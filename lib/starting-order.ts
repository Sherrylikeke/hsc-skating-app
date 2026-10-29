import type {StartingOrder} from './club-types';
import type {PdfItem} from './official-parser';
import {categoryKey,categoryCompatible,groupOf,normalizeName,plain} from './official-parser.ts';
type Roster=Array<{id:string;name:string;identityPending?:boolean}>;
export const programOf=(text:string)=>/\bSHORT\b/i.test(text)?'short':/\bFREE\b/i.test(text)?'free':/\bRHYTHM\b/i.test(text)?'rhythm':/\bPATTERN\b/i.test(text)?plain(text).toLowerCase().replace(/.*pattern\s*dance/i,'pattern').trim():'';
function ids(name:string,roster:Roster){return name.split(/\s*\/\s*/).flatMap(part=>{const matches=roster.filter(s=>!s.identityPending&&normalizeName(s.name)===normalizeName(part));return matches.length===1?[matches[0].id]:[];});}
function row(name:string,category:string,startNumber:number,warmupGroup:number|null,individualTime:string|null,sourceUrl:string,page:number,roster:Roster):StartingOrder{return {id:`${sourceUrl}|${category}|${name}`,name,category,program:programOf(category),startNumber,warmupGroup,individualTime,sourceUrl,page,skaterIds:ids(name,roster)};}
export function parseStartingOrderPdf(pages:PdfItem[][],url:string,roster:Roster):StartingOrder[]{
  const output:StartingOrder[]=[];let warmup:number|null=null;let category='';
  pages.forEach((items,page)=>{const text=items.map(i=>i.str).join(' ');if(!/starting\s*order/i.test(text))return;
    const nextCategory=items.find(i=>categoryKey(i.str)&&programOf(i.str))?.str.trim()||category;if(nextCategory!==category)warmup=null;category=nextCategory;if(!category)return;
    const nameHeader=items.find(i=>/^name$/i.test(i.str.trim()));const clubHeader=items.find(i=>/^club$/i.test(i.str.trim()));if(!nameHeader||!clubHeader)return;
    const warmHeader=items.find(i=>/warm.?up\s*group/i.test(i.str)&&Math.abs(i.y-nameHeader.y)<3);
    const timeHeader=items.find(i=>/^(?:start\s*)?time$/i.test(i.str.trim())&&Math.abs(i.y-nameHeader.y)<3);
    const lines:Array<{y:number;items:PdfItem[]}>=[];for(const i of items.filter(i=>i.str.trim()&&i.y<nameHeader.y-3&&i.y>35).sort((a,b)=>b.y-a.y)){let line=lines.find(l=>Math.abs(l.y-i.y)<2);if(!line){line={y:i.y,items:[]};lines.push(line);}line.items.push(i);}
    for(const line of lines){const lineText=line.items.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ');const explicit=lineText.match(/^warm[- ]?up\s+group\s*[:#]?\s*(\d+)$/i);if(explicit){warmup=Number(explicit[1]);continue;}
      const number=line.items.find(i=>i.x<nameHeader.x-3&&/^\d+$/.test(i.str.trim()));const name=line.items.filter(i=>i.x>=nameHeader.x-2&&i.x<clubHeader.x-5).map(i=>i.str).join(' ').trim();if(!number||!name)continue;
      const warmCell=warmHeader?line.items.find(i=>Math.abs(i.x-warmHeader.x)<15&&/^\d+$/.test(i.str.trim())):undefined;
      const timeCell=timeHeader?line.items.find(i=>Math.abs(i.x-timeHeader.x)<15&&/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?$/i.test(i.str.trim())):undefined;
      output.push(row(name,category,Number(number.str),warmCell?Number(warmCell.str):warmup,timeCell?.str.trim()||null,url,page+1,roster));
    }
  });return output;
}
export function parseStartingOrderHtml(html:string,url:string,roster:Roster):StartingOrder[]{
  const output:StartingOrder[]=[];let category='',headers:string[]=[],warmup:number|null=null;
  for(const match of html.matchAll(/<(h[1-4]|caption)\b[^>]*>([\s\S]*?)<\/\1>|<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)){
    if(match[1]){const text=plain(match[2]);if(categoryKey(text)&&programOf(text)){category=text;warmup=null;}continue;}
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
export function orderFor(orders:StartingOrder[],id:string,category:string){const key=categoryKey(category),program=programOf(category),group=groupOf(category);const matches=orders.filter(o=>o.skaterIds.includes(id)&&categoryKey(o.category)===key&&categoryCompatible(o.category,category)&&o.program===program&&(groupOf(o.category)===group||groupOf(o.category)===null||group===null));return matches.length===1?matches[0]:undefined;}
