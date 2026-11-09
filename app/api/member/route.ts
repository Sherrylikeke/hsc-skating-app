import {db, profiles} from '../../../lib/club-store';
import {memberRequest} from '../../../lib/member-admin';
import {failure} from '../../../lib/member-access';
import {ownerEmail, requestIdentity} from '../../../lib/member-runtime';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  try {
    const action=new URL(request.url).searchParams.get('action')||'me';
    const accountOnly=['identity','me','session','logout','revoke-own-sessions'].includes(action);
    const identity=await requestIdentity(request);
    return await memberRequest({database:db(),identity,candidates:accountOnly?[]:await profiles(),ownerEmail},request);
  }
  catch (error) {return failure(error);}
}
export const GET = handle;
export const POST = handle;
