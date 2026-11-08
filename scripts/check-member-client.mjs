import assert from 'node:assert/strict';
import {MemberAPIError,activeMemberRole,readMemberResponse,recoverMemberSession} from '../lib/member-client.ts';
import {homeSkaterChoices} from '../lib/home-skater-choices.ts';
import {groupHomeSchedule} from '../lib/home-schedule.ts';
import {arrivalReference} from '../lib/schedule-time.ts';

const checks=[];
assert.equal(activeMemberRole({role:'admin',status:'active'},'admin'),true);
for(const member of [null,{role:'parent',status:'active'},{role:'admin',status:'disabled'},{role:'admin',status:'pending'},{role:'admin',status:'club-viewer'}])assert.equal(activeMemberRole(member,'admin'),false);
assert.equal(activeMemberRole({role:'coach',status:'active'},'coach'),true);
assert.equal(activeMemberRole({role:'coach',status:'pending-verification'},'coach'),false);
checks.push('privileged UI requires both the current role and active status, not a previous cached role');
assert.deepEqual(await readMemberResponse(Response.json({ok:true}),'Unavailable'),{ok:true});
await assert.rejects(readMemberResponse(Response.json({error:'Session expired'},{status:401}),'Unavailable'),failure=>failure instanceof MemberAPIError&&failure.status===401&&failure.message==='Session expired');
checks.push('JSON API results retain real HTTP status and server messages');

for(const response of [new Response('<html>Gateway</html>',{status:401}),new Response('{bad',{headers:{'Content-Type':'application/json'}}),Response.json(null),Response.json([])]){
  await assert.rejects(readMemberResponse(response,'Unavailable'),failure=>failure instanceof MemberAPIError&&failure.status===502);
}
checks.push('HTML gateways, invalid JSON and invalid response shapes are not treated as login expiry');

let restores=0;
assert.equal(await recoverMemberSession(async()=>42,async()=>{restores++;},true),42);assert.equal(restores,0);
checks.push('a valid session does not create a replacement session');

let loads=0;
assert.equal(await recoverMemberSession(async()=>{loads++;if(loads===1)throw new MemberAPIError(401,'Expired');return 'restored';},async()=>{restores++;},true),'restored');
assert.equal(loads,2);assert.equal(restores,1);
checks.push('an allowed real JSON 401 restores once and reloads once');

for(const failure of [new MemberAPIError(403,'Disabled'),new MemberAPIError(503,'Schedule unavailable'),new MemberAPIError(502,'Gateway unavailable'),new Error('Network unavailable')]){
  const previous=restores;
  await assert.rejects(recoverMemberSession(async()=>{throw failure;},async()=>{restores++;},true),error=>error===failure);
  assert.equal(restores,previous);
}
checks.push('permission denial, data-service failures and network failures propagate without session restoration');

const expired=new MemberAPIError(401,'Expired');
await assert.rejects(recoverMemberSession(async()=>{throw expired;},async()=>{throw new Error('Must not restore');},false),error=>error===expired);
checks.push('an identity without restore permission cannot start a replacement session');

loads=0;restores=0;
await assert.rejects(recoverMemberSession(async()=>{loads++;throw expired;},async()=>{restores++;},true),error=>error===expired);
assert.equal(loads,2);assert.equal(restores,1);
checks.push('a second 401 propagates instead of creating a retry loop');

const restoreFailure=new MemberAPIError(403,'Account disabled');
loads=0;
await assert.rejects(recoverMemberSession(async()=>{loads++;throw expired;},async()=>{throw restoreFailure;},true),error=>error===restoreFailure);
assert.equal(loads,1);
checks.push('failed recovery preserves the error and does not reload private records');

const skaters=[{id:'HSC-A',name:'Carson Wang'},{id:'HSC-B',name:'Alex Wang'},{id:'HSC-C',name:'Alex Wang'},{id:'HSC-D',name:'Nathaniel'}];
const before=structuredClone(skaters);
assert.deepEqual(homeSkaterChoices(skaters,[],'  ＡＬＥＸ   wang  ').map(skater=>skater.id),['HSC-B','HSC-C']);
assert.deepEqual(homeSkaterChoices(skaters,['HSC-B'],'alex').map(skater=>skater.id),['HSC-C']);
checks.push('search normalizes width, case and whitespace but keeps same-name people distinct and excludes selected IDs');

assert.deepEqual(homeSkaterChoices(skaters,[],'hsc-d').map(skater=>skater.id),['HSC-D']);
assert.deepEqual(homeSkaterChoices(skaters,[],'carson hsc-a').map(skater=>skater.id),['HSC-A']);
assert.deepEqual(homeSkaterChoices(skaters,[],'unknown'),[]);
assert.deepEqual(homeSkaterChoices(skaters,[],'   '),skaters);
assert.deepEqual(homeSkaterChoices(skaters,skaters.map(skater=>skater.id),''),[]);
assert.deepEqual(skaters,before);
checks.push('name/ID search handles no results, empty queries and all-selected lists without mutating roster data');

const session = {date:'2026-11-08',start:'11:15',end:'12:00',timezone:'America/Toronto',uncertain:false};
const pending = {...session,uncertain:true,start:'',end:''};
const past = {...session,date:'2026-11-07'};
const next = {...session,start:'13:00',end:'13:30'};
const familyRows = [past,pending,session,next];
assert.deepEqual(groupHomeSchedule(familyRows, Date.parse('2026-11-08T16:30Z')), {upcoming:[session,next],pending:[pending],past:[past]});
assert.deepEqual(groupHomeSchedule(familyRows, Date.parse('2026-11-08T17:00Z')), {upcoming:[next],pending:[pending],past:[past,session]});
assert.deepEqual(groupHomeSchedule([pending], Date.parse('2026-11-09T00:01Z')).pending,[pending]);
assert.deepEqual(groupHomeSchedule([pending], Date.parse('2026-11-09T05:01Z')).past,[pending]);
const unknownZone = {...session,timezone:'Unspecified'};
assert.deepEqual(groupHomeSchedule([unknownZone],Date.parse('2026-11-08T17:00Z')).upcoming,[unknownZone]);
assert.equal(arrivalReference(unknownZone),null);
checks.push('current, pending and past sessions use the rink clock and keep in-progress groups visible');

assert.equal(arrivalReference(session),'10:15');
assert.equal(arrivalReference(session,'2026-11-08T10:00'),null);
assert.equal(arrivalReference(session,'2026-11-08T10:40'),'10:15');
assert.equal(arrivalReference({...session,start:'00:30'}),'2026-11-07 23:30');
assert.equal(arrivalReference({...session,uncertain:true}),null);
assert.equal(arrivalReference({...session,date:'2026-03-08',start:'02:30'}),null);
assert.equal(arrivalReference({...session,date:'2026-11-01',start:'01:30'}),null);
assert.equal(arrivalReference({...session,date:'2026-11-01',start:'02:30'}),'01:30 -05:00');
checks.push('60-minute arrival guidance distinguishes dates, uncertain slots and DST transitions');
console.log(JSON.stringify({passed:checks.length,checks,fixtureOnly:true,productionWrites:0,realEmailsSent:0},null,2));
