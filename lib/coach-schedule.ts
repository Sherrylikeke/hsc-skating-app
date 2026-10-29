import {splitCoaches} from './club-types.ts';
import type {ScheduleRow} from './club-types.ts';

export type CoachScheduleFilters={event:string;coach:string;date:string;assignedOnly:boolean};
export function filterCoachSchedule<Row extends {eventId:string;coach:string;date:string}>(rows:Row[],filters:CoachScheduleFilters):Row[]{
  return rows.filter(row=>(!filters.event||row.eventId===filters.event)&&(!filters.assignedOnly||row.coach.trim())&&(!filters.coach||splitCoaches(row.coach).includes(filters.coach))&&(!filters.date||row.date===filters.date));
}

export const hasCoachGroupTime=(row:ScheduleRow)=>!row.uncertain&&/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start);
export type CoachScheduleDay={date:string;skaterCount:number;sessionCount:number;unconfirmedCount:number;zones:Array<{timezone:string;rows:ScheduleRow[]}>};
export function groupCoachSchedule(rows:ScheduleRow[]):CoachScheduleDay[]{
  const dates=new Map<string,ScheduleRow[]>();
  for(const row of rows){const day=dates.get(row.date)||[];day.push(row);dates.set(row.date,day);}
  return [...dates].sort(([a],[b])=>(a||'9999').localeCompare(b||'9999')).map(([date,day])=>{
    const zones=new Map<string,ScheduleRow[]>();
    for(const row of day){const zone=zones.get(row.timezone)||[];zone.push(row);zones.set(row.timezone,zone);}
    return {date,skaterCount:new Set(day.map(row=>row.skaterId)).size,sessionCount:day.length,unconfirmedCount:day.filter(row=>!hasCoachGroupTime(row)).length,
      zones:[...zones].sort(([a],[b])=>a.localeCompare(b)).map(([timezone,zone])=>({timezone,rows:[...zone].sort((a,b)=>
        Number(!hasCoachGroupTime(a))-Number(!hasCoachGroupTime(b))||
        (hasCoachGroupTime(a)&&hasCoachGroupTime(b)?a.start.localeCompare(b.start):0)||
        a.skaterName.localeCompare(b.skaterName)||a.category.localeCompare(b.category)||a.id.localeCompare(b.id)
      )})),
    };
  });
}
export const orderCoachSchedule=(rows:ScheduleRow[])=>groupCoachSchedule(rows).flatMap(day=>day.zones.flatMap(zone=>zone.rows));
