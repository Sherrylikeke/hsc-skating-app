import type {OfficialDocument,Participant} from './club-types';
import {STARTING_DRAW_VERSION} from './club-types.ts';

function documentKey(value:string){
  try{const url=new URL(value);return url.origin.replace('://www.','://')+decodeURIComponent(url.pathname).replace(/(?:EL|[A-Z]{2}\d+SO)\.pdf$/i,'').toLowerCase();}catch{return '';}
}
export function selectStartingOrderDocuments(documents:OfficialDocument[],participants:Participant[]){
  const related=new Set(participants.filter(participant=>participant.skaterIds.length).map(participant=>documentKey(participant.sourceUrl)).filter(Boolean));
  const priority=(document:OfficialDocument)=>{
    const outdated=document.parserVersion!==STARTING_DRAW_VERSION&&document.parserVersion!=='starting-api-1';
    const pending=(!document.attemptedAt&&!document.checkedAt)||(outdated&&!document.error);
    return pending?(related.has(documentKey(document.url))?0:1):2;
  };
  return documents.filter(document=>document.kind==='start-order').sort((first,second)=>priority(first)-priority(second)||(first.attemptedAt||first.checkedAt||'').localeCompare(second.attemptedAt||second.checkedAt||'')).slice(0,4);
}
