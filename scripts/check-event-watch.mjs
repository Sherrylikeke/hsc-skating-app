import assert from 'node:assert/strict';
import {defaultEventFriends,friendStorageKey,readFriends,guestSchedule,watchChoices,watchTiming} from '../lib/event-watch.ts';

const date='2026-11-08', timezone='America/Toronto', source='https://example.test';
const participant=(id,club,category='Senior Women')=>({id,club,category,name:'Avery Lane',section:'ON',skaterIds:[],matchStatus:'guest',sourceUrl:source});
const block=(id,category,range)=>({id,category,range,date,start:'12:00',end:'12:30',rink:'Red',activity:'competition',group:null,page:1,sourceUrl:source});
const order={id:'o1',name:'Avery Lane',category:'Senior Women SHORT',program:'short',startNumber:18,warmupGroup:3,individualTime:null,sourceUrl:source,page:1,skaterIds:[]};
const east=participant('entry','East'), west=participant('entry','West');
const event={id:'cup',name:'Cup',url:source,timezone,participants:[east,west],startingOrders:[order],blocks:[
  block('first','Senior Women SHORT (1-10)',[1,10]),block('second','Senior Women SHORT (11-20)',[11,20])]};
const choices=watchChoices(event,[]);
assert.equal(choices.length,2);
const followEast=new Set([choices.find(c=>c.details[0].includes('East')).id]);
const ambiguous=guestSchedule(event,followEast);
assert.equal(ambiguous.length,1);assert.equal(ambiguous[0].uncertain,true);
assert.equal(ambiguous[0].startingOrder,undefined);assert.equal(ambiguous[0].candidates.length,2);
const solo={...event,participants:[east]};
const [confirmed]=guestSchedule(solo,followEast);
assert.equal(confirmed.uncertain,false);assert.equal(confirmed.startingOrder.startNumber,18);
assert.equal(confirmed.startingOrder.individualTime,null);assert.match(confirmed.category,/11-20/);
const nextCategory=participant('entry2','East','Junior Women');
assert.equal(watchChoices({...event,participants:[east,nextCategory]},[]).length,1);
assert.equal(watchChoices({...event,participants:[{...east,club:''},{...nextCategory,club:''}]},[]).length,2);
const time=(utc)=>Date.parse(date+'T'+utc+'Z');
assert.equal(watchTiming(confirmed,time('16:59')),'upcoming');
assert.equal(watchTiming(confirmed,time('17:00')),'ongoing');
assert.equal(watchTiming(confirmed,time('17:30')),'ended');
assert.equal(watchTiming(ambiguous[0],time('17:00')),'pending');
assert.equal(watchTiming({...confirmed,date:'2026-11-01',start:'01:10',end:'01:40'},time('17:00')),'pending');
assert.equal(watchTiming({...confirmed,timezone:''},time('17:00')),'pending');
assert.ok(event.startingOrders.every(o=>!o.skaterIds.length));
const roster=[{id:'home',name:'Home Skater'},{id:'friend',name:'Club Friend'},{id:'other',name:'Not Entered'}];
const clubEvent={...event,participants:[
  {...east,id:'home-entry',name:'Home Skater',skaterIds:['home']},
  {...east,id:'friend-entry',name:'Club Friend',skaterIds:['friend']},
  {...east,id:'friend-second',name:'Club Friend',category:'Junior Women',skaterIds:['friend']},
  {...west,id:'club-guest',name:'Club Guest',club:'Hamilton SC'},west,
]};
const defaults=defaultEventFriends(clubEvent,roster,['home']);
assert.equal(defaults.length,2);assert.ok(defaults.includes('friend'));assert.ok(!defaults.includes('home'));assert.ok(!defaults.includes('other'));
assert.ok(defaults.some(id=>id.startsWith('entry:')));
const storage=new Map();globalThis.sessionStorage={getItem:key=>storage.get(key)??null};
const key=friendStorageKey('member-a','cup');
assert.deepEqual(readFriends(key,defaults),defaults);
storage.set(key,'[]');assert.deepEqual(readFriends(key,defaults),[]); // Explicit unselect-all must survive revisits.
storage.set(key,JSON.stringify([choices[0].id]));assert.deepEqual(readFriends(key,defaults),[choices[0].id]);
assert.deepEqual(readFriends(friendStorageKey('member-b','cup'),defaults),defaults);
assert.deepEqual(readFriends(friendStorageKey('member-a','other'),defaults),defaults);
storage.set(key,'broken');assert.deepEqual(readFriends(key,defaults),defaults);
globalThis.sessionStorage={getItem:()=>{throw new Error('Storage unavailable');}};
assert.deepEqual(readFriends(key,defaults),defaults);delete globalThis.sessionStorage;
console.log('Event watch: same-name entries, published order, uncertain ranges, local times and DST verified.');
