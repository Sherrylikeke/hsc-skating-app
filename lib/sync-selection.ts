import {eventLinkSignature} from './event-document-sync.ts';
type Event={id:string;name:string;start:string;end?:string;detailCheckedAt?:string;detailLinksSignature?:string;detailError?:string;documents?:Array<{kind:'schedule'|'entries'|'results'|'start-order';url:string;label:string;error?:string}>;participants?:Array<{skaterIds:string[]}>;offeredCategories?:string[];registrations?:Array<{opens:string;closes?:string;opensTime?:string;closesTime?:string}>};
// Two imminent events stay frequent; the last slot prevents other nearby levels from starving.
export function selectDetailEvents<T extends Event>(events:T[],today:string,now?:number):T[]{
  const cutoff=new Date(today+'T12:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()+183);
  const available=events.filter(event=>(event.end||event.start)>=today&&event.start<=cutoff.toISOString().slice(0,10)).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
  const nextWeek=new Date(today+'T12:00:00Z');nextWeek.setUTCDate(nextWeek.getUTCDate()+7);
  const due=(event:Event)=>{
    // Reserve the rotating slot for incomplete registration metadata when a phase
    // is opening soon/already open. An attempted event cools down until tomorrow.
    if(event.detailCheckedAt?.slice(0,10)===today)return false;
    const windows=event.registrations||[];
    return windows.some(window=>window.opens<=nextWeek.toISOString().slice(0,10)&&(window.closes||window.opens)>=today)&&(!event.offeredCategories?.length||windows.some(window=>!window.opensTime||window.closes&&!window.closesTime));
  };
  const oldest=(a:Event,b:Event)=>(a.detailCheckedAt||'').localeCompare(b.detailCheckedAt||'')||a.start.localeCompare(b.start)||a.id.localeCompare(b.id);
  // Published/revised documents and unfinished imports must reach the parser,
  // even while nearer competitions are being checked every hour.
  const actionable=available.filter(event=>event.documents?.some(d=>d.kind==='entries'||d.kind==='schedule')&&
    (!now||!event.detailCheckedAt||now-Date.parse(event.detailCheckedAt)>=45*60_000)&&
    (event.detailLinksSignature!==eventLinkSignature({documents:event.documents})||event.detailError==='官网页面有修订，名单与赛程等待复核'||event.documents.some(d=>d.error)));
  const urgent=actionable.sort((a,b)=>Number(!!b.participants?.some(p=>p.skaterIds.length))-Number(!!a.participants?.some(p=>p.skaterIds.length))||oldest(a,b))[0];
  if(urgent){const rest=available.filter(event=>event.id!==urgent.id),near=rest[0],rotation=rest.filter(event=>event.id!==near?.id).sort(oldest)[0];return [urgent,near,rotation].filter((event):event is T=>!!event);}
  const fixed=available.slice(0,2),others=available.slice(2).sort((a,b)=>Number(due(b))-Number(due(a))||oldest(a,b));
  return [...fixed,...others.slice(0,1)];
}
