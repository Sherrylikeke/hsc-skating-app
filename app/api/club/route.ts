import {ensureHistory,profiles,readLiveEvents,readPlans,readSyncStatus,recordsFor,historyMeta,historyEventList,recentRecords} from '../../../lib/club-store';
import {requestMember} from '../../../lib/member-runtime';
import {accessibleSkaters,assertSkater,failure,json} from '../../../lib/member-access';
import {db} from '../../../lib/club-store';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    const member=await requestMember(request);const admin=member.role==='admin';const ids=await accessibleSkaters(db(),member);
    const allowed=(skaterIds:string[])=>admin||skaterIds.some(id=>ids.includes(id));
    await ensureHistory();const params=new URL(request.url).searchParams;
    if(params.has('skater')){await assertSkater(db(),member,params.get('skater')!);return json({records:await recordsFor({skater:params.get('skater')!})});}
    if(params.has('event'))return json({records:(await recordsFor({event:params.get('event')!})).filter(row=>allowed(row.skater_ids))});
    const [skaters,events,plans,sync,recent]=await Promise.all([profiles(),readLiveEvents(),readPlans(),readSyncStatus(),recentRecords()]);
    return json({member,skaters:skaters.filter(row=>admin||ids.includes(row.id)),events:events.map(event=>admin?event:{...event,participants:event.participants.map(row=>({...row,skaterIds:row.skaterIds.filter(id=>ids.includes(id))})),startingOrders:event.startingOrders?.map(row=>({...row,skaterIds:row.skaterIds.filter(id=>ids.includes(id))}))}),plans:plans.filter(row=>admin||ids.includes(row.skaterId)),sync,recent:recent.filter(row=>allowed(row.skater_ids)),historyEvents:historyEventList.filter(row=>allowed(row.skaterIds)).map(row=>({...row,skaterIds:admin?row.skaterIds:row.skaterIds.filter(id=>ids.includes(id))})),summary:historyMeta.summary,asOf:historyMeta.asOf,window:historyMeta.window,reviews:admin?historyMeta.reviews:[],limitations:historyMeta.limitations});
  }catch(error){return failure(error);}
}
