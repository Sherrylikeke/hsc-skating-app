import {AccessError,json,nowISO,stringField} from './member-access';
import type {Candidate,Member} from './member-access';
import {coachNames} from './parent-skaters';
import {assignedToCoach,coachKey,isScheduleCoach} from './coach-identity';
const profileKey=(id:string)=>'schedule-coach:'+id;
export async function scheduleCoachProfile(database:D1Database,member:Member){
  if(!isScheduleCoach(member))return {name:'',names:[] as string[]};
  const names=await coachNames(database),saved=await database.prepare('SELECT value FROM app_meta WHERE key=?').bind(profileKey(member.id)).first<{value:string}>();
  const claim=await database.prepare("SELECT payload FROM hsc_claims WHERE member_id=? AND kind='membership' ORDER BY created_at DESC LIMIT 1").bind(member.id).first<{payload:string}>();
  const requested=claim?JSON.parse(claim.payload).coachName:'',chosen=saved?.value||requested||member.name;
  return {name:names.find(name=>coachKey(name)===coachKey(chosen))??'',names};
}
export async function saveCoachProfile(database:D1Database,member:Member,body:Record<string,unknown>){
  if(!isScheduleCoach(member))throw new AccessError(403,'Sign in as a coach.');
  const profile=await scheduleCoachProfile(database,member),name=stringField(body.coachName,120),canonical=profile.names.find(value=>coachKey(value)===coachKey(name));
  if(!canonical)throw new AccessError(400,'Choose your coach name from the list.');
  if(profile.name&&coachKey(profile.name)!==coachKey(canonical))throw new AccessError(403,'Ask the administrator to correct your registered coach name.');
  await database.batch([database.prepare('INSERT INTO app_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(profileKey(member.id),canonical),database.prepare("INSERT INTO hsc_audit(id,actor_id,action,subject_id,payload,created_at) VALUES (?,?,'schedule-coach-name',?,?,?)").bind(crypto.randomUUID(),member.id,member.id,JSON.stringify({name:canonical,access:'shared-schedules-only'}),nowISO())]);
  return json({name:canonical,names:profile.names});
}
export async function selfCoachAssignment(database:D1Database,member:Member,body:Record<string,unknown>,candidates:Candidate[]){
  if(!isScheduleCoach(member))throw new AccessError(403,'Sign in as a coach.');
  const profile=await scheduleCoachProfile(database,member),id=stringField(body.skaterId,100);
  if(!profile.name||body.coachName!==profile.name||!candidates.some(candidate=>candidate.id===id))throw new AccessError(400,'Choose your own coach name and a listed skater.');
  const row=await database.prepare('SELECT coach,revision FROM coach_assignments WHERE skater_id=?').bind(id).first<{coach:string;revision:number}>();
  if(body.revision!==undefined&&body.revision!==(row?.revision??0))throw new AccessError(409,'Coach assignments changed. Reload before saving.');
  const before=row?.coach??candidates.find(candidate=>candidate.id===id)?.coach??'';
  if(assignedToCoach(before,profile.name))return json({coach:before,revision:row?.revision??0});
  const after=[before.trim(),profile.name].filter(Boolean).join('/'),operation=crypto.randomUUID(),time=nowISO(),gate='EXISTS(SELECT 1 FROM hsc_audit WHERE id=?)';
  if(after.length>500)throw new AccessError(400,'The coach list is full. Ask the administrator to review it.');
  const results=await database.batch([
    database.prepare("INSERT INTO hsc_audit(id,actor_id,action,subject_id,payload,created_at) SELECT ?,?,'coach-self-assign',?,?,? WHERE COALESCE((SELECT revision FROM coach_assignments WHERE skater_id=?),0)=? AND EXISTS(SELECT 1 FROM hsc_members WHERE id=? AND auth_version=? AND status IN ('active','club-viewer') AND (role='coach' OR role IS NULL AND requested_role='coach'))")
      .bind(operation,member.id,id,JSON.stringify({before,after,access:'shared-schedules-only'}),time,id,row?.revision??0,member.id,member.auth_version),
    database.prepare(`INSERT INTO coach_assignments(skater_id,coach,revision,updated_at) SELECT ?,?,1,? WHERE ${gate} ON CONFLICT(skater_id) DO UPDATE SET coach=excluded.coach,revision=coach_assignments.revision+1,updated_at=excluded.updated_at`).bind(id,after,time,operation),
  ]);
  if(!results[0].meta.changes)throw new AccessError(409,'Coach assignments changed. Reload before saving.');
  return json({coach:after,revision:(row?.revision??0)+1});
}
