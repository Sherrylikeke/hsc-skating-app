import type {Identity} from './member-access';

export type PilotRegistration={email:string;role:'parent'|'coach'|'skater'};
export function pilotRegistrationFor(configuration:string|undefined,identity:Identity|null,email=''):PilotRegistration|null {
  if(!configuration||!identity||identity.provider==='password')return null;
  const signedInEmail=identity.email.trim().toLowerCase();
  if(email&&email.trim().toLowerCase()!==signedInEmail)return null;
  let entries:unknown;try{entries=JSON.parse(configuration);}catch{return null;}
  if(!Array.isArray(entries)||entries.length>20)return null;
  const matches=entries.filter((entry):entry is PilotRegistration=>!!entry&&typeof entry==='object'&&typeof entry.email==='string'&&entry.email.trim().toLowerCase()===signedInEmail&&['parent','coach','skater'].includes(entry.role));
  return matches.length===1?{email:signedInEmail,role:matches[0].role}:null;
}
