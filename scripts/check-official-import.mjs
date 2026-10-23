import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractTextItems,getDocumentProxy} from 'unpdf';
import {parseEntryPdf} from '../lib/entry-pdf.ts';
import {importEntries} from '../lib/entry-import.ts';
import {parseScheduleDocument,scheduleRows} from '../lib/official-parser.ts';

const checks=[];
async function pages(bytes){return (await extractTextItems(await getDocumentProxy(bytes,{disableFontFace:true}))).items;}
const fixtures={};
for(const name of ['adult-2026-masters-entry','adult-2026-gold-entry','keswick-2026-gold-entry','keswick-2026-schedule','adult-2026-schedule'])fixtures[name]=await pages(new Uint8Array(fs.readFileSync('tests/fixtures/'+name+'.pdf')));
const goldUrl='https://skateontario.org/results/26PSAdults/PSADULTGoldWomenFreeYAEL.pdf';
const gold=parseEntryPdf(fixtures['adult-2026-gold-entry'],goldUrl,[{id:'fixture-a',name:'Alexis Collins'}]);
assert.equal(gold.length,4);assert.equal(gold[0].club,'Wainfleet SC');assert.deepEqual(gold[0].skaterIds,['fixture-a']);assert.equal(gold[0].category,'Gold Women (Free YA)');
assert.equal(parseEntryPdf(fixtures['adult-2026-masters-entry'],goldUrl,[]).length,1);
assert.ok(parseEntryPdf(fixtures['keswick-2026-gold-entry'],goldUrl,[]).length>0);
checks.push('three genuine official entry PDFs preserve category, club, section, counts and source links');

for(const roster of [[{id:'fixture-a',name:'Alexis Collins',identityPending:true}],[{id:'fixture-a',name:'Alexis Collins'},{id:'fixture-b',name:'Alexis Collins'}]])assert.deepEqual(parseEntryPdf(fixtures['adult-2026-gold-entry'],goldUrl,roster)[0].skaterIds,[]);
checks.push('pending identities and ambiguous roster names never acquire automatic candidate links');

const malformed=structuredClone(fixtures['adult-2026-gold-entry']);malformed[0].find(item=>item.str==='4').str='9';
assert.throws(()=>parseEntryPdf(malformed,goldUrl,[]),/Number Entries/);
assert.throws(()=>parseEntryPdf([[]],goldUrl,[]),/表头/);
const wrapped=structuredClone(fixtures['adult-2026-gold-entry']);wrapped[0].push({str:'Unaligned name continuation',x:54,y:580});
assert.throws(()=>parseEntryPdf(wrapped,goldUrl,[]),/分列/);
checks.push('count mismatches, scans and unaligned name rows fail closed rather than import partial names');

const scheduleUrl='https://skateontario.org/wp-content/uploads/2026/07/Keswick-schedule-for-posting-1.pdf';
const schedule=parseScheduleDocument(fixtures['keswick-2026-schedule'],scheduleUrl);
const byDate=schedule.blocks.reduce((counts,block)=>({...counts,[block.date]:(counts[block.date]||0)+1}),{});
assert.deepEqual(byDate,{'2026-11-20':20,'2026-11-21':16,'2026-11-22':4});
assert.ok(schedule.blocks.some(block=>block.date==='2026-11-20'&&block.rink==='GREEN RINK'&&block.start==='10:00'));
assert.ok(schedule.blocks.some(block=>block.date==='2026-11-21'&&block.rink==='BLUE RINK'&&block.start==='08:00'));
assert.ok(schedule.warnings.length>0);
const shuffled=parseScheduleDocument(fixtures['keswick-2026-schedule'].map(page=>[...page].reverse()),scheduleUrl);
assert.deepEqual(shuffled.blocks,schedule.blocks);
checks.push('same-page Friday/Saturday bands and two rinks remain spatially correct even if PDF item order changes');

const adult=parseScheduleDocument(fixtures['adult-2026-schedule'],'adult');assert.equal(adult.blocks.length,0);assert.ok(adult.warnings.some(warning=>warning.includes('冰场')));
checks.push('unsupported rink-less or continuation layouts remain pending instead of inventing an arena or date');

const skaters=[{id:'fixture-a',name:'Fixture',coach:'Coach',training:true,categories:[],clubs:[],recordCount:0,eventCount:0,identityStatus:''}];
const event={id:'SO-TEST',name:'Test',url:scheduleUrl,timezone:'America/Toronto',participants:[{id:'entry',name:'Fixture',category:'STAR 7 Women U12 Group 1',skaterIds:['fixture-a'],matchStatus:'fixture',sourceUrl:goldUrl}],blocks:schedule.blocks};
const matched=scheduleRows([event],skaters);assert.ok(matched.length>0);assert.ok(matched.every(row=>!row.category.includes('O12')||row.category.includes('U12')));
const unknownAge=scheduleRows([{...event,participants:[{...event.participants[0],category:'STAR 7 Women Group 1'}]}],skaters);assert.ok(unknownAge.length>0);assert.ok(unknownAge.every(row=>row.uncertain));
checks.push('explicit U12/O12 categories do not cross-match and missing age stays uncertain');

const indexUrl='https://skateontario.org/import-fixture/';
const fileUrls=Array.from({length:6},(_,index)=>indexUrl+'entries-'+(index+1)+'.pdf');
let urls=[...fileUrls],fail=new Set(),revision=1;
const calls=[];
const readBytes=async url=>{calls.push(url);if(url===indexUrl)return new TextEncoder().encode(urls.map(file=>'<a href="'+file+'">Entry List</a>').join(''));if(fail.has(url))throw new Error('fixture download failure');return new Uint8Array([revision]);};
const readPdf=async()=>fixtures['adult-2026-gold-entry'];
const document={url:indexUrl,label:'Entry Lists',kind:'entries'};
const before=structuredClone(document);
const first=await importEntries(document,[],[],'roster-a','2026-10-23T12:00:00Z',readBytes,readPdf);
assert.equal(calls.length,5);assert.equal(first.participants.length,16);assert.equal(first.document.entryFiles.filter(file=>file.checkedAt).length,4);assert.ok(first.errors.some(error=>error.includes('4/6')));assert.deepEqual(document,before);
checks.push('catalog imports are bounded to four PDF requests and partial progress is explicit without mutating prior metadata');

calls.length=0;
const second=await importEntries(first.document,first.participants,[],'roster-a','2026-10-23T13:00:00Z',readBytes,readPdf);
assert.deepEqual(calls.slice(1,3),fileUrls.slice(4));assert.equal(second.participants.length,24);assert.equal(second.errors.length,0);
checks.push('later batches prioritize unvisited files and retain already imported categories');

fail=new Set(fileUrls);calls.length=0;
const failed=await importEntries(second.document,second.participants,[],'roster-a','2026-10-23T14:00:00Z',readBytes,readPdf);
assert.deepEqual(failed.participants,second.participants);assert.ok(failed.errors.length>0);assert.ok(failed.document.entryFiles.some(file=>file.error));
fail=new Set();revision=2;calls.length=0;
const revised=await importEntries(failed.document,failed.participants,[],'roster-a','2026-10-23T15:00:00Z',readBytes,readPdf);
assert.ok(revised.document.entryFiles.some(file=>file.hash!==second.document.entryFiles.find(previous=>previous.url===file.url).hash));
assert.equal(revised.participants.length,24);
checks.push('download failures retain old rows and same-URL content revisions replace only their file without duplicating people');

calls.length=0;
const rosterChanged=await importEntries(second.document,second.participants,[{id:'fixture-a',name:'Alexis Collins'}],'roster-b','2026-10-23T16:00:00Z',readBytes,readPdf);
assert.ok(rosterChanged.participants.some(row=>row.skaterIds.includes('fixture-a')));assert.ok(rosterChanged.errors.length>0);
urls=urls.slice(1);calls.length=0;
const removed=await importEntries(second.document,second.participants,[],'roster-a','2026-10-23T17:00:00Z',readBytes,readPdf);
assert.ok(removed.participants.some(row=>row.sourceUrl===fileUrls[0]));assert.ok(removed.errors.some(error=>error.includes('移除')));
checks.push('roster changes require rematching and removed catalog links preserve old records with an explicit review warning');

const invalid=await importEntries(second.document,second.participants,[],'roster-a','2026-10-23T18:00:00Z',readBytes,async()=>malformed);
assert.deepEqual(invalid.participants,second.participants);assert.ok(invalid.errors.some(error=>error.includes('Number Entries')));
checks.push('invalid PDF revisions cannot overwrite previously valid entries');
console.log(JSON.stringify({passed:checks.length,checks,fixtureOnly:true,productionWrites:0,realEmailsSent:0,keswickBlocks:byDate,adultSchedulePending:adult.warnings},null,2));
