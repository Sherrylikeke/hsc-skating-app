import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseStartingOrderPdf,parseStartingOrderHtml,orderFor} from '../lib/starting-order.ts';
import {discoverDocuments,scheduleRows} from '../lib/official-parser.ts';
import {readOfficialPdfItems} from '../lib/official-pdf.ts';
import {selectStartingOrderDocuments} from '../lib/starting-order-selection.ts';
import {coachTimingEstimate} from '../lib/coach-timing.ts';
import {STARTING_DRAW_VERSION} from '../lib/club-types.ts';
import {clubEventResponse} from '../lib/club-response.ts';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/provincials-2026-pre-novice-men-start-order-items.json','utf8'));
const roster=[{id:'cyrus',name:'Cyrus Huang'},{id:'nathaniel',name:'Nathaniel',identityPending:true}];
const url='https://skateontario.org/results/26PROVS/26PROVPre-NoviceMenFP2SO.pdf';
const parsed=parseStartingOrderPdf(fixture,url,roster);assert.equal(parsed.length,5);assert.equal(parsed[0].name,'Cyrus Huang');assert.equal(parsed[0].startNumber,1);assert.ok(parsed.every(r=>r.warmupGroup===1&&r.individualTime===null));assert.deepEqual(parsed[0].skaterIds,['cyrus']);
// Synthetic fixture explicitly labels warm-up group; category Group 2 must not become warm-up group 2.
const html='<h2>Pre-Novice Men Free Program Group 2</h2><table><tr><th>Starting Order</th><th>Competitor</th><th>Warm-Up Group</th><th>Start Time</th></tr><tr><td>17</td><td>Cyrus Huang</td><td>4</td><td>14:28:30</td></tr><tr><td>18</td><td>Nathaniel</td><td>4</td><td>14:33:00</td></tr></table>';
const actual=parseStartingOrderHtml(html,'https://skateontario.org/example.html',roster);assert.equal(actual.length,2);assert.equal(actual[0].warmupGroup,4);assert.equal(actual[0].startNumber,17);assert.equal(actual[0].individualTime,'14:28:30');assert.equal(actual[1].skaterIds.length,0);
assert.equal(orderFor(actual,'cyrus','PRE-NOVICE MEN SHORT'),undefined);assert.equal(orderFor(actual,'cyrus','PRE-NOVICE MEN FREE - GROUP 2').startNumber,17);
const docs=discoverDocuments('<a href="/order.pdf">Starting Order</a><a href="/entry.pdf">Entry List</a>','https://skateontario.org/event/');assert.deepEqual(docs.map(d=>d.kind),['start-order','entries']);
const skater={id:'cyrus',name:'Cyrus Huang',coach:'Jen Jackson/Bryce Davidson'};
const block=(id,range)=>({id,category:`PRE-NOVICE MEN FREE (${range.join('-')})`,categoryKey:'PRENOVICE:MEN',group:null,range,activity:'competition',date:'2026-11-06',start:'10:00',end:'11:00',rink:'RINK',page:1,sourceUrl:'https://skateontario.org/schedule.pdf'});
const event={id:'test',name:'Test',url:'https://skateontario.org',timezone:'America/Toronto',participants:[{category:'Pre-Novice Men',skaterIds:['cyrus'],matchStatus:'test'}],blocks:[block('a',[1,15]),block('b',[16,25])],startingOrders:actual};
const rows=scheduleRows([event],[skater]);assert.equal(rows.length,1);assert.equal(rows[0].startingOrder.startNumber,17);assert.equal(rows[0].uncertain,false);assert.equal(rows[0].coach,skater.coach);
const pending=scheduleRows([{...event,startingOrders:[]}],[skater]);
assert.equal(pending.length,1);assert.equal(pending[0].uncertain,true);assert.equal(pending[0].start,'');assert.equal(pending[0].end,'');assert.equal(pending[0].candidates.length,2);assert.ok(!pending[0].category.includes('('));
console.log(JSON.stringify({officialPdfRows:parsed.length,explicitWarmupVerified:true,continuousPdfBlockVerified:true,rangeResolvedByOfficialOrder:true,defaultCoachPreserved:true}));
const keswickBase='https://skateontario.org/results/27KES/';
for(const [file,count,name,number] of [
  ['keswick-2026-preju-u11-group2-start.pdf',10,'Sydney Mitchell',2],
  ['keswick-2026-star7-o12-group1-start.pdf',15,'Mina-Fée Trahan',1],
]){
  const pages=await readOfficialPdfItems(new Uint8Array(fs.readFileSync('tests/fixtures/'+file)));
  const orders=parseStartingOrderPdf(pages,keswickBase+file,[]);
  assert.equal(orders.length,count);assert.equal(orders.find(order=>order.name===name).startNumber,number);
  assert.deepEqual(orders.map(order=>order.warmupGroup),Array.from({length:count},(_,index)=>Math.floor(index/5)+1));
  assert.ok(orders.every(order=>order.individualTime===null));
}
const sydneyPages=await readOfficialPdfItems(new Uint8Array(fs.readFileSync('tests/fixtures/keswick-2026-preju-u11-group2-start.pdf')));
const sydneyRoster=[{id:'sydney',name:'Sydney Mitchell',coach:'Fixture Coach'}];
const sydneyDraw=parseStartingOrderPdf(sydneyPages,keswickBase+'sydney.pdf',sydneyRoster);
const sydneyBlock={id:'sydney-block',category:'Pre-Juvenile U11 Women - Group 2',categoryKey:'PREJUVENILE:WOMEN',group:2,range:null,activity:'competition',date:'2026-11-21',start:'16:50',end:'17:50',rink:'GREEN RINK',page:1,sourceUrl:keswickBase+'schedule.pdf'};
const sydneyEvent={id:'keswick',name:'Keswick',url:keswickBase,timezone:'America/Toronto',blocks:[sydneyBlock],startingOrders:sydneyDraw,participants:sydneyDraw.map(o=>({name:o.name,category:o.category,skaterIds:o.skaterIds,matchStatus:'fixture'}))};
const [sydneyRow]=scheduleRows([sydneyEvent],sydneyRoster);
assert.equal(sydneyRow.startingOrder.warmupGroup,1); // Category Group 2 is a separate concept.
assert.deepEqual(coachTimingEstimate(sydneyRow,sydneyEvent),{warmup:'16:50',start:'17:00'});
const remapRows=(spacings)=>{const ys=sydneyPages[0].filter(i=>i.x<50&&/^\d+$/.test(i.str.trim())).map(i=>i.y);const next=[ys[0]];for(const gap of spacings)next.push(next.at(-1)-gap);return [sydneyPages[0].map(item=>{const index=ys.findIndex(y=>Math.abs(y-item.y)<1);return index<0?item:{...item,y:next[index]+item.y-ys[index]};})];};
const uneven=remapRows(Array.from({length:9},(_,index)=>index===3?19.55:14.25));
assert.deepEqual(parseStartingOrderPdf(uneven,url,[]).map(o=>o.warmupGroup),[1,1,1,1,2,2,2,2,2,2]);
const irregular=remapRows(Array.from({length:9},(_,index)=>index===4?35:14.25));
assert.ok(parseStartingOrderPdf(irregular,url,[]).every(o=>o.warmupGroup===null));
const withoutFooter=[sydneyPages[0].filter(i=>i.str.trim()!=='Date:')];
assert.ok(parseStartingOrderPdf(withoutFooter,url,[]).every(o=>o.warmupGroup===null));
assert.ok(parseStartingOrderPdf([sydneyPages[0],sydneyPages[0]],url,[]).every(o=>o.warmupGroup===null));
const wrapped=[sydneyPages[0].concat({str:'wrapped continuation',x:54,y:420,height:9})];
assert.ok(parseStartingOrderPdf(wrapped,url,[]).every(o=>o.warmupGroup===null));
const duplicate=[sydneyPages[0].map(i=>i.x<50&&i.str==='6'?{...i,str:'7'}:i)];
assert.ok(parseStartingOrderPdf(duplicate,url,[]).every(o=>o.warmupGroup===null));
const labelled=[sydneyPages[0].concat({str:'Warm-up Group 8',x:54,y:438,height:9})];
assert.ok(parseStartingOrderPdf(labelled,url,[]).every(o=>o.warmupGroup===8));
const scaled=[sydneyPages[0].map(i=>({...i,x:i.x*.8,y:i.y*.8,height:i.height*.8}))];
assert.deepEqual(parseStartingOrderPdf(scaled,url,[]).map(o=>o.warmupGroup),sydneyDraw.map(o=>o.warmupGroup));
const withdrawnPages=await readOfficialPdfItems(new Uint8Array(fs.readFileSync('tests/fixtures/keswick-2026-star5-u10-group2-start.pdf')));
const withdrawalRoster=[{id:'annie',name:'Annie Dong'},{id:'shirley',name:'Shirley Dong'}];
const withdrawnDraw=parseStartingOrderPdf(withdrawnPages,keswickBase+'27KesSTAR5WomenU10Group2FP2SO.pdf',withdrawalRoster);
assert.equal(withdrawnDraw.length,15);
assert.deepEqual(withdrawnDraw.map(o=>o.warmupGroup),[1,1,1,1,2,2,2,2,2,3,3,3,3,3,3]);
assert.ok(withdrawnDraw.every(o=>o.drawComplete&&o.withdrawnCount===1&&o.individualTime===null));
const withdrawalEvent={...sydneyEvent,documents:[],blocks:[{...sydneyBlock,category:'STAR 5 Women U10 - Group 2',categoryKey:'STAR5:WOMEN',start:'13:15',end:'14:40'}],startingOrders:withdrawnDraw,
  participants:[...withdrawnDraw.map(o=>({name:o.name,category:o.category,skaterIds:o.skaterIds})),{name:'Adeline Shi',category:withdrawnDraw[0].category,skaterIds:[]}]};
const sharedWithdrawalEvent=clubEventResponse(withdrawalEvent,false);
assert.ok(sharedWithdrawalEvent.startingOrders.every(o=>o.drawComplete&&o.withdrawnCount===1));
const withdrawalRows=scheduleRows([sharedWithdrawalEvent],withdrawalRoster);
const annie=withdrawalRows.find(r=>r.skaterName==='Annie Dong'),shirley=withdrawalRows.find(r=>r.skaterName==='Shirley Dong');
assert.deepEqual(coachTimingEstimate(annie,sharedWithdrawalEvent),{warmup:'13:39',start:'13:48'});
assert.deepEqual(coachTimingEstimate(shirley,sharedWithdrawalEvent),{warmup:'14:07',start:'14:12'});
assert.equal(coachTimingEstimate(annie,{...sharedWithdrawalEvent,startingOrders:withdrawnDraw.map(o=>({...o,drawComplete:undefined}))}),null);
assert.equal(coachTimingEstimate(annie,{...sharedWithdrawalEvent,startingOrders:withdrawnDraw.filter(o=>o.startNumber!==8)}),null);
assert.equal(coachTimingEstimate(annie,{...sharedWithdrawalEvent,participants:withdrawalEvent.participants.filter(p=>p.name!=='Annie Dong')}),null);
console.log('Verified full PDF draws retain explicit WD counts: #5 withdrawal preserves visual heats 1/2/3; Annie #7 estimates 13:39 / 13:48 and Shirley #11 14:07 / 14:12, while unknown missing rows still prevent estimation.');
const documents=Array.from({length:9},(_,index)=>({kind:'start-order',url:keswickBase+'27KesSTAR5WomenU13Group'+index+'FP2SO.pdf',label:'Starting Order'}));
const participants=[{skaterIds:['sydney'],sourceUrl:keswickBase.replace('https://','https://www.')+'27KesSTAR5WomenU13Group8EL.pdf'}];
const firstBatch=selectStartingOrderDocuments(documents,participants);
assert.equal(firstBatch.length,4);assert.equal(firstBatch[0].url,documents[8].url);
for(const document of firstBatch){document.attemptedAt='2026-11-09T20:00:00Z';document.error='fixture failed read';}
const secondBatch=selectStartingOrderDocuments(documents,participants);
assert.equal(secondBatch.length,4);assert.ok(secondBatch.every(document=>!document.attemptedAt));
const upgraded=documents.map(document=>({...document,error:undefined,attemptedAt:'2026-11-01',checkedAt:'2026-11-01',parserVersion:STARTING_DRAW_VERSION}));
upgraded[8].parserVersion='starting-draw-2';
assert.equal(selectStartingOrderDocuments(upgraded,participants)[0].url,upgraded[8].url);
console.log('PDF visual heat boundaries, continuous blocks, unequal group sizes, explicit labels, scaled layouts and Sydney estimated 16:50 warm-up / 17:00 skate verified; irregular, wrapped, incomplete and multipage layouts stay pending; stale cached draws reparse before current documents.');
