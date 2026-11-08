import {scheduleInstant} from './schedule-time.ts';
import type {ClubSkater, LiveEvent} from './club-types.ts';
import {scheduleRows} from './official-parser.ts';
import {AccessError, accessibleSkaters, admittedIDs, assertSkater, audit, nowISO, stringField} from './member-access.ts';
import type {Member} from './member-access.ts';

type Rule = {id:string;member_id:string;skater_id:string;arrival_minutes:number;notify_minutes:number;packing:string;enabled:number;revision:number};
export type ReminderPlan = {id:string;ruleId:string;memberId:string;skaterId:string;eventId:string;eventName:string;category:string;startAt:string;arrivalAt:string;notifyAt:string;packing:string;timezone:string;source:string;basis:string};
export function reminderPlans(events:LiveEvent[],rules:Rule[],time=Date.now()):ReminderPlan[] {
  const skaters=[...new Set(rules.map(rule=>rule.skater_id))].map(id=>({id,name:id,coach:''} as ClubSkater));
  const rows=scheduleRows(events,skaters).filter(row=>!row.uncertain);
  const output:ReminderPlan[]=[];
  for (const rule of rules.filter(item=>item.enabled)) for (const row of rows.filter(item=>item.skaterId===rule.skater_id)) {
    const start=scheduleInstant(row.date,row.start,row.timezone);
    if (start===null || start<=time) continue;
    const notify=start-rule.notify_minutes*60000;
    if (notify<time-3600000) continue;
    output.push({id:`reminder|${rule.id}|${rule.revision}|${row.eventId}|${row.slotKey}|${start}`,ruleId:rule.id,memberId:rule.member_id,skaterId:row.skaterId,eventId:row.eventId,eventName:row.eventName,category:row.category,startAt:new Date(start).toISOString(),arrivalAt:new Date(start-rule.arrival_minutes*60000).toISOString(),notifyAt:new Date(notify).toISOString(),packing:rule.packing,timezone:row.timezone,source:row.sourceUrl,basis:'official-group-start'});
  }
  return output;
}
async function currentPlans(database:D1Database) {
  const [{results:events},{results:rules}]=await Promise.all([
    database.prepare('SELECT payload FROM live_events').all<{payload:string}>(),
    database.prepare("SELECT r.* FROM hsc_reminder_rules r JOIN hsc_members m ON m.id=r.member_id AND m.status='active' WHERE r.enabled=1 AND EXISTS (SELECT 1 FROM hsc_admissions a WHERE a.skater_id=r.skater_id AND a.admitted=1) AND (m.role='admin' OR EXISTS (SELECT 1 FROM hsc_relations link WHERE link.member_id=m.id AND link.kind=m.role AND link.skater_id=r.skater_id AND link.active=1))").all<Rule>(),
  ]);
  return reminderPlans(events.map(row=>JSON.parse(row.payload)),rules);
}
export async function reconcileReminders(database:D1Database) {
  const plans=await currentPlans(database),time=nowISO();
  const statements=[database.prepare("UPDATE hsc_outbox SET state='cancelled',lease_until=NULL WHERE kind='reminder' AND state IN ('pending','processing') AND id NOT IN (SELECT value FROM json_each(?))").bind(JSON.stringify(plans.map(plan=>plan.id)))];
  for (const plan of plans) statements.push(database.prepare("INSERT INTO hsc_outbox (id,kind,subject_id,skater_id,author_id,payload,available_at,created_at) VALUES (?,'reminder',?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET state='pending',available_at=excluded.available_at WHERE hsc_outbox.state='cancelled'").bind(plan.id,plan.ruleId,plan.skaterId,plan.memberId,JSON.stringify(plan),plan.notifyAt,time));
  for(let offset=0;offset<statements.length;offset+=40)await database.batch(statements.slice(offset,offset+40));
  return plans;
}
export async function reminderIsCurrent(database:D1Database,id:string) {
  return (await currentPlans(database)).some(plan=>plan.id===id);
}
export async function listReminders(database:D1Database,member:Member) {
  const scope=await accessibleSkaters(database,member);
  const {results}=await database.prepare('SELECT * FROM hsc_reminder_rules WHERE member_id=?').bind(member.id).all<Rule>();
  const rules=results.filter(rule=>member.role==='admin'||scope.includes(rule.skater_id));
  const plans=(await reconcileReminders(database)).filter(plan=>plan.memberId===member.id);
  return {rules,plans,channel:'in-app',syncIntervalMinutes:60};
}
export async function saveReminder(database:D1Database,member:Member,body:Record<string,unknown>) {
  const skaterId=stringField(body.skaterId,100);
  await assertSkater(database,member,skaterId);
  const arrival=Number(body.arrivalMinutes),notify=Number(body.notifyMinutes);
  if (!Number.isInteger(arrival)||arrival<60||arrival>1440||!Number.isInteger(notify)||notify<arrival+60||notify>10080) throw new AccessError(400,'Arrive at least 60 minutes early. Send the reminder at least 60 minutes before arrival.');
  const packing=stringField(body.packing,2000),id=member.id+'|'+skaterId;
  await admittedIDs(database,[skaterId]);
  await database.batch([
    database.prepare('INSERT INTO hsc_reminder_rules (id,member_id,skater_id,arrival_minutes,notify_minutes,packing,enabled,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET arrival_minutes=excluded.arrival_minutes,notify_minutes=excluded.notify_minutes,packing=excluded.packing,enabled=excluded.enabled,revision=revision+1,updated_at=excluded.updated_at').bind(id,member.id,skaterId,arrival,notify,packing,body.enabled===false?0:1,nowISO()),
    audit(database,member.id,'reminder-rule',skaterId,{arrivalMinutes:arrival,notifyMinutes:notify,enabled:body.enabled!==false}),
  ]);
  return listReminders(database,member);
}
