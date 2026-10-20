import type {LiveEvent,Participant,ScheduleBlock,OfficialDocument,ClubSkater,ScheduleRow} from './club-types';
export type PdfItem={str:string;x:number;y:number};
export function plain(value:string){return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;|&#0*38;/g,'&').replace(/&quot;|&#34;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\s+/g,' ').trim();}
export const normalizeName=(name:string)=>plain(name).normalize('NFKC').toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const attribute=(text:string,name:string)=>{const m=text.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,'i'));return m?plain(m[2]):'';};
export function categoryKey(value:string){
  const text=plain(value).toUpperCase().replace(/PRE[ -]?NOVICE/g,'PRENOVICE');
  const level=text.match(/\b(PRENOVICE|NOVICE|JUNIOR|SENIOR|STAR\s*\d+)\b/)?.[1]||'';
  let discipline='';if(/\bPAIR(S)?\b/.test(text))discipline='PAIR';else if(/S[YW]N?CHRO|SYNCHRO/.test(text))discipline='SYNCHRO';else if(/\bSOLO\b/.test(text))discipline='SOLO';else if(/DANCE/.test(text))discipline='DANCE';else if(/\bWOMEN\b|\bGIRLS\b/.test(text))discipline='WOMEN';else if(/\bMEN\b|\bBOYS\b/.test(text))discipline='MEN';
  return level&&discipline?`${level}:${discipline}`:'';
}
export const groupOf=(value:string)=>{const m=value.match(/\bGROUP\s*([0-9]+)/i);return m?Number(m[1]):null;};
export function discoverDocuments(html:string,base:string):OfficialDocument[]{
  const found=new Map<string,OfficialDocument>();
  for(const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=attribute(match[1],'href');if(!href)continue;
    let url:URL;try{url=new URL(href,base);}catch{continue;}
    if(!/^https?:$/.test(url.protocol))continue;
    const label=plain(match[2]);const signal=label+' '+url.pathname;
    const kind=/schedule/i.test(signal)?'schedule':/entry\s*list|start\s*order|cssEntryList|entries/i.test(signal)?'entries':/result/i.test(signal)?'results':null;
    if(!kind || (!/\.pdf$/i.test(url.pathname) && !/dstools\.ca$|skatingresults\.ca$|skateontario\.org$/.test(url.hostname)))continue;
    // Keep entry lists and actual schedule files, not navigation/category pages.
    if(kind==='schedule' && !/\.pdf$/i.test(url.pathname))continue;
    if(kind==='results' && !/\.pdf$|index\.|\.htm$/i.test(url.pathname))continue;
    found.set(url.href,{url:url.href,label:label||kind,kind});
  }
  return [...found.values()];
}
export function calendarEvent(raw:Record<string,unknown>,checkedAt:string):LiveEvent{
  const venue=raw.venue as Record<string,string>|undefined;
  return {id:`SO-${raw.id}`,name:plain(String(raw.title||'')),url:String(raw.url||''),start:String(raw.start_date||'').slice(0,10),end:String(raw.end_date||'').slice(0,10),timezone:String(raw.timezone||'America/Toronto'),venue:venue?.venue||'',city:venue?.city||'',updateText:plain(String(raw.description||'')).slice(0,450),officialModified:String(raw.modified||''),checkedAt,documents:[],participants:[],blocks:[],entryStatus:'尚未读取名单',scheduleStatus:'尚未读取赛程',source:'Skate Ontario'};
}
export function parseEntries(html:string,sourceUrl:string,roster:Array<{id:string;name:string;identityPending?:boolean}>):Participant[]{
  const names=new Map<string,string[]>();
  for(const row of roster){if(row.identityPending)continue;const key=normalizeName(row.name);names.set(key,[...(names.get(key)||[]),row.id]);}
  const rows:Participant[]=[];
  for(const match of html.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)){
    const category=attribute(match[1],'data-category');if(!category)continue;
    const spans=[...match[2].matchAll(/<span\b[^>]*class=["'][^"']*\bskater-name\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)];
    const name=spans.length?spans.map(m=>plain(m[1])).join(' / '):plain(match[2].match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1]||'');
    if(!name)continue;
    const parts=name.split(/\s*\/\s*/);const skaterIds:string[]=[];
    for(const part of parts){const matches=names.get(normalizeName(part))||[];if(matches.length===1)skaterIds.push(matches[0]);}
    rows.push({id:`${category}|${name}`,name,category,club:attribute(match[1],'data-club'),section:attribute(match[1],'data-section'),skaterIds:[...new Set(skaterIds)],matchStatus:skaterIds.length?'官方名单同名匹配，身份待核对':'其他参赛者',sourceUrl});
  }
  return rows;
}
function time24(value:string){const m=value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!m)return '';const hour=(Number(m[1])%12)+(m[3].toUpperCase()==='PM'?12:0);return `${String(hour).padStart(2,'0')}:${m[2]}`;}
function pageDate(items:PdfItem[]){
  const text=items.map(i=>i.str).join(' ');const m=text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})/i);
  if(!m)return '';const months=['january','february','march','april','may','june','july','august','september','october','november','december'];return `${m[3]}-${String(months.indexOf(m[1].toLowerCase())+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`;
}
export function parseScheduleItems(pages:PdfItem[][],sourceUrl:string):ScheduleBlock[]{
  const blocks:ScheduleBlock[]=[];
  pages.forEach((items,page)=>{
    const date=pageDate(items);if(!date)return;
    const starts=items.filter(i=>i.str.trim()==='START').sort((a,b)=>a.x-b.x);
    for(let col=0;col<starts.length;col++){
      const header=starts[col];const left=header.x-25;const right=starts[col+1]?starts[col+1].x-25:Infinity;
      const rink=items.filter(i=>Math.abs(i.y-header.y)<3 && i.x>header.x+40 && i.x<right && /RINK/i.test(i.str)).map(i=>i.str).join(' ');if(!rink)continue;
      const content=items.filter(i=>i.str.trim() && i.y<header.y-3 && i.x>=left && i.x<right).sort((a,b)=>b.y-a.y||a.x-b.x);
      const lines:Array<{y:number;items:PdfItem[]}>=[];
      for(const item of content){let line=lines.find(l=>Math.abs(l.y-item.y)<2);if(!line){line={y:item.y,items:[]};lines.push(line);}line.items.push(item);}
      for(const line of lines){
        const text=line.items.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim();
        const m=text.match(/^(\d{1,2}:\d{2}\s*[AP]M)\s+(\d{1,2}:\d{2}\s*[AP]M)\s+(.+)$/i);if(!m)continue;
        const category=m[3].trim();const key=categoryKey(category);if(!key || /FLOOD|GOOD NIGHT|DRIVE SAFE/.test(category))continue;
        const start=time24(m[1]),end=time24(m[2]);if(!start||!end||start>=end)continue;
        const range=category.match(/\((\d+)\s*[-–]\s*(\d+)\)/);
        blocks.push({id:`${date}|${rink}|${start}|${category}`,date,start,end,rink,category,categoryKey:key,group:groupOf(category),range:range?[Number(range[1]),Number(range[2])]:null,activity:/PRACTICE/i.test(category)?'practice':'competition',page:page+1,sourceUrl});
      }
    }
  });
  return blocks.sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
}
export function scheduleRows(events:LiveEvent[],skaters:ClubSkater[]):ScheduleRow[]{
  const skaterMap=new Map(skaters.map(row=>[row.id,row]));const output=new Map<string,ScheduleRow>();
  for(const event of events)for(const entry of event.participants){
    const key=categoryKey(entry.category),group=groupOf(entry.category);if(!key)continue;
    const matching=event.blocks.filter(block=>block.categoryKey===key && (group===null || block.group===null || group===block.group));
    for(const id of entry.skaterIds){const skater=skaterMap.get(id);if(!skater)continue;
      for(const block of matching){const uncertain=(block.group!==null&&group===null)||block.range!==null;const rowId=`${event.id}|${id}|${block.id}`;
        const normalized=block.category.toUpperCase().replace(/\s+/g,' ').trim();
        const occurrence=event.blocks.filter(other=>other.category.toUpperCase().replace(/\s+/g,' ').trim()===normalized).findIndex(other=>other.id===block.id);
        const slotKey=`${normalized}:${occurrence}`;
        output.set(rowId,{id:rowId,slotKey,eventId:event.id,eventName:event.name,eventUrl:event.url,skaterId:id,skaterName:skater.name,coach:skater.coach,category:block.category,date:block.date,start:block.start,end:block.end,rink:block.rink,activity:block.activity,uncertain,sourceUrl:block.sourceUrl,page:block.page,timezone:event.timezone,matchStatus:entry.matchStatus});
      }
    }
  }
  return [...output.values()].sort((a,b)=>`${a.date} ${a.start} ${a.skaterName}`.localeCompare(`${b.date} ${b.start} ${b.skaterName}`));
}
