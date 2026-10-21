import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseEntries,parseScheduleItems,scheduleRows,categoryKey} from '../lib/official-parser.ts';
const roster=JSON.parse(fs.readFileSync('data/roster.json','utf8').replace(/^\uFEFF/,''));
const participants=parseEntries(fs.readFileSync('tests/fixtures/sectionals-2026-11-entries.html','utf8'),'https://dstools.ca/cssEntryList/27SSNO/',roster);
const blocks=parseScheduleItems(JSON.parse(fs.readFileSync('tests/fixtures/sectionals-2026-11-items.json','utf8')),'https://skateontario.org/wp-content/uploads/2026/07/2027-Skate-Ontario-Junior-Senior-Sectional-Championships_Schedule_Oct-6.pdf');
assert.ok(participants.length>100);assert.equal(participants.filter(row=>row.skaterIds.length).length,8);
assert.ok(blocks.length>45);
const men=blocks.find(b=>b.date==='2026-11-05'&&b.category==='NOVICE MEN SHORT');assert.equal(men.start,'17:45');assert.equal(men.end,'18:55');assert.equal(men.rink,'MOLSON RINK');
assert.equal(categoryKey('Podium Pathway - Singles - Pre-Novice Women Group 2'),'PRENOVICE:WOMEN');
const event={id:'SO-325444',name:'Sectionals',url:'https://skateontario.org',timezone:'America/Toronto',participants,blocks};
const rows=scheduleRows([event],roster);
const eva=rows.filter(r=>r.skaterName==='Eva Wang');assert.equal(eva.length,2);assert.ok(eva.every(r=>r.category.includes('GROUP 2')&&!r.uncertain));
const carson=rows.filter(row=>row.skaterName==='Carson Wang');
assert.equal(carson.length,2);assert.ok(carson.every(row=>row.uncertain&&row.start===''&&row.end===''&&row.candidates.length===2));
assert.ok(carson.some(row=>row.category==='PRE-NOVICE MEN SHORT'));assert.ok(carson.some(row=>row.category==='PRE-NOVICE MEN FREE'));
const confirmed=scheduleRows([{...event,startingOrders:[{id:'test-official-short',name:'Carson Wang',category:'PRE-NOVICE MEN SHORT',program:'short',startNumber:17,warmupGroup:null,individualTime:null,sourceUrl:'https://skateontario.org/test-order.pdf',page:1,skaterIds:[carson[0].skaterId]}]}],roster).filter(row=>row.skaterName==='Carson Wang');
assert.equal(confirmed.length,2);assert.equal(confirmed.filter(row=>row.uncertain).length,1);assert.equal(confirmed.find(row=>!row.uncertain).start,'11:15');
assert.ok(!rows.some(r=>r.skaterName==='Nathaniel'));

console.log(JSON.stringify({participants:participants.length,matched:8,blocks:blocks.length,clubScheduleRows:rows.length,carson:carson.map(row=>({category:row.category,date:row.date,start:row.start,end:row.end,uncertain:row.uncertain,candidates:row.candidates})),partialOrderResolvesOnlyItsProgram:true,noviceMen:men,eva:eva.map(r=>({date:r.date,start:r.start,rink:r.rink})),preservesUnknownIndividualTimes:true},null,2));

