import type {PdfItem} from './official-parser';
import {normalizeName,plain,categoryCompatible,groupOf} from './official-parser.ts';

export type ScoreLine={label:string;values:string[]};
export type ResultSkater={id:string;name:string;club:string;rank:number|null;overallRank?:number|null;status:string;total:number|null;tes:number|null;pcs:number|null;bonus:number|null;deduction:number|null;page:number;sourceUrl:string;elements:ScoreLine[];components:ScoreLine[]};
export type ResultBoard={id:string;label:string;kind:'category'|'segment';sourceUrl:string;rows:ResultSkater[]};
export type CompetitionResults={boards:ResultBoard[];warnings:string[];checkedAt:string};
const numeric=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&/^[+-]?\d+(?:\.\d+)?$/.test(value.trim())?Number(value):null;
export const sameCompetitor=(a:string,b:string)=>normalizeName(a)===normalizeName(b);
export const sameResultCategory=(first:string,second:string)=>categoryCompatible(first,second)&&(groupOf(first)===null||groupOf(first)===groupOf(second));
export function comparisonRank(rows:ResultSkater[],row:ResultSkater,key:'tes'|'pcs'){
  // No ordinal is meaningful if any scored opponent's component is missing.
  const scored=rows.filter(r=>r.status==='result');
  if(row.status!=='result'||row[key]===null||scored.some(r=>r[key]===null))return null;
  return 1+scored.filter(r=>r[key]!>row[key]!).length;
}
function lines(items:PdfItem[]){
  const output:Array<{y:number;items:PdfItem[]}>=[];
  for(const item of items.filter(i=>i.str.trim()).sort((a,b)=>b.y-a.y)){
    let line=output.find(l=>Math.abs(l.y-item.y)<1.6);if(!line){line={y:item.y,items:[]};output.push(line);}line.items.push(item);
  }
  for(const line of output)line.items.sort((a,b)=>a.x-b.x);return output;
}
const joined=(items:PdfItem[])=>items.map(i=>i.str.trim()).join(' ');
export function parseResultPdf(pages:PdfItem[][],sourceUrl:string):ResultBoard[]{
  const boards:ResultBoard[]=[];
  pages.forEach((items,pageIndex)=>{
    const pageLines=lines(items);
    const name=items.find(i=>/^(?:Name|Competitor\(s\)|Competitor|Name of Competitor)$/i.test(i.str.trim()));
    const rank=items.find(i=>/^(?:Rank|FPl\.?|Pl\.?|Place)$/i.test(i.str.trim())&&(!name||Math.abs(i.y-name.y)<3));
    if(!name||!rank)return;
    const header=items.filter(i=>Math.abs(i.y-name.y)<2&&i.str.trim());
    const total=header.find(i=>/^(?:Points|Score|Total(?: Score)?)$/i.test(i.str.trim())&&i.x>name.x);
    if(!total)return;
    const club=header.find(i=>/^Club$/i.test(i.str.trim())&&i.x>name.x)||header.find(i=>/^(?:Nation|NOC|Section)$/i.test(i.str.trim())&&i.x>name.x);
    const tes=header.find(i=>/^(?:Element Score|TES|Technical.*Score)$/i.test(i.str.trim()));
    const pcs=header.find(i=>/^(?:Prog Comp Score|PCS|Program Component.*)$/i.test(i.str.trim()));
    const bonus=header.find(i=>/^Bonus$/i.test(i.str.trim())),deduction=header.find(i=>/^Deduction/i.test(i.str.trim()));
    const categoryLine=pageLines.filter(l=>l.y>name.y+4&&l.y<name.y+100).reverse().find(l=>/\b(?:STAR\s*\d+|Women|Men|Girls|Boys|Dance|Pairs|Artistic|Gold|Silver|Bronze|Adult)\b/i.test(joined(l.items))&&!/Summary|Result|Date|Version/i.test(joined(l.items)));
    const label=categoryLine?joined(categoryLine.items):'Official results';
    const kind=tes&&pcs?'segment':'category';
    let board=boards.find(b=>b.label===label&&b.kind===kind);if(!board){board={id:sourceUrl+'|'+label,label,kind,sourceUrl,rows:[]};boards.push(board);}
    const anchors=[name.x,club?.x,tes?.x,pcs?.x,bonus?.x,deduction?.x,total.x,...header.filter(i=>/^(?:SP|FP|FS|RD|FD|PD\d?)$/.test(i.str.trim())).map(i=>i.x)].filter((x):x is number=>x!==undefined).sort((a,b)=>a-b);
    const textCell=(row:PdfItem[],start:number,end:number)=>joined(row.filter(i=>i.x>=start-5&&i.x<end-5));
    const score=(row:PdfItem[],anchor?:PdfItem)=>anchor?numeric(row.find(i=>numeric(i.str)!==null&&Math.abs(i.x-anchor.x)<35)?.str):null;
    for(const line of pageLines.filter(l=>l.y<name.y-4&&l.y>45)){
      const rankItem=line.items.find(i=>i.x<name.x-3&&/^(?:\d+|WD|WDR|DNS|DSQ)$/i.test(i.str.trim()));
      if(!rankItem)continue;
      const competitor=textCell(line.items,name.x,anchors.find(x=>x>name.x+5)??total.x);if(!competitor||numeric(competitor)!==null)continue;
      const rowTotal=score(line.items,total);if(rowTotal===null&&/^\d+$/.test(rankItem.str.trim()))continue;
      const row:ResultSkater={id:sourceUrl+'|'+pageIndex+'|'+normalizeName(competitor),name:competitor,club:club?textCell(line.items,club.x,anchors.find(x=>x>club.x+5)??total.x):'',rank:numeric(rankItem.str),status:rowTotal!==null?'result':rankItem.str.trim(),total:rowTotal,tes:score(line.items,tes),pcs:score(line.items,pcs),bonus:score(line.items,bonus),deduction:score(line.items,deduction),page:pageIndex+1,sourceUrl,elements:[],components:[]};
      const elementHeader=pageLines.find(l=>l.y<line.y&&/Executed Element/.test(joined(l.items)));
      const componentHeader=pageLines.find(l=>l.y<line.y&&/Program Component/.test(joined(l.items)));
      if(elementHeader){const base=elementHeader.items.find(i=>/^Value$/i.test(i.str))?.x??250;
        row.elements=pageLines.filter(l=>l.y<elementHeader.y-3&&l.y>(componentHeader?.y??45)).flatMap(l=>{const left=joined(l.items.filter(i=>i.x<base-5));return /^\d+\s+\S/.test(left)?[{label:left,values:l.items.filter(i=>i.x>=base-5).map(i=>i.str.trim())}]:[];});}
      if(componentHeader)row.components=pageLines.filter(l=>l.y<componentHeader.y-3&&l.y>45).flatMap(l=>{
        const first=l.items[0];return first&&/^(?:Composition|Presentation|Performance(?:\/Execution)?|Interpretation.*|Timing|Skating Skills|Transitions.*)$/i.test(first.str.trim())?[{label:first.str.trim(),values:l.items.slice(1).map(i=>i.str.trim())}]:[];
      });
      if(!board.rows.some(r=>sameCompetitor(r.name,row.name)&&r.rank===row.rank))board.rows.push(row);
    }
  });
  return boards.filter(b=>b.rows.length).map(board=>({...board,rows:board.rows.sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity))}));
}
export function parseApiResults(payload:unknown,sourceUrl:string,label:string):ResultBoard{
  const input=(payload as {CompetitorEntries?:Array<Record<string,unknown>>})?.CompetitorEntries;if(!Array.isArray(input))throw Error('Unsupported results response');
  const rows=input.map((r,index):ResultSkater=>({id:String(r.competitorEntryId||index),name:String(r.competitorName||''),club:String(r.competitorClub||''),rank:numeric(r.segmentRank),overallRank:numeric(r.categoryRank),status:r.competitorStatus==='SCORED'?'result':String(r.competitorStatus||'Unpublished'),total:r.competitorStatus==='SCORED'?numeric(r.score):null,tes:r.competitorStatus==='SCORED'?numeric(r.tes):null,pcs:r.competitorStatus==='SCORED'?numeric(r.pcs):null,bonus:numeric(r.bonus),deduction:numeric(r.deduction),sourceUrl,page:0,elements:[],components:[]}));
  return {id:sourceUrl,label,kind:'segment',sourceUrl,rows:rows.sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity))};
}
export function parseApiMarks(elements:unknown,components:unknown){
  const numberText=(value:unknown)=>{const n=numeric(value);return n===null?'—':n.toFixed(2);};
  const elementRows=(elements as {SkateElements?:Array<Record<string,unknown>>})?.SkateElements,componentRows=(components as {Components?:Array<Record<string,unknown>>})?.Components;
  if(!Array.isArray(elementRows)||!Array.isArray(componentRows))throw Error('Unsupported score details');
  return {
    elements:elementRows.map((r):ScoreLine=>({label:[r.order,r.code,r.modifiers,r.notes,r.halfway_bonus?'x':''].filter(Boolean).join(' '),values:[numberText(r.base_value),numberText(r.goe_trimmed_mean),...((r.official_goe_scores||[]) as Array<Record<string,unknown>>).map(j=>`${j.judge_number?'J'+j.judge_number:'Ref'}: ${numberText(j.goe_value)}`),numberText(r.goe_score)]})),
    components:componentRows.map((r):ScoreLine=>({label:String(r.programComponentName||r.code||''),values:[numberText(r.calculationValue),...((r.officialScores||[]) as Array<Record<string,unknown>>).map(j=>`${j.officialPosition?'J'+j.officialPosition:'Ref'}: ${numberText(j.pcScore)}`),numberText(r.total)]})),
  };
}
export function linkedResultDocuments(html:string,hub:string,sourceUrl:string){
  const source=new URL(sourceUrl),stem=source.pathname.replace(/CR\.pdf$/i,'');
  return [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].flatMap(match=>{try{const url=new URL(plain(match[1]),hub);return url.origin===source.origin&&url.pathname.startsWith(stem)&&/^(?:SP|FP|FS|RD|FD|PD)\d*(?:DRO|DE|JR|CR)\.pdf$/i.test(url.pathname.slice(stem.length))?[url.href]:[];}catch{return [];}}).filter((u,i,all)=>all.indexOf(u)===i).slice(0,4);
}
export function parseResultHtml(html:string,sourceUrl:string,label:string):ResultBoard[]{
  let columns:string[]=[],rows:ResultSkater[]=[];
  for(const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>plain(c[1]));
    if(cells.some(c=>/^(?:Rank|FPl\.?|Place)$/i.test(c))&&cells.some(c=>/^(?:Name|Name of Competitor|Competitor)$/i.test(c))){columns=cells;continue;}
    if(!columns.length)continue;const index=(pattern:RegExp)=>columns.findIndex(c=>pattern.test(c)),get=(pattern:RegExp)=>cells[index(pattern)]||'';
    const rank=get(/^(?:Rank|FPl\.?|Place)$/i),name=get(/^(?:Name|Name of Competitor|Competitor)$/i);if(!name||!/^\d+$|^(?:WD|DNS|DSQ)$/i.test(rank))continue;
    const total=numeric(get(/^(?:Points|Total(?: Score)?|TSS)$/i));
    rows.push({id:sourceUrl+'|'+normalizeName(name),name,club:get(/^(?:Nation|NOC|Club)$/i),rank:numeric(rank),total,status:total===null?rank:'result',tes:numeric(get(/^TES$/i)),pcs:numeric(get(/^PCS$/i)),bonus:null,deduction:numeric(get(/Ded/i)),page:0,sourceUrl,elements:[],components:[]});
  }
  return rows.length?[{id:sourceUrl,label,kind:columns.some(c=>/^TES$/i.test(c))?'segment':'category',sourceUrl,rows}]:[];
}
export function combineApiBoards(boards:ResultBoard[],label:string):ResultBoard|null{
  if(boards.length<2)return null;
  const names=[...new Set(boards.flatMap(b=>b.rows.map(r=>normalizeName(r.name))))];
  const rows=names.map(name=>{
    const segments=boards.map(b=>b.rows.find(r=>normalizeName(r.name)===name)),last=segments.filter(Boolean).at(-1)!;
    const complete=segments.every(r=>r?.status==='result'&&r.total!==null);
    const sum=(key:'total'|'tes'|'pcs'|'bonus'|'deduction')=>complete&&segments.every(r=>r![key]!==null)?Math.round(segments.reduce((s,r)=>s+r![key]!,0)*100)/100:null;
    return {...last,id:'combined|'+name,rank:complete?last.overallRank??null:null,status:complete?'result':'Incomplete',total:sum('total'),tes:sum('tes'),pcs:sum('pcs'),bonus:sum('bonus'),deduction:sum('deduction'),elements:[],components:[]};
  }).sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity));
  return {id:'combined|'+boards[0].id,label,kind:'category',sourceUrl:boards[0].sourceUrl,rows};
}
