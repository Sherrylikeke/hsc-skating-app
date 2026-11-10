import type {StartingOrder} from './club-types';
import type {PdfItem} from './official-parser';
import {categoryKey,categoryCompatible,groupOf,normalizeName,plain} from './official-parser.ts';
type Roster=Array<{id:string;name:string;identityPending?:boolean}>;
export const programOf=(text:string)=>/\bARTISTIC\b/i.test(text)?'artistic':/\bSHORT\b/i.test(text)?'short':/\bFREE(?:SKATE|SKATING)?\b/i.test(text)?'free':/\bRHYTHM\b/i.test(text)?'rhythm':/\bPATTERN\b/i.test(text)?plain(text).toLowerCase().replace(/.*pattern\s*dance/i,'pattern').trim():'';
export function scheduledProgram(category:string){
  const explicit=programOf(category);
  if(explicit)return explicit;
  // Some official timetables print only the level for these single-program singles events.
  const [level,discipline]=categoryKey(category).split(':');
  if(!['MEN','WOMEN','FREESKATE'].includes(discipline))return '';
  if(/^STAR\s*[79]$/.test(level))return 'short';
  return /^(?:STAR\s*(?:[34568]|10)|GOLD|PREJUVENILE|JUVENILE)$/.test(level)?'free':'';
}
function ids(name:string,roster:Roster){return name.split(/\s*\/\s*/).flatMap(part=>{const matches=roster.filter(s=>!s.identityPending&&normalizeName(s.name)===normalizeName(part));return matches.length===1?[matches[0].id]:[];});}
function row(name:string,category:string,startNumber:number,warmupGroup:number|null,individualTime:string|null,sourceUrl:string,page:number,roster:Roster):StartingOrder{return {id:`${sourceUrl}|${category}|${name}`,name,category,program:scheduledProgram(category),startNumber,warmupGroup,individualTime,sourceUrl,page,skaterIds:ids(name,roster)};}
type DrawLine={y:number;items:PdfItem[]};
type LayoutEntry={order:StartingOrder;y:number;height:number|undefined};
function applyLayoutWarmups(items:PdfItem[],lines:DrawLine[],entries:LayoutEntry[],headerY:number,nameX:number,clubX:number){
  // Verified Skate Canada draw layout: aligned # / Name / Club / Section,
  // a dated footer, regular single-line entries, and larger gaps between heats.
  // Category titles, a fixed number of skaters, and page breaks are never boundaries.
  if(!entries.length||!['#','Section'].every(label=>items.some(i=>i.str.trim()===label&&Math.abs(i.y-headerY)<3))||
    !items.some(i=>i.str.trim()==='Date:'&&i.y<35))return;
  if(entries.some((entry,index)=>entry.order.startNumber<1||(index>0&&entry.order.startNumber<=entries[index-1].order.startNumber)||entry.order.warmupGroup!==null||!entry.height||entry.height<=0))return;
  const withdrawn=lines.filter(line=>line.items.some(i=>i.x<nameX-3&&/^(?:WD|DNS)$/i.test(i.str.trim()))&&line.items.some(i=>i.x>=nameX-2&&i.x<clubX-5&&i.str.trim()));
  if(entries.at(-1)!.order.startNumber-entries.length>withdrawn.length)return;
  const heights=entries.map(entry=>entry.height!).sort((a,b)=>a-b),height=heights[Math.floor(heights.length/2)];
  if(heights.some(value=>Math.abs(value-height)>height*.05))return;
  if(lines.some(line=>line.y<=entries[0].y&&!entries.some(entry=>Math.abs(entry.y-line.y)<2)&&!withdrawn.includes(line)))return;
  const gaps=entries.slice(1).map((entry,index)=>entries[index].y-entry.y);
  const regular=gaps.filter(gap=>gap>=height*1.45&&gap<=height*1.75).sort((a,b)=>a-b);
  if(gaps.length&&!regular.length)return;
  const baseline=regular[Math.floor(regular.length/2)],tolerance=Math.max(.4,height*.06);
  const separators=gaps.filter(gap=>Math.abs(gap-baseline)>tolerance);
  if(separators.some(gap=>gap<baseline*1.25||gap>baseline*1.7)||
    separators.some(gap=>Math.abs(gap-separators[0])>tolerance))return;
  let group=1;
  entries.forEach((entry,index)=>{if(index&&gaps[index-1]>baseline+tolerance)group++;entry.order.warmupGroup=group;entry.order.drawComplete=true;entry.order.withdrawnCount=withdrawn.length;});
}
export function parseStartingOrderPdf(pages:PdfItem[][],url:string,roster:Roster):StartingOrder[]{
  const output:StartingOrder[]=[];let warmup:number|null=null;let category='';
  pages.forEach((items,page)=>{const text=items.map(i=>i.str).join(' ');if(!/starting\s*order/i.test(text))return;
    const heading=items.find(i=>categoryKey(i.str)&&programOf(i.str))??items.find(i=>categoryKey(i.str)&&scheduledProgram(i.str));
    const nextCategory=heading?.str.trim()||category;if(nextCategory!==category)warmup=null;category=nextCategory;if(!category)return;
    const nameHeader=items.find(i=>/^name$/i.test(i.str.trim()));const clubHeader=items.find(i=>/^club$/i.test(i.str.trim()));if(!nameHeader||!clubHeader)return;
    const warmHeader=items.find(i=>/warm.?up\s*group/i.test(i.str)&&Math.abs(i.y-nameHeader.y)<3);
    const timeHeader=items.find(i=>/^(?:start\s*)?time$/i.test(i.str.trim())&&Math.abs(i.y-nameHeader.y)<3);
    const lines:DrawLine[]=[],layout:LayoutEntry[]=[];let explicitWarmup=!!warmHeader;
    for(const i of items.filter(i=>i.str.trim()&&i.y<nameHeader.y-3&&i.y>35).sort((a,b)=>b.y-a.y)){let line=lines.find(l=>Math.abs(l.y-i.y)<2);if(!line){line={y:i.y,items:[]};lines.push(line);}line.items.push(i);}
    for(const line of lines){const lineText=line.items.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ');const explicit=lineText.match(/^warm[- ]?up\s+group\s*[:#]?\s*(\d+)$/i);if(explicit){warmup=Number(explicit[1]);explicitWarmup=true;continue;}
      const number=line.items.find(i=>i.x<nameHeader.x-3&&/^\d+$/.test(i.str.trim()));const name=line.items.filter(i=>i.x>=nameHeader.x-2&&i.x<clubHeader.x-5).map(i=>i.str).join(' ').trim();if(!number||!name)continue;
      const warmCell=warmHeader?line.items.find(i=>Math.abs(i.x-warmHeader.x)<15&&/^\d+$/.test(i.str.trim())):undefined;
      const timeCell=timeHeader?line.items.find(i=>Math.abs(i.x-timeHeader.x)<15&&/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?$/i.test(i.str.trim())):undefined;
      const order=row(name,category,Number(number.str),warmCell?Number(warmCell.str):warmup,timeCell?.str.trim()||null,url,page+1,roster);
      output.push(order);layout.push({order,y:line.y,height:number.height});
    }
    if(pages.length===1&&!explicitWarmup)applyLayoutWarmups(items,lines,layout,nameHeader.y,nameHeader.x,clubHeader.x);
  });return output;
}
export function parseStartingOrderHtml(html:string,url:string,roster:Roster):StartingOrder[]{
  const output:StartingOrder[]=[];let category='',headers:string[]=[],warmup:number|null=null;
  for(const match of html.matchAll(/<(h[1-4]|caption)\b[^>]*>([\s\S]*?)<\/\1>|<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)){
    if(match[1]){const text=plain(match[2]);if(categoryKey(text)&&scheduledProgram(text)){category=text;warmup=null;}continue;}
    const cells=[...match[4].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c=>plain(c[1]));if(!cells.length)continue;
    if(/<th\b/i.test(match[4])){headers=cells;continue;}
    const text=cells.join(' '),explicit=text.match(/^warm[- ]?up\s+group\s*[:#]?\s*(\d+)$/i);if(explicit){warmup=Number(explicit[1]);continue;}
    const categoryAttribute=match[3]?.match(/data-category\s*=\s*["']([^"']+)["']/i)?.[1];const current=categoryAttribute?plain(categoryAttribute):category;
    const nameIndex=headers.findIndex(h=>/^(?:name|competitor|skater)$/i.test(h)),orderIndex=headers.findIndex(h=>/^(?:starting\s*order|start(?:ing)?\s*(?:no\.?|number)|#)$/i.test(h));
    if(!current||nameIndex<0||orderIndex<0||!/^\d+$/.test(cells[orderIndex]||''))continue;
    const warmIndex=headers.findIndex(h=>/warm.?up\s*group/i.test(h)),timeIndex=headers.findIndex(h=>/^(?:start(?:ing)?\s*)?time$/i.test(h));const warm=warmIndex>=0&&/^\d+$/.test(cells[warmIndex]||'')?Number(cells[warmIndex]):warmup;
    const time=cells[timeIndex]||'';output.push(row(cells[nameIndex],current,Number(cells[orderIndex]),warm,/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?$/i.test(time)?time:null,url,0,roster));
  }return output;
}
export function orderFor(orders:StartingOrder[],id:string,category:string){const key=categoryKey(category),program=scheduledProgram(category),group=groupOf(category);const matches=orders.filter(o=>o.skaterIds.includes(id)&&categoryKey(o.category)===key&&categoryCompatible(o.category,category)&&(o.program||scheduledProgram(o.category))===program&&(groupOf(o.category)===group||groupOf(o.category)===null||group===null));return matches.length===1?matches[0]:undefined;}
