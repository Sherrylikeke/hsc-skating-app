import type {ClubSkater,LiveEvent} from './club-types';
import {todayToronto} from './club-types';
import {AccessError,nowISO,scheduleSkaterIds,stringField} from './member-access';
import type {Member} from './member-access';
import {isRegistrationStatus} from './registration-board';
import type {RegistrationPlan} from './registration-board';

export async function memberRegistrations(database:D1Database,member:Member,today=todayToronto()):Promise<RegistrationPlan[]> {
  const ids=await scheduleSkaterIds(database,member);
  if(!ids.length)return [];
  const {results}=await database.prepare(`SELECT p.skater_id AS skaterId,p.event_id AS eventId,p.status,p.updated_at AS updatedAt
    FROM hsc_registration_plans p JOIN live_events e ON e.id=p.event_id
    WHERE p.member_id=? AND p.skater_id IN (SELECT value FROM json_each(?))
      AND COALESCE(NULLIF(json_extract(e.payload,'$.end'),''),json_extract(e.payload,'$.start'))>=?
    ORDER BY p.updated_at DESC,p.event_id,p.skater_id`).bind(member.id,JSON.stringify(ids),today).all<RegistrationPlan>();
  return results;
}

export async function saveMemberRegistration(database:D1Database,member:Member,body:Record<string,unknown>,skaters:Pick<ClubSkater,'id'>[],today=todayToronto()):Promise<RegistrationPlan|null> {
  const skaterId=stringField(body.skaterId,100),eventId=stringField(body.eventId,100);
  if(body.status!==null&&!isRegistrationStatus(body.status))throw new AccessError(400,'请选择有效的个人报名状态');
  if(!skaters.some(skater=>skater.id===skaterId)||!(await scheduleSkaterIds(database,member)).includes(skaterId))throw new AccessError(403,'请先将该选手加入 My Skaters');
  const row=await database.prepare('SELECT payload FROM live_events WHERE id=?').bind(eventId).first<{payload:string}>();
  if(!row)throw new AccessError(404,'赛事不存在，请刷新赛事列表');
  const event=JSON.parse(row.payload) as LiveEvent;
  if((event.end||event.start)<today)throw new AccessError(400,'只能记录当前或未来赛事的个人报名计划');
  if(body.status===null){
    await database.prepare('DELETE FROM hsc_registration_plans WHERE member_id=? AND skater_id=? AND event_id=?').bind(member.id,skaterId,eventId).run();
    return null;
  }
  const plan:RegistrationPlan={skaterId,eventId,status:body.status,updatedAt:nowISO()};
  await database.prepare(`INSERT INTO hsc_registration_plans(id,member_id,skater_id,event_id,status,updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(member_id,skater_id,event_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`)
    .bind(JSON.stringify([member.id,skaterId,eventId]),member.id,skaterId,eventId,plan.status,plan.updatedAt).run();
  return plan;
}
