import {db} from '../../../lib/club-store';
import {requestMember} from '../../../lib/member-runtime';
import {checkWrite,failure,stringField} from '../../../lib/member-access';
import {listOfficialNotices,readOfficialNotice} from '../../../lib/official-updates';
export async function GET(request:Request){try{return Response.json({notifications:await listOfficialNotices(db(),await requestMember(request))},{headers:{'Cache-Control':'no-store'}});}catch(error){return failure(error);}}
export async function POST(request:Request){try{const member=await requestMember(request);checkWrite(request);const body=await request.json() as {id?:unknown};await readOfficialNotice(db(),member,stringField(body.id,500));return Response.json({ok:true});}catch(error){return failure(error);}}
