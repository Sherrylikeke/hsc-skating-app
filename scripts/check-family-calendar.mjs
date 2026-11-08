import assert from 'node:assert/strict';
import {familyCalendar,familyOverlaps,rinkGroups} from '../lib/family-calendar.ts';
import {watchChoices} from '../lib/event-watch.ts';

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
