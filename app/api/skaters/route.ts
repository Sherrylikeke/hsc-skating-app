import {canonicalCoachList} from '../../../lib/coach-names';
import {db,profiles} from '../../../lib/club-store';
import {requestMember} from '../../../lib/member-runtime';
import {AccessError,bodyJSON,failure,json,rateLimit,stringField} from '../../../lib/member-access';

export const dynamic='force-dynamic';
type Admission={payload:string;admitted:number;updated_at:string};
const normalized=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
async function versions(id:string){
  const database=db();
  const [profile,coach]=await Promise.all([
    database.prepare('SELECT payload,admitted,updated_at FROM hsc_admissions WHERE skater_id=?').bind(id).first<Admission>(),
    database.prepare('SELECT coach,revision FROM coach_assignments WHERE skater_id=?').bind(id).first<{coach:string;revision:number}>(),
  ]);
  return {profile,coach};
}
export async function GET(request:Request){
  try{
    await requestMember(request,['admin']);
    const id=new URL(request.url).searchParams.get('id');
    const skater=(await profiles()).find(row=>row.id===id);
    if(!skater)throw new AccessError(404,'Skater not found.');
    const {profile,coach}=await versions(skater.id);
    const latest=profile?JSON.parse(profile.payload):{};
    return json({skater:{...skater,...(profile?{name:latest.name,training:latest.training,identityPending:latest.identityPending}:{}),coach:canonicalCoachList(coach?.coach??skater.coach),profileRevision:profile?.updated_at??null,coachRevision:coach?.revision??0}});
  }catch(error){return failure(error);}
}
export async function POST(request:Request){
  try{
    const member=await requestMember(request,['admin']);
    const body=await bodyJSON(request),database=db();
    await rateLimit(database,'skater-write:'+member.id,80);
    const creating=body.id===undefined;
    const id=creating?'HSC-NEW-'+crypto.randomUUID():stringField(body.id,100);
    const all=await profiles(),previous=all.find(row=>row.id===id);
    if(!creating&&!previous)throw new AccessError(404,'Skater not found. Reload the list before editing.');
    const name=stringField(body.name,120),coach=canonicalCoachList(stringField(body.coach,500,true));
    if(/[\r\n\t\x00-\x1f]/.test(name)||/[\r\n\t\x00-\x1f]/.test(coach)||typeof body.training!=='boolean'||typeof body.identityPending!=='boolean')throw new AccessError(400,'Check the skater name, coach and profile fields.');
    if(all.some(row=>row.id!==id&&normalized(row.name)===normalized(name)))throw new AccessError(409,'A skater with this name already exists. Edit the existing profile.');
    const current=await versions(id);
    if(!Number.isSafeInteger(body.coachRevision)||body.coachRevision!==(current.coach?.revision??0)||body.profileRevision!==(current.profile?.updated_at??null))throw new AccessError(409,'This skater was updated elsewhere. Reload the profile before saving.');
    const before=current.profile?JSON.parse(current.profile.payload):{};
    // Retain admission and official-club overrides. Editing a roster never grants account access.
    const payload={...before,name,normalizedName:normalized(name),training:body.training,identityPending:body.identityPending};
    const now=new Date().toISOString(),operation=crypto.randomUUID();
    const gate='EXISTS (SELECT 1 FROM hsc_audit WHERE id=?)';
    const results=await database.batch([
      database.prepare(`INSERT INTO hsc_audit (id,actor_id,action,subject_id,payload,created_at)
        SELECT ?,?,'skater-save',?,?,? WHERE
        (? IS NULL AND NOT EXISTS (SELECT 1 FROM hsc_admissions WHERE skater_id=?) OR EXISTS (SELECT 1 FROM hsc_admissions WHERE skater_id=? AND updated_at=?))
        AND COALESCE((SELECT revision FROM coach_assignments WHERE skater_id=?),0)=?
        AND NOT EXISTS (SELECT 1 FROM hsc_admissions WHERE skater_id<>? AND COALESCE(json_extract(payload,'$.normalizedName'),lower(trim(json_extract(payload,'$.name'))))=?)`)
        .bind(operation,member.id,id,JSON.stringify({before:previous??null,after:{...payload,coach},admitted:current.profile?.admitted??0}),now,body.profileRevision,id,id,body.profileRevision,id,body.coachRevision,id,normalized(name)),
      database.prepare(`INSERT INTO hsc_admissions (skater_id,admitted,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE ${gate} ON CONFLICT(skater_id) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
        .bind(id,current.profile?.admitted??0,JSON.stringify(payload),member.id,now,operation),
      database.prepare(`INSERT INTO coach_assignments (skater_id,coach,revision,updated_at) SELECT ?,?,1,? WHERE ${gate} ON CONFLICT(skater_id) DO UPDATE SET coach=excluded.coach,revision=coach_assignments.revision+1,updated_at=excluded.updated_at`)
        .bind(id,coach,now,operation),
    ]);
    if(!results[0].meta.changes)throw new AccessError(409,'The profile changed or this name already exists. Reload before saving.');
    return json({skater:{...(await profiles()).find(row=>row.id===id)!,profileRevision:now,coachRevision:(current.coach?.revision??0)+1}},creating?201:200);
  }catch(error){return failure(error);}
}
