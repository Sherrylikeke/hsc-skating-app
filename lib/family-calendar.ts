import type {ClubEvent,ClubSkater,ScheduleRow} from './club-types.ts';
import {confirmedGroupInterval,watchChoices,watchedRows} from './event-watch.ts';
import {categoryCompatible,groupOf} from './official-parser.ts';

type Session = {row:ScheduleRow; interval:ReturnType<typeof confirmedGroupInterval>};
type Registration = {id:string; name:string; skaterId:string; category:string; event:ClubEvent};
export type CalendarDay = {sessions:Session[]; registrations:Registration[]};

export function rinkGroups(sessions:Session[],events:ClubEvent[]) {
  const venues=new Map(events.map(event=>[event.id,event.venue || event.name]));
  const surfaces=new Map<string,{ice:string;venue:string;sessions:Session[]}>();
  for(const session of sessions) {
    const {row}=session, venue=venues.get(row.eventId)??row.eventName;
    const rinks=new Set([row.rink,...(row.candidates??[]).map(c=>c.rink)].filter(Boolean));
    for(const ice of rinks) {
      const key=JSON.stringify([venue,ice]);
      const surface=surfaces.get(key)??{ice,venue,sessions:[]};
      surface.sessions.push(session);
      surfaces.set(key,surface);
    }
  }
  return surfaces;
}

export function familyCalendar(events:ClubEvent[],skaters:ClubSkater[],ownIds:string[],friends:(eventId:string)=>string[]) {
  const days=new Map<string,CalendarDay>();
  const undated:Registration[]=[];
  function day(date:string) {
    const value=days.get(date) ?? {sessions:[],registrations:[]};
    days.set(date,value);
    return value;
  }
  for(const event of events) {
    const selected=new Set([...ownIds,...friends(event.id)]);
    if(!selected.size) continue;
    const rows=watchedRows(event,skaters,selected);
    for(const row of rows) day(row.date).sessions.push({row,interval:confirmedGroupInterval(row)});
    for(const choice of watchChoices(event,skaters)) {
      if(!selected.has(choice.id)) continue;
      for(const entry of choice.entries) {
        const group=groupOf(entry.category);
        if(rows.some(({skaterId,category})=>skaterId===choice.id && categoryCompatible(entry.category,category)
          && (group===null || groupOf(category)===null || groupOf(category)===group))) continue;
        const registration={id:JSON.stringify([event.id,choice.id,entry.id]),name:choice.name,skaterId:choice.id,category:entry.category,event};
        if(event.start===event.end) day(event.start).registrations.push(registration);
        else undated.push(registration);
      }
    }
  }
  return {days,undated};
}

// Compare actual instants even when two competition rinks use different time zones.
export function familyOverlaps(sessions:Session[],ownIds:string[]) {
  const timed=sessions.flatMap(({row,interval})=>interval && ownIds.includes(row.skaterId)?[{row,...interval}]:[])
    .sort((a,b)=>a.start-b.start);
  const overlaps=[];
  for(const [i,a] of timed.entries()) {
    for(let j=i+1;j<timed.length && timed[j].start<a.end;j++) {
      const b=timed[j];
      if(a.row.skaterId!==b.row.skaterId) overlaps.push({a:a.row,b:b.row,start:b.start,end:Math.min(a.end,b.end)});
    }
  }
  return overlaps;
}
