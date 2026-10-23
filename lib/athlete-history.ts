import type {HistoryRecord} from './club-types';
import {seasonOf} from './club-types.ts';
export type HistoryFilters={season:string;category:string;level:string;event:string;status:string;query:string};
export const emptyHistoryFilters:HistoryFilters={season:'',category:'',level:'',event:'',status:'',query:''};
export function filterAthleteHistory(rows:HistoryRecord[],f:HistoryFilters){return rows.filter(r=>(!f.season||seasonOf(r.start_date)===f.season)&&(!f.category||r.category===f.category)&&(!f.level||r.result_level===f.level)&&(!f.event||r.event_key===f.event)&&(!f.status||r.status===f.status)&&(!f.query||`${r.event_name} ${r.category} ${r.club}`.toLocaleLowerCase().includes(f.query.toLocaleLowerCase().trim())));}
export function scoreSeries(rows:HistoryRecord[]){
  const groups=new Map<string,HistoryRecord[]>();
  for(const row of rows){if(row.status!=='result'||row.total_score===null||String(row.total_score).trim()===''||!Number.isFinite(Number(row.total_score))||row.entity_type==='team')continue;const key=`${row.category} · ${row.result_level==='segment'?'分项分数':row.result_level==='category'?'类别总分':row.result_level==='entry'?'条目成绩':row.result_level}`;groups.set(key,[...(groups.get(key)||[]),row]);}
  return [...groups].map(([label,records])=>({label,records:records.sort((a,b)=>a.start_date.localeCompare(b.start_date)||a.record_id.localeCompare(b.record_id))})).sort((a,b)=>b.records.length-a.records.length||a.label.localeCompare(b.label));
}
export function scoreTrend(rows:HistoryRecord[],requestedSeries=''){
  const series=scoreSeries(rows),active=series.find(group=>group.label===requestedSeries)||series[0];
  return {series,active,points:active?.records||[]};
}
