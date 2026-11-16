import type {ClubEvent,ClubSkater} from './club-types.ts';
import {compareEventDates,homeEventCards} from './event-registration.ts';

export const registrationStatuses=['considering','submitted','waitlisted','not-attending'] as const;
export type RegistrationStatus=typeof registrationStatuses[number];
export type RegistrationPlan={skaterId:string;eventId:string;status:RegistrationStatus;updatedAt:string};
export const isRegistrationStatus=(value:unknown):value is RegistrationStatus=>registrationStatuses.some(status=>status===value);
export const futureRegistrationEvents=(events:ClubEvent[],today:string)=>events.filter(event=>(event.end||event.start)>=today).sort(compareEventDates);

export function registrationBoardCards(events:ClubEvent[],skaters:ClubSkater[],ownIds:string[],plans:RegistrationPlan[],today:string,now?:number) {
  const recommended=new Map(homeEventCards(events,skaters,ownIds,today,now).map(card=>[card.event.id,card]));
  const own=skaters.filter(skater=>ownIds.includes(skater.id));
  return futureRegistrationEvents(events,today).flatMap(event=>{
    const card=recommended.get(event.id);
    const rows=own.flatMap(skater=>{
      const plan=plans.find(plan=>plan.eventId===event.id&&plan.skaterId===skater.id);
      const entries=event.participants.filter(entry=>entry.skaterIds.includes(skater.id));
      const suggested=!!card?.matching.some(match=>match.id===skater.id);
      return plan||entries.length||suggested?[{skater,plan,entries,suggested}]:[];
    });
    return rows.length?[{event,rows}]:[];
  });
}
