import type {ClubSkater,OfficialDocument,Participant} from './club-types.ts';
import {normalizeName} from './official-parser.ts';

const representsHamilton=(club:string)=>/^hamilton (?:s\s*c|skating club)$/.test(normalizeName(club).replace(/\./g,'').trim());

export async function reconcileOfficialRoster(database:D1Database,roster:ClubSkater[],participants:Participant[],
  document:OfficialDocument,checkedAt:string){
  const verifiedSources=new Set(document.entryFiles
    ?document.entryFiles.filter(file=>file.checkedAt&&file.hash&&!file.error).map(file=>file.url)
    :document.checkedAt&&document.hash&&!document.error?[document.url]:[]);
  const names=new Map<string,string[]>();
  for(const skater of roster){
    const key=normalizeName(skater.name),current=names.get(key)||[];
    if(!skater.identityPending)current.push(skater.id);
    names.set(key,current);
  }
  const verified=participants.filter(entry=>verifiedSources.has(entry.sourceUrl));
  const otherClubs=new Set(verified.filter(entry=>!representsHamilton(entry.club)).map(entry=>normalizeName(entry.name)));
  const candidates=new Map<string,Participant>();
  for(const entry of verified){
    const key=normalizeName(entry.name);
    if(representsHamilton(entry.club)&&!names.has(key)&&!otherClubs.has(key)
      &&entry.name.length<=120&&/^[\p{L}\p{M}.'’ -]+$/u.test(entry.name)&&key.includes(' ')){
      candidates.set(key,entry);
    }
  }

  const pending=await Promise.all([...candidates].map(async ([key,entry])=>{
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
    const id='HSC-OFFICIAL-'+Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
    const payload={name:entry.name.trim(),normalizedName:key,training:false,identityPending:false,
      representedClubs:'Hamilton SC',officialEntrySource:entry.sourceUrl};
    const statement=database.prepare(`INSERT INTO hsc_admissions (skater_id,admitted,payload,updated_by,updated_at)
      SELECT ?,0,?,'official-entry-list',?
      WHERE NOT EXISTS (SELECT 1 FROM hsc_admissions WHERE COALESCE(json_extract(payload,'$.normalizedName'),lower(trim(json_extract(payload,'$.name'))))=?)
      ON CONFLICT(skater_id) DO NOTHING`).bind(id,JSON.stringify(payload),checkedAt,key);
    return {id,key,statement};
  }));
  let added=0;
  if(pending.length){
    const saved=await database.batch(pending.map(item=>item.statement));
    const concurrent:string[]=[];
    for(const [index,item] of pending.entries()){
      if(saved[index].meta.changes){names.set(item.key,[item.id]);added++;}
      else concurrent.push(item.key);
    }
    if(concurrent.length){
      const {results}=await database.prepare(`SELECT skater_id,payload FROM hsc_admissions WHERE
        COALESCE(json_extract(payload,'$.normalizedName'),lower(trim(json_extract(payload,'$.name')))) IN
        (SELECT value FROM json_each(?))`).bind(JSON.stringify(concurrent)).all<{skater_id:string;payload:string}>();
      for(const saved of results){
        const profile=JSON.parse(saved.payload) as {name:string;identityPending?:boolean};
        if(profile.identityPending)continue;
        const key=normalizeName(profile.name);
        names.set(key,[...(names.get(key)||[]),saved.skater_id]);
      }
    }
  }

  const matched=participants.map(entry=>{
    if(!verifiedSources.has(entry.sourceUrl))return entry;
    const skaterIds=[...new Set(entry.name.split(/\s*\/\s*/).flatMap(part=>{
      const ids=names.get(normalizeName(part))||[];
      return ids.length===1?ids:[];
    }))];
    if(skaterIds.join('|')===entry.skaterIds.join('|'))return entry;
    const interim=/\binterim\b/i.test(document.label+' '+document.url);
    return {...entry,skaterIds,matchStatus:skaterIds.length?(interim?'官方临时名单同名匹配，身份待核对':'官方名单同名匹配，身份待核对'):'其他参赛者'};
  });
  return {participants:matched,added,refreshRoster:pending.length>0};
}
