import {AccessError, audit, nowISO, rateLimit} from './member-access';
import roster from '../data/roster.json';

export type Registration = {role:'skater'|'parent'|'coach';skaterIds:string[];skaterName:string};
const normalizedName=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
export async function registrationEligibility(database:D1Database,body:Record<string,unknown>,address:string):Promise<Registration> {
  await rateLimit(database,'registration:'+address,8,3600000);
  if(!['skater','parent','coach'].includes(String(body.role)))throw new AccessError(400,'Choose Skater, Parent or Coach.');
  if(typeof body.skaterName!=='string'||!body.skaterName.trim()||body.skaterName.length>120)throw new AccessError(400,"Enter the club skater's full name.");
  const {results}=await database.prepare('SELECT skater_id,payload FROM hsc_admissions').all<{skater_id:string;payload:string}>();
  const names=new Map(roster.map(skater=>[skater.id,skater.name]));
  for(const row of results){const profile=JSON.parse(row.payload) as {name:string};names.set(row.skater_id,profile.name);}
  const matches=[...names].filter(([,name])=>normalizedName(name)===normalizedName(body.skaterName as string));
  if(!matches.length)throw new AccessError(403,'This skater name is not on the club list. Check the spelling or contact the club.');
  return {role:body.role as Registration['role'],skaterIds:matches.map(([id])=>id),skaterName:matches[0][1]};
}
export async function recordRegistration(database:D1Database,user:{id:string;email:string;name:string},registration:Registration) {
  const memberId='password:'+user.id,time=nowISO(),claimId=crypto.randomUUID();
  await database.batch([
    database.prepare("INSERT INTO hsc_members (id,email,name,requested_role,status,created_at) VALUES (?,?,?,?,'club-viewer',?) ON CONFLICT(id) DO NOTHING").bind(memberId,user.email.toLowerCase(),user.name,registration.role,time),
    database.prepare("INSERT INTO hsc_claims (id,member_id,kind,payload,status,created_at) VALUES (?,?,'membership',?,'pending',?)").bind(claimId,memberId,JSON.stringify({role:registration.role,skaterIds:registration.skaterIds,name:registration.skaterName,note:'Name-list match enables shared official schedules only. Pinned names are preferences, not verified identity or private relationships.'}),time),
    audit(database,memberId,'registration-request',claimId,{role:registration.role,skaterIds:registration.skaterIds,access:'shared-schedules'}),
  ]);
}
