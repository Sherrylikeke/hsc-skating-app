export function legacyVerificationAccess(configuration:string|undefined,userId:string):boolean {
  if(!configuration||!userId)return false;
  try{
    const entries:unknown=JSON.parse(configuration);
    return Array.isArray(entries)&&entries.length<=20&&entries.every(entry=>typeof entry==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(entry))&&entries.includes(userId);
  }catch{return false;}
}
