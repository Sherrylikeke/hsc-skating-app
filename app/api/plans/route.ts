import {db,readLiveEvent,profiles} from '../../../lib/club-store';
import {scheduleRows} from '../../../lib/official-parser';
import {requestMember} from '../../../lib/member-runtime';
import {assertSkater,audit,checkWrite,failure} from '../../../lib/member-access';
export async function POST(request:Request){
  let member;
  try{member=await requestMember(request,['admin','coach']);checkWrite(request);}catch(error){return failure(error);}
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'请求来源无效'},{status:403});
  try{
    const body=await request.json() as {skaterId:string;eventId:string;slotKey:string;meetingTime:string;note:string;revision:number};
    await assertSkater(db(),member,body.skaterId,true);
    if(!(await profiles()).some(row=>row.id===body.skaterId)||typeof body.eventId!=='string'||typeof body.note!=='string'||body.note.length>1500||typeof body.meetingTime!=='string'||(body.meetingTime!==''&&!/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(body.meetingTime))||!Number.isSafeInteger(body.revision)||body.revision<0)return Response.json({error:'安排信息格式无效'},{status:400});
    const event=await readLiveEvent(body.eventId);if(!event)return Response.json({error:'比赛不存在'},{status:404});
    if(typeof body.slotKey!=='string'||body.slotKey.length>350||!scheduleRows([event],await profiles()).some(row=>row.skaterId===body.skaterId&&row.slotKey===body.slotKey))return Response.json({error:'赛程分项已变更，请刷新后核对'},{status:409});
    const id=`${body.eventId}|${body.skaterId}|${body.slotKey}`;
    const results=await db().batch([db().prepare('INSERT INTO coach_plans (id,skater_id,event_id,meeting_time,note,revision) VALUES (?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET meeting_time=excluded.meeting_time,note=excluded.note,revision=coach_plans.revision+1 WHERE coach_plans.revision = ? RETURNING id,skater_id AS skaterId,event_id AS eventId,meeting_time AS meetingTime,note,revision').bind(id,body.skaterId,body.eventId,body.meetingTime,body.note,body.revision),audit(db(),member.id,'plan-write',id,body)]);
    const row=results[0].results[0];
    if(!row)return Response.json({error:'其他页面已更新安排，请刷新后重试'},{status:409});
    return Response.json({plan:{...row,slotKey:body.slotKey}});
  }catch(error){return failure(error);}
}
