import type {Member} from './member-access';
import {splitCoaches} from './club-types.ts';
export const coachKey=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase().replace(/^jennifer jackson$/,'jen jackson');
export const isScheduleCoach=(member:Pick<Member,'role'|'requested_role'|'status'>)=>['active','club-viewer'].includes(member.status)&&(member.role==='coach'||!member.role&&member.requested_role==='coach');
export const assignedToCoach=(value:string,name:string)=>!!name&&splitCoaches(value).some(coach=>coachKey(coach)===coachKey(name));
export function coachScheduleRows<Row extends {coach:string}>(rows:Row[],name:string,hideOthers:boolean,extraCoaches:string[]){return rows.filter(row=>!hideOthers||assignedToCoach(row.coach,name)||extraCoaches.some(coach=>assignedToCoach(row.coach,coach))).sort((a,b)=>Number(assignedToCoach(b.coach,name))-Number(assignedToCoach(a.coach,name)));}
