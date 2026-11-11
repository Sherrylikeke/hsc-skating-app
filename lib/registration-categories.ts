import type {ClubEvent,ClubSkater,RegistrationCategory} from './club-types';
import {categoryKey} from './official-parser.ts';
import {seasonOf} from './club-types.ts';

export function registrationYearStart(today:string){
  const [year,month,day]=today.split('-').map(Number);
  const lastDay=new Date(Date.UTC(year-1,month,0)).getUTCDate();
  return `${year-1}-${String(month).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
}
export function registrationLevel(category:string){
  return category.normalize('NFKC').toUpperCase().replace(/PRE[ -]?NOVICE/g,'PRENOVICE').replace(/PRE[ -]?JUVENILE/g,'PREJUVENILE').replace(/\bSTAR\s*(10|[1-9])\b/g,'STAR $1').match(/\b(PREJUVENILE|JUVENILE|PRENOVICE|NOVICE|JUNIOR|SENIOR|GOLD|ADULT|STAR (?:10|[1-9]))\b/)?.[1]||'';
}
export function registrationDiscipline(category:string){
  if(/\bART(?:ISTIC)?\b/i.test(category))return 'ARTISTIC';
  const key=categoryKey(category).split(':')[1];
  if(key==='SOLO'&&/DANCE/i.test(category))return 'SOLO-DANCE';
  return ['WOMEN','MEN','FREESKATE'].includes(key)||!key?'SINGLES':key;
}
const genders=(category:string)=>[...new Set([...category.matchAll(/\b(WOMEN|GIRLS|MEN|BOYS)\b/gi)].map(match=>/women|girls/i.test(match[1])?'Women':'Men'))];
const ages=(category:string)=>[...new Set([...category.matchAll(/\b([UO])\s*(\d{1,2})\b/gi)].map(match=>(match[1]+match[2]).toUpperCase()))];
function completeCategory(category:string,date:string,context:RegistrationCategory[]){
  // Some official results say "Juvenile / Singles". Retain the latest level,
  // filling omitted details only from this skater's recent records at that level.
  const references=context.filter(row=>row.date<=date&&registrationLevel(row.category)===registrationLevel(category)&&registrationDiscipline(row.category)===registrationDiscipline(category));
  const knownGenders=[...new Set(references.flatMap(row=>genders(row.category)))];
  const gender=!genders(category).length&&knownGenders.length===1?knownGenders[0]:'';
  // Age bands are season-specific; do not carry an age over the July boundary.
  const datedAges=references.filter(row=>seasonOf(row.date)===seasonOf(date)&&ages(row.category).length).sort((a,b)=>b.date.localeCompare(a.date));
  const knownAges=[...new Set(datedAges.filter(row=>row.date===datedAges[0]?.date).flatMap(row=>ages(row.category)))];
  const age=!ages(category).length&&knownAges.length===1?knownAges[0]:'';
  return [category,gender,age].filter(Boolean).join(' ');
}
const validDate=(value:string)=>/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;

// A dated entry establishes a current level; lifetime profile labels do not.
// Keep disciplines separate so advancing in singles does not erase dance entries.
export function homeRegistrationCategories(skater:ClubSkater,events:ClubEvent[],today:string){
  const since=registrationYearStart(today);
  const history=(skater.registrationHistory||[]).filter(row=>validDate(row.date)&&row.date>=since&&row.date<=today);
  const entries=events.filter(event=>validDate(event.start)&&(event.end||event.start)>=since).flatMap(event=>event.participants.filter(entry=>entry.skaterIds.includes(skater.id)).map(entry=>({date:event.start,category:entry.category})));
  const context=[...history,...entries];
  const latest=new Map<string,{date:string;categories:Set<string>}>();
  for(const row of context){
    if(!registrationLevel(row.category))continue;
    const family=registrationDiscipline(row.category),previous=latest.get(family);
    // Short/free are two segments of the same registration level.
    const category=row.category.replace(/\b(?:SHORT|FREE(?:SKATE)?)\b|\b(?:GROUP|GRP)\.?\s*(?:\d+|[A-Z])\b/gi,' ').replace(/[()]/g,' ').replace(/\s+/g,' ').trim();
    if(!previous||row.date>previous.date)latest.set(family,{date:row.date,categories:new Set([category])});
    else if(row.date===previous.date)previous.categories.add(category);
  }
  const categories=[...latest.values()].flatMap(row=>[...row.categories].map(category=>completeCategory(category,row.date,context)));
  const assumedBeginner=!categories.length&&!skater.hasRegistrationHistory&&!skater.recordCount&&!skater.categories.length&&!skater.registrationHistory?.length&&!entries.length;
  return {categories:assumedBeginner?['STAR 1','STAR 2','STAR 3','STAR 4']:categories,assumedBeginner};
}

export function attachRegistrationHistory(skaters:ClubSkater[],rows:Array<{skaterIds:string[];date:string;category:string;status:string}>,today:string){
  const bySkater=new Map<string,RegistrationCategory[]>();
  const since=registrationYearStart(today);
  for(const row of rows)for(const id of row.skaterIds){const values=bySkater.get(id)||[];if(row.date>=since&&row.date<=today&&row.status!=='withdrawn')values.push({date:row.date,category:row.category});bySkater.set(id,values);}
  return skaters.map(skater=>({...skater,hasRegistrationHistory:bySkater.has(skater.id),registrationHistory:bySkater.get(skater.id)||[]}));
}
