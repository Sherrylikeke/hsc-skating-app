import type {CoachPlan, ScheduleRow} from './club-types.ts';
import {arrivalReference, scheduleInstant} from './schedule-time.ts';

export const competitionChecklistItems=['skates','outfit','music','water','check-in'] as const;

export function competitionDayRows(rows:ScheduleRow[],ownIds:string[],date:string,skaterId='') {
  const own=new Set(ownIds);
  return rows.filter(row=>own.has(row.skaterId)&&row.date===date&&(!skaterId||row.skaterId===skaterId))
    .sort((a,b)=>{
      const instant=(row:ScheduleRow)=>row.uncertain?null:scheduleInstant(row.date,row.start,row.timezone);
      return (instant(a)??Infinity)-(instant(b)??Infinity)||a.skaterName.localeCompare(b.skaterName)||a.id.localeCompare(b.id);
    });
}

export function competitionDayPlan(row:ScheduleRow,plans:CoachPlan[]) {
  return plans.find(plan=>plan.skaterId===row.skaterId&&plan.eventId===row.eventId&&plan.slotKey===row.slotKey);
}

export function competitionDayArrival(row:ScheduleRow,meetingTime?:string):{time:string;meeting:boolean}|null {
  const guide=arrivalReference(row,meetingTime);
  if(guide)return {time:guide,meeting:false};
  if(row.uncertain||!meetingTime)return null;
  const start=scheduleInstant(row.date,row.start,row.timezone);
  const meeting=scheduleInstant(meetingTime.slice(0,10),meetingTime.slice(11,16),row.timezone);
  if(start===null||meeting===null||meeting>start-60*60*1000)return null;
  return {time:(meetingTime.slice(0,10)===row.date?'':meetingTime.slice(0,10)+' ')+meetingTime.slice(11,16),meeting:true};
}

export const competitionChecklistKey=(memberId:string,date:string)=>'hsc-competition-checklist:'+JSON.stringify([memberId,date]);
export const competitionChecklistItemKey=(skaterId:string,item:string)=>JSON.stringify([skaterId,item]);

export function readCompetitionChecklist(key:string,storage?:Pick<Storage,'getItem'>):string[] {
  try {
    const saved=JSON.parse((storage??localStorage).getItem(key)??'[]') as unknown;
    return Array.isArray(saved)?[...new Set(saved.filter((id):id is string=>typeof id==='string'))]:[];
  } catch {return [];}
}
