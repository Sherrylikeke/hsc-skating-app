import {db,profiles} from '../../../lib/club-store';
import {bodyJSON,failure,json,rateLimit} from '../../../lib/member-access';
import {requestMember} from '../../../lib/member-runtime';
import {memberRegistrations,saveMemberRegistration} from '../../../lib/member-registrations';

export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    const member=await requestMember(request);
    return json({plans:await memberRegistrations(db(),member)});
  }catch(error){return failure(error);}
}
export async function POST(request:Request) {
  try {
    const member=await requestMember(request),body=await bodyJSON(request),database=db();
    await rateLimit(database,`registration-plan:${member.id}`,80);
    return json({plan:await saveMemberRegistration(database,member,body,await profiles())});
  }catch(error){return failure(error);}
}
