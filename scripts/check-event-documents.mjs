import assert from 'node:assert/strict';
import {selectLinkEvents,refreshEventLinks} from '../lib/event-document-sync.ts';
import {clubEventResponse} from '../lib/club-response.ts';
const checks=[];
const event={id:'SO-325865',name:'STAR 1-4 Niagara',url:'https://skateontario.org/event/star-1-4-niagara-2/',start:'2026-12-04',end:'2026-12-06',timezone:'America/Toronto',venue:'Fixture',city:'Fixture',updateText:'',officialModified:'2026-11-12',checkedAt:'2026-11-16T15:00:00Z',detailCheckedAt:'2026-11-11T14:24:06Z',detailError:'PDF date layout needs review',scheduleStatus:'Needs review',entryStatus:'Interim only',documents:[{kind:'entries',url:'https://skateontario.org/interim.pdf',label:'Interim List',hash:'entry-hash',checkedAt:'2026-11-11T14:00:00Z'}],participants:[{id:'fixture',name:'Fixture Skater',category:'STAR 2',skaterIds:['fixture']}],blocks:[]};
// Link text and URL from the official Niagara page checked on 2026-11-16.
const schedule='https://skateontario.org/wp-content/uploads/2026/08/Schedule.pdf';
const page='<a href="/interim.pdf">Interim Entry Lists as of Nov. 4</a><a href="'+schedule+'">Schedule as of Nov. 11</a><a href="'+schedule+'">Schedule</a>';
const before=structuredClone(event),now='2026-11-16T16:00:00Z';
const refreshed=await refreshEventLinks(event,now,async()=>page);
assert.deepEqual(event,before);
assert.equal(refreshed.documents.find(d=>d.kind==='schedule').url,schedule);
assert.equal(refreshed.documents.find(d=>d.kind==='schedule').label,'Schedule as of Nov. 11');
assert.equal(refreshed.documents.find(d=>d.kind==='schedule').checkedAt,undefined);
assert.equal(refreshed.documents.find(d=>d.kind==='entries').hash,'entry-hash');
assert.equal(refreshed.linksCheckedAt,now);assert.equal(refreshed.linksAttemptedAt,now);
assert.equal(refreshed.detailCheckedAt,event.detailCheckedAt);assert.equal(refreshed.detailSuccessAt,undefined);
assert.equal(refreshed.detailError,event.detailError);assert.deepEqual(refreshed.participants,event.participants);assert.deepEqual(refreshed.blocks,[]);
checks.push('Niagara schedule link is saved without a final entry list or supported PDF, keeping its dated label and prior import metadata');
const failed=await refreshEventLinks(refreshed,'2026-11-16T17:00:00Z',async()=>{throw Error('Official page unavailable');});
assert.equal(failed.linksCheckedAt,now);assert.equal(failed.linksAttemptedAt,'2026-11-16T17:00:00Z');
assert.match(failed.linksError,/unavailable/);assert.deepEqual(failed.documents,refreshed.documents);assert.deepEqual(failed.participants,event.participants);
assert.equal((await refreshEventLinks(failed,'2026-11-16T18:00:00Z',async()=>page)).linksError,undefined);
checks.push('page failure retains saved links and data, records only an attempt, and recovery clears only the page error');
const events=Array.from({length:37},(_,index)=>({...event,id:'SO-'+index,start:'2027-01-01',end:'2027-01-02',detailCheckedAt:undefined}));
for(let round=0;round<13;round++){
  const selected=selectLinkEvents(events,'2026-11-16');assert.equal(selected.length,3);
  for(const candidate of selected)candidate.linksAttemptedAt='2026-11-16T'+String(round).padStart(2,'0')+':00:00Z';
}
assert.ok(events.every(e=>e.linksAttemptedAt));
const expired={...event,id:'expired',end:'2026-11-15'},distant={...event,id:'distant',start:'2027-12-01',end:'2027-12-02'};
assert.deepEqual(selectLinkEvents([expired,distant,event],'2026-11-16').map(e=>e.id),[event.id]);
checks.push('37 active events rotate within 13 successful rounds; failed attempts move on and ended/out-of-window events do not consume slots');
const ordinary=clubEventResponse({...refreshed,linksError:'internal-source-error'},false),admin=clubEventResponse(refreshed,true);
assert.ok(ordinary.documents.some(d=>d.url===schedule));assert.equal(ordinary.needsReview,true);
for(const field of ['linksCheckedAt','linksAttemptedAt','linksError','detailCheckedAt','detailSuccessAt','detailError'])assert.equal(ordinary[field],undefined,field);
assert.equal(admin.linksCheckedAt,now);
checks.push('ordinary members receive the schedule link without raw diagnostics; administrators retain independent link and import timestamps');
console.log(JSON.stringify({passed:checks.length,checks,fixtureOnly:true,productionWrites:0},null,2));
