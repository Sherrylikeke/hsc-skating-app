import {requestMember} from '../../../lib/member-runtime';
import {db,profiles,readLiveEvents,readPlans} from '../../../lib/club-store';
import {accessibleSkaters,failure,json} from '../../../lib/member-access';
import {scheduleRows} from '../../../lib/official-parser';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    const member=await requestMember(request),scope=await accessibleSkaters(db(),member);
    const [candidates,events,plans]=await Promise.all([profiles(),readLiveEvents(),readPlans()]);
    const skaters=candidates.filter(skater=>member.role==='admin'||scope.includes(skater.id));
    const rows=scheduleRows(events,skaters).filter(row=>Date.parse(row.date+'T23:59:59Z')>Date.now()-86400000).map(row=>({...row,plan:plans.find(plan=>plan.skaterId===row.skaterId&&plan.eventId===row.eventId&&plan.slotKey===row.slotKey)||null}));
    return json({skaters,rows});
  }catch(error){return failure(error);}
}
