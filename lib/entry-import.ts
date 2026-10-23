import type {OfficialDocument,Participant} from './club-types';
import type {PdfItem} from './official-parser';
import {discoverDocuments,parseEntries} from './official-parser.ts';
import {parseEntryPdf} from './entry-pdf.ts';
import {ENTRY_PDF_VERSION} from './club-types.ts';

const ENTRY_HTML_VERSION='entry-html-1';
const batchSize=4;
const hashBytes=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))).map(value=>value.toString(16).padStart(2,'0')).join('');
type Roster=Array<{id:string;name:string;identityPending?:boolean}>;
type ReadBytes=(url:string,maxBytes?:number)=>Promise<Uint8Array>;
type ReadPdf=(bytes:Uint8Array)=>Promise<PdfItem[][]>;

export async function importEntries(document:OfficialDocument,previous:Participant[],roster:Roster,rosterHash:string,now:string,readBytes:ReadBytes,readPdf:ReadPdf){
  const state={...document,attemptedAt:now};
  const bytes=await readBytes(state.url,8_000_000),hash=await hashBytes(bytes);
  if(/\.pdf$/i.test(new URL(state.url).pathname)){
    const participants=state.hash===hash&&state.parserVersion===ENTRY_PDF_VERSION&&state.matchingRosterHash===rosterHash?previous:parseEntryPdf(await readPdf(bytes),state.url,roster);
    return {document:{...state,hash,parserVersion:ENTRY_PDF_VERSION,matchingRosterHash:rosterHash,checkedAt:now,entryCount:participants.length,error:undefined},participants,errors:[] as string[],status:'已读取官方报名 PDF'};
  }
  const html=new TextDecoder().decode(bytes),direct=parseEntries(html,state.url,roster);
  if(direct.length)return {document:{...state,hash,parserVersion:ENTRY_HTML_VERSION,matchingRosterHash:rosterHash,checkedAt:now,entryCount:direct.length,entryFiles:undefined,error:undefined},participants:direct,errors:[] as string[],status:'已读取官方名单'};
  const discovered=discoverDocuments(html,state.url).filter(file=>file.kind==='entries'&&/\.pdf$/i.test(new URL(file.url).pathname)&&new URL(file.url).origin===new URL(state.url).origin);
  if(!discovered.length||discovered.length>160)throw new Error('报名目录中没有已支持的同源 PDF 或文件数量超出范围，保留上次有效名单');
  const old=new Map((state.entryFiles||[]).map(file=>[file.url,file]));
  const files=discovered.map(file=>({...old.get(file.url),...file}));
  const current=new Set(files.map(file=>file.url));
  const removed=(state.entryFiles||[]).filter(file=>!current.has(file.url)).map(file=>({...file,error:'官网目录不再列出此文件，保留旧资料待核对'}));
  const selected=[...files].sort((first,second)=>(first.attemptedAt||first.checkedAt||'').localeCompare(second.attemptedAt||second.checkedAt||'')).slice(0,batchSize);
  let participants=[...previous];
  for(const file of selected){
    file.attemptedAt=now;
    try{
      const payload=await readBytes(file.url,8_000_000),fileHash=await hashBytes(payload);
      if(file.hash!==fileHash||file.parserVersion!==ENTRY_PDF_VERSION||file.matchingRosterHash!==rosterHash){
        const parsed=parseEntryPdf(await readPdf(payload),file.url,roster);
        participants=[...participants.filter(row=>row.sourceUrl!==file.url),...parsed];file.entryCount=parsed.length;
      }
      file.hash=fileHash;file.parserVersion=ENTRY_PDF_VERSION;file.matchingRosterHash=rosterHash;file.checkedAt=now;delete file.error;
    }catch(failure){file.error=failure instanceof Error?failure.message:'报名 PDF 读取失败';}
  }
  const checked=files.filter(file=>file.checkedAt&&!file.error&&file.parserVersion===ENTRY_PDF_VERSION&&file.matchingRosterHash===rosterHash).length;
  const pending=files.length-checked;
  const errors=files.filter(file=>file.error).map(file=>new URL(file.url).pathname.split('/').pop()+': '+file.error);
  if(pending)errors.push(`报名 PDF 已核对 ${checked}/${files.length} 份，剩余 ${pending} 份等待后续批次或人工核对`);
  if(removed.length)errors.push(`目录移除了 ${removed.length} 份旧文件，旧资料保留待核对`);
  return {document:{...state,hash,parserVersion:'entry-index-1',matchingRosterHash:rosterHash,entryFiles:[...files,...removed],entryCount:participants.length,checkedAt:errors.length?state.checkedAt:now,error:errors.join('；')||undefined},participants,errors,status:errors.length?`报名目录部分导入：${checked}/${files.length} 份 PDF 已核对`:'已读取报名目录全部 PDF'};
}
