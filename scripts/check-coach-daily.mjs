import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {coachOverlaps,filterCoachSchedule,groupCoachSchedule,orderCoachSchedule} from '../lib/coach-schedule.ts';

const row=(id,date,start,extra={})=>({id,slotKey:id,eventId:'event-a',eventName:'Fixture Competition',eventUrl:'https://example.test',skaterId:id,skaterName:id,coach:'Jen Jackson',category:'STAR 5',date,start,end:'15:00',rink:'BLUE',activity:'competition',uncertain:false,sourceUrl:'https://example.test/schedule.pdf',page:1,timezone:'America/Toronto',matchStatus:'official',...extra});
const rows=[
  row('late','2026-11-21','14:00'),
  row('uncertain','2026-11-20','08:01',{uncertain:true}),
  row('first','2026-11-20','09:00',{skaterId:'child-a',skaterName:'Same Name'}),
  row('other-program','2026-11-20','13:00',{skaterId:'child-a',skaterName:'Same Name',category:'Artistic'}),
  row('same-name-child','2026-11-20','10:00',{skaterName:'Same Name'}),
  row('another-zone','2026-11-20','08:00',{timezone:'America/Winnipeg',eventId:'event-b'}),
];
const before=structuredClone(rows),checks=[];
const conflicts=coachOverlaps(rows);
assert.deepEqual(conflicts.get('first').map(c=>c.peer.id),['another-zone','same-name-child']);
assert.deepEqual(conflicts.get('another-zone').map(c=>c.peer.id),['first','same-name-child','other-program']);
assert.ok(!conflicts.has('uncertain')&&!conflicts.has('late'));
const boundary=[row('one','2026-11-20','08:00',{end:'09:00',coach:'A / B'}),row('touch','2026-11-20','09:00',{end:'10:00',coach:'A'})];
assert.equal(coachOverlaps(boundary).size,0);
boundary[1].start='08:45';
assert.equal(coachOverlaps(boundary,'B').size,0);
const overlap=coachOverlaps(boundary,'A').get('one')[0];
assert.deepEqual(overlap.coaches,['A']);
assert.equal(overlap.end-overlap.start,15*60_000);
checks.push('overlaps identify actual peers, shared coaches and intersecting minutes across zones; adjacent and candidate slots are excluded');
const days=groupCoachSchedule(rows);
assert.deepEqual(days.map(day=>day.date),['2026-11-20','2026-11-21']);
assert.equal(days[0].skaterCount,4);assert.equal(days[0].sessionCount,5);assert.equal(days[0].unconfirmedCount,1);
assert.equal(days[1].skaterCount,1);assert.equal(days[1].sessionCount,1);
checks.push('dates sort chronologically; multiple programs count as one child, while same-name children remain distinct');
assert.deepEqual(days[0].zones.map(zone=>zone.timezone),['America/Toronto','America/Winnipeg']);
assert.deepEqual(days[0].zones[0].rows.map(row=>row.id),['first','same-name-child','other-program','uncertain']);
assert.deepEqual(days[0].zones[1].rows.map(row=>row.id),['another-zone']);
checks.push('confirmed starts sort within local time zones, with uncertain candidate times last');
const filtered=filterCoachSchedule(rows,{event:'event-a',coach:'Jen Jackson',date:'2026-11-20',assignedOnly:true});
assert.equal(groupCoachSchedule(filtered)[0].skaterCount,3);assert.equal(groupCoachSchedule(filtered)[0].sessionCount,4);
assert.deepEqual(orderCoachSchedule(filtered).map(row=>row.id),['first','same-name-child','other-program','uncertain']);
assert.deepEqual(rows,before);assert.deepEqual(groupCoachSchedule([]),[]);
checks.push('counts and row order honor the existing combined filters without changing input or adding sessions');

registerHooks({
  resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
    if(specifier.startsWith('.')&&context.parentURL){for(const extension of ['.ts','.tsx']){const file=new URL(specifier+extension,context.parentURL);if(fs.existsSync(file))return {url:file.href,shortCircuit:true};}}
    throw error;
  }},
  load(url,context,next){
    if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8'),shortCircuit:true};
    if(url.startsWith('file:')&&/\.tsx?$/.test(url))return {format:'module',source:ts.transpileModule(fs.readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const {default:CoachDailySchedule}=await import('../app/coach-daily-schedule.tsx');
const {default:SessionTiming}=await import('../app/session-timing.tsx');
const timingCategory='STAR 6 Women Group 1',timingSource='https://example.test/draw.pdf';
const timingBlock={id:'timing',category:timingCategory,group:1,range:null,activity:'competition',date:'2026-11-20',start:'09:00',end:'09:20',rink:'BLUE'};
const timingOrders=['One','Two','Three'].map((name,index)=>({id:name,name,category:timingCategory,program:'free',startNumber:index+1,warmupGroup:1,individualTime:null,sourceUrl:timingSource}));
const timingEvent={id:'timing-event',blocks:[timingBlock],startingOrders:timingOrders,participants:timingOrders.map(o=>({name:o.name,category:o.category}))};
const timingRow={...row('timing-row','2026-11-20','09:00'),id:'timing-event|Two|timing',skaterId:'Two',startingOrder:timingOrders[1]};
const estimateMarkup=renderToStaticMarkup(createElement(SessionTiming,{row:timingRow,event:timingEvent}));
assert.match(estimateMarkup,/Estimated warm-up/);assert.match(estimateMarkup,/09:00/);assert.match(estimateMarkup,/Estimated skate start/);assert.match(estimateMarkup,/09:10/);assert.ok(!estimateMarkup.includes('pending'));
const officialMarkup=renderToStaticMarkup(createElement(SessionTiming,{row:{...timingRow,startingOrder:{...timingOrders[1],individualTime:'09:12:30'}},event:timingEvent}));
assert.match(officialMarkup,/Official individual time/);assert.match(officialMarkup,/09:12:30/);assert.ok(!officialMarkup.includes('Estimated skate start'));
assert.match(renderToStaticMarkup(createElement(SessionTiming,{row:{...timingRow,startingOrder:undefined},event:timingEvent})),/Individual time pending/);
assert.equal(renderToStaticMarkup(createElement(SessionTiming,{row:{...timingRow,activity:'practice'},event:timingEvent})), '');
checks.push('shared personal/profile/watch/calendar timing shows a valid estimate, prioritizes official start and preserves pending for incomplete draws');
let detailsCalls=0;
const html=renderToStaticMarkup(createElement(CoachDailySchedule,{rows,conflicts,onSkater:()=>{},renderDetails:()=>{detailsCalls++;return createElement('p',null,'Expanded details');}}));
assert.ok(html.indexOf('2026.11.20')<html.indexOf('2026.11.21'));
assert.match(html,/<strong>4<\/strong> skaters/);assert.match(html,/<strong>5<\/strong> sessions/);
assert.ok(html.includes('Group time'));assert.ok(html.includes('Skater / Category'));assert.ok(html.includes('Rink'));
assert.ok(html.includes('America/Toronto'));assert.ok(html.includes('America/Winnipeg'));
assert.ok(!html.includes('08:01'),'Unconfirmed candidate start must not appear as a confirmed time');
assert.ok(html.includes('TBC'));assert.ok(html.includes('Possible overlap'));assert.equal(detailsCalls,0);
assert.equal((html.match(/aria-expanded="false"/g)||[]).length,rows.length+conflicts.size);
checks.push('the overview renders date counts, compact table headers, local clocks and TBC without expanding detailed cards');
const empty=renderToStaticMarkup(createElement(CoachDailySchedule,{rows:[],conflicts:new Map(),onSkater:()=>{},renderDetails:()=>null}));
assert.ok(empty.includes('No matching official sessions'));
checks.push('an empty filtered view explains how to change filters');
const practice=renderToStaticMarkup(createElement(CoachDailySchedule,{rows:[row('practice','2026-11-20','11:00',{activity:'practice'})],conflicts:new Map(),onSkater:()=>{},renderDetails:()=>null}));
assert.ok(practice.includes('Practice · STAR 5'));
checks.push('official practice remains identifiable in the compact overview');
const published=renderToStaticMarkup(createElement(CoachDailySchedule,{rows:[row('ordered','2026-11-05','11:15',{startingOrder:{startNumber:19,warmupGroup:4,individualTime:null,sourceUrl:'https://skatingresults.ca/fixture/#/seg/test/start',page:0}})],conflicts:new Map(),onSkater:()=>{},renderDetails:()=>null}));
assert.ok(published.includes('Start #19'));assert.ok(published.includes('Warm-up <!-- -->4')||published.includes('Warm-up 4'));assert.ok(published.includes('https://skatingresults.ca/fixture/#/seg/test/start'));assert.ok(published.includes('aria-expanded="false"'));
checks.push('published starting order and warm-up group link are visible before expanding a row');
console.log(JSON.stringify({passed:checks.length,checks,fixtureOnly:true,productionWrites:0},null,2));
