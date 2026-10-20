import {getChatGPTUser} from '../../chatgpt-auth';
import {syncCalendar,syncEvent} from '../../../lib/official-sync';
export async function POST(request:Request){
  if(!await getChatGPTUser())return Response.json({error:'请先登录'},{status:401});
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'请求来源无效'},{status:403});
  try{const body=await request.json() as {eventId?:string};if(body.eventId&&!/^SO-\d+$/.test(body.eventId))return Response.json({error:'比赛标识无效'},{status:400});return Response.json(body.eventId?await syncEvent(body.eventId):await syncCalendar());}catch(error){return Response.json({error:error instanceof Error?error.message:'同步失败，已保留之前的数据'},{status:503});}
}
