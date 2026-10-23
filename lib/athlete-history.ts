import type {HistoryRecord} from './club-types';
import {seasonOf} from './club-types.ts';
export type HistoryFilters={season:string;category:string;level:string;event:string;status:string;query:string};
export const emptyHistoryFilters:HistoryFilters={season:'',category:'',level:'',event:'',status:'',query:''};
export function historyCategory(value:string){
  return value.normalize('NFKC').replace(/^\s*Category\s*:\s*/i,'').replace(/\b(?:GROUP|GRP)\.?\s*(?:\d+|[A-Z])\b/gi,' ').replace(/\b(?:NON[\s-]*QUALIFYING|NQ)\b/gi,' ').replace(/\bPRE[\s-]*(JUVENILE|NOVICE)\b/gi,'PRE$1').replace(/\bSTAR\s*(\d+)\b/gi,'STAR $1').replace(/\b(STAR \d+)(?:\s+\1)+\b/gi,'$1').replace(/\bGIRLS\b/gi,'WOMEN').replace(/\bBOYS\b/gi,'MEN').replace(/\bSINGLES\b/gi,' ').replace(/\b([UO])\s*(\d{1,2})\b/gi,'$1$2').replace(/[()[\],:/–-]/g,' ').replace(/\s+/g,' ').trim().toUpperCase().replace(/\b([UO]\d+)\s+(WOMEN|MEN)\b/g,'$2 $1');
}
const categoryWords:Record<string,string>={PREJUVENILE:'Pre-Juvenile',PRENOVICE:'Pre-Novice',JUVENILE:'Juvenile',NOVICE:'Novice',JUNIOR:'Junior',SENIOR:'Senior',WOMEN:'Women',MEN:'Men',FREE:'Free',SHORT:'Short',ARTISTIC:'Artistic',CLASS:'Class'};
function categoryLabel(value:string,includeGender=false){
  const label=(includeGender?value:value.replace(/\b(?:WOMEN|MEN)\b/g,' ')).replace(/\s+/g,' ').trim()||value;
  return label.replace(/\b(PREJUVENILE|PRENOVICE|JUVENILE|NOVICE|JUNIOR|SENIOR|WOMEN|MEN|FREE|SHORT|ARTISTIC|CLASS)\b/g,word=>categoryWords[word]||word);
}
export function historyCategories(categories:string[]){
  const values=[...new Set(categories.map(historyCategory).filter(Boolean))],counts=new Map<string,number>();
  for(const value of values){const label=categoryLabel(value);counts.set(label,(counts.get(label)||0)+1);}
  return values.map(value=>({value,label:categoryLabel(value,(counts.get(categoryLabel(value))||0)>1)})).sort((first,second)=>first.label.localeCompare(second.label,undefined,{numeric:true}));
}
export function filterAthleteHistory(rows:HistoryRecord[],f:HistoryFilters){return rows.filter(r=>(!f.season||seasonOf(r.start_date)===f.season)&&(!f.category||historyCategory(r.category)===historyCategory(f.category))&&(!f.level||r.result_level===f.level)&&(!f.event||r.event_key===f.event)&&(!f.status||r.status===f.status)&&(!f.query||`${r.event_name} ${r.category} ${r.club}`.toLocaleLowerCase().includes(f.query.toLocaleLowerCase().trim())));}
export function scoreSeries(rows:HistoryRecord[]){
  const groups=new Map<string,HistoryRecord[]>();
  const labels=new Map(historyCategories(rows.map(row=>row.category)).map(category=>[category.value,category.label]));
  for(const row of rows){if(row.status!=='result'||row.total_score===null||String(row.total_score).trim()===''||!Number.isFinite(Number(row.total_score))||row.entity_type==='team')continue;const key=`${labels.get(historyCategory(row.category))||row.category} · ${row.result_level==='segment'?'分项分数':row.result_level==='category'?'类别总分':row.result_level==='entry'?'条目成绩':row.result_level}`;groups.set(key,[...(groups.get(key)||[]),row]);}
  return [...groups].map(([label,records])=>({label,records:records.sort((a,b)=>a.start_date.localeCompare(b.start_date)||a.record_id.localeCompare(b.record_id))})).sort((a,b)=>b.records.length-a.records.length||a.label.localeCompare(b.label));
}
export function scoreTrend(rows:HistoryRecord[],requestedSeries=''){
  const series=scoreSeries(rows),active=series.find(group=>group.label===requestedSeries)||series[0];
  return {series,active,points:active?.records||[]};
}
