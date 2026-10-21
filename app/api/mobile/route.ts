import {requestMember} from '../../../lib/member-runtime';
import {db,profiles,readLiveEvents,readPlans} from '../../../lib/club-store';
import {accessibleSkaters,scheduleSkaterIds,failure,json} from '../../../lib/member-access';
import {scheduleRows} from '../../../lib/official-parser';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    const member=await requestMember(request),scope=await accessibleSkaters(db(),member),pinned=await scheduleSkaterIds(db(),member);
    const [candidates,events,plans]=await Promise.all([profiles(),readLiveEvents(),readPlans()]);
    const admin=member.role==='admin'&&member.status==='active';
    const skaters=candidates.sort((first,second)=>Number(pinned.includes(second.id))-Number(pinned.includes(first.id)));
    const rows=scheduleRows(events,skaters).filter(row=>Date.parse(row.date+'T23:59:59Z')>Date.now()-86400000).map(row=>({...row,isOwn:pinned.includes(row.skaterId),plan:admin||scope.includes(row.skaterId)?plans.find(plan=>plan.skaterId===row.skaterId&&plan.eventId===row.eventId&&plan.slotKey===row.slotKey)||null:null})).sort((first,second)=>Number(second.isOwn)-Number(first.isOwn));
    return json({skaters,rows,privateSkaterIds:admin?skaters.map(skater=>skater.id):scope});
  }catch(error){return failure(error);}
}
