const corrections=new Map([
  ['jen jackson','Jennifer Jackson'],
  ['jennifer jackson','Jennifer Jackson'],
  ['bryce davidson','Bryce Davison'],
  ['bryce davison','Bryce Davison'],
]);

// Keep saved historical spellings readable while using the corrected names everywhere.
export function canonicalCoachName(name:string){
  return corrections.get(name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase())??name;
}
export function canonicalCoachList(value:string){
  return value.split(/([/／;；&])/).map((part,index)=>index%2?part:part.replace(/\S(?:.*\S)?/,canonicalCoachName)).join('');
}
