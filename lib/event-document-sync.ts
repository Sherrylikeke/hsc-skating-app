import {discoverDocuments} from './official-parser.ts';
import type {LiveEvent,OfficialDocument} from './club-types.ts';

export function isInterimEntry(document:OfficialDocument){
  return document.kind==='entries'&&/(?:^|[^a-z])interim(?:[^a-z]|$)/i.test(`${document.label} ${document.url}`);
}

export function discoverEventDocuments(event:LiveEvent,html:string){
  const documents=discoverDocuments(html,event.url).map(document=>({
    ...(event.savedInterimEntry?.url===document.url?event.savedInterimEntry:undefined),
    ...event.documents.find(previous=>previous.url===document.url),...document
  }));
  const savedInterimEntry=documents.find(isInterimEntry)||event.savedInterimEntry||event.documents.find(isInterimEntry)||(
    event.id==='SO-325466'&&event.start==='2026-12-17'&&new URL(event.url).pathname==='/event/provincial-series-7-stratford/'
      ?{kind:'entries' as const,label:'Interim Entry Lists as of Oct 27',url:'https://skateontario.org/wp-content/uploads/2026/07/Provincial-Series-Stratford-Interim-Entry-Lists_v2_.pdf'}
      :undefined
  );
  return {documents,savedInterimEntry};
}

export function entryDocumentFor(event:Pick<LiveEvent,'documents'|'savedInterimEntry'>&{participants:readonly unknown[]}){
  const current=event.documents.filter(document=>document.kind==='entries');
  return current.find(document=>!isInterimEntry(document))||current[0]||
    (event.participants.length?undefined:event.savedInterimEntry);
}
export const eventLinkSignature=(event:Pick<LiveEvent,'documents'>)=>JSON.stringify(event.documents.filter(d=>d.kind==='schedule'||d.kind==='entries').map(d=>[d.kind,d.url,d.label]).sort((a,b)=>a[1].localeCompare(b[1])));
export function resolvedSourceUrl(bytes:Uint8Array,requested:string){
  const original=new URL(requested),resolved=new URL((bytes as Uint8Array&{resolvedUrl?:string}).resolvedUrl||requested);
  if(resolved.hostname.replace(/^www\./,'')===original.hostname.replace(/^www\./,''))resolved.hostname=original.hostname;
  if(resolved.origin!==original.origin)throw new Error('官网目录跳转到不同来源，保留上次有效资料');
  return resolved.href;
}

// Page links rotate independently of the more expensive PDF/entry imports.
export function selectLinkEvents<T extends Pick<LiveEvent,'id'|'start'|'end'|'linksAttemptedAt'|'linksCheckedAt'|'detailCheckedAt'>>(events:T[],today:string):T[]{
  const cutoff=new Date(today+'T12:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()+183);
  const attempted=(event:T)=>event.linksAttemptedAt||event.linksCheckedAt||event.detailCheckedAt||'';
  return events.filter(event=>event.end>=today&&event.start<=cutoff.toISOString().slice(0,10))
    .sort((a,b)=>attempted(a).localeCompare(attempted(b))||a.start.localeCompare(b.start)||a.id.localeCompare(b.id)).slice(0,3);
}

export async function refreshEventLinks(event:LiveEvent,now:string,readPage:(url:string)=>Promise<string>):Promise<LiveEvent>{
  try{
    const {documents,savedInterimEntry}=discoverEventDocuments(event,await readPage(event.url));
    const scheduleStatus=!event.blocks.length&&documents.some(document=>document.kind==='schedule')?'已发现官网赛程链接，文件内容等待核对':event.scheduleStatus;
    return {...event,documents,savedInterimEntry,scheduleStatus,linksAttemptedAt:now,linksCheckedAt:now,linksError:undefined};
  }catch(error){
    // A failed page must not remove saved links, participants or schedule blocks.
    return {...event,linksAttemptedAt:now,linksError:error instanceof Error?error.message:'官网链接读取失败'};
  }
}
