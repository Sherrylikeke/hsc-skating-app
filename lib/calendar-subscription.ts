import {AccessError,digest,nowISO,randomToken,scheduleSkaterIds} from './member-access';
import type {Member} from './member-access';
import {isRegisteredPilot} from './pilot-registration';
import {legacyVerificationAccess} from './legacy-verification';
import {scheduleRows} from './official-parser';
import type {ClubSkater,LiveEvent} from './club-types';
import {calendarExport} from './calendar-export';

type Subscription={member_id:string;hash:string;auth_version:number;created_at:string;updated_at:string};
export type CalendarSubscriptionStatus={active:boolean;createdAt?:string;updatedAt?:string};
export type CalendarVerification={required:boolean;graceUsers?:string};

export async function calendarSubscriptionStatus(database:D1Database,member:Member):Promise<CalendarSubscriptionStatus> {
  const subscription=await database.prepare('SELECT * FROM hsc_calendar_subscriptions WHERE member_id=? AND auth_version=?').bind(member.id,member.auth_version).first<Subscription>();
  return subscription?{active:true,createdAt:subscription.created_at,updatedAt:subscription.updated_at}:{active:false};
}

export async function updateCalendarSubscription(database:D1Database,member:Member,action:unknown):Promise<CalendarSubscriptionStatus&{token?:string}> {
  if(!['create','replace','revoke'].includes(String(action)))throw new AccessError(400,'请选择创建、更换或撤销订阅');
  if(action==='revoke'){
    await database.prepare('DELETE FROM hsc_calendar_subscriptions WHERE member_id=?').bind(member.id).run();
    return {active:false};
  }
  if(action==='create'&&(await calendarSubscriptionStatus(database,member)).active)throw new AccessError(409,'订阅已存在；如需新网址，请更换订阅');
  const token=randomToken(),time=nowISO();
  await database.prepare('INSERT INTO hsc_calendar_subscriptions (member_id,hash,auth_version,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET hash=excluded.hash,auth_version=excluded.auth_version,created_at=excluded.created_at,updated_at=excluded.updated_at').bind(member.id,await digest(token),member.auth_version,time,time).run();
  return {active:true,createdAt:time,updatedAt:time,token};
}

// This capability authorizes only the official calendar feed. It never becomes
// a session, private skater relation, or authorization for any membership API.
export async function calendarFeedMember(database:D1Database,token:string,verification:CalendarVerification):Promise<Member|null> {
  if(!/^[a-f0-9]{64}$/.test(token))return null;
  const member=await database.prepare("SELECT m.* FROM hsc_calendar_subscriptions s JOIN hsc_members m ON m.id=s.member_id AND m.auth_version=s.auth_version WHERE s.hash=? AND (m.status='club-viewer' OR (m.status='active' AND m.role IN ('admin','parent','skater','coach')))").bind(await digest(token)).first<Member>();
  if(!member)return null;
  const authUser=await database.prepare("SELECT u.id,u.email,u.email_verified FROM hsc_auth_user u LEFT JOIN hsc_auth_links l ON l.auth_user_id=u.id WHERE l.member_id=? OR ?='password:'||u.id LIMIT 1").bind(member.id,member.id).first<{id:string;email:string;email_verified:number}>();
  if(!authUser)return member.id.startsWith('password:')?null:member;
  if(authUser.email.toLowerCase()!==member.email.toLowerCase())return null;
  if(!authUser.email_verified&&member.role!=='admin'){
    const grace=legacyVerificationAccess(verification.graceUsers,authUser.id);
    if(verification.required&&!grace&&!await isRegisteredPilot(database,authUser.id))return null;
    if(member.status==='active')return grace?{...member,status:'club-viewer',role:null}:null;
  }
  return member;
}

export async function subscribedCalendar(database:D1Database,member:Member,events:LiveEvent[],skaters:ClubSkater[],now=Date.now()) {
  const ids=new Set(await scheduleSkaterIds(database,member));
  // Always re-read current server-side My Skaters. Browser friend selections,
  // private notes, and coach plans do not participate in this data path.
  return calendarExport(scheduleRows(events,skaters.filter(skater=>ids.has(skater.id))),now,{subscription:true});
}
