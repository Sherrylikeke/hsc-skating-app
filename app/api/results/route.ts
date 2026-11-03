import {requestMember} from '../../../lib/member-runtime';
import {db,ensureHistory} from '../../../lib/club-store';
import {json,failure} from '../../../lib/member-access';
import {loadCompetitionResults,loadCompetitionMarks} from '../../../lib/results-source';
import type {HistoryRecord} from '../../../lib/club-types';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    await requestMember(request);await ensureHistory();const id=new URL(request.url).searchParams.get('record');
    if(!id||id.length>100)return json({error:'Record required'},400);
    const found=await db().prepare('SELECT payload FROM history_records WHERE id = ?').bind(id).first<{payload:string}>();
    if(!found)return json({error:'Record not found'},404);
    const params=new URL(request.url).searchParams,record=JSON.parse(found.payload) as HistoryRecord;
    try{if(params.has('entry'))return json(await loadCompetitionMarks(record,params.get('board')||'',params.get('entry')||''));return json(await loadCompetitionResults(record));}
    catch{return json({error:'Full official results could not be loaded. Please open the official source or retry.'},502);}
  }catch(error){return failure(error);}
}
