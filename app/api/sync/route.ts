import {syncCalendar,syncEvent} from '../../../lib/official-sync';
import {requestMember} from '../../../lib/member-runtime';
import {checkWrite,failure} from '../../../lib/member-access';
export async function POST(request:Request){
  try{await requestMember(request,['admin']);checkWrite(request);}catch(error){return failure(error);}
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'请求来源无效'},{status:403});
  try{const body=await request.json() as {eventId?:string};if(body.eventId&&!/^SO-\d+$/.test(body.eventId))return Response.json({error:'比赛标识无效'},{status:400});return Response.json(body.eventId?await syncEvent(body.eventId):await syncCalendar());}catch(error){return Response.json({error:error instanceof Error?error.message:'同步失败，已保留之前的数据'},{status:503});}
}
