import type {ScheduleRow} from './club-types.ts';
import {confirmedGroupInterval} from './event-watch.ts';

const escapeText=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp=(value:number)=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
// RFC 5545 folds at 75 octets, without splitting a UTF-8 character.
function fold(line:string) {
  const lines:string[]=[];let part='',size=0;
  for(const char of line){const bytes=new TextEncoder().encode(char).length;if(size+bytes>75){lines.push(part);part=' ';size=1;}part+=char;size+=bytes;}
  lines.push(part);return lines.join('\r\n');
}

export function calendarExport(rows:ScheduleRow[],now=Date.now()) {
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//HSC//Schedule Export//EN','CALSCALE:GREGORIAN'];
  const seen=new Set<string>();let count=0;
  for(const row of rows){
    const interval=confirmedGroupInterval(row);
    if(!interval||seen.has(row.id))continue;
    seen.add(row.id);count++;
    const uid=Array.from(new TextEncoder().encode(row.id),b=>b.toString(16).padStart(2,'0')).join('');
    lines.push('BEGIN:VEVENT','UID:'+uid+'@hsc.memberportal.dev','DTSTAMP:'+stamp(now),
      'DTSTART:'+stamp(interval.start),'DTEND:'+stamp(interval.end),
      'SUMMARY:'+escapeText(row.skaterName+' · '+row.category),
      'LOCATION:'+escapeText(row.rink+' · '+row.eventName),
      'DESCRIPTION:'+escapeText('Official group time, not individual skate time. One-time copy; check HSC for updates.\n官方组别时段，非个人开滑时间。单次导出，不会自动更新。\n'+row.timezone+'\n'+row.sourceUrl),
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return {count,content:lines.map(fold).join('\r\n')+'\r\n'};
}
