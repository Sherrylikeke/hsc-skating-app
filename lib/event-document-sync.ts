import {discoverDocuments} from './official-parser.ts';
import type {LiveEvent} from './club-types.ts';
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
    const documents=discoverDocuments(await readPage(event.url),event.url).map(document=>({...event.documents.find(previous=>previous.url===document.url),...document}));
    const scheduleStatus=!event.blocks.length&&documents.some(document=>document.kind==='schedule')?'已发现官网赛程链接，文件内容等待核对':event.scheduleStatus;
    return {...event,documents,scheduleStatus,linksAttemptedAt:now,linksCheckedAt:now,linksError:undefined};
  }catch(error){
    // A failed page must not remove saved links, participants or schedule blocks.
    return {...event,linksAttemptedAt:now,linksError:error instanceof Error?error.message:'官网链接读取失败'};
  }
}
