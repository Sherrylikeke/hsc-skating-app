import {formatInTimeZone} from 'date-fns-tz';
import {compareEventDates} from './event-registration.ts';
import {scheduleInstant} from './schedule-time.ts';
import type {ClubEvent,ClubSkater,ScheduleRow} from './club-types.ts';

export type HomeScope='mine'|'team'|`skater:${string}`;
export function filterHomeSchedule<Row extends {skaterId:string}>(rows:Row[],ownIds:string[],scope:HomeScope):Row[] {
  const own=new Set(ownIds);
  if(scope==='mine')return rows.filter(row=>own.has(row.skaterId));
  if(scope==='team')return [...rows.filter(row=>own.has(row.skaterId)),...rows.filter(row=>!own.has(row.skaterId))];
  return rows.filter(row=>row.skaterId===scope.slice(7));
}

export function groupHomeSchedule(rows:ScheduleRow[], now:number) {
  const upcoming:ScheduleRow[] = [], pending:ScheduleRow[] = [], past:ScheduleRow[] = [];
  const localDates = new Map<string,string>();
  for (const row of rows) {
    let today = localDates.get(row.timezone);
    if (today === undefined) {
      try {
        today = formatInTimeZone(now, row.timezone, 'yyyy-MM-dd');
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        today = ''; // Keep the published row when the source zone cannot establish an end time.
      }
      localDates.set(row.timezone, today);
    }
    const end = row.date === today && !row.uncertain && row.end > row.start
      ? scheduleInstant(row.date, row.end, row.timezone) : null;
    if (row.date < today || (end !== null && end <= now)) past.push(row);
    else if (row.uncertain) pending.push(row);
    else upcoming.push(row);
  }
  return {upcoming,pending,past};
}

// Display-only windows. Keep the original rows for calendars, alerts and coach plans.
export function upcomingGroupWindows(rows:ScheduleRow[]) {
  const windows = new Map<string, ScheduleRow>();
  const pending: ScheduleRow[] = [];
  for (const row of rows) {
    const category = row.category.replace(/\s*\bGROUPS?\s*\d+(?:\s*(?:&|AND|,|[-–])\s*\d+)*/gi,'').trim();
    const candidates = (row.candidates ?? (category !== row.category ? [row] : []))
      .filter(slot=>slot.start && slot.end && slot.start < slot.end);
    if (row.activity !== 'competition' || !candidates.length) {
      pending.push(row);
      continue;
    }
    const id = [row.eventId,row.skaterId,row.date,category.toUpperCase()].join('|');
    const window: ScheduleRow = windows.get(id) ?? {...row,id,category,start:'',end:'',candidates:[],startingOrder:undefined};
    for (const slot of candidates) {
      if (!window.candidates!.some(current=>current.slotKey===slot.slotKey)) window.candidates!.push(slot);
      if (!window.start || slot.start < window.start) window.start = slot.start;
      if (slot.end > window.end) window.end = slot.end;
      if (window.rink !== slot.rink) window.rink = '';
    }
    windows.set(id,window);
  }
  return {windows:[...windows.values()],pending};
}

export function upcomingCompetitionCards(
  events:ClubEvent[], rows:ScheduleRow[], skaters:ClubSkater[], ownIds:string[], scope:HomeScope, now:number, today:string,
){
  const scopedRows=filterHomeSchedule(rows,ownIds,scope);
  const scopedSkaters=filterHomeSchedule(skaters.map(skater=>({skaterId:skater.id,skater})),ownIds,scope);
  const {upcoming,pending,past}=groupHomeSchedule(scopedRows,now);
  const {windows,pending:unmatched}=upcomingGroupWindows(pending);
  const scheduled=new Set(scopedRows.map(row=>row.eventId+'|'+row.skaterId));
  const rowsByEvent=new Map<string,ScheduleRow[]>();
  for(const row of [...upcoming,...windows,...unmatched].sort((a,b)=>
    a.date.localeCompare(b.date)||(a.start||'24:00').localeCompare(b.start||'24:00')
  )){
    const sessions=rowsByEvent.get(row.eventId);
    if(sessions)sessions.push(row);
    else rowsByEvent.set(row.eventId,[row]);
  }
  const cards=events.filter(event=>(event.end||event.start)>=today).sort(compareEventDates).flatMap(event=>{
    const sessions=rowsByEvent.get(event.id)||[];
    const entered=new Set(event.participants.flatMap(entry=>entry.skaterIds));
    const waiting=scopedSkaters.filter(({skaterId})=>entered.has(skaterId)&&!scheduled.has(event.id+'|'+skaterId))
      .map(({skater})=>skater);
    return sessions.length||waiting.length ? [{event,sessions,waiting}] : [];
  });
  return {cards,past};
}
