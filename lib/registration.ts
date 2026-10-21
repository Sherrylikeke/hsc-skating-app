import {AccessError, audit, nowISO, rateLimit} from './member-access';

export type Registration = {role:'skater'|'parent'|'coach';skaterId:string;skaterName:string};
const normalizedName=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
export async function registrationEligibility(database:D1Database,body:Record<string,unknown>,address:string):Promise<Registration> {
  await rateLimit(database,'registration:'+address,8,3600000);
  if(!['skater','parent','coach'].includes(String(body.role)))throw new AccessError(400,'Choose Skater, Parent or Coach.');
  if(typeof body.skaterName!=='string'||!body.skaterName.trim()||body.skaterName.length>120)throw new AccessError(400,"Enter the club skater's full name.");
  const {results}=await database.prepare('SELECT skater_id,payload FROM hsc_admissions WHERE admitted=1').all<{skater_id:string;payload:string}>();
  const matches=results.flatMap(row=>{
    const profile=JSON.parse(row.payload) as {name:string;training?:boolean;identityPending?:boolean};
    return profile.training===true&&!profile.identityPending&&normalizedName(profile.name)===normalizedName(body.skaterName as string)?[{id:row.skater_id,name:profile.name}]:[];
  });
  if(matches.length!==1)throw new AccessError(403,'Registration requires a uniquely matched, administrator-approved HSC skater. Contact the club if the name is missing or ambiguous.');
  return {role:body.role as Registration['role'],skaterId:matches[0].id,skaterName:matches[0].name};
}
export async function recordRegistration(database:D1Database,user:{id:string;email:string;name:string},registration:Registration) {
  const memberId='password:'+user.id,time=nowISO(),claimId=crypto.randomUUID();
  await database.batch([
    database.prepare("INSERT INTO hsc_members (id,email,name,requested_role,status,created_at) VALUES (?,?,?,?,'pending',?) ON CONFLICT(id) DO NOTHING").bind(memberId,user.email.toLowerCase(),user.name,registration.role,time),
    database.prepare("INSERT INTO hsc_claims (id,member_id,kind,payload,status,created_at) VALUES (?,?,'membership',?,'pending',?)").bind(claimId,memberId,JSON.stringify({role:registration.role,skaterIds:[registration.skaterId],name:registration.skaterName,note:'Registration roster match only; identity and relationship require administrator verification.'}),time),
    audit(database,memberId,'registration-request',claimId,{role:registration.role,skaterId:registration.skaterId}),
  ]);
}
