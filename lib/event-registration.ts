import type {ClubEvent,ClubSkater,EventRegistration} from './club-types.ts';
import {categoryCompatible,plain,scheduleRows} from './official-parser.ts';

// Skate Ontario now directs existing SkateReg accounts to Uplifter.
export const REGISTRATION_PORTAL='https://uplifterfigureskating.com/';
export function registrationLink(value:string){
  try{const url=new URL(value);return url.protocol==='https:'&&['skatereg.ca','www.skatereg.ca','uplifterfigureskating.com','www.uplifterfigureskating.com'].includes(url.hostname)?url.href:null;}catch{return null;}
}
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
function officialDate(value:string){
  const match=value.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if(!match)return '';
  const date=`${match[3]}-${String(months.indexOf(match[1].toLowerCase())+1).padStart(2,'0')}-${match[2].padStart(2,'0')}`;
  return new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date?date:'';
}
export function announcementLinks(html:string,base:string){
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(match=>{
    try{const url=new URL(plain(match[1]),base);return url.origin===new URL(base).origin&&/\.pdf$/i.test(url.pathname)&&/announcement/i.test(plain(match[2])+' '+url.pathname)?[url.href]:[];}catch{return [];}
  }).filter((url,i,all)=>all.indexOf(url)===i).slice(0,2);
}
export function registrationDetails(content:string,name:string,sourceUrl:string){
  const raw=content.replace(/<\/(?:p|div|tr|h[1-6]|li)>|<br\s*\/?\s*>/gi,'\n');
  const lines=raw.split(/[\r\n]+/).map(plain).filter(Boolean);
  const registrations:EventRegistration[]=[];
  let section:'public'|'assigned'='public';
  const url=[...content.matchAll(/(?:href=["'])([^"']+)["']/gi)].map(match=>registrationLink(plain(match[1]))).find(url=>url&&!/listings\/events|sign-up-skate-ontario-events/i.test(url))||REGISTRATION_PORTAL;
  const dates=new Map<string,{opens?:string;closes?:string}>();
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(/^(?:ASSIGNED ATHLETE|ADVANCED) REGISTRATION\s*:?$/i.test(line))section='assigned';
    if(/^(?:PUBLIC|GENERAL) REGISTRATION\s*:?$/i.test(line))section='public';
    if(/\b(?:MUSIC|COACH|ON[- ]SITE)\s+REGISTRATION\b/i.test(line))continue;
    const match=line.match(/\b(?:(ASSIGNED ATHLETE|ADVANCED|PUBLIC|GENERAL)\s+)?REGISTRATION\b.{0,100}?\b(OPENS?|CLOSES?)\b\s*:?(.*)/i);
    if(!match)continue;
    const kind=/ASSIGNED|ADVANCED/i.test(match[1]||'')||/assigned athletes|advanced registration/i.test(line.slice(0,match.index!+match[0].indexOf(match[2])))?'assigned':match[1]?'public':section;
    const dateText=match[3]||lines[i+1]||'',date=officialDate(dateText);
    if(!date)continue;
    const window=dates.get(kind)||{};
    if(/^open/i.test(match[2])){
      // The first official table/paragraph takes priority over duplicate explanatory prose.
      window.opens??=date;
      const close=dateText.match(/\bclose(?:s)?\b(.*)/i);if(close)window.closes??=officialDate(close[1])||undefined;
    }else window.closes??=date;
    dates.set(kind,window);
  }
  for(const [kind,window] of dates)if(window.opens&&(!window.closes||window.closes>=window.opens))registrations.push({kind:kind as 'public'|'assigned',opens:window.opens,closes:window.closes,url,sourceUrl});
  const text=lines.join('\n');
  const categorySection=text.match(/(?:following categories[^:]*:|^CATEGORIES\s*$)([\s\S]*?)(?:MUSIC REQUIREMENTS|MUSIC SUBMISSION|REGISTRATION OPENING|(?![\s\S]))/im)?.[1]||'';
  const offeredCategories=categorySection.split('\n').map(line=>line.split(/\s+(?:must|each skater|shall)\b/i)[0].trim()).filter(line=>/^(?:STAR\s*(?:10|[1-9])\b|(?:PRE[- ]?)?(?:JUVENILE|NOVICE)\b|JUNIOR\b|SENIOR\b|GOLD\b|ADULT\b)/i.test(line)&&!/assessment|passed/i.test(line));
  // The series title itself is an explicit published level range, independent of entry lists.
  const range=name.match(/\bSTAR\s*([1-9])\s*[-–]\s*(10|[1-9])\b/i);
  if(range&&Number(range[1])<=Number(range[2]))for(let level=Number(range[1]);level<=Number(range[2]);level++)offeredCategories.push('STAR '+level);
  return {registrations,offeredCategories:[...new Set(offeredCategories)]};
}

function categoryMatches(own:string,offered:string){
  // Level-only series titles cover freeskate; other disciplines require an explicit category.
  if(/^STAR\s*\d+$/i.test(offered))return own.match(/\bSTAR\s*(10|[1-9])\b/i)?.[0].replace(/\s/g,'').toUpperCase()===offered.replace(/\s/g,'').toUpperCase()&&!/dance|elements|showcase|artistic|synchro/i.test(own);
  return categoryCompatible(own,offered);
}
export const compareEventDates=(a:Pick<ClubEvent,'start'|'name'|'id'>,b:Pick<ClubEvent,'start'|'name'|'id'>)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
const validDate=(date?:string)=>!!date&&/^20\d{2}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
export function mergeRegistrations(primary:EventRegistration[],secondary:EventRegistration[]){
  return [...primary.map(window=>{
    const previous=secondary.find(other=>other.kind===window.kind&&other.opens===window.opens);
    const confirmed=previous&&validDate(previous.closes)?previous:undefined;
    const merged=!validDate(window.closes)&&confirmed?{...window,closes:confirmed.closes,sourceUrl:confirmed.sourceUrl}:window;
    return merged.url===REGISTRATION_PORTAL&&previous&&registrationLink(previous.url)?{...merged,url:previous.url}:merged;
  }),...secondary.filter(window=>!primary.some(other=>other.kind===window.kind))];
}
export function homeEventCards(events:ClubEvent[],skaters:ClubSkater[],ownIds:string[],today:string){
  const own=new Set(ownIds),mine=skaters.filter(skater=>own.has(skater.id));
  return events.filter(event=>(event.end||event.start)>=today).flatMap(event=>{
    const entered=mine.filter(skater=>event.participants.some(entry=>entry.skaterIds.includes(skater.id)));
    const matching=mine.filter(skater=>{
      if(entered.some(registered=>registered.id===skater.id))return false;
      const current=events.filter(item=>(item.end||item.start)>=today).flatMap(item=>item.participants.filter(entry=>entry.skaterIds.includes(skater.id)).map(entry=>entry.category));
      return !skater.identityPending&&(current.length?current:skater.categories).some(category=>(event.offeredCategories||[]).some(offered=>categoryMatches(category,offered)));
    });
    const windows=(event.registrations||[]).filter(window=>{
      // Public closing is required. Missing deadlines never extend to competition day.
      if(window.kind!=='public'||!validDate(window.opens)||!validDate(window.closes)||window.closes! < window.opens)return false;
      const date=new Date(window.opens+'T12:00:00Z');if(!Number.isFinite(date.getTime()))return false;
      date.setUTCDate(date.getUTCDate()-14);
      return today>=date.toISOString().slice(0,10)&&today<=window.closes!&&!!registrationLink(window.url);
    });
    const rows=entered.length?scheduleRows([event],entered):[];
    return entered.length||matching.length&&windows.length?[{event,entered,matching,rows,windows:matching.length?windows:[]}]:[];
  }).sort((a,b)=>compareEventDates(a.event,b.event));
}
