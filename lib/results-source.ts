import {getDocumentProxy,extractTextItems} from 'unpdf';
import type {HistoryRecord} from './club-types';
import {parseApiResults,parseApiMarks,parseResultPdf,parseResultHtml,combineApiBoards,linkedResultDocuments,sameCompetitor,sameResultCategory} from './competition-results';
import type {CompetitionResults,ResultBoard} from './competition-results';
const hosts=new Set(['skateontario.org','www.skateontario.org','skatecanada.ca','www.skatecanada.ca','cssterminalserv.skatecanada.ca','results.isu.org','results.vistream.com.pl','sc-css-public-api-cmh9d3htgxfpdkb7.canadacentral-01.azurewebsites.net']);
export async function readResultSource(url:string,maxBytes=8_000_000){
  let target=new URL(url);if(target.hostname==='skateontario.org')target.hostname='www.skateontario.org';
  for(let redirect=0;redirect<4;redirect++){
    if(target.protocol!=='https:'||!hosts.has(target.hostname))throw Error('Unsupported official results host');
    const response=await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(20000)});
    if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');if(!location)throw Error('Missing redirect');target=new URL(location,target);continue;}
    if(!response.ok)throw Error('Official results unavailable');
    if(Number(response.headers.get('content-length')||0)>maxBytes)throw Error('Results file too large');
    const reader=response.body?.getReader();if(!reader)throw Error('Empty official response');const chunks:Uint8Array[]=[];let length=0;
    while(true){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.length;if(length>maxBytes){await reader.cancel();throw Error('Results file too large');}chunks.push(chunk.value);}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
  }throw Error('Too many redirects');
}
async function pdfBoards(url:string){const pdf=await getDocumentProxy(await readResultSource(url),{maxImageSize:1_000_000,disableFontFace:true});try{if(pdf.numPages>80)throw Error('Results PDF too long');return parseResultPdf((await extractTextItems(pdf)).items,url);}finally{const destroy=(pdf as unknown as {destroy?:()=>Promise<void>}).destroy;if(typeof destroy==='function')await destroy.call(pdf);}}
const cache=new Map<string,{expires:number;value:CompetitionResults}>(),pending=new Map<string,Promise<CompetitionResults>>();
export async function loadCompetitionResults(record:HistoryRecord&{source_segment_urls?:string[]}){
  const key=record.source_url+'|'+record.name;const cached=cache.get(key);if(cached&&cached.expires>Date.now())return cached.value;
  if(pending.has(key))return pending.get(key)!;
  const task=(async()=>{
    const boards:ResultBoard[]=[],warnings:string[]=[];
    if(new URL(record.source_url).hostname.startsWith('sc-css-public-api-')){
      const urls=record.source_segment_urls?.length?record.source_segment_urls:[record.source_url];
      for(const [index,url] of urls.slice(0,4).entries())try{const saved=record.segment_scores?.[index] as unknown;const label=saved&&typeof saved==='object'&&'segment' in saved?String(saved.segment):urls.length>1?`Segment ${index+1}`:record.category;boards.push(parseApiResults(JSON.parse(new TextDecoder().decode(await readResultSource(url,3_000_000))),url,label));}catch{warnings.push('Some official segment results could not be loaded.');}
      if(urls.length===boards.length){const combined=combineApiBoards(boards,record.category+' · combined segments');if(combined)boards.unshift(combined);}
    }else if(/\.pdf$/i.test(new URL(record.source_url).pathname)){
      boards.push(...await pdfBoards(record.source_url));
      if(boards.some(b=>b.kind==='category'))try{
        const hub=record.event_url,html=new TextDecoder().decode(await readResultSource(hub,2_000_000));
        const documents=linkedResultDocuments(html,hub,record.source_url);
        for(const url of documents)try{boards.push(...await pdfBoards(url));}catch{warnings.push('Some official score details could not be loaded.');}
      }catch{warnings.push('The official score-detail index could not be loaded.');}
    }else{const url=new URL(record.source_url).hostname==='isu-skating.com'?record.event_url:record.source_url;boards.push(...parseResultHtml(new TextDecoder().decode(await readResultSource(url,2_000_000)),url,record.category));}
    // Never mix categories from a combined PDF or a different program: retain only boards containing this original competitor.
    const isApi=new URL(record.source_url).hostname.startsWith('sc-css-public-api-');
    const matching=boards.filter(b=>(isApi||sameResultCategory(record.category,b.label))&&b.rows.some(r=>sameCompetitor(r.name,record.name)));
    if(!matching.length)throw Error('Full results unavailable for this official source');
    // A one-program category has the same total as its segment. Enrich it only on an exact name AND total match.
    const segments=matching.filter(b=>b.kind==='segment');
    if(segments.length===1)for(const board of matching.filter(b=>b.kind==='category'))board.rows=board.rows.map(row=>{const detail=segments[0].rows.find(r=>sameCompetitor(r.name,row.name)&&r.total===row.total);return detail?{...detail,id:row.id,rank:row.rank}:row;});
    const value={boards:matching,warnings,checkedAt:new Date().toISOString()};
    if(cache.size>=20)cache.delete(cache.keys().next().value!);cache.set(key,{expires:Date.now()+15*60000,value});return value;
  })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
export async function loadCompetitionMarks(record:HistoryRecord,boardId:string,entryId:string){
  const result=await loadCompetitionResults(record),board=result.boards.find(b=>b.id===boardId),row=board?.rows.find(r=>r.id===entryId);
  if(!row||row.id.startsWith('combined|')||!new URL(row.sourceUrl).hostname.startsWith('sc-css-public-api-'))throw Error('Unknown result entry');
  if(row.elements.length||row.components.length)return {elements:row.elements,components:row.components};
  const base=new URL('/entry/'+encodeURIComponent(row.id)+'/',row.sourceUrl);
  const [elements,components]=await Promise.all(['elements','components'].map(async kind=>JSON.parse(new TextDecoder().decode(await readResultSource(new URL(kind,base).href,2_000_000)))));
  const detail=parseApiMarks(elements,components);Object.assign(row,detail);return detail;
}
