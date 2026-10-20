import {getChatGPTUser} from '../../chatgpt-auth';
import {db, profiles} from '../../../lib/club-store';
import {memberRequest} from '../../../lib/member-admin';
import {failure} from '../../../lib/member-access';
import {ownerEmail} from '../../../lib/member-runtime';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  try {return await memberRequest({database: db(), identity: await getChatGPTUser(), candidates: await profiles(), ownerEmail}, request);}
  catch (error) {return failure(error);}
}
export const GET = handle;
export const POST = handle;
