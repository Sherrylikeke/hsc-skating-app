import {formatInTimeZone, fromZonedTime} from 'date-fns-tz';

// A local clock reading during a DST gap or overlap cannot identify a unique instant.
export function scheduleInstant(date:string, clock:string, timezone:string):number | null {
  const local = date + 'T' + clock;
  const instant = fromZonedTime(local + ':00', timezone).getTime();
  if (!Number.isFinite(instant)) return null;
  const format = (time:number) => formatInTimeZone(time, timezone, "yyyy-MM-dd'T'HH:mm");
  if (format(instant) !== local || [instant-3600000, instant+3600000].some(time => format(time) === local)) return null;
  return instant;
}

export function arrivalReference(row:{uncertain:boolean;date:string;start:string;timezone:string}, meetingTime?:string):string | null {
  if (row.uncertain) return null;
  const start = scheduleInstant(row.date, row.start, row.timezone);
  if (start === null) return null;
  const arrival = start - 60 * 60 * 1000;
  if (meetingTime) {
    const meeting = scheduleInstant(meetingTime.slice(0,10), meetingTime.slice(11,16), row.timezone);
    if (meeting !== null && meeting <= arrival) return null;
  }
  const date = formatInTimeZone(arrival, row.timezone, 'yyyy-MM-dd');
  const clock = formatInTimeZone(arrival, row.timezone, 'HH:mm');
  const offset = scheduleInstant(date, clock, row.timezone) === null ? formatInTimeZone(arrival,row.timezone,' XXX') : '';
  return (date === row.date ? '' : date + ' ') + clock + offset;
}
