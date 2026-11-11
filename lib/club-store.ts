import {env} from 'cloudflare:workers';
import metadata from '../data/history-meta.json';
import sourceRecords from '../data/history-records.json';
import roster from '../data/roster.json';
import type {HistoryRecord,HistoryEvent,ClubSkater,LiveEvent,CoachPlan,SyncStatus} from './club-types';
import {eventWriteStatements} from './change-notifications';
export function db(){if(!env.DB)throw new Error('数据库暂不可用');return env.DB;}
const SEED_VERSION='history-2026-10-19-v1';
export async function ensureHistory(){
  const database=db();const found=await database.prepare('SELECT value FROM app_meta WHERE key = ?').bind(SEED_VERSION).first<{value:string}>();if(found)return;
  const statements:D1PreparedStatement[]=[];
  for(let i=0;i<sourceRecords.length;i+=30){const rows=sourceRecords.slice(i,i+30);statements.push(database.prepare(`INSERT INTO history_records (id,event_id,payload) VALUES ${rows.map(()=>'(?,?,?)').join(',')} ON CONFLICT(id) DO NOTHING`).bind(...rows.flatMap(row=>[row.record_id,row.event_key,JSON.stringify(row)])));}
  for(let i=0;i<metadata.events.length;i+=40){const rows=metadata.events.slice(i,i+40);statements.push(database.prepare(`INSERT INTO history_events (id,payload) VALUES ${rows.map(()=>'(?,?)').join(',')} ON CONFLICT(id) DO NOTHING`).bind(...rows.flatMap(row=>[row.id,JSON.stringify(row)])));}
  statements.push(database.prepare('INSERT INTO app_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').bind(SEED_VERSION,new Date().toISOString()));
  await database.batch(statements);
}
export async function profiles():Promise<ClubSkater[]>{
  const {results}=await db().prepare('SELECT skater_id,coach FROM coach_assignments').all<{skater_id:string;coach:string}>();const coaches=new Map(results.map(row=>[row.skater_id,row.coach]));
  const old=new Map(metadata.skaters.map(row=>[row.skater_id,row]));
  const {results:admissions}=await db().prepare('SELECT skater_id,payload FROM hsc_admissions').all<{skater_id:string;payload:string}>();
  const overrides=new Map(admissions.map(row=>[row.skater_id,JSON.parse(row.payload) as {name:string;training:boolean;identityPending:boolean;representedClubs:string}]));
  const candidates=[...roster,...admissions.filter(row=>!roster.some(candidate=>candidate.id===row.skater_id)).map(row=>({id:row.skater_id,name:overrides.get(row.skater_id)!.name,coach:'',training:false}))];
  return candidates.map(row=>{const info=old.get(row.id);const update=overrides.get(row.id);return {id:row.id,name:update?.name||row.name,coach:coaches.get(row.id)??row.coach,training:update?.training??row.training,identityPending:update?.identityPending??('identityPending' in row&&row.identityPending===true),categories:info?.categories||[],clubs:update?.representedClubs?update.representedClubs.split(/\s*;\s*/):info?.represented_clubs||[],firstSeen:info?.first_seen,lastSeen:info?.last_seen,recordCount:info?.record_count||0,eventCount:info?.event_count||0,identityStatus:(update?.identityPending??('identityPending' in row&&row.identityPending))?'全名待确认':info?.identity_status||'用户添加，尚无已关联记录'};});
}
export async function readLiveEvents():Promise<LiveEvent[]>{const {results}=await db().prepare('SELECT payload FROM live_events').all<{payload:string}>();return results.map(row=>JSON.parse(row.payload) as LiveEvent).sort((a,b)=>a.start.localeCompare(b.start));}
export async function readLiveEvent(id:string):Promise<LiveEvent|null>{const row=await db().prepare('SELECT payload FROM live_events WHERE id = ?').bind(id).first<{payload:string}>();return row?JSON.parse(row.payload):null;}
export async function putLiveEvent(event:LiveEvent){await db().batch(eventWriteStatements(db(),event,await readLiveEvent(event.id)));}
export async function readPlans():Promise<CoachPlan[]>{const {results}=await db().prepare('SELECT id,skater_id AS skaterId,event_id AS eventId,meeting_time AS meetingTime,note,revision FROM coach_plans').all<Omit<CoachPlan,'slotKey'>>();return results.map(row=>({...row,slotKey:row.id.split('|').slice(2).join('|')}));}
export async function readSyncStatus():Promise<SyncStatus>{const row=await db().prepare('SELECT value FROM app_meta WHERE key = ?').bind('official-sync-status').first<{value:string}>();return row?JSON.parse(row.value):{};}
export async function putSyncStatus(update:SyncStatus){const old=await readSyncStatus();const defined=Object.fromEntries(Object.entries(update).filter(([,value])=>value!==undefined));await db().prepare('INSERT INTO app_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('official-sync-status',JSON.stringify({...old,...defined})).run();}
export async function recentRecords(skaterIds?:string[]):Promise<HistoryRecord[]>{
  if(skaterIds?.length===0)return [];
  const filter=skaterIds===undefined?'':" WHERE EXISTS (SELECT 1 FROM json_each(history_records.payload,'$.skater_ids') AS skater WHERE skater.value IN (SELECT value FROM json_each(?)))";
  const query=db().prepare("SELECT payload FROM history_records"+filter+" ORDER BY json_extract(payload,'$.start_date') DESC,id LIMIT 6");
  const {results}=await (skaterIds===undefined?query:query.bind(JSON.stringify(skaterIds))).all<{payload:string}>();
  return results.map(row=>JSON.parse(row.payload));
}
export async function recordsFor({skater,event}:{skater?:string;event?:string}):Promise<HistoryRecord[]>{
  let query='SELECT payload FROM history_records';const args:string[]=[];
  if(skater){query+=' WHERE EXISTS (SELECT 1 FROM json_each(history_records.payload,\'$.skater_ids\') WHERE value = ?)';args.push(skater);}else if(event){query+=' WHERE event_id = ?';args.push(event);}
  query+=" ORDER BY json_extract(payload,'$.start_date') DESC, id LIMIT 1100";
  const {results}=await db().prepare(query).bind(...args).all<{payload:string}>();return results.map(row=>JSON.parse(row.payload));
}
export const historyMeta=metadata;
export const historyEventList=metadata.events as HistoryEvent[];
