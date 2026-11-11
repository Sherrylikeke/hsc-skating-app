import assert from 'node:assert/strict';
import {checkOfficialSources} from '../lib/official-sync-client.ts';

const checks=[];
function mock(responses){
  const calls=[];
  return {calls,async request(path,init){
    assert.equal(path,'/api/sync');assert.equal(init.method,'POST');
    calls.push(JSON.parse(init.body));
    const next=responses.shift();
    if(next instanceof Error)throw next;
    assert.ok(next,'Unexpected extra source request');
    return next;
  }};
}
const calendar=()=>Response.json({events:8,nextEvents:[{id:'SO-1',start:'2026-11-01'},{id:'SO-2',start:'2026-11-02'},{id:'SO-3',start:'2026-11-03'},{id:'SO-4',start:'2026-11-04'}]});
const success=mock([calendar(),Response.json({errors:[]}),Response.json({errors:[]}),Response.json({errors:[]})]);
const progress=[];
assert.deepEqual(await checkOfficialSources(success.request,'2026-10-23',undefined,(current,total)=>progress.push([current,total])),{events:8,checkedEvents:3,errors:[]});
assert.deepEqual(success.calls,[{},{eventId:'SO-1'},{eventId:'SO-2'},{eventId:'SO-3'}]);
assert.deepEqual(progress,[[1,3],[2,3],[3,3]]);checks.push('calendar first, sequential detail checks, maximum three events');

const partial=mock([calendar(),Response.json({error:'Source unavailable'},{status:503}),Response.json({errors:['Schedule format needs review']}),Response.json({errors:[]})]);
const partialResult=await checkOfficialSources(partial.request,'2026-10-23');
assert.deepEqual(partialResult.errors,['SO-1: Source unavailable','SO-2: Schedule format needs review']);
assert.equal(partial.calls.length,4);checks.push('HTTP failures and successful responses with parser warnings remain partial failures');

const network=mock([calendar(),new Error('Network unavailable'),new Response('<html>Unavailable</html>',{status:502}),Response.json({errors:[]})]);
const networkResult=await checkOfficialSources(network.request,'2026-10-23');
assert.equal(networkResult.errors.length,2);assert.match(networkResult.errors[0],/SO-1: Network unavailable/);assert.equal(network.calls.length,4);checks.push('network and non-JSON detail failures do not hide failures or skip later events');

const single=mock([Response.json({errors:['Entries need review']})]);
assert.deepEqual(await checkOfficialSources(single.request,'2026-10-23','SO-9'),{events:0,checkedEvents:1,errors:['Entries need review']});
assert.deepEqual(single.calls,[{eventId:'SO-9'}]);checks.push('single-event checks preserve parser warnings without requesting the calendar');

const failedCalendar=mock([Response.json({error:'Calendar unavailable'},{status:503})]);
await assert.rejects(checkOfficialSources(failedCalendar.request,'2026-10-23'),/Calendar unavailable/);
assert.equal(failedCalendar.calls.length,1);checks.push('failed calendar stops details and cannot report success');

const distant=mock([Response.json({events:2,nextEvents:[{id:'SO-6',start:'2027-04-25'}]})]);
assert.deepEqual(await checkOfficialSources(distant.request,'2026-10-23'),{events:2,checkedEvents:0,errors:[]});
assert.equal(distant.calls.length,1);checks.push('events beyond the 183-day calendar window are not checked');

const boundary=mock([Response.json({events:1,nextEvents:[{id:'SO-7',start:'2027-04-24'}]}),Response.json({errors:[]})]);
assert.equal((await checkOfficialSources(boundary.request,'2026-10-23')).checkedEvents,1);checks.push('183-day boundary includes distant competition announcements for registration reminders');
console.log(JSON.stringify({passed:checks.length,checks,fixtureOnly:true,productionWrites:0},null,2));
