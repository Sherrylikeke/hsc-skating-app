import type {ClubEvent, ScheduleRow, StartingOrder} from './club-types';
import {categoryCompatible, categoryKey, groupOf, normalizeName} from './official-parser.ts';
import {scheduledProgram} from './starting-order.ts';

// Skate Canada Competitions §3.9 (2026–27). A published segment duration takes precedence.
// https://info.skatecanada.ca/index.php/en-ca/rules-of-sport/54-competitions.html
function warmupMinutes(category:string, order:StartingOrder) {
  const label=(category+' '+order.category).toUpperCase();
  if (/\b(?:SHARED|ROTATION|ROTATING|ELEMENTS|SYNCHRO\w*|SHOWCASE|IMPROV|SPECIAL OLYMPICS|WARM[ -]?UP)\b/.test(label)) return null;
  if (/\bSTAR\s*\d+\s*\/\s*\d+\b/i.test(category) || category.split('/').filter(part=>categoryKey(part)).length>1) return null;
  // Ordinary STAR 1–2 events use elements/stations, not a sequence of individual music programs.
  if (/\bSTAR\s*[12]\b/.test(label) && !/\b(?:DANCE|ARTISTIC)\b/.test(label)) return null;
  if (order.warmupSeconds && order.warmupSeconds>0) return order.warmupSeconds/60;
  if (/\bART(?:ISTIC)?\b/.test(label)) return 4;
  if (/\bPATTERN\b/.test(label)) return 3;
  if (/\bDANCE\b/.test(label)) return /\b(?:SOLO|RHYTHM|FREE)\b/.test(label)?5:null;
  if (/\bPAIRS?\b/.test(label)) {
    if (/\bPRE[ -]?NOVICE|\bNOVICE/.test(label)) return order.program==='short'?5:order.program==='free'?6:null;
    if (/\bJUVENILE\b/.test(label) && order.program==='free') return 5;
    return /\b(?:JUNIOR|SENIOR)\b/.test(label)?6:null;
  }
  if (/\bADULT\b/.test(label)) {
    if (/\bINTRO\b/.test(label)) return 4;
    if (/\bBRONZE\b/.test(label)) return 5;
    return /\b(?:SILVER|GOLD|MASTERS?)\b/.test(label)?6:null;
  }
  const star=label.match(/\bSTAR\s*(10|[3-9])\b/);
  if (star) return Number(star[1])<=4?4:5;
  if (/\b(?:PRE[ -]?)?(?:JUVENILE|NOVICE)\b|\bGOLD\b/.test(label)) return 5;
  return /\b(?:JUNIOR|SENIOR)\b/.test(label)?6:null;
}

function minute(clock:string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock)?Number(clock.slice(0,2))*60+Number(clock.slice(3)):NaN;
}

export function coachTimingEstimate(row:ScheduleRow, event:Pick<ClubEvent,'id'|'startingOrders'|'blocks'|'participants'>) {
  const order=row.startingOrder;
  if (!order || row.uncertain || row.activity!=='competition' || !order.warmupGroup) return null;
  const block=event.blocks.find(b=>row.id===event.id+'|'+row.skaterId+'|'+b.id);
  if (!block) return null;
  const warmup=warmupMinutes(block.category,order);
  if (!warmup) return null;

  // The coach may only see one club member in the table. The denominator is the whole official draw.
  const sameCategory=(category:string)=>categoryCompatible(category,block.category) &&
    (block.group===null || groupOf(category)===null || groupOf(category)===block.group);
  const program=order.program||scheduledProgram(order.category);
  const draw=(event.startingOrders??[]).filter(o=>(o.program||scheduledProgram(o.category))===program && sameCategory(o.category));
  if (draw.some(o=>o.category!==order.category || o.sourceUrl!==order.sourceUrl)) return null;
  const otherBlocks=event.blocks.filter(b=>b.id!==block.id && b.activity==='competition');
  if (otherBlocks.some(b=>b.date===block.date && b.rink===block.rink && b.start<block.end && b.end>block.start)) return null;

  if (!block.range) {
    // Without an explicit number range, verify that this entire draw belongs to one session.
    if (otherBlocks.some(b=>sameCategory(b.category) && scheduledProgram(b.category)===scheduledProgram(block.category))) return null;
    const entered=event.participants.filter(p=>sameCategory(p.category));
    const names=new Set(entered.map(p=>normalizeName(p.name)));
    if (entered.length!==draw.length || names.size!==draw.length || !draw.every(o=>names.delete(normalizeName(o.name)))) return null;
  }
  const [first,last]=block.range??[1,draw.length];
  const entries=draw.filter(o=>o.startNumber>=first && o.startNumber<=last).sort((a,b)=>a.startNumber-b.startNumber);
  if (!entries.length || entries.length!==last-first+1) return null;
  const slot=entries[order.startNumber-first];
  if (slot?.id!==order.id || slot.warmupGroup!==order.warmupGroup) return null;
  const groups:number[]=[];
  for (const [index,entry] of entries.entries()) {
    const group=entry.warmupGroup;
    if (entry.startNumber!==first+index || !Number.isSafeInteger(group) || !group || group<1) return null;
    if (group===groups.at(-1)) continue;
    if (groups.length && group!==groups[groups.length-1]+1) return null;
    groups.push(group);
  }
  if (draw.some(o=>(o.startNumber<first || o.startNumber>last) && o.warmupGroup!==null && groups.includes(o.warmupGroup))) return null;
  const start=minute(block.start), end=minute(block.end);
  const pauses:Array<{start:number;end:number}>=[];
  for (const interval of [...(block.breaks??[])].sort((a,b)=>a.start.localeCompare(b.start))) {
    const from=Math.max(start,minute(interval.start)), to=Math.min(end,minute(interval.end));
    if (!Number.isFinite(from+to) || from>=to) return null;
    const previous=pauses.at(-1);
    if (previous && from<=previous.end) previous.end=Math.max(previous.end,to);
    else pauses.push({start:from,end:to});
  }
  const pauseMinutes=pauses.reduce((sum,p)=>sum+p.end-p.start,0);
  const perSkater=(end-start-pauseMinutes-groups.length*warmup)/entries.length;
  if (!Number.isFinite(perSkater) || perSkater<=0) return null;

  // Calculate on skating time, then put the published pauses back at their wall-clock times.
  function localClock(offset:number) {
    let time=start+offset;
    for (const p of pauses) if (time>=p.start) time+=p.end-p.start;
    const rounded=Math.round(time);
    return String(Math.floor(rounded/60)).padStart(2,'0')+':'+String(rounded%60).padStart(2,'0');
  }
  const firstInGroup=entries.findIndex(o=>o.warmupGroup===order.warmupGroup);
  const groupStart=firstInGroup*perSkater+groups.indexOf(order.warmupGroup)*warmup;
  const position=order.startNumber-first-firstInGroup;
  return {warmup:localClock(groupStart),start:localClock(groupStart+warmup+position*perSkater)};
}
