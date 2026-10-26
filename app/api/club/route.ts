import {ensureHistory,profiles,readLiveEvents,readPlans,readSyncStatus,recordsFor,historyMeta,historyEventList,recentRecords} from '../../../lib/club-store';
import {requestMember} from '../../../lib/member-runtime';
import {accessibleSkaters,scheduleSkaterIds,failure,json} from '../../../lib/member-access';
import {db} from '../../../lib/club-store';
import {clubEventResponse,clubSyncResponse} from '../../../lib/club-response';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    const member=await requestMember(request);const admin=member.role==='admin'&&member.status==='active';const ids=await accessibleSkaters(db(),member),pinned=await scheduleSkaterIds(db(),member);
    await ensureHistory();const params=new URL(request.url).searchParams;
    if(params.has('skater')){if(!(await profiles()).some(skater=>skater.id===params.get('skater')))return json({error:'Skater not found.'},404);return json({records:await recordsFor({skater:params.get('skater')!})});}
    if(params.has('event'))return json({records:await recordsFor({event:params.get('event')!})});
    const [skaters,events,plans,sync,recent]=await Promise.all([profiles(),readLiveEvents(),readPlans(),readSyncStatus(),recentRecords()]);
    return json({member,ownSkaterIds:pinned,writableSkaterIds:admin?skaters.map(skater=>skater.id):member.role==='coach'?ids:[],skaters:skaters.sort((first,second)=>Number(pinned.includes(second.id))-Number(pinned.includes(first.id))),events:events.map(event=>clubEventResponse(event,admin)),plans:plans.filter(row=>admin||ids.includes(row.skaterId)),sync:clubSyncResponse(sync,admin),recent,historyEvents:historyEventList,summary:historyMeta.summary,asOf:historyMeta.asOf,window:historyMeta.window,reviews:admin?historyMeta.reviews:[],limitations:historyMeta.limitations});
  }catch(error){return failure(error);}
}
