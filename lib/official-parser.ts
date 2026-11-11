import type {LiveEvent,Participant,ScheduleBlock,OfficialDocument,ClubSkater,ScheduleRow} from './club-types';
import {registrationDetails} from './event-registration.ts';
import {orderFor} from './starting-order.ts';
export type PdfItem={str:string;x:number;y:number;height?:number};
export function plain(value:string){return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;|&#0*38;/g,'&').replace(/&quot;|&#34;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\s+/g,' ').trim();}
export const normalizeName=(name:string)=>plain(name).normalize('NFKC').toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const attribute=(text:string,name:string)=>{const m=text.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,'i'));return m?plain(m[2]):'';};
export function categoryKey(value:string){
  const text=plain(value).toUpperCase().replace(/PRE[ -]?NOVICE/g,'PRENOVICE').replace(/PRE[ -]?JUVENILE/g,'PREJUVENILE');
  const level=text.match(/\b(PREJUVENILE|JUVENILE|PRENOVICE|NOVICE|JUNIOR|SENIOR|GOLD|ADULT|STAR\s*\d+)\b/)?.[1]||'';
  let discipline='';if(/\bTEAM\s+ELEMENTS\b/.test(text))discipline='TEAM-ELEMENTS';else if(/\bELEMENTS\b/.test(text))discipline='ELEMENTS';else if(/\bPAIR(S)?\b/.test(text))discipline='PAIR';else if(/S[YW]N?CHRO|SYNCHRO/.test(text))discipline='SYNCHRO';else if(/\bSOLO\b/.test(text))discipline='SOLO';else if(/DANCE/.test(text))discipline='DANCE';else if(/\bWOMEN\b|\bGIRLS\b/.test(text))discipline='WOMEN';else if(/\bMEN\b|\bBOYS\b/.test(text))discipline='MEN';else if(/^STAR\s*[1-3]$/.test(level))discipline='FREESKATE';
  return level&&discipline?`${level}:${discipline}`:'';
}
export const groupOf=(value:string)=>{const m=value.match(/\bGROUP\s*([0-9]+)/i);return m?Number(m[1]):null;};
export function categoryKeys(value:string){const shared=value.match(/\bSTAR\s*([1-4])\s*\/\s*([1-4])\b/i);return shared?[...new Set([shared[1],shared[2]].map(level=>categoryKey(value.replace(shared[0],'STAR '+level))))]:[categoryKey(value)];}
export function discoverDocuments(html:string,base:string):OfficialDocument[]{
  const found=new Map<string,OfficialDocument>();
  for(const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=attribute(match[1],'href');if(!href)continue;
    let url:URL;try{url=new URL(href,base);}catch{continue;}
    if(!/^https?:$/.test(url.protocol))continue;
    const label=plain(match[2]);const signal=label+' '+url.pathname;
    const kind=/schedule/i.test(signal)?'schedule':/start(?:ing)?[ -]*order|SO\.pdf$/i.test(signal)?'start-order':/(?:entry|interim)[\s_-]*list|cssEntryList|entries/i.test(signal)?'entries':/result/i.test(signal)?'results':null;
    if(!kind || (!/\.pdf$/i.test(url.pathname) && !/dstools\.ca$|skatingresults\.ca$|skateontario\.org$/.test(url.hostname)))continue;
    // Keep entry lists and actual schedule files, not navigation/category pages.
    if(kind==='schedule' && !/\.pdf$/i.test(url.pathname))continue;
    if(kind==='results' && !/\.pdf$|index\.|\.htm$|\/$/i.test(url.pathname))continue;
    found.set(url.href,{url:url.href,label:label||kind,kind});
  }
  return [...found.values()];
}
export function competitionSchedule(documents:OfficialDocument[]){return documents.find(document=>document.kind==='schedule'&&!/\bAWARDS?\b|AWARDS?[-_ ]SCHEDULE/i.test(document.label+' '+new URL(document.url).pathname));}
export function calendarEvent(raw:Record<string,unknown>,checkedAt:string):LiveEvent{
  const venue=raw.venue as Record<string,string>|undefined;
  return {...registrationDetails(String(raw.description||''),plain(String(raw.title||'')),String(raw.url||'')),id:`SO-${raw.id}`,name:plain(String(raw.title||'')),url:String(raw.url||''),start:String(raw.start_date||'').slice(0,10),end:String(raw.end_date||'').slice(0,10),timezone:String(raw.timezone||'America/Toronto'),venue:venue?.venue||'',city:venue?.city||'',updateText:plain(String(raw.description||'')).slice(0,450),officialModified:String(raw.modified||''),checkedAt,documents:[],participants:[],blocks:[],entryStatus:'尚未读取名单',scheduleStatus:'尚未读取赛程',source:'Skate Ontario'};
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
function time24(value:string){const match=value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!match||Number(match[1])<1||Number(match[1])>12||Number(match[2])>59)return '';const hour=(Number(match[1])%12)+(match[3].toUpperCase()==='PM'?12:0);return String(hour).padStart(2,'0')+':'+match[2];}
function pdfLines(items:PdfItem[],tolerance=2){
  const lines:Array<{y:number;items:PdfItem[]}>=[];for(const item of [...items].sort((first,second)=>second.y-first.y||first.x-second.x)){if(!item.str.trim())continue;let line=lines.find(value=>Math.abs(value.y-item.y)<tolerance);if(!line){line={y:item.y,items:[]};lines.push(line);}line.items.push(item);}return lines;
}
function dateOnLine(text:string){
  const matches=[...text.matchAll(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})/gi)];
  if(matches.length!==1)return '';const match=matches[0],months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const date=match[3]+'-'+String(months.indexOf(match[1].toLowerCase())+1).padStart(2,'0')+'-'+match[2].padStart(2,'0');
  return new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date?date:'';
}
export function parseScheduleDocument(pages:PdfItem[][],sourceUrl:string):{blocks:ScheduleBlock[];warnings:string[]}{
  const blocks:ScheduleBlock[]=[],warnings=new Set<string>();
  const pauses:Array<{date:string;rink:string;start:string;end:string}>=[];
  for(const [page,items] of pages.entries()){
    const anchors=pdfLines(items).map(line=>({y:line.y,text:line.items.map(item=>item.str).join(' ')})).filter(line=>/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+/i.test(line.text)).map(line=>({y:line.y,date:dateOnLine(line.text)}));
    const starts=items.filter(item=>item.str.trim()==='START').sort((first,second)=>second.y-first.y||first.x-second.x);
    if(!starts.length){warnings.add('第 '+(page+1)+' 页缺少可确认的 START/END 赛程表头');continue;}
    for(const header of starts){
      const date=anchors.filter(anchor=>anchor.y>header.y+2).at(-1)?.date;
      if(!date){warnings.add('第 '+(page+1)+' 页有缺少明确日期的表格，暂不导入');continue;}
      const neighbors=starts.filter(item=>Math.abs(item.y-header.y)<3).sort((first,second)=>first.x-second.x),index=neighbors.indexOf(header);
      const left=header.x-25,right=neighbors[index+1]?neighbors[index+1].x-25:Infinity;
      const endHeader=items.find(item=>item.str.trim()==='END'&&Math.abs(item.y-header.y)<3&&item.x>header.x&&item.x<right);
      const rink=items.filter(item=>Math.abs(item.y-header.y)<3&&item.x>header.x+40&&item.x<right&&/\b(?:RINK|PAD)\b/i.test(item.str)).map(item=>item.str).join(' ');
      if(!endHeader||!rink){warnings.add('第 '+(page+1)+' 页有未明确标注 END 或冰场的表格，暂不导入');continue;}
      const lowerDate=anchors.find(anchor=>anchor.y<header.y-3)?.y??0;
      const lowerHeader=starts.find(item=>item.y<header.y-3)?.y??0;
      const bottom=Math.max(lowerDate,lowerHeader);
      const content=items.filter(item=>item.y<header.y-3&&item.y>bottom+3&&item.x>=left&&item.x<right);
      let shared:ScheduleBlock|undefined;
      for(const line of pdfLines(content)){
        const text=line.items.sort((first,second)=>first.x-second.x).map(item=>item.str).join(' ').replace(/\s+/g,' ').trim();
        const match=text.match(/^(\d{1,2}:\d{2}\s*[AP]M)\s+(\d{1,2}:\d{2}\s*[AP]M)\s+(.+)$/i);
        if(!match){
          if(shared&&/^STAR\s*[1-4]\b/i.test(text)&&categoryKey(text)===shared.categoryKey&&/shared warm[ -]?up/i.test(shared.category)&&text!==shared.category){blocks.push({...shared,id:date+'|'+rink+'|'+shared.start+'|'+text,category:text,group:groupOf(text)});shared=undefined;continue;}
          shared=undefined;if(categoryKey(text))warnings.add('第 '+(page+1)+' 页有未明确列出完整起止时间的类别，暂不导入');continue;
        }
        shared=undefined;
        const category=match[3].trim(),key=categoryKey(category);
        if(/^(?:ICE\s+(?:RESURFACING|RESURFACE)|FLOOD|(?:LUNCH|DINNER|JUDGES'?\s+)?\s*BREAK|LUNCH|DINNER)\b/i.test(category)){
          const start=time24(match[1]),end=time24(match[2]);
          if(start&&end&&start<end)pauses.push({date,rink,start,end});
          continue;
        }
        if(/FLOOD|GOOD NIGHT|GOODNIGHT|DRIVE SAFE|THANK YOU/i.test(category))continue;
        if(!key){warnings.add('第 '+(page+1)+' 页有尚未支持的类别，暂不导入');continue;}
        const start=time24(match[1]),end=time24(match[2]);if(!start||!end||start>=end){warnings.add('第 '+(page+1)+' 页有无效或倒序时间，暂不导入');continue;}
        const range=category.match(/\((\d+)\s*[-–]\s*(\d+)\)/);
        const block:ScheduleBlock={id:date+'|'+rink+'|'+start+'|'+category,date,start,end,rink,category,categoryKey:key,group:groupOf(category),range:range?[Number(range[1]),Number(range[2])]:null,activity:/PRACTICE/i.test(category)?'practice':'competition',page:page+1,sourceUrl};
        blocks.push(block);if(/shared warm[ -]?up/i.test(category))shared=block;
      }
    }
  }
  for(const block of blocks){
    const inside=pauses.filter(p=>p.date===block.date&&p.rink===block.rink&&p.start<block.end&&p.end>block.start);
    if(inside.length)block.breaks=inside.map(({start,end})=>({start,end}));
  }
  return {blocks:[...new Map(blocks.map(block=>[block.id,block])).values()].sort((first,second)=>(first.date+' '+first.start).localeCompare(second.date+' '+second.start)),warnings:[...warnings]};
}
export function parseScheduleItems(pages:PdfItem[][],sourceUrl:string):ScheduleBlock[]{return parseScheduleDocument(pages,sourceUrl).blocks;}
function categoryDetails(value:string){return {ages:[...value.matchAll(/\b([UO])\s*(\d{1,2})\b/gi)].map(match=>match[0].replace(/\s/g,'').toUpperCase()),band:value.match(/\bCLASS\s+([IVX]+)\b/i)?.[1].toUpperCase(),program:/\bSHORT\b/i.test(value)?'short':/\bART(?:ISTIC)?\b/i.test(value)?'artistic':/\bFREE(?:SKATE)?\b/i.test(value)?'free':undefined,nonqualifying:/\bNON[\s\u2010-\u2015-]*QUALIF|\bN\.?\s*Q\b/i.test(value)};}
function categoryVariants(value:string){
  const parts=value.split(/\s*\/\s*/);
  // Full category names joined by a slash are explicit shared sessions.
  // Keep age alternatives such as U12/O12 together with their NQ qualifier.
  const [level,discipline]=categoryKey(parts[0]).split(':'),first=categoryDetails(parts[0]);
  const variants=parts.map(part=>{
    if(categoryKey(part)||!['MEN','WOMEN'].includes(discipline))return part;
    const repeated=part.match(/^(STAR\s*(?:10|[1-9]))\b(.*)$/i),details=categoryDetails(part);
    // The Nov 10 Keswick revision repeats the same STAR level and age but
    // omits Men in the second half. Inherit only that explicitly shared sex.
    if(!repeated||repeated[1].replace(/\s/g,'').toUpperCase()!==level.replace(/\s/g,'')||
      !first.ages.length||first.ages.join('|')!==details.ages.join('|')||first.program!==details.program)return part;
    return repeated[1]+' '+discipline+repeated[2];
  });
  if(parts.length>1&&variants.every(part=>categoryKey(part)))return variants;
  // An unrecognized repeated category must not attach its NQ label to the first.
  if(parts.length>1&&categoryKey(parts[0])&&parts.slice(1).every(part=>/^STAR\s*(?:10|[1-9])\b/i.test(part)))return variants.filter(part=>categoryKey(part));
  return [value];
}
export function categoryCompatible(first:string,second:string){
  return categoryVariants(first).some(entryCategory=>categoryVariants(second).some(blockCategory=>{
    const entry=categoryDetails(entryCategory),block=categoryDetails(blockCategory);
    return categoryKeys(entryCategory).some(key=>categoryKeys(blockCategory).includes(key))&&entry.nonqualifying===block.nonqualifying&&(entry.program==='artistic')===(block.program==='artistic')&&(!entry.ages.length||!block.ages.length||entry.ages.some(age=>block.ages.includes(age)))&&(!entry.band||!block.band||entry.band===block.band)&&(!entry.program||!block.program||entry.program===block.program);
  }));
}
export function scheduleRows(events:Array<Pick<LiveEvent,'id'|'name'|'url'|'timezone'|'participants'|'blocks'|'startingOrders'>>,skaters:Array<Pick<ClubSkater,'id'|'name'|'coach'>>):ScheduleRow[]{
  const skaterMap=new Map(skaters.map(row=>[row.id,row]));const output=new Map<string,ScheduleRow>();
  for(const event of events)for(const entry of event.participants){
    const key=categoryKey(entry.category),group=groupOf(entry.category);if(!key)continue;
    const matching=event.blocks.filter(block=>categoryCompatible(entry.category,block.category)&&(group===null||block.group===null||group===block.group));
    for(const id of entry.skaterIds){const skater=skaterMap.get(id);if(!skater)continue;
      for(const block of matching){const startingOrder=block.activity==='competition'?orderFor(event.startingOrders||[],id,block.category):undefined;if(block.range&&startingOrder&&(startingOrder.startNumber<block.range[0]||startingOrder.startNumber>block.range[1]))continue;const entryDetails=categoryDetails(entry.category),blockDetails=categoryDetails(block.category);const uncertain=(block.group!==null&&group===null)||(block.range!==null&&!startingOrder)||!!(blockDetails.ages.length&&!entryDetails.ages.length)||!!(blockDetails.band&&!entryDetails.band);const rowId=`${event.id}|${id}|${block.id}`;
        const normalized=block.category.toUpperCase().replace(/\s+/g,' ').trim();
        const occurrence=event.blocks.filter(other=>other.category.toUpperCase().replace(/\s+/g,' ').trim()===normalized).findIndex(other=>other.id===block.id);
        const slotKey=`${normalized}:${occurrence}`;
        output.set(rowId,{id:rowId,slotKey,eventId:event.id,eventName:event.name,eventUrl:event.url,skaterId:id,skaterName:skater.name,coach:skater.coach,category:block.category,date:block.date,start:block.start,end:block.end,rink:block.rink,activity:block.activity,uncertain,sourceUrl:block.sourceUrl,page:block.page,timezone:event.timezone,matchStatus:entry.matchStatus,startingOrder});
      }
    }
  }
  const consolidated=new Map<string,ScheduleRow>();
  for(const row of output.values()) {
    if(!row.uncertain||row.startingOrder||! /\(\d+\s*[-–]\s*\d+\)/.test(row.category)){consolidated.set(row.id,row);continue;}
    const category=row.category.replace(/\s*\(\d+\s*[-–]\s*\d+\)/g,'').replace(/\s+/g,' ').trim();
    const slotKey=`PENDING:${category.toUpperCase()}:${row.date}:${row.activity}`;
    const id=`${row.eventId}|${row.skaterId}|${slotKey}`;
    const candidate={category:row.category,start:row.start,end:row.end,rink:row.rink,sourceUrl:row.sourceUrl,page:row.page,slotKey:row.slotKey};
    const existing=consolidated.get(id);
    if(existing){existing.candidates!.push(candidate);if(existing.rink!==row.rink)existing.rink='';}
    else consolidated.set(id,{...row,id,slotKey,category,start:'',end:'',candidates:[candidate]});
  }
  return [...consolidated.values()].sort((a,b)=>`${a.date} ${a.start} ${a.skaterName}`.localeCompare(`${b.date} ${b.start} ${b.skaterName}`));
}
