import {env} from 'cloudflare:workers';
import {db,profiles,readLiveEvents} from '../../../../lib/club-store';
import {calendarFeedMember,subscribedCalendar} from '../../../../lib/calendar-subscription';
import {verificationDelivery} from '../../../../lib/verification-mail';
import type {MailEnvironment} from '../../../../lib/verification-mail';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request) {
  try{
    const runtime=env as unknown as MailEnvironment;
    const member=await calendarFeedMember(db(),new URL(request.url).searchParams.get('token')??'',{required:verificationDelivery(runtime).enabled,graceUsers:runtime.HSC_EMAIL_VERIFICATION_GRACE_USERS});
    if(!member)return new Response('Calendar subscription unavailable.',{status:404,headers});
    const [events,skaters]=await Promise.all([readLiveEvents(),profiles()]);
    const file=await subscribedCalendar(db(),member,events,skaters);
    return new Response(file.content,{headers:{...headers,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="hsc-my-skaters.ics"'}});
  }catch{return new Response('Calendar temporarily unavailable.',{status:503,headers});}
}
