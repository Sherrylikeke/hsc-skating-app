import {extractTextItems,getDocumentProxy} from 'unpdf';
import roster from '../data/roster.json';
import {db,putLiveEvent,readLiveEvents,readLiveEvent,putSyncStatus,readSyncStatus} from './club-store';
import {calendarEvent,discoverDocuments,parseEntries,parseScheduleItems} from './official-parser';
import {parseStartingOrderPdf,parseStartingOrderHtml} from './starting-order';
import {todayToronto} from './club-types';
import type {LiveEvent,OfficialDocument} from './club-types';
const allowedHosts=new Set(['skateontario.org','www.skateontario.org','dstools.ca','www.dstools.ca','skatingresults.ca','www.skatingresults.ca']);
async function source(url:string,maxBytes=3_000_000):Promise<Uint8Array>{
  let target=new URL(url);if(!allowedHosts.has(target.hostname)||target.protocol!=='https:')throw new Error('来源不在已接入的官方名单中');
  if(target.hostname==='skateontario.org')target.hostname='www.skateontario.org';
  for(let redirects=0;redirects<4;redirects++){
    const response=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 (compatible; HSCClubPortal/0.2)','Accept':'text/html,application/json,application/pdf;q=0.9,*/*;q=0.8'}});
    if([301,302,303,307,308].includes(response.status)){target=new URL(response.headers.get('location')||'',target);if(!allowedHosts.has(target.hostname)||target.protocol!=='https:')throw new Error('官方链接跳转到尚未接入的来源');continue;}
    if(!response.ok)throw new Error(`官网暂时无法读取（HTTP ${response.status}）`);
    if(Number(response.headers.get('content-length')||0)>maxBytes)throw new Error('官网文件超出本轮读取范围');
    const reader=response.body?.getReader();if(!reader)throw new Error('官网返回空文件');const parts:Uint8Array[]=[];let size=0;
    while(true){const result=await reader.read();if(result.done)break;size+=result.value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('官网文件超出本轮读取范围');}parts.push(result.value);}
    const output=new Uint8Array(size);let position=0;for(const part of parts){output.set(part,position);position+=part.byteLength;}return output;
  }
  throw new Error('官网链接跳转次数过多');
}
const hashBytes=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))).map(n=>n.toString(16).padStart(2,'0')).join('');
const message=(error:unknown)=>error instanceof Error?error.message:'官网读取失败';
async function syncCalendarBody(){
  const now=new Date().toISOString();await putSyncStatus({lastAttempt:now,error:null});
  try{
    const start=todayToronto();const endDate=new Date(start+'T12:00:00Z');endDate.setUTCDate(endDate.getUTCDate()+183);const end=endDate.toISOString().slice(0,10);
    let url=`https://skateontario.org/wp-json/tribe/events/v1/events?start_date=${start}&end_date=${end}&per_page=50`;const gathered:Record<string,unknown>[]=[];
    for(let page=0;url&&page<3;page++){
      const raw=JSON.parse(new TextDecoder().decode(await source(url))) as {events?:Record<string,unknown>[];next_rest_url?:string};if(!Array.isArray(raw.events))throw new Error('官网日历格式发生变化，保留已有数据');
      gathered.push(...raw.events);url=raw.next_rest_url||'';
    }
    const existing=new Map((await readLiveEvents()).map(event=>[event.id,event]));const incoming:LiveEvent[]=[];
    for(const raw of gathered){const item=calendarEvent(raw,now);if(!item.name||!/^20\d\d-\d\d-\d\d$/.test(item.start)||!allowedHosts.has(new URL(item.url).hostname))continue;const previous=existing.get(item.id);
      if(previous){incoming.push({...previous,...item,documents:previous.documents,participants:previous.participants,blocks:previous.blocks,entryStatus:previous.entryStatus,scheduleStatus:previous.scheduleStatus,detailCheckedAt:previous.detailCheckedAt,detailError:previous.officialModified!==item.officialModified?'官网页面有修订，名单与赛程等待复核':previous.detailError});}else incoming.push(item);
    }
    const database=db();const statements:D1PreparedStatement[]=[];
    for(let i=0;i<incoming.length;i+=25){const chunk=incoming.slice(i,i+25);statements.push(database.prepare(`INSERT INTO live_events (id,payload,updated_at) VALUES ${chunk.map(()=>'(?,?,?)').join(',')} ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`).bind(...chunk.flatMap(event=>[event.id,JSON.stringify(event),now])));}
    if(statements.length)await database.batch(statements);
    await putSyncStatus({lastSuccess:now,lastCalendarSuccess:now,events:incoming.length,error:null});
    return {events:incoming.length,checkedAt:now,source:'https://skateontario.org/events/',nextEvents:incoming.sort((a,b)=>a.start.localeCompare(b.start)).slice(0,3).map(event=>({id:event.id,name:event.name,start:event.start}))};
  }catch(error){await putSyncStatus({error:message(error)});throw error;}
}
async function revision(eventId:string,document:OfficialDocument){if(!document.hash)return;await db().prepare('INSERT INTO source_revisions (id,event_id,kind,url,hash,checked_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(`${eventId}|${document.kind}|${document.hash}`,eventId,document.kind,document.url,document.hash,document.checkedAt||new Date().toISOString()).run();}
async function syncEventBody(id:string){
  const existing=await readLiveEvent(id);if(!existing)throw new Error('请先同步官网日历');
  const now=new Date().toISOString();let event={...existing,detailCheckedAt:now};const errors:string[]=[];let changed=0;
  try{
    const html=new TextDecoder().decode(await source(event.url));const discovered=discoverDocuments(html,event.url);
    for(const hub of discovered.filter(d=>d.kind==='results'&&!/\.pdf(?:$|\?)/i.test(d.url)).slice(0,2)){
      try{const linked=discoverDocuments(new TextDecoder().decode(await source(hub.url)),hub.url);for(const doc of linked.filter(d=>d.kind==='start-order'))if(!discovered.some(d=>d.url===doc.url))discovered.push(doc);}catch(error){errors.push('出场资料页面：'+message(error));}
    }
    const documents=discovered.map(document=>({...existing.documents.find(old=>old.url===document.url),...document}));
    event={...event,documents};
    const entries=documents.find(document=>document.kind==='entries');const schedule=documents.find(document=>document.kind==='schedule');
    if(entries){
      try{
        const bytes=await source(entries.url);const hash=await hashBytes(bytes);const previous=existing.documents.find(document=>document.url===entries.url);
        if(previous?.hash!==hash||!existing.participants.length){
          if(/\.pdf(?:$|\?)/i.test(entries.url))throw new Error('该名单 PDF 格式待核对，已保留官网链接');
          const participants=parseEntries(new TextDecoder().decode(bytes),entries.url,roster);if(!participants.length)throw new Error('名单格式尚未识别，保留上次有效名单');
          event.participants=participants;changed++;
        }
        entries.hash=hash;entries.checkedAt=now;delete entries.error;event.entryStatus='已读取官方名单';await revision(event.id,entries);
      }catch(error){entries.error=message(error);errors.push(entries.error);event.entryStatus=existing.participants.length?'名单更新待核对，显示上次有效版本':'名单待核对';}
    }else event.entryStatus=existing.participants.length?'官网当前未列出名单链接，保留已读取版本':'官网尚未公布名单链接';
    if(schedule){
      try{
        const bytes=await source(schedule.url,8_000_000);const hash=await hashBytes(bytes);const previous=existing.documents.find(document=>document.url===schedule.url);
        if(previous?.hash!==hash||!existing.blocks.length){
          const pdf=await getDocumentProxy(bytes,{maxImageSize:1_000_000,disableFontFace:true});if(pdf.numPages>20)throw new Error('赛程页数超出已验证格式，保留原始链接');
          const {items}=await extractTextItems(pdf);const blocks=parseScheduleItems(items,schedule.url);if(!blocks.length)throw new Error('赛程表格格式待核对，保留上次有效时间');
          event.blocks=blocks;changed++;
        }
        schedule.hash=hash;schedule.checkedAt=now;delete schedule.error;event.scheduleStatus='已读取官方组别赛程';await revision(event.id,schedule);
      }catch(error){schedule.error=message(error);errors.push(schedule.error);event.scheduleStatus=existing.blocks.length?'赛程更新待核对，显示上次有效版本':'赛程待核对';}
    }else event.scheduleStatus=existing.blocks.length?'官网当前未列出赛程链接，保留已读取版本':'官网尚未公布赛程链接';
    const orderDocs=documents.filter(d=>d.kind==='start-order');
    if(orderDocs.length){
      const selected=[...orderDocs].sort((a,b)=>(a.checkedAt||'').localeCompare(b.checkedAt||'')).slice(0,4);let orders=[...(existing.startingOrders||[])];
      for(const doc of selected){try{const bytes=await source(doc.url,8_000_000);const hash=await hashBytes(bytes);const previous=existing.documents.find(d=>d.url===doc.url);
        if(previous?.hash!==hash||!orders.some(o=>o.sourceUrl===doc.url)){
          let parsed;if(/\.pdf(?:$|\?)/i.test(doc.url)){const pdf=await getDocumentProxy(bytes,{maxImageSize:1_000_000,disableFontFace:true});if(pdf.numPages>20)throw new Error('出场顺序页数超出已验证格式');const {items}=await extractTextItems(pdf);parsed=parseStartingOrderPdf(items,doc.url,roster);}else parsed=parseStartingOrderHtml(new TextDecoder().decode(bytes),doc.url,roster);
          if(!parsed.length)throw new Error('出场顺序格式待核对，保留上次有效资料');orders=[...orders.filter(o=>o.sourceUrl!==doc.url),...parsed];changed++;
        }doc.hash=hash;doc.checkedAt=now;delete doc.error;await revision(event.id,doc);
      }catch(error){doc.error=message(error);errors.push(doc.error);}}
      event.startingOrders=orders;const pending=orderDocs.filter(d=>!d.checkedAt||d.error).length;event.startingOrderStatus=pending?`已读取 ${orders.length} 条出场信息，${pending} 份文件待核对`:`已读取 ${orders.length} 条官方出场信息`;
    }else event.startingOrderStatus=existing.startingOrders?.length?'官网当前未列出出场链接，保留已读取版本':'官网尚未发现 Starting Order 链接';
    event.detailError=errors.join('；')||undefined;await putLiveEvent(event);await putSyncStatus({lastAttempt:now,lastSuccess:errors.length?undefined:now,error:errors.join('；')||null,entries:event.participants.filter(row=>row.skaterIds.length).length,blocks:event.blocks.length});
    return {id:event.id,name:event.name,changed,participants:event.participants.length,matchedSkaters:new Set(event.participants.flatMap(row=>row.skaterIds)).size,blocks:event.blocks.length,checkedAt:now,errors};
  }catch(error){event.detailError=message(error);await putLiveEvent(event);await putSyncStatus({lastAttempt:now,error:message(error)});throw error;}
}
export async function syncStatus(){return {status:await readSyncStatus(),events:(await readLiveEvents()).map(event=>({id:event.id,name:event.name,start:event.start,end:event.end,detailCheckedAt:event.detailCheckedAt,error:event.detailError,matched:event.participants.filter(row=>row.skaterIds.length).length})),scope:'Skate Ontario 官方日历；DSTools HTML 名单；含明确日期、START/END 与 RINK 表头的赛程 PDF。其他格式保留链接并提示核对。',instructions:'先同步日历，再逐个检查未来45天内最近三场比赛。读取失败不删除旧数据。官方时段是组别时间，不推算个人时间；教练集合与备注独立保存。'};}
async function withSyncLock<T>(operation:()=>Promise<T>):Promise<T>{
  const lock=JSON.stringify({token:crypto.randomUUID(),expiresAt:Date.now()+300000});
  const acquired=await db().prepare("INSERT INTO app_meta (key,value) VALUES ('official-source-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(json_extract(app_meta.value,'$.expiresAt') AS INTEGER) <= ? RETURNING value").bind(lock,Date.now()).first();
  if(!acquired)throw new Error('官网资料正在同步中，请稍后重试');
  try{return await operation();}finally{await db().prepare("DELETE FROM app_meta WHERE key='official-source-lock' AND value=?").bind(lock).run();}
}
export const syncCalendar=()=>withSyncLock(syncCalendarBody);
export const syncEvent=(id:string)=>withSyncLock(()=>syncEventBody(id));
