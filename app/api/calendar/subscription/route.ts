import {db} from '../../../../lib/club-store';
import {requestMember} from '../../../../lib/member-runtime';
import {bodyJSON,failure,json,rateLimit} from '../../../../lib/member-access';
import {calendarSubscriptionStatus,updateCalendarSubscription} from '../../../../lib/calendar-subscription';

export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try{return json(await calendarSubscriptionStatus(db(),await requestMember(request)));}
  catch(error){return failure(error);}
}
export async function POST(request:Request) {
  try{
    const member=await requestMember(request),body=await bodyJSON(request);
    await rateLimit(db(),'calendar-subscription:'+member.id,20,3600000);
    const result=await updateCalendarSubscription(db(),member,body.action);
    const {token,...status}=result;
    // The raw token is returned only by the request that creates/replaces it.
    return json({...status,...(token?{url:new URL('/api/calendar/feed?token='+token,request.url).href}:{})},200,{'Referrer-Policy':'no-referrer'});
  }catch(error){return failure(error);}
}
