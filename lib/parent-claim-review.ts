import type {Candidate} from './member-access';
export type ParentClaimPayload={name:string;role:string;skaterIds:string[];note?:string;registrationMatch?:'matched'|'missing'|'ambiguous'};
export function parentClaimExistingSkater(payload:ParentClaimPayload,candidate:Candidate|undefined){
  return !!candidate&&!candidate.identityPending&&payload.registrationMatch!=='missing'&&payload.skaterIds.includes(candidate.id);
}
