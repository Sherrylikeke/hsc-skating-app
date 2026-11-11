import {splitCoaches} from './club-types.ts';
import {skaterNameSuggestions} from './skater-name-search.ts';
export function coachSuggestions(value:string,names:Iterable<string>){
  const parts=value.split(/[/／;；&]/),query=parts.pop()?.trim()??'',chosen=new Set(parts.map(part=>part.trim().toLowerCase()));
  const candidates=[...new Set([...names].flatMap(splitCoaches))].filter(name=>!chosen.has(name.toLowerCase()));
  return query.length<2?[]:skaterNameSuggestions(candidates,query).names;
}
export function chooseCoach(value:string,name:string){const index=Math.max(...['/','／',';','；','&'].map(separator=>value.lastIndexOf(separator)));return (index<0?'':value.slice(0,index+1)+' ')+name;}
