import {digest} from './member-access';

export type PilotRegistration={email:string;role:'parent'|'coach'|'skater';invitationHash:string;expiresAt:string};
export const pilotUsedKey=(pilot:PilotRegistration)=>'hsc-pilot-used:'+pilot.invitationHash;
export async function isRegisteredPilot(database:D1Database,userId:string):Promise<boolean> {
  const record=await database.prepare("SELECT key FROM app_meta WHERE key LIKE 'hsc-pilot-used:%' AND json_valid(value) AND json_extract(value,'$.userId')=? LIMIT 1").bind(userId).first();
  return !!record;
}
export async function pilotInvitationFor(configuration:string|undefined,token:string,email='',time=Date.now()):Promise<PilotRegistration|null> {
  if(!configuration||!/^[a-f0-9]{64}$/.test(token))return null;
  let entries:unknown;try{entries=JSON.parse(configuration);}catch{return null;}
  if(!Array.isArray(entries)||entries.length>20)return null;
  const hash=await digest(token);
  const matches=entries.filter((entry):entry is PilotRegistration=>{
    if(!entry||typeof entry!=='object'||typeof entry.email!=='string'||!/^\S+@\S+\.\S+$/.test(entry.email)||!['parent','coach','skater'].includes(entry.role)||typeof entry.invitationHash!=='string'||!/^[a-f0-9]{64}$/.test(entry.invitationHash)||typeof entry.expiresAt!=='string'||!Number.isFinite(Date.parse(entry.expiresAt))||Date.parse(entry.expiresAt)<=time)return false;
    let difference=0;for(let index=0;index<hash.length;index++)difference|=hash.charCodeAt(index)^entry.invitationHash.charCodeAt(index);
    return difference===0&&(!email||entry.email.trim().toLowerCase()===email.trim().toLowerCase());
  });
  if(matches.length!==1)return null;
  const result=matches[0],boundEmail=result.email.trim().toLowerCase();
  if(entries.filter(entry=>entry&&typeof entry.email==='string'&&entry.email.trim().toLowerCase()===boundEmail).length!==1)return null;
  return {...result,email:boundEmail};
}
