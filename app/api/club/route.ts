import {getChatGPTUser} from '../../chatgpt-auth';
import {ensureHistory,profiles,readLiveEvents,readPlans,readSyncStatus,recordsFor,historyMeta,historyEventList,recentRecords} from '../../../lib/club-store';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  if(!await getChatGPTUser())return Response.json({error:'请先登录'},{status:401});
  try{
    await ensureHistory();const params=new URL(request.url).searchParams;
    if(params.has('skater'))return Response.json({records:await recordsFor({skater:params.get('skater')!})},{headers:{'Cache-Control':'no-store'}});
    if(params.has('event'))return Response.json({records:await recordsFor({event:params.get('event')!})},{headers:{'Cache-Control':'no-store'}});
    const [skaters,events,plans,sync,recent]=await Promise.all([profiles(),readLiveEvents(),readPlans(),readSyncStatus(),recentRecords()]);
    return Response.json({skaters,events,plans,sync,recent,historyEvents:historyEventList,summary:historyMeta.summary,asOf:historyMeta.asOf,window:historyMeta.window,reviews:historyMeta.reviews,limitations:historyMeta.limitations},{headers:{'Cache-Control':'no-store'}});
  }catch(error){console.error('HSC club read:',error instanceof Error?error.message:'unknown failure');return Response.json({error:'暂时无法读取俱乐部资料，请重试'},{status:503});}
}
