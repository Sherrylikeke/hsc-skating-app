type SyncResponse={events?:number;nextEvents?:Array<{id:string;start:string}>;errors?:string[];error?:string};
export type SyncSummary={events:number;checkedEvents:number;errors:string[]};
type RequestSync=(path:string,init:RequestInit)=>Promise<Response>;

export async function checkOfficialSources(request:RequestSync,today:string,eventId?:string,onProgress?:(current:number,total:number)=>void):Promise<SyncSummary>{
  async function check(id?:string){
    const response=await request('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(id?{eventId:id}:{})});
    const result=await response.json() as SyncResponse;
    if(!response.ok)throw new Error(result.error||'Official source check failed.');
    return result;
  }
  const first=await check(eventId);
  const errors=[...(first.errors||[])];
  if(eventId)return {events:0,checkedEvents:1,errors};
  const cutoff=new Date(today+'T12:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()+183);
  const selected=(first.nextEvents||[]).filter(event=>event.start<=cutoff.toISOString().slice(0,10)).slice(0,3);
  for(const [index,event] of selected.entries()){
    onProgress?.(index+1,selected.length);
    try{const result=await check(event.id);errors.push(...(result.errors||[]).map(error=>`${event.id}: ${error}`));}
    catch(failure){errors.push(`${event.id}: ${failure instanceof Error?failure.message:'Official source check failed.'}`);}
  }
  return {events:first.events??0,checkedEvents:selected.length,errors};
}
