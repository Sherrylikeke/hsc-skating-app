import {syncCalendar,syncEvent,syncStatus} from '../../lib/official-sync';
import {syncOperator} from '../../lib/member-runtime';
import {failure} from '../../lib/member-access';
const tools=[
  {name:'sync_hsc_calendar',description:'同步 Skate Ontario 官方赛事日历，保留已保存的名单、赛程和教练备注。',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'sync_hsc_event',description:'读取一场已在日历内的比赛的官方名单与赛程，识别同链接文件修订。失败保留旧数据。',inputSchema:{type:'object',properties:{event_id:{type:'string',pattern:'^SO-[0-9]+$'}},required:['event_id'],additionalProperties:false}},
  {name:'get_hsc_sync_status',description:'查看最近成功同步、异常、未来比赛和无人值守同步规则。',inputSchema:{type:'object',properties:{},additionalProperties:false}},
];
export async function POST(request:Request){
  try{await syncOperator();}catch(error){return failure(error);}
  let body:{id?:string|number;method?:string;params?:{name?:string;arguments?:{event_id?:string}}};
  try{body=await request.json() as typeof body;}catch{return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});}
  const result=(value:unknown)=>Response.json({jsonrpc:'2.0',id:body.id??null,result:value});
  if(body.method==='server/discover')return result({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
  if(body.method==='initialize')return result({protocolVersion:'2026-07-28',serverInfo:{name:'HSC Club Portal',version:'0.2.0'},capabilities:{tools:{}}});
  if(body.method==='notifications/initialized')return new Response(null,{status:204});
  if(body.method==='tools/list')return result({tools});
  if(body.method!=='tools/call')return Response.json({jsonrpc:'2.0',id:body.id??null,error:{code:-32601,message:'Method not found'}});
  try{
    const name=body.params?.name;let value:unknown;
    if(name==='sync_hsc_calendar')value=await syncCalendar();
    else if(name==='get_hsc_sync_status')value=await syncStatus();
    else if(name==='sync_hsc_event'){const id=body.params?.arguments?.event_id;if(!id||!/^SO-\d+$/.test(id))throw new Error('比赛标识无效');value=await syncEvent(id);}
    else throw new Error('未知工具');
    return result({content:[{type:'text',text:JSON.stringify(value)}],isError:false});
  }catch(error){return result({content:[{type:'text',text:error instanceof Error?error.message:'同步失败，保留旧数据'}],isError:true});}
}
