import type {OfficialDocument,Participant} from './club-types';

function documentKey(value:string){
  try{const url=new URL(value);return url.origin.replace('://www.','://')+decodeURIComponent(url.pathname).replace(/(?:EL|[A-Z]{2}\d+SO)\.pdf$/i,'').toLowerCase();}catch{return '';}
}
export function selectStartingOrderDocuments(documents:OfficialDocument[],participants:Participant[]){
  const related=new Set(participants.filter(participant=>participant.skaterIds.length).map(participant=>documentKey(participant.sourceUrl)).filter(Boolean));
  const priority=(document:OfficialDocument)=>document.attemptedAt||document.checkedAt?2:related.has(documentKey(document.url))?0:1;
  return documents.filter(document=>document.kind==='start-order').sort((first,second)=>priority(first)-priority(second)||(first.attemptedAt||first.checkedAt||'').localeCompare(second.attemptedAt||second.checkedAt||'')).slice(0,4);
}
