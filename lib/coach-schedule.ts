import {splitCoaches} from './club-types.ts';

export type CoachScheduleFilters={event:string;coach:string;date:string;assignedOnly:boolean};
export function filterCoachSchedule<Row extends {eventId:string;coach:string;date:string}>(rows:Row[],filters:CoachScheduleFilters):Row[]{
  return rows.filter(row=>(!filters.event||row.eventId===filters.event)&&(!filters.assignedOnly||row.coach.trim())&&(!filters.coach||splitCoaches(row.coach).includes(filters.coach))&&(!filters.date||row.date===filters.date));
}
