import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseStartingOrderPdf,parseStartingOrderHtml,orderFor} from '../lib/starting-order.ts';
import {discoverDocuments,scheduleRows} from '../lib/official-parser.ts';
import {readOfficialPdfItems} from '../lib/official-pdf.ts';
import {selectStartingOrderDocuments} from '../lib/starting-order-selection.ts';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/provincials-2026-pre-novice-men-start-order-items.json','utf8'));
const roster=[{id:'cyrus',name:'Cyrus Huang'},{id:'nathaniel',name:'Nathaniel',identityPending:true}];
const url='https://skateontario.org/results/26PROVS/26PROVPre-NoviceMenFP2SO.pdf';
const parsed=parseStartingOrderPdf(fixture,url,roster);assert.equal(parsed.length,5);assert.equal(parsed[0].name,'Cyrus Huang');assert.equal(parsed[0].startNumber,1);assert.ok(parsed.every(r=>r.warmupGroup===null&&r.individualTime===null));assert.deepEqual(parsed[0].skaterIds,['cyrus']);
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
console.log(JSON.stringify({officialPdfRows:parsed.length,explicitWarmupVerified:true,missingWarmupNeverGuessed:true,rangeResolvedByOfficialOrder:true,defaultCoachPreserved:true}));
const keswickBase='https://skateontario.org/results/27KES/';
for(const [file,count,name,number] of [
  ['keswick-2026-preju-u11-group2-start.pdf',10,'Sydney Mitchell',2],
  ['keswick-2026-star7-o12-group1-start.pdf',15,'Mina-Fée Trahan',1],
]){
  const pages=await readOfficialPdfItems(new Uint8Array(fs.readFileSync('tests/fixtures/'+file)));
  const orders=parseStartingOrderPdf(pages,keswickBase+file,[]);
  assert.equal(orders.length,count);assert.equal(orders.find(order=>order.name===name).startNumber,number);
  assert.ok(orders.every(order=>order.warmupGroup===null&&order.individualTime===null));
}
const documents=Array.from({length:9},(_,index)=>({kind:'start-order',url:keswickBase+'27KesSTAR5WomenU13Group'+index+'FP2SO.pdf',label:'Starting Order'}));
const participants=[{skaterIds:['sydney'],sourceUrl:keswickBase.replace('https://','https://www.')+'27KesSTAR5WomenU13Group8EL.pdf'}];
const firstBatch=selectStartingOrderDocuments(documents,participants);
assert.equal(firstBatch.length,4);assert.equal(firstBatch[0].url,documents[8].url);
for(const document of firstBatch){document.attemptedAt='2026-11-09T20:00:00Z';document.error='fixture failed read';}
const secondBatch=selectStartingOrderDocuments(documents,participants);
assert.equal(secondBatch.length,4);assert.ok(secondBatch.every(document=>!document.attemptedAt));
console.log('Keswick PDF draws preserve official order without inventing warm-up groups; related categories are prioritized and failed files cannot starve unattempted documents.');
