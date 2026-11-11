import {readOfficialPdfItems} from './official-pdf';
import {selectDetailEvents} from './sync-selection';
import {db,putLiveEvent,readLiveEvents,readLiveEvent,putSyncStatus,readSyncStatus,profiles} from './club-store';
import {calendarEvent,discoverDocuments,parseScheduleDocument,competitionSchedule,scheduleRows} from './official-parser';
import {importEntries} from './entry-import';
import {parseStartingOrderPdf,parseStartingOrderHtml} from './starting-order';
import {importStartingOrderApp,startingOrderApp} from './starting-order-api';
import {selectStartingOrderDocuments} from './starting-order-selection';
import {announcementLinks,registrationDetails,mergeRegistrations} from './event-registration';
import {todayToronto,ENTRY_PDF_VERSION,STARTING_DRAW_VERSION} from './club-types';
import type {LiveEvent} from './club-types';
import {drainOutbox} from './member-messages';
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
const SCHEDULE_VERSION='schedule-bands-5';
const readPdfItems=readOfficialPdfItems;
function entryProgress(event:LiveEvent){const files=event.documents.flatMap(document=>(document.entryFiles||[]).map(file=>({file,rosterHash:document.matchingRosterHash})));const verified=files.filter(({file,rosterHash})=>file.checkedAt&&!file.error&&file.parserVersion===ENTRY_PDF_VERSION&&file.matchingRosterHash===rosterHash).length;return {total:files.length,verified,pending:files.length-verified};}
function startingOrderProgress(event:LiveEvent){const documents=event.documents.filter(document=>document.kind==='start-order');const verified=documents.filter(document=>document.checkedAt&&!document.error&&(document.parserVersion===STARTING_DRAW_VERSION||document.parserVersion==='starting-api-1')).length;return {total:documents.length,verified,pending:documents.length-verified};}
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
      if(previous){incoming.push({...previous,...item,registrations:mergeRegistrations(item.registrations||[],previous.registrations||[]),offeredCategories:[...new Set([...(previous.offeredCategories||[]),...(item.offeredCategories||[])])],documents:previous.documents,participants:previous.participants,blocks:previous.blocks,entryStatus:previous.entryStatus,scheduleStatus:previous.scheduleStatus,detailCheckedAt:previous.detailCheckedAt,detailError:previous.officialModified!==item.officialModified?'官网页面有修订，名单与赛程等待复核':previous.detailError});}else incoming.push(item);
    }
    for(const event of incoming)await putLiveEvent(event);
    await putSyncStatus({lastSuccess:now,lastCalendarSuccess:now,events:incoming.length,error:null});
    return {events:incoming.length,checkedAt:now,source:'https://skateontario.org/events/',nextEvents:selectDetailEvents(incoming,start).map(event=>({id:event.id,name:event.name,start:event.start}))};
  }catch(error){await putSyncStatus({error:message(error)});throw error;}
}
async function syncEventBody(id:string){
  const existing=await readLiveEvent(id);if(!existing)throw new Error('请先同步官网日历');
  const roster=await profiles();
  const matchingRosterHash=await hashBytes(new TextEncoder().encode(JSON.stringify(roster.map(row=>({id:row.id,name:row.name,identityPending:row.identityPending===true})).sort((first,second)=>first.id.localeCompare(second.id)))));
  const now=new Date().toISOString();let event={...existing,detailCheckedAt:now};const errors:string[]=[];let changed=0;
  try{
    const html=new TextDecoder().decode(await source(event.url));const discovered=discoverDocuments(html,event.url);
    const details=registrationDetails(html,event.name,event.url);
    // Page updates take priority; announcements fill missing windows and offered categories.
    for(const url of announcementLinks(html,event.url))try{
      const pages=await readPdfItems(await source(url,8_000_000));
      const text=pages.map(items=>{
        const lines:Array<{y:number;items:typeof items}>=[];
        for(const item of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){let line=lines.find(line=>Math.abs(line.y-item.y)<3);if(!line){line={y:item.y,items:[]};lines.push(line);}line.items.push(item);}
        return lines.map(line=>line.items.sort((a,b)=>a.x-b.x).map(item=>item.str).join(' ')).join('\n');
      }).join('\n');
      const announcement=registrationDetails(text,event.name,url);
      details.registrations=mergeRegistrations(details.registrations,announcement.registrations);
      details.offeredCategories.push(...announcement.offeredCategories);
    }catch(error){errors.push('报名公告：'+message(error));}
    event.registrations=details.registrations.length?details.registrations:existing.registrations;
    event.offeredCategories=[...new Set(details.offeredCategories.length?details.offeredCategories:existing.offeredCategories||[])];
    for(const hub of discovered.filter(d=>(d.kind==='results'||d.kind==='start-order')&&!/\.pdf(?:$|\?)/i.test(d.url)).slice(0,2)){
      try{
        const linked=discoverDocuments(new TextDecoder().decode(await source(hub.url)),hub.url).filter(document=>document.kind==='start-order'&&document.url!==hub.url);
        if(linked.length&&hub.kind==='start-order')discovered.splice(discovered.indexOf(hub),1);
        for(const doc of linked)if(!discovered.some(d=>d.url===doc.url))discovered.push(doc);
      }catch(error){errors.push('出场资料页面：'+message(error));}
    }
    const documents=discovered.map(document=>({...existing.documents.find(old=>old.url===document.url),...document}));
    for(const document of documents)if(document.kind==='schedule'&&/AWARDS?/i.test(document.label+document.url))delete document.error;
    event={...event,documents};
    const entries=documents.filter(document=>document.kind==='entries').sort((a,b)=>Number(/interim/i.test(a.label+' '+a.url))-Number(/interim/i.test(b.label+' '+b.url)))[0];const schedule=competitionSchedule(documents);
    if(entries){
      try{
        const imported=await importEntries(entries,existing.participants,roster,matchingRosterHash,now,source,readPdfItems);
        if(JSON.stringify(imported.participants)!==JSON.stringify(existing.participants))changed++;
        event.participants=imported.participants;Object.assign(entries,imported.document);errors.push(...imported.errors);event.entryStatus=imported.status;
      }catch(error){entries.error=message(error);entries.attemptedAt=now;errors.push(entries.error);event.entryStatus=existing.participants.length?'名单更新待核对，显示上次有效版本':'名单待核对';}
    }else event.entryStatus=existing.participants.length?'官网当前未列出名单链接，保留已读取版本':'官网尚未公布名单链接';
    if(schedule){
      try{
        const bytes=await source(schedule.url,8_000_000),hash=await hashBytes(bytes),previous=existing.documents.find(document=>document.url===schedule.url);
        if(previous?.hash!==hash||!existing.blocks.length||previous.parserVersion!==SCHEDULE_VERSION||previous.error){
          const parsed=parseScheduleDocument(await readPdfItems(bytes),schedule.url);
          if(!parsed.blocks.length)throw new Error(parsed.warnings.join('；')||'赛程表格格式待核对，保留上次有效时间');
          event.blocks=parsed.blocks;if(JSON.stringify(event.blocks)!==JSON.stringify(existing.blocks))changed++;
          schedule.error=parsed.warnings.join('；')||undefined;
        }
        schedule.hash=hash;schedule.parserVersion=SCHEDULE_VERSION;schedule.checkedAt=now;
        if(schedule.error){errors.push(schedule.error);event.scheduleStatus='赛程部分导入，未识别行待核对';}else event.scheduleStatus='已读取官方组别赛程';
      }catch(error){schedule.error=message(error);errors.push(schedule.error);event.scheduleStatus=existing.blocks.length?'赛程更新待核对，显示上次有效版本':'赛程待核对';}
    }else event.scheduleStatus=existing.blocks.length?'官网当前未列出赛程链接，保留已读取版本':'官网尚未公布赛程链接';
    const orderDocs=documents.filter(d=>d.kind==='start-order');
    if(orderDocs.length){
      const selected=selectStartingOrderDocuments(orderDocs,event.participants);let orders=[...(existing.startingOrders||[])];
      for(const doc of selected){doc.attemptedAt=now;try{const bytes=await source(doc.url,8_000_000);const hash=await hashBytes(bytes);const previous=existing.documents.find(d=>d.url===doc.url);
        const html=/\.pdf(?:$|\?)/i.test(doc.url)?'':new TextDecoder().decode(bytes);
        if(startingOrderApp(html,doc.url)){
          const previousOrders=orders.filter(o=>(o.sourceDocumentUrl||o.sourceUrl)===doc.url);
          const imported=await importStartingOrderApp(html,doc.url,roster,event.participants,previousOrders,source);
          if(!imported)throw Error('动态出场资料待核对');
          if(JSON.stringify(imported.orders)!==JSON.stringify(previousOrders))changed++;
          orders=[...orders.filter(o=>(o.sourceDocumentUrl||o.sourceUrl)!==doc.url),...imported.orders];
          doc.hash=await hashBytes(new TextEncoder().encode(JSON.stringify(imported.orders)));doc.parserVersion='starting-api-1';doc.matchingRosterHash=matchingRosterHash;doc.checkedAt=now;doc.entryCount=imported.orders.length;
          if(imported.errors.length){doc.error=imported.errors.join('；');errors.push(doc.error);}else delete doc.error;
          continue;
        }
        if(previous?.hash!==hash||previous.parserVersion!==STARTING_DRAW_VERSION||!orders.some(o=>o.sourceUrl===doc.url)||previous.matchingRosterHash!==matchingRosterHash){
          let parsed;if(/\.pdf(?:$|\?)/i.test(doc.url)){parsed=parseStartingOrderPdf(await readPdfItems(bytes),doc.url,roster);}else parsed=parseStartingOrderHtml(new TextDecoder().decode(bytes),doc.url,roster);
          if(!parsed.length)throw new Error('出场顺序格式待核对，保留上次有效资料');if(previous?.hash!==hash||JSON.stringify(parsed)!==JSON.stringify(orders.filter(order=>order.sourceUrl===doc.url)))changed++;orders=[...orders.filter(o=>o.sourceUrl!==doc.url),...parsed];
        }doc.hash=hash;doc.parserVersion=STARTING_DRAW_VERSION;doc.matchingRosterHash=matchingRosterHash;doc.checkedAt=now;delete doc.error;
      }catch(error){doc.error=message(error);errors.push(doc.error);}}
      event.startingOrders=orders;const pending=orderDocs.filter(d=>!d.checkedAt||d.error||(d.parserVersion!==STARTING_DRAW_VERSION&&d.parserVersion!=='starting-api-1')).length;event.startingOrderStatus=pending?`已读取 ${orders.length} 条出场信息，${pending} 份文件待核对`:`已读取 ${orders.length} 条官方出场信息`;
    }else event.startingOrderStatus=existing.startingOrders?.length?'官网当前未列出出场链接，保留已读取版本':'官网尚未发现 Starting Order 链接';
    event.detailError=errors.join('；')||undefined;await putLiveEvent(event);await putSyncStatus({lastAttempt:now,lastSuccess:errors.length?undefined:now,error:errors.join('；')||null,entries:event.participants.filter(row=>row.skaterIds.length).length,blocks:event.blocks.length});
    return {id:event.id,name:event.name,changed,registrationPreview:event.registrations,participants:event.participants.length,matchedSkaters:new Set(event.participants.flatMap(row=>row.skaterIds)).size,blocks:event.blocks.length,entryFiles:entryProgress(event),startingOrderFiles:startingOrderProgress(event),startingOrderStatus:event.startingOrderStatus,entryStatus:event.entryStatus,scheduleStatus:event.scheduleStatus,scheduleSource:schedule?{url:schedule.url,hash:schedule.hash,parserVersion:schedule.parserVersion}:undefined,scheduleBlocksPreview:event.blocks.map(block=>({date:block.date,start:block.start,end:block.end,category:block.category,rink:block.rink})),clubEntriesPreview:event.participants.filter(entry=>entry.skaterIds.length).slice(0,80).map(entry=>({name:entry.name,category:entry.category,skaterIds:entry.skaterIds})),schedulePreview:scheduleRows([event],roster).filter(row=>row.activity==='competition').slice(0,40).map(row=>({name:row.skaterName,category:row.category,date:row.date,start:row.start,end:row.end,rink:row.rink,uncertain:row.uncertain,startNumber:row.startingOrder?.startNumber,warmupGroup:row.startingOrder?.warmupGroup,individualTime:row.startingOrder?.individualTime,sourceUrl:row.startingOrder?.sourceUrl})),checkedAt:now,errors};
  }catch(error){event.detailError=message(error);await putLiveEvent(event);await putSyncStatus({lastAttempt:now,error:message(error)});throw error;}
}
export async function syncStatus(){return {status:await readSyncStatus(),events:(await readLiveEvents()).map(event=>({id:event.id,name:event.name,start:event.start,end:event.end,detailCheckedAt:event.detailCheckedAt,error:event.detailError,matched:event.participants.filter(row=>row.skaterIds.length).length,participants:event.participants.length,blocks:event.blocks.length,entryFiles:entryProgress(event),entryStatus:event.entryStatus,scheduleStatus:event.scheduleStatus})),scope:'Skate Ontario 官方日历与网页／Announcement报名日期；DSTools HTML 名单；已验证的三列Interim PDF；同源目录内 Name/Club/Section 与总人数可核对的报名 PDF，每场每轮最多四份；明确日期分区、START/END 与 RINK 表头的赛程 PDF。其他格式或未完成批次保留链接并提示核对。',instructions:'先同步日历，再依次检查返回的 nextEvents（未来183天，最近两场加一场按上次检查时间轮换，最多三场，包含 STAR 1–4）。PDF 名单分批轮转，待处理不等于全量成功。读取失败不删除旧数据。官方时段是组别时间，不推算个人时间；教练集合与备注独立保存。'};}
async function withSyncLock<T>(operation:()=>Promise<T>):Promise<T>{
  const lock=JSON.stringify({token:crypto.randomUUID(),expiresAt:Date.now()+300000});
  const acquired=await db().prepare("INSERT INTO app_meta (key,value) VALUES ('official-source-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(json_extract(app_meta.value,'$.expiresAt') AS INTEGER) <= ? RETURNING value").bind(lock,Date.now()).first();
  if(!acquired)throw new Error('官网资料正在同步中，请稍后重试');
  try{return await operation();}finally{try{await drainOutbox(db());}finally{await db().prepare("DELETE FROM app_meta WHERE key='official-source-lock' AND value=?").bind(lock).run();}}
}
export const syncCalendar=()=>withSyncLock(syncCalendarBody);
export const syncEvent=(id:string)=>withSyncLock(()=>syncEventBody(id));
