import type {ClubEvent, ClubSkater, Participant, ScheduleRow} from './club-types.ts';
import {categoryCompatible, groupOf, normalizeName, scheduleRows} from './official-parser.ts';
import {scheduleInstant} from './schedule-time.ts';

type Choice = {id:string; name:string; details:string[]; entries:Participant[]};
export const friendStorageKey=(memberId:string,eventId:string)=>'hsc-watch-friends:'+JSON.stringify([memberId,eventId]);
export function readFriends(key:string,defaults:string[]=[]):string[] {
  try {
    const saved=sessionStorage.getItem(key);
    if(saved===null)return [...defaults];
    const ids:unknown=JSON.parse(saved);
    return Array.isArray(ids) ? ids.filter((id):id is string=>typeof id==='string') : [...defaults];
  } catch { return [...defaults]; }
}
// When the source omits the club, keep separate entry records distinct.
const entryKey = (p:Participant) => 'entry:' + JSON.stringify([normalizeName(p.name),p.club,p.section,p.club?'':p.id]);

export function watchChoices(event:ClubEvent, skaters:ClubSkater[]) {
  const roster = new Map(skaters.map(s => [s.id,s.name]));
  const choices = new Map<string,Choice>();
  for (const p of event.participants) {
    const ids = p.skaterIds.filter(id => roster.has(id));
    for (const id of ids.length ? ids : [entryKey(p)]) {
      const choice = choices.get(id) ?? {id,name:roster.get(id) ?? p.name,details:[],entries:[]};
      const detail = [p.category,p.club].filter(Boolean).join(' · ');
      if (!choice.details.includes(detail)) choice.details.push(detail);
      choice.entries.push(p);
      choices.set(id,choice);
    }
  }
  return [...choices.values()].sort((a,b) => a.name.localeCompare(b.name));
}

export function defaultEventFriends(event:ClubEvent,skaters:ClubSkater[],ownIds:string[]=[]){
  const roster=new Set(skaters.map(skater=>skater.id)),own=new Set(ownIds);
  return watchChoices(event,skaters).filter(choice=>!own.has(choice.id)&&
    (roster.has(choice.id)||choice.entries.some(entry=>/^hamilton\s+(?:sc|skating\s+club)$/i.test(entry.club.trim())))).map(choice=>choice.id);
}

// Guests have no club profile. Scope their identity to this official entry and event.
export function guestSchedule(event:ClubEvent, followed:Set<string>) {
  const guests = event.participants.filter(p => followed.has(entryKey(p)));
  if (!guests.length) return [];
  const wantedNames = new Set(guests.map(p => normalizeName(p.name)));
  const entries = event.participants.filter(p => wantedNames.has(normalizeName(p.name)));
  const startingOrders = (event.startingOrders ?? []).flatMap(order => {
    const group = groupOf(order.category);
    const matches = entries.filter(p => normalizeName(p.name) === normalizeName(order.name)
      && categoryCompatible(p.category,order.category)
      && (group === null || groupOf(p.category) === null || groupOf(p.category) === group));
    if (matches.length !== 1 || !followed.has(entryKey(matches[0]))) return [];
    return [{...order,skaterIds:[entryKey(matches[0])]}];
  });
  const participants = guests.map(p => ({...p,skaterIds:[entryKey(p)]}));
  return scheduleRows([{...event,participants,startingOrders}],guests.map(p => ({id:entryKey(p),name:p.name,coach:''})));
}

export function watchedRows(event:ClubEvent,skaters:ClubSkater[],selected:Set<string>) {
  return [
    ...scheduleRows([{...event,participants:event.participants.filter(p=>p.skaterIds.some(id=>selected.has(id)))}],skaters.filter(s=>selected.has(s.id))),
    ...guestSchedule(event,selected),
  ];
}

export function confirmedGroupInterval(row:ScheduleRow) {
  const start = !row.uncertain && row.timezone ? scheduleInstant(row.date,row.start,row.timezone) : null;
  const end = start !== null ? scheduleInstant(row.date,row.end,row.timezone) : null;
  return start!==null && end!==null && end>start ? {start,end} : null;
}

export function watchTiming(row:ScheduleRow, now:number) {
  const interval=confirmedGroupInterval(row);
  if(!interval) return 'pending';
  const {start,end}=interval;
  if (end <= now) return 'ended';
  return start <= now ? 'ongoing' : 'upcoming';
}
