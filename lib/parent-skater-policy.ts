import type {Member} from './member-access';
export const PARENT_SKATER_LIMIT=4;
export const isParentAccount=(member:Pick<Member,'role'|'requested_role'>)=>member.role==='parent'||!member.role&&member.requested_role==='parent';
