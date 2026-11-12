type Event={id:string;name:string;start:string;end?:string;detailCheckedAt?:string;offeredCategories?:string[];registrations?:Array<{opens:string;closes?:string;opensTime?:string;closesTime?:string}>};
// Two imminent events stay frequent; the last slot prevents other nearby levels from starving.
export function selectDetailEvents<T extends Event>(events:T[],today:string):T[]{
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
  const fixed=available.slice(0,2),others=available.slice(2).sort((a,b)=>Number(due(b))-Number(due(a))||(a.detailCheckedAt||'').localeCompare(b.detailCheckedAt||'')||a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
  return [...fixed,...others.slice(0,1)];
}
