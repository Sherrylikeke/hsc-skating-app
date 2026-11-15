import assert from 'node:assert/strict';
import {familyCalendar,familyOverlaps,rinkGroups} from '../lib/family-calendar.ts';
import {watchChoices} from '../lib/event-watch.ts';
import {calendarExport} from '../lib/calendar-export.ts';

const day='2026-11-14',source='https://example.test/cup';
const skaters=[{id:'a',name:'Ana Reed',coach:''},{id:'b',name:'Ben Reed',coach:''}];
const participants=[['a','Ana Reed','Senior Women'],['b','Ben Reed','Junior Men'],['','Nora Lin','Senior Men'],['a','Ana Reed','Novice Women']].map(([id,name,category],i)=>({
  id:'p'+i,name,category,club:'Test Club',section:'ON',skaterIds:id?[id]:[],sourceUrl:source
}));
const blocks=[['Senior Women','13:00','13:35','Red'],['Junior Men','13:20','13:50','Blue'],['Senior Men','14:00','14:30','Blue']].map(([category,start,end,rink],i)=>({
  id:'s'+i,date:day,start,end,rink,category:category+' SHORT',group:null,range:null,activity:'competition',page:1,sourceUrl:source
}));
const event={id:'cup',name:'Cup',start:day,end:day,timezone:'America/Toronto',url:source,participants,blocks,startingOrders:[]};
const friend=watchChoices(event,skaters).find(s=>s.name==='Nora Lin').id;
const other={...event,id:'other',start:'2026-11-20',end:'2026-11-22',blocks:[]};
const {days,undated}=familyCalendar([event,other],skaters,['a','b'],id=>id==='cup'?[friend]:[]);
const saturday=days.get(day);
assert.equal(saturday.sessions.length,3);
assert.deepEqual(saturday.registrations.map(r=>r.category),['Novice Women']);
assert.equal(undated.length,3);assert.ok(undated.every(r=>r.event.id==='other' && r.name!=='Nora Lin'));
assert.equal(days.has(other.start),false);
const overlaps=familyOverlaps(saturday.sessions,['a','b']);
assert.equal(overlaps.length,1);assert.equal((overlaps[0].end-overlaps[0].start)/60000,15);
const chicago={...event,id:'away',timezone:'America/Chicago',participants:[participants[1]],blocks:[{...blocks[1],start:'12:20',end:'12:50'}]};
const cross=familyCalendar([{...event,participants:[participants[0]]},chicago],skaters,['a','b'],()=>[]).days.get(day);
assert.equal(familyOverlaps(cross.sessions,['a','b'])[0].start,overlaps[0].start);
for(const variant of [{start:'13:35',end:'14:00'},{start:'13:20',end:'13:50',range:[11,20]}]){
  const revised={...event,blocks:[blocks[0],{...blocks[1],...variant}]};
  const {sessions}=familyCalendar([revised],skaters,['a','b'],()=>[]).days.get(day);
  assert.equal(familyOverlaps(sessions,['a','b']).length,0);
}
assert.equal(familyCalendar([event],skaters,[],()=>[]).days.size,0);
assert.equal(familyOverlaps(saturday.sessions,['a']).length,0);
const away={...event,id:'away',venue:'Elsewhere'};
const surfaces=rinkGroups([...saturday.sessions,{...saturday.sessions[1],row:{...saturday.sessions[1].row,rink:'Blue',eventId:'away'}}],[event,away]);
assert.equal([...surfaces.values()].filter(group=>group.ice==='Blue').length,2);
console.log('Calendar selection, guest scope, pending dates, distinct home skaters, endpoint and time-zone overlaps passed.');

const rows=saturday.sessions.map(s=>s.row);
const exported=calendarExport([...rows,rows[0],{...rows[0],id:'pending',uncertain:true}],0);
assert.equal(exported.count,3,'deduplicate and exclude unconfirmed times');
const unfolded=exported.content.replace(/\r\n /g,'');
assert.match(unfolded,/DTSTART:20261114T180000Z/);
assert.match(unfolded,/DTEND:20261114T183500Z/);
assert.equal((unfolded.match(/BEGIN:VEVENT/g)||[]).length,3);
assert.ok(!unfolded.includes('VALARM'),'no unrequested reminders or estimated personal times');
const summer={...rows[0],date:'2026-07-14'};
assert.match(calendarExport([summer]).content,/DTSTART:20260714T170000Z/);
assert.equal(calendarExport([{...rows[0],date:'2026-11-01',start:'01:15',end:'01:45'}]).count,0,'ambiguous DST interval omitted');
assert.equal(calendarExport([{...rows[0],date:'2026-03-08',start:'02:15',end:'02:45'}]).count,0,'DST gap omitted');
const special={...rows[0],skaterName:'林,小;冰\\\nBEGIN:VEVENT'+ '🧊'.repeat(60),note:'PRIVATE-NOTE',coach:'PRIVATE-COACH'};
const specialFile=calendarExport([special],0).content;
assert.equal((specialFile.match(/\r\nBEGIN:VEVENT/g)||[]).length,1,'untrusted text cannot inject properties');
assert.ok(!specialFile.includes('PRIVATE-'),'export only shared schedule fields');
for(const line of specialFile.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75,'fold at UTF-8 octet boundary');
assert.ok(!specialFile.includes('\uFFFD'),'no broken Unicode');
const uid=file=>file.replace(/\r\n /g,'').match(/UID:([^\r]+)/)[1];
assert.equal(uid(specialFile),uid(calendarExport([{...special,end:'14:00'}],1000).content),'stable identity after official revision');
assert.deepEqual(calendarExport([]).count,0);
console.log('ICS export: UTC/DST, uncertainty, deduplication, stable UID, UTF-8 folding, escaping and private-data exclusion passed.');
