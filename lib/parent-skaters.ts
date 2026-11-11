import {AccessError,accessibleSkaters,json,nowISO,requireRole,scheduleSkaterIds,stringField} from './member-access';
import type {Candidate,Member} from './member-access';
import {isParentAccount,PARENT_SKATER_LIMIT} from './parent-skater-policy';
import {splitCoaches} from './club-types';
import {coachKey} from './coach-identity';

export async function coachNames(database:D1Database){
  const [{results},{results:registered},{results:chosen}]=await Promise.all([
    database.prepare("SELECT coach FROM coach_assignments WHERE coach<>''").all<{coach:string}>(),
    database.prepare("SELECT json_extract(payload,'$.coachName') AS name FROM hsc_claims WHERE kind='membership' AND json_valid(payload) AND json_extract(payload,'$.role')='coach' AND typeof(json_extract(payload,'$.coachName'))='text'").all<{name:string}>(),
    database.prepare("SELECT value AS name FROM app_meta WHERE key LIKE 'schedule-coach:%'").all<{name:string}>(),
  ]);
  return [...new Set([...results.flatMap(row=>splitCoaches(row.coach)),...registered.map(row=>row.name),...chosen.map(row=>row.name)].filter(name=>name.length>0&&name.length<=120))].sort();
}
export async function homeRevision(database:D1Database,memberId:string){return (await database.prepare('SELECT MAX(updated_at) AS revision FROM hsc_home_skaters WHERE member_id=?').bind(memberId).first<{revision:string|null}>())?.revision??null;}
export async function saveHomeSkater(database:D1Database,member:Member,body:Record<string,unknown>,candidates:Candidate[]){
  if(!['active','club-viewer'].includes(member.status))throw new AccessError(403,'Sign in to manage your skater homepage.');
  const id=stringField(body.skaterId,100),replace=body.replaceSkaterId===undefined?'':stringField(body.replaceSkaterId,100);
  if(typeof body.pinned!=='boolean'||!candidates.some(candidate=>candidate.id===id)||replace&&!body.pinned)throw new AccessError(400,'Choose a skater on the club list.');
  const revision=await homeRevision(database,member.id),before=await scheduleSkaterIds(database,member);
  if(replace&&(!before.includes(replace)||replace===id||before.includes(id)))throw new AccessError(409,'Choose a current skater to replace and a different listed skater.');
  const after=body.pinned?[...new Set([...before.filter(value=>value!==replace),id])]:before.filter(value=>value!==id);
  if(isParentAccount(member)&&after.length>PARENT_SKATER_LIMIT&&after.length>before.length)throw new AccessError(400,'A parent can add up to 4 skaters. Replace or remove a skater first. / 家长最多添加4位选手，请先更换或移除。');
  const operation=crypto.randomUUID(),time=new Date(Math.max(Date.now(),(Date.parse(revision??'')||0)+1)).toISOString(),gate='EXISTS(SELECT 1 FROM hsc_audit WHERE id=?)';
  const statements=[database.prepare("INSERT INTO hsc_audit(id,actor_id,action,subject_id,payload,created_at) SELECT ?,?,'home-skater',?,?,? WHERE COALESCE((SELECT MAX(updated_at) FROM hsc_home_skaters WHERE member_id=?),'')=? AND EXISTS(SELECT 1 FROM hsc_members WHERE id=? AND auth_version=? AND status IN ('active','club-viewer'))")
    .bind(operation,member.id,id,JSON.stringify({pinned:body.pinned,replaceSkaterId:replace||undefined}),time,member.id,revision??'',member.id,member.auth_version)];
  for(const [skaterId,pinned] of [[id,Number(body.pinned)],...(replace?[[replace,0]]:[])] as [string,number][])statements.push(database.prepare(`INSERT INTO hsc_home_skaters(id,member_id,skater_id,pinned,updated_at) SELECT ?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET pinned=excluded.pinned,updated_at=excluded.updated_at`).bind(JSON.stringify([member.id,skaterId]),member.id,skaterId,pinned,time,operation));
  const results=await database.batch(statements);if(!results[0].meta.changes)throw new AccessError(409,'Your skater list changed. Refresh before trying again. / 选手列表已变更，请刷新后重试。');
  return json({preferredSkaterIds:await scheduleSkaterIds(database,member)});
}
async function parentChild(database:D1Database,member:Member,id:string,candidates:Candidate[]){
  requireRole(member,'parent');
  const candidate=candidates.find(candidate=>candidate.id===id);
  if(!candidate||!(await accessibleSkaters(database,member)).includes(id)||!(await scheduleSkaterIds(database,member)).includes(id))throw new AccessError(403,'Coach editing requires an administrator-approved parent–skater relationship. / 编辑教练需要管理员核实亲子关系。');
  return candidate;
}
export async function parentCoach(database:D1Database,member:Member,id:string,candidates:Candidate[]){
  const child=await parentChild(database,member,id,candidates);
  const row=await database.prepare('SELECT coach,revision FROM coach_assignments WHERE skater_id=?').bind(id).first<{coach:string;revision:number}>();
  return json({skater:{id,name:child.name,coach:row?.coach??child.coach??'',revision:row?.revision??0},names:await coachNames(database)});
}
export async function saveParentCoach(database:D1Database,member:Member,body:Record<string,unknown>,candidates:Candidate[]){
  const id=stringField(body.skaterId,100),home=await homeRevision(database,member.id);
  await parentChild(database,member,id,candidates);
  if(typeof body.coach!=='string'||body.coach.length>500||/[\x00-\x1f]/.test(body.coach)||!Number.isSafeInteger(body.revision)||Number(body.revision)<0)throw new AccessError(400,'Enter valid coach names.');
  const choices=await coachNames(database);
  if(splitCoaches(body.coach).some(name=>!choices.some(choice=>coachKey(choice)===coachKey(name))))throw new AccessError(400,'Choose coach names from the dropdown. / 请从下拉列表选择教练。');
  const operation=crypto.randomUUID(),time=nowISO(),gate='EXISTS(SELECT 1 FROM hsc_audit WHERE id=?)';
  const results=await database.batch([
    database.prepare("INSERT INTO hsc_audit(id,actor_id,action,subject_id,payload,created_at) SELECT ?,?,'parent-coach-update',?,?,? WHERE COALESCE((SELECT revision FROM coach_assignments WHERE skater_id=?),0)=? AND COALESCE((SELECT MAX(updated_at) FROM hsc_home_skaters WHERE member_id=?),'')=? AND EXISTS(SELECT 1 FROM hsc_members WHERE id=? AND role='parent' AND status='active' AND auth_version=?) AND EXISTS(SELECT 1 FROM hsc_relations r JOIN hsc_admissions a ON a.skater_id=r.skater_id AND a.admitted=1 WHERE r.member_id=? AND r.skater_id=? AND r.kind='parent' AND r.active=1)")
      .bind(operation,member.id,id,JSON.stringify({coach:body.coach}),time,id,body.revision,member.id,home??'',member.id,member.auth_version,member.id,id),
    database.prepare(`INSERT INTO coach_assignments(skater_id,coach,revision,updated_at) SELECT ?,?,1,? WHERE ${gate} ON CONFLICT(skater_id) DO UPDATE SET coach=excluded.coach,revision=coach_assignments.revision+1,updated_at=excluded.updated_at`).bind(id,body.coach.trim(),time,operation),
  ]);
  if(!results[0].meta.changes)throw new AccessError(409,'The coach details or your access changed. Reload before saving. / 教练资料或权限已变更，请重新读取。');
  return json({ok:true,coach:body.coach.trim(),revision:Number(body.revision)+1});
}
