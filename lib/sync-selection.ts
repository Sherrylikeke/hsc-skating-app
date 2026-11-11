type Event={id:string;name:string;start:string;end?:string;detailCheckedAt?:string;registrations?:Array<{opens:string;closes?:string}>};
// Two imminent events stay frequent; the last slot prevents other nearby levels from starving.
export function selectDetailEvents<T extends Event>(events:T[],today:string):T[]{
  const cutoff=new Date(today+'T12:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()+183);
  const available=events.filter(event=>(event.end||event.start)>=today&&event.start<=cutoff.toISOString().slice(0,10)).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
  const fixed=available.slice(0,2),others=available.slice(2).sort((a,b)=>(a.detailCheckedAt||'').localeCompare(b.detailCheckedAt||'')||a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
  return [...fixed,...others.slice(0,1)];
}
