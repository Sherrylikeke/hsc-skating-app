import {scheduleRows} from './official-parser.ts';
import {AccessError,nowISO,scheduleSkaterIds} from './member-access.ts';
import type {Member} from './member-access.ts';
import type {LiveEvent} from './club-types.ts';

export type OfficialUpdate={changeId:string;eventId:string;eventName:string;skaterName:string;source:string;checkedAt:string;entryChanged:boolean;scheduleChanged:boolean;removed:boolean;categories:string[];sessions:Array<{date:string;start:string;end:string;rink:string;category:string}>};
export type OfficialNotice={id:string;skater_id:string;read_at:string|null;created_at:string;payload:OfficialUpdate};
export function officialUpdate(event:LiveEvent,previous:LiveEvent|null,skaterId:string,changeId:string):OfficialUpdate{
  const entries=(source:LiveEvent|null)=>source?.participants.filter(p=>p.skaterIds.includes(skaterId)).map(({name,category})=>({name,category})).sort((a,b)=>a.category.localeCompare(b.category))||[];
  const after=entries(event),before=entries(previous),name=after[0]?.name||before[0]?.name||event.startingOrders?.find(o=>o.skaterIds.includes(skaterId))?.name||'';
  const sessions=(source:LiveEvent|null)=>source?scheduleRows([{...source,participants:source.participants.filter(entry=>entry.skaterIds.includes(skaterId))}],[{id:skaterId,name,coach:''}]).filter(row=>!row.uncertain).map(({date,start,end,rink,category})=>({date,start,end,rink,category})):[];
  const current=sessions(event);
  return {changeId,eventId:event.id,eventName:event.name,skaterName:name,source:event.url,checkedAt:event.detailCheckedAt||event.checkedAt,entryChanged:JSON.stringify(after)!==JSON.stringify(before),scheduleChanged:JSON.stringify(current)!==JSON.stringify(sessions(previous)),removed:!after.length&&!event.startingOrders?.some(o=>o.skaterIds.includes(skaterId)),categories:after.map(e=>e.category),sessions:current};
}
export async function officialRecipientMap(database:D1Database){
  const {results}=await database.prepare("SELECT * FROM hsc_members WHERE status IN ('active','club-viewer')").all<Member>();
  const map=new Map<string,Array<{id:string}>>();
  for(const member of results)for(const id of await scheduleSkaterIds(database,member)){const recipients=map.get(id)||[];recipients.push({id:member.id});map.set(id,recipients);}
  return map;
}
function requireScheduleAccount(member:Member){if(!['active','club-viewer'].includes(member.status))throw new AccessError(403,'请先完成账号验证');}
export async function listOfficialNotices(database:D1Database,member:Member):Promise<OfficialNotice[]>{
  requireScheduleAccount(member);
  const ids=await scheduleSkaterIds(database,member);if(!ids.length)return [];
  const {results}=await database.prepare("SELECT id,skater_id,read_at,created_at,payload FROM hsc_notifications WHERE member_id=? AND kind='official-update' AND skater_id IN (SELECT value FROM json_each(?)) ORDER BY created_at DESC,id DESC LIMIT 100").bind(member.id,JSON.stringify(ids)).all<Omit<OfficialNotice,'payload'>&{payload:string}>();
  return results.map(row=>({...row,payload:JSON.parse(row.payload) as OfficialUpdate}));
}
export async function readOfficialNotice(database:D1Database,member:Member,id:string){
  const notice=(await listOfficialNotices(database,member)).find(row=>row.id===id);if(!notice)throw new AccessError(404,'通知不存在或已不在我的选手范围');
  await database.prepare("UPDATE hsc_notifications SET read_at=COALESCE(read_at,?) WHERE member_id=? AND (id=? OR (kind='schedule' AND json_extract(payload,'$.changeId')=?))").bind(nowISO(),member.id,id,notice.payload.changeId).run();
}
