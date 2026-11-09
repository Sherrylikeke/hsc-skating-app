import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getDocumentProxy,extractTextItems} from 'unpdf';
import {parseApiStartingOrder,importStartingOrderApp,startingOrderApp,startingCategory} from '../lib/starting-order-api.ts';
import {scheduleRows,parseScheduleDocument,competitionSchedule} from '../lib/official-parser.ts';
import {coachTimingEstimate} from '../lib/coach-timing.ts';
import {clubEventResponse} from '../lib/club-response.ts';
import {parseStartingOrderHtml} from '../lib/starting-order.ts';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/sectionals-2026-starting-order-api.json','utf8'));
const roster=[{id:'fixture-carson',name:'Carson Wang'},{id:'pending',name:'Nathaniel',identityPending:true}];
const short=fixture.segments.find(s=>/Short/.test(s.segmentName)),free=fixture.segments.find(s=>/Free/.test(s.segmentName));
const orders=parseApiStartingOrder(fixture.entries[short.segmentId],startingCategory(fixture.category),short,fixture.documentUrl,roster);
const carson=orders.find(o=>o.name==='Carson Wang');assert.equal(carson.startNumber,19);assert.equal(carson.warmupGroup,4);assert.equal(carson.individualTime,null);assert.deepEqual(carson.skaterIds,['fixture-carson']);assert.ok(carson.sourceUrl.endsWith('/'+short.segmentId+'/start'));
assert.equal(parseApiStartingOrder(fixture.entries[free.segmentId],startingCategory(fixture.category),free,fixture.documentUrl,roster).length,0);
const html=`<script>var EVENT_ID = "${fixture.eventId}"; var API = "/api/results";</script>`;
assert.equal(startingOrderApp(html,fixture.documentUrl).eventId,fixture.eventId);assert.equal(startingOrderApp(html,'https://evil.test/results'),null);assert.equal(startingOrderApp(html.replace('/api/results','https://evil.test/api'),fixture.documentUrl),null);
const participants=[{category:'Pre-Novice Men',skaterIds:['fixture-carson']}];let fail=false;
const read=async url=>{if(fail&&url.endsWith(short.segmentId+'/entries'))throw Error('Fixture source failure');let value;
 if(url.endsWith('/categories'))value={Categories:[fixture.category]};else if(url.endsWith('/segments'))value={Segments:fixture.segments};else{const id=url.match(/segment\/([^/]+)\/entries$/)?.[1];value=fixture.entries[id];}assert.ok(value,'Only declared same-origin API paths may be read');return new TextEncoder().encode(JSON.stringify(value));};
const imported=await importStartingOrderApp(html,fixture.documentUrl,roster,participants,[],read);assert.equal(imported.errors.length,0);assert.equal(imported.orders.find(o=>o.name==='Carson Wang').startNumber,19);
fail=true;const previous=imported.orders.map(o=>o.name==='Carson Wang'?{...o,startNumber:18}:o);const failed=await importStartingOrderApp(html,fixture.documentUrl,roster,participants,previous,read);assert.equal(failed.errors.length,1);assert.equal(failed.orders.find(o=>o.name==='Carson Wang').startNumber,18);fail=false;
const recovered=await importStartingOrderApp(html,fixture.documentUrl,roster,participants,failed.orders,read);assert.equal(recovered.orders.filter(o=>o.name==='Carson Wang').length,1);assert.equal(recovered.orders.find(o=>o.name==='Carson Wang').startNumber,19);
const pdf=await getDocumentProxy(new Uint8Array(fs.readFileSync('tests/fixtures/sectionals-2026-oct26-schedule.pdf')));const {items}=await extractTextItems(pdf);const source='https://skateontario.org/schedule-oct26.pdf';const parsed=parseScheduleDocument(items,source);const blocks=parsed.blocks.filter(b=>b.categoryKey==='PRENOVICE:MEN');assert.equal(blocks.length,4);
const event={id:'fixture',name:'Fixture',url:fixture.documentUrl,timezone:'America/Toronto',participants,blocks,startingOrders:imported.orders};const rows=scheduleRows([event],[{...roster[0],coach:'Jen Jackson/Bryce Davidson'}]);assert.equal(rows.length,2);const shortRow=rows.find(r=>r.startingOrder);assert.equal(shortRow.date,'2026-11-05');assert.equal(shortRow.start,'11:15');assert.equal(shortRow.end,'12:15');assert.equal(shortRow.rink,'MOLSON RINK');assert.equal(shortRow.uncertain,false);assert.equal(rows.find(r=>!r.startingOrder).uncertain,true);
const award={url:'https://skateontario.org/Awards-Schedule.pdf',kind:'schedule',label:'Awards Schedule'},schedule={url:source,kind:'schedule',label:'Schedule - Updated as of Oct 26'};assert.equal(competitionSchedule([award,schedule]),schedule);assert.equal(competitionSchedule([award]),undefined);
const memberEvent=clubEventResponse({...event,documents:[]},false);
assert.equal(memberEvent.startingOrders[0].warmupSeconds,300);
function timing(number, data=memberEvent) {
  const target=data.startingOrders.find(o=>o.startNumber===number);
  const block=data.blocks.find(b=>/SHORT/i.test(b.category) && (!b.range || (b.range[0]<=number && number<=b.range[1])));
  const row={...shortRow,id:data.id+'|'+shortRow.skaterId+'|'+block.id,startingOrder:target};
  return coachTimingEstimate(row,data);
}
assert.equal(timing(1),null); // #5 withdrew; the source no longer contains a complete first block.
assert.deepEqual(coachTimingEstimate(shortRow,memberEvent),{warmup:'11:15',start:'11:35'});
assert.deepEqual(timing(21),{warmup:'11:45',start:'11:50'});
assert.equal(shortRow.startingOrder.individualTime,null);
assert.equal(coachTimingEstimate(rows.find(r=>r.uncertain),memberEvent),null);
const shortBlock=blocks.find(b=>b.start===shortRow.start && b.date===shortRow.date);
const duplicateBand={...shortBlock,id:'second-slot',start:'13:00',end:'14:00'};
assert.equal(timing(19,{...memberEvent,blocks:[...blocks,duplicateBand]}),null);
assert.equal(timing(19,{...memberEvent,blocks:[...blocks,{...duplicateBand,range:[19,22]}]}),null);
const within=imported.orders.filter(o=>o.startNumber>=16);
const vary=(mapOrder=b=>b,patch={})=>({...memberEvent,blocks:[{...shortBlock,...patch}],startingOrders:within.map(mapOrder)});
const noOverride=o=>({...o,warmupSeconds:undefined});
assert.deepEqual(timing(19,vary(noOverride)),{warmup:'11:15',start:'11:35'}); // older saved draw
for(const [category,minutes] of [['Junior Men Short',6],['STAR 4 Boys Short',4],['STAR 7 Women Short',5],['STAR 7 Women Artistic Short',4]]){
  const data=vary(o=>({...noOverride(o),category}),{category});
  assert.equal(timing(16,data).start,'11:'+String(15+minutes));
}
assert.equal(timing(16,vary(o=>({...o,warmupSeconds:240}))).start,'11:19');
assert.equal(timing(16,vary(o=>({...o,warmupSeconds:undefined,category:'Unknown Men Short'}),{category:'Unknown Men Short'})),null);
const missing=memberEvent.startingOrders.filter(o=>o.startNumber!==18);
assert.equal(timing(19,{...memberEvent,startingOrders:missing}),null);
assert.equal(timing(19,vary(o=>({...o,warmupGroup:o.startNumber===18?null:o.warmupGroup}))),null);
assert.equal(timing(19,vary(o=>({...o,startNumber:o.startNumber===18?17:o.startNumber}))),null);
assert.equal(timing(19,vary(o=>o,{category:shortBlock.category+' (Shared Warm-up)'})),null);
assert.equal(timing(19,vary(o=>o,{end:'11:24'})),null);
assert.equal(timing(19,vary(o=>o,{range:[17,25]})),null); // same warm-up group straddles the start
const full=vary(o=>({...o,startNumber:o.startNumber-15}),{range:null});
full.participants=full.startingOrders.map(o=>({name:o.name,category:'Pre-Novice Men'}));
assert.deepEqual(timing(4,full),{warmup:'11:15',start:'11:35'});
assert.equal(timing(4,{...full,participants:full.participants.slice(1)}),null);
assert.equal(timing(4,{...full,blocks:[...full.blocks,{...full.blocks[0],id:'other',start:'13:00',end:'14:00'}]}),null);
// A real timetable can label a STAR event by level alone. Follow its normal import and row-building path.
const starCategory='STAR 7 Women U12 - Group 2';
const starRoster=[{id:'fixture-a',name:'Example A',coach:'Coach'}];
const starHtml='<h2>'+starCategory+'</h2><table><tr><th>#</th><th>Skater</th><th>Warm-up Group</th></tr>'+
  '<tr><td>1</td><td>Guest</td><td>1</td></tr><tr><td>2</td><td>Example A</td><td>1</td></tr></table>';
const starDraw=parseStartingOrderHtml(starHtml,'https://example.test/starting-order',starRoster);
const starEvent={...memberEvent,startingOrders:starDraw,blocks:[{...shortBlock,category:starCategory,group:2,range:null,start:'09:00',end:'09:15'}],
  participants:starDraw.map(o=>({name:o.name,category:starCategory,skaterIds:o.skaterIds}))};
const [starRow]=scheduleRows([starEvent],starRoster);
assert.equal(starRow.startingOrder.program,'short');
assert.deepEqual(coachTimingEstimate(starRow,starEvent),{warmup:'09:00',start:'09:10'});
// Parse a break within the block; exclude it from the allocation and resume at its published end.
const line=(y,fields)=>fields.map(([x,str])=>({x,y,str}));
const page=[...line(720,[[0,'Thursday, November 5, 2026']]),...line(700,[[20,'START'],[80,'END'],[160,'MOLSON RINK']]),
  ...line(670,[[20,'11:15 AM'],[80,'12:25 PM'],[160,shortBlock.category]]),
  ...line(650,[[20,'11:45 AM'],[80,'11:55 AM'],[160,'FLOOD']])];
const withBreak={...memberEvent,blocks:parseScheduleDocument([page],source).blocks};
assert.deepEqual(timing(19,withBreak),{warmup:'11:15',start:'11:35'});
assert.deepEqual(timing(21,withBreak),{warmup:'11:55',start:'12:00'});
console.log('Coach timing: complete official fields, rule/meet warm-ups, ranges, breaks and pending cases verified');
console.log(JSON.stringify({passed:6,officialStartNumber:19,warmupGroup:4,shortWindow:'2026-11-05 11:15–12:15',rink:'MOLSON RINK',individualTimeNotInvented:true,freeDrawPending:true,awardsExcluded:true,partialFailurePreserved:true,sourceBounded:true}));
