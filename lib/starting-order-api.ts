import {categoryCompatible,categoryKey,groupOf,normalizeName} from './official-parser.ts';
import {programOf} from './starting-order.ts';
import type {StartingOrder,Participant} from './club-types';
type Roster=Array<{id:string;name:string;identityPending?:boolean}>;
type ReadBytes=(url:string,maxBytes?:number)=>Promise<Uint8Array>;
type ApiCategory={categoryId:string;categoryDescription?:string;categoryGivenName?:string;categoryName?:string;disciplineName?:string};
type ApiSegment={segmentId:string;segmentName:string;patternDance?:string;warmUpTime?:number};
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export function startingOrderApp(html:string,url:string){
  const origin=new URL(url);if(origin.protocol!=='https:'||!['skatingresults.ca','www.skatingresults.ca'].includes(origin.hostname))return null;
  const id=html.match(/\b(?:var|const|let)\s+EVENT_ID\s*=\s*["']([^"']+)["']/)?.[1];
  const api=html.match(/\b(?:var|const|let)\s+API\s*=\s*["']([^"']+)["']/)?.[1];
  return uuid(id)&&api==='/api/results'?{eventId:id!,api:origin.origin+api}:null;
}
export function startingCategory(category:ApiCategory){
  let label=category.categoryDescription||category.categoryGivenName||'';
  if(!categoryKey(label)&&category.disciplineName)label+=' '+category.disciplineName;
  if(category.categoryName&&normalizeName(category.categoryName)!==normalizeName(label))label+=' · '+category.categoryName;
  return label.trim();
}
export function parseApiStartingOrder(payload:unknown,category:string,segment:ApiSegment,documentUrl:string,roster:Roster):StartingOrder[]{
  const entries=(payload as {CompetitorEntries?:Array<Record<string,unknown>>})?.CompetitorEntries;
  if(!Array.isArray(entries)||entries.length>500)throw Error('官方出场接口格式待核对');
  const fullCategory=category+' - '+segment.segmentName+(segment.patternDance?' - '+segment.patternDance:'');
  const warmupSeconds=segment.warmUpTime;
  const timing=typeof warmupSeconds==='number'&&Number.isSafeInteger(warmupSeconds)&&warmupSeconds>0?{warmupSeconds}:{};
  return entries.flatMap(entry=>{
    const number=entry.sortOrder;if(typeof number!=='number'||!Number.isInteger(number)||number<1||/WITHDRAW|DNS|DISQUAL/i.test(String(entry.competitorStatus||'')))return [];
    const name=String(entry.competitorName||'').trim();if(!name)return [];
    const skaterIds=name.split(/\s*\/\s*/).flatMap(part=>{const matches=roster.filter(s=>!s.identityPending&&normalizeName(s.name)===normalizeName(part));return matches.length===1?[matches[0].id]:[];});
    const warmup=entry.warmUpGroup;
    return [{id:documentUrl+'|'+segment.segmentId+'|'+name,name,category:fullCategory,program:programOf(fullCategory),startNumber:number,warmupGroup:typeof warmup==='number'&&Number.isInteger(warmup)&&warmup>0?warmup:null,...timing,individualTime:null,sourceUrl:documentUrl.split('#')[0]+'#/seg/'+segment.segmentId+'/start',sourceDocumentUrl:documentUrl,sourceSegmentId:segment.segmentId,page:0,skaterIds}];
  });
}
export async function importStartingOrderApp(html:string,documentUrl:string,roster:Roster,participants:Participant[],previous:StartingOrder[],read:ReadBytes){
  const app=startingOrderApp(html,documentUrl);if(!app)return null;
  const json=async(path:string)=>JSON.parse(new TextDecoder().decode(await read(app.api+'/'+path,3_000_000)));
  const categories=(await json('event/'+app.eventId+'/categories')).Categories as ApiCategory[];
  if(!Array.isArray(categories)||categories.length>80)throw Error('官方类别接口格式待核对');
  const related=participants.filter(p=>p.skaterIds.length);
  const targets=categories.filter(c=>uuid(c.categoryId)&&related.some(p=>categoryCompatible(p.category,startingCategory(c))&&(groupOf(p.category)===null||groupOf(startingCategory(c))===null||groupOf(p.category)===groupOf(startingCategory(c)))));
  if(targets.length>12)throw Error('关联出场类别超过本轮已验证范围，保留旧资料');
  const sources:Array<{category:string;segment:ApiSegment}>=[];
  for(const category of targets){const segments=(await json('category/'+category.categoryId+'/segments')).Segments as ApiSegment[];
    if(!Array.isArray(segments)||segments.length>4)throw Error('官方项目接口格式待核对');
    for(const segment of segments)if(uuid(segment.segmentId)&&programOf(segment.segmentName))sources.push({category:startingCategory(category),segment});
  }
  if(sources.length>24)throw Error('关联出场项目超过本轮已验证范围，保留旧资料');
  let orders=[...previous];const errors:string[]=[];
  for(const source of sources){try{const payload=await json('segment/'+source.segment.segmentId+'/entries');const parsed=parseApiStartingOrder(payload,source.category,source.segment,documentUrl,roster);
    orders=[...orders.filter(o=>o.sourceSegmentId!==source.segment.segmentId),...parsed];
  }catch{errors.push(source.category+' '+source.segment.segmentName+' 的出场顺序待核对');}}
  return {orders,errors,segments:sources.length};
}
