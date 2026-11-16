import {discoverDocuments} from './official-parser.ts';
import type {LiveEvent} from './club-types.ts';

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
