import type {ClubSkater,HistoryEvent,HistoryRecord,LiveEvent} from './club-types.ts';
import {parseResultPdf} from './competition-results.ts';
import {categoryCompatible,discoverDocuments,groupOf,normalizeName,plain} from './official-parser.ts';
import type {PdfItem} from './official-parser.ts';
import {outboxStatement} from './outbox-statement.ts';
import type {OfficialUpdate} from './official-updates.ts';

const prefix='official-results:';
const recordPrefix='official-result:';
const retryMinutes=45;
const onCompetitionDay=(event:LiveEvent,today:string)=>event.start<=today&&event.end>=today;
const torontoDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'});
const digest=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)))
  .map(byte=>byte.toString(16).padStart(2,'0')).join('');
const officialHub=(url:URL)=>url.protocol==='https:'&&/^(?:www\.)?skateontario\.org$/i.test(url.hostname)
  && !url.username&&!url.password&&/^\/results\/(?!entries(?:\/|$))[a-z\d_-]+(?:\/(?:index\.html?)?)?$/i.test(url.pathname);
const normalizeHub=(url:URL)=>{
  if(!url.pathname.endsWith('/')&&!/\.html?$/i.test(url.pathname))url.pathname+='/';
  return url;
};
const sameHost=(a:URL,b:URL)=>a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'');
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);
type FileProgress={attemptedAt:string;hash?:string;error?:string};
type Progress={checkedAt:string;source?:string;total:number;verified:number;rosterHash?:string;files:Record<string,FileProgress>;error?:string};
type ReadSource=(url:string,maxBytes?:number)=>Promise<Uint8Array>;
type ReadPdf=(bytes:Uint8Array)=>Promise<PdfItem[][]>;

export function resultCatalog(html:string,source:string){
  const hub=new URL(source);
  if(!officialHub(hub))return [];
  normalizeHub(hub);
  const root=new URL('./',hub).pathname;
  const files=new Map<string,string>();
  for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const category=plain(row[1].match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1]||'');
    if(!category)continue;
    for(const link of row[1].matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
      if(!/^RESULTS?$/i.test(plain(link[2])))continue;
      let url:URL;
      try{url=new URL(plain(link[1]),hub);}catch{continue;}
      if(url.protocol!=='https:'||!sameHost(url,hub)||url.username||url.password
        ||!url.pathname.startsWith(root)||!/^[-\w%&.+]+CR\.pdf$/i.test(url.pathname.slice(root.length)))continue;
      url.hostname=hub.hostname;url.hash='';url.search='';
      files.set(url.href,category);
    }
  }
  return [...files].map(([url,category])=>({url,category}));
}

export function resultHub(event:LiveEvent,html:string){
  const documents=[...discoverDocuments(html,event.url),...event.documents];
  // Some organizers label a combined entry, start-order and results directory "Entry Lists".
  const found=documents.find(doc=>doc.kind!=='schedule'&&officialHub(new URL(doc.url)));
  if(found)return normalizeHub(new URL(found.url)).href;
  if(event.id==='SO-325449'&&event.start==='2026-11-20'&&event.end==='2026-11-22')
    return 'https://skateontario.org/results/27KES/';
  return undefined;
}

export async function resultRecords(event:LiveEvent,roster:ClubSkater[],category:string,hub:string,pages:PdfItem[][],file:string){
  const boards=parseResultPdf(pages,file).filter(board=>board.kind==='category');
  if(!boards.length)throw Error('未读到可核对的官方总成绩表');
  const names=new Map<string,ClubSkater[]>();
  for(const skater of roster){
    if(skater.identityPending)continue;
    const key=normalizeName(skater.name);
    names.set(key,[...(names.get(key)||[]),skater]);
  }
  const records=new Map<string,HistoryRecord>();
  for(const row of boards.flatMap(board=>board.rows)){
    const withdrawn=/^(?:WD|WDR|DNS)$/i.test(row.status);
    if(!withdrawn&&(row.status!=='result'||row.rank===null||row.total===null))continue;
    const club=normalizeName(row.club.replace(/(?:,?\s+|,)ON$/i,''));
    const team=row.name.includes(' / ');
    const skaterIds=[...new Set(row.name.split(/\s*\/\s*/).flatMap(name=>{
      const candidates=names.get(normalizeName(name));
      if(candidates?.length!==1)return [];
      const skater=candidates[0];
      const entered=event.participants.some(entry=>entry.skaterIds.includes(skater.id)&&normalizeName(entry.club)===club);
      return club&&(entered||club==='hamilton sc'||club==='hamilton skating club'||skater.clubs.some(value=>normalizeName(value)===club))?[skater.id]:[];
    }))];
    if(!skaterIds.length)continue;
    const key=[event.id,category,normalizeName(row.name)].join('|');
    const id=recordPrefix+await digest(new TextEncoder().encode(key));
    records.set(id,{record_id:id,event_key:event.id,event_name:event.name,event_url:hub,
      start_date:event.start,end_date:event.end,category,name:row.name,club:row.club,section:'',
      result_level:'category',rank:row.rank,total_score:row.total,source_url:file,source_page:row.page,
      status:withdrawn?'withdrawn':'result',skater_ids:skaterIds,entity_type:team?'team':'individual'});
  }
  return [...records.values()];
}

async function progress(database:D1Database,events:LiveEvent[]){
  const {results}=await database.prepare("SELECT key,value FROM app_meta WHERE key IN (SELECT ?||value FROM json_each(?))")
    .bind(prefix,JSON.stringify(events.map(event=>event.id))).all<{key:string;value:string}>();
  return new Map(results.map(row=>[row.key.slice(prefix.length),JSON.parse(row.value) as Progress]));
}

export async function selectHistoryImports(database:D1Database,events:LiveEvent[],today:string,now:number){
  const cutoff=new Date(today+'T12:00:00Z');
  cutoff.setUTCDate(cutoff.getUTCDate()-7);
  const recent=events.filter(event=>event.start<=today&&event.end>=cutoff.toISOString().slice(0,10));
  if(!recent.length)return [];
  const states=await progress(database,recent);
  const ready=recent.filter(event=>{
    const state=states.get(event.id);
    const complete=state&&state.total>0&&state.verified===state.total&&!state.error;
    const interval=complete&&!onCompetitionDay(event,today)?24*60:retryMinutes;
    return !state||now-Date.parse(state.checkedAt)>=interval*60_000;
  }).sort((a,b)=>(states.get(a.id)?.checkedAt||'').localeCompare(states.get(b.id)?.checkedAt||'')
    ||b.end.localeCompare(a.end)||a.id.localeCompare(b.id));
  const inProgress=ready.filter(event=>onCompetitionDay(event,today)).slice(0,2);
  const finished=ready.find(event=>!onCompetitionDay(event,today));
  return finished?[...inProgress,finished]:inProgress;
}

export async function importHistory(database:D1Database,event:LiveEvent,roster:ClubSkater[],now:string,
  readSource:ReadSource,readPdf:ReadPdf){
  const old=(await progress(database,[event])).get(event.id);
  const state:Progress={checkedAt:now,source:old?.source,total:old?.total||0,verified:old?.verified||0,files:{...old?.files}};
  const updates:HistoryRecord[]=[];
  const errors:string[]=[];
  const active=onCompetitionDay(event,torontoDate.format(new Date(now)));
  try{
    const cached=resultHub(event,'')||old?.source;
    const hub=cached||resultHub(event,new TextDecoder().decode(await readSource(event.url)));
    if(hub){
      state.source=hub;
      const files=resultCatalog(new TextDecoder().decode(await readSource(hub)),hub);
      if(!files.length||files.length>160)throw Error('官方成绩目录缺少可验证的成绩表');
      state.rosterHash=await digest(new TextEncoder().encode(JSON.stringify(roster.map(
        ({id,name,identityPending,clubs})=>[id,name,Boolean(identityPending),clubs]
      ))));
      if(old?.rosterHash!==state.rosterHash)state.files={};
      const focus=event.participants.filter(entry=>entry.skaterIds.length);
      const priority=(category:string)=>focus.some(entry=>categoryCompatible(entry.category,category)
        &&(groupOf(entry.category)===null||groupOf(category)===null||groupOf(entry.category)===groupOf(category)));
      state.total=files.length;
      const checked=(url:string)=>state.files[url]?.hash&&!state.files[url]?.error;
      const interval=(active?retryMinutes:24*60)*60_000;
      const due=files.filter(file=>!checked(file.url)||Date.parse(now)-Date.parse(state.files[file.url].attemptedAt)>=interval);
      const oldest=(a:typeof files[number],b:typeof files[number])=>(state.files[a.url]?.attemptedAt||'').localeCompare(state.files[b.url]?.attemptedAt||'');
      const relevant=active?due.filter(file=>priority(file.category)).sort(oldest).slice(0,10):[];
      const selected=new Set(relevant);
      const batch=[...relevant,...due.filter(file=>!selected.has(file)).sort((a,b)=>oldest(a,b)
        ||Number(priority(b.category))-Number(priority(a.category))).slice(0,12-relevant.length)];
      for(const file of batch){
        const previous=state.files[file.url];
        try{
          const bytes=await readSource(file.url,8_000_000);
          if(active&&!previous?.hash&&/^\s*<(?:!DOCTYPE HTML|html\b)/i.test(new TextDecoder().decode(bytes.slice(0,128)))){
            state.files[file.url]={attemptedAt:now};
            continue;
          }
          const hash=await digest(bytes);
          if(hash!==previous?.hash)updates.push(...await resultRecords(event,roster,file.category,hub,await readPdf(bytes),file.url));
          state.files[file.url]={attemptedAt:now,hash};
        }catch(error){
          const detail=errorText(error);
          state.files[file.url]={attemptedAt:now,hash:previous?.hash,
            error:active&&!previous?.hash&&/\bHTTP (?:404|410)\b/.test(detail)?undefined:detail};
        }
      }
      state.verified=files.filter(file=>checked(file.url)).length;
      for(const file of files)if(state.files[file.url]?.error)
        errors.push(new URL(file.url).pathname.split('/').pop()+': '+state.files[file.url].error);
    }
  }catch(error){errors.push(errorText(error));}
  if(errors.length)state.error=errors.join('；');
  const writes=updates.map(row=>database.prepare('INSERT INTO history_records (id,event_id,payload) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload')
    .bind(row.record_id,event.id,JSON.stringify(row)));
  if(updates.length){
    const {results}=await database.prepare('SELECT payload FROM history_records WHERE event_id=?').bind(event.id).all<{payload:string}>();
    const archive=new Map(results.map(({payload})=>{const row=JSON.parse(payload) as HistoryRecord;return [row.record_id,row];}));
    for(const row of updates){
      const previous=archive.get(row.record_id);
      const changed=!previous||row.rank!==previous.rank||row.total_score!==previous.total_score||row.status!==previous.status;
      const result={rank:row.rank,totalScore:row.total_score,withdrawn:row.status==='withdrawn',revised:!!previous};
      for(const skaterId of row.skater_ids){
        if(!changed&&previous?.skater_ids.includes(skaterId))continue;
        const changeId=crypto.randomUUID(),skaterName=roster.find(skater=>skater.id===skaterId)?.name||row.name;
        const payload:OfficialUpdate={changeId,eventId:event.id,eventName:event.name,skaterName,source:row.source_url,
          checkedAt:now,entryChanged:false,scheduleChanged:false,removed:false,categories:[row.category],sessions:[],result};
        writes.push(outboxStatement(database,{id:'results|'+changeId,kind:'official-update',subjectId:changeId,skaterId,payload}));
      }
      archive.set(row.record_id,row);
    }
    const records=[...archive.values()];
    const item:HistoryEvent={id:event.id,name:event.name,url:state.source!,start:event.start,end:event.end,dateBasis:'Skate Ontario',
      recordCount:records.length,teamCount:records.filter(row=>row.entity_type==='team').length,
      skaterIds:[...new Set(records.flatMap(row=>row.skater_ids))]};
    writes.push(database.prepare('INSERT INTO history_events (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload')
      .bind(item.id,JSON.stringify(item)));
  }
  writes.push(database.prepare('INSERT INTO app_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .bind(prefix+event.id,JSON.stringify(state)));
  await database.batch(writes);
  const saved=await database.prepare('SELECT count(*) AS n FROM history_records WHERE event_id=?').bind(event.id).first<{n:number}>();
  return {id:event.id,name:event.name,checkedAt:now,files:state.total,verified:state.verified,records:saved?.n||0,errors};
}

export async function historyImportStatus(database:D1Database){
  const {results}=await database.prepare("SELECT key,value FROM app_meta WHERE key LIKE 'official-results:%'").all<{key:string;value:string}>();
  return results.map(row=>{
    const state=JSON.parse(row.value) as Progress;
    return {id:row.key.slice(prefix.length),checkedAt:state.checkedAt,files:state.total,verified:state.verified,error:state.error};
  });
}
