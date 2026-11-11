import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterCoachSchedule} from '../lib/coach-schedule.ts';
import {assignedToCoach,coachScheduleRows} from '../lib/coach-identity.ts';
import {canonicalCoachName,canonicalCoachList} from '../lib/coach-names.ts';
import {coachSuggestions} from '../lib/coach-name-search.ts';

const rows=[
  {id:'first',eventId:'event-a',coach:'Jen Jackson/Bryce Davidson',date:'2026-11-05'},
  {id:'second',eventId:'event-a',coach:'Jen Jackson',date:'2026-11-06'},
  {id:'third',eventId:'event-b',coach:'Bryce Davidson',date:'2026-11-05'},
  {id:'fourth',eventId:'event-b',coach:'',date:'2026-11-06'},
];
const before=structuredClone(rows),all={event:'',coach:'',date:'',assignedOnly:false};
assert.deepEqual(filterCoachSchedule(rows,all),rows);
assert.deepEqual(filterCoachSchedule(rows,{...all,event:'event-a'}).map(row=>row.id),['first','second']);
assert.deepEqual(filterCoachSchedule(rows,{...all,event:'event-b',assignedOnly:true}).map(row=>row.id),['third']);
assert.deepEqual(filterCoachSchedule(rows,{...all,event:'event-a',coach:'Bryce Davidson',date:'2026-11-05',assignedOnly:true}).map(row=>row.id),['first']);
assert.equal(filterCoachSchedule(rows,{...all,event:'event-a',coach:'Bryce Davidson',date:'2026-11-06'}).length,0);
assert.equal(filterCoachSchedule(rows,{...all,event:'missing'}).length,0);
assert.equal(filterCoachSchedule([],all).length,0);assert.deepEqual(rows,before);
const app=fs.readFileSync('app/club-app.tsx','utf8');
assert.ok(app.includes('教练总表比赛筛选'));assert.ok(app.includes('event:coachEventFilter'));
assert.ok(app.includes('<CoachDailySchedule rows={filteredSchedule}'));assert.ok(app.includes('filteredSchedule.map(row=>'));
assert.ok(app.includes('!coachEventFilter||plan.eventId===coachEventFilter'));
assert.ok(assignedToCoach('Jen Jackson/Bryce Davidson','Jen Jackson'));assert.ok(assignedToCoach('Jen Jackson/Bryce Davidson','Bryce Davidson'));assert.ok(assignedToCoach('Jennifer Jackson/Bryce Davidson','Jen Jackson'));
assert.deepEqual(coachScheduleRows(rows,'Bryce Davidson',true,[]).map(row=>row.id),['first','third']);
assert.deepEqual(coachScheduleRows(rows,'Bryce Davidson',true,['Jen Jackson']).map(row=>row.id),['first','third','second']);
assert.deepEqual(coachScheduleRows(rows,'Jen Jackson',false,[]).slice(0,2).map(row=>row.id),['first','second']);
assert.deepEqual(coachSuggestions('bryce',['Jen Jackson/Bryce Davidson']),['Bryce Davison']);assert.deepEqual(coachSuggestions('jen',['Jen Jackson/Bryce Davidson']),['Jennifer Jackson']);
assert.ok(assignedToCoach('Jen Jackson/Bryce Davidson','Bryce Davison'));assert.ok(assignedToCoach('Jennifer Jackson/Bryce Davison','Bryce Davidson'));
assert.equal(canonicalCoachList('  jen   jackson / Bryce davidson ; Other Coach & Jennifer Jackson  '),'  Jennifer Jackson / Bryce Davison ; Other Coach & Jennifer Jackson  ');
assert.equal(canonicalCoachName('Jen Jackson Smith'),'Jen Jackson Smith');assert.equal(canonicalCoachName('constructor'),'constructor');
assert.deepEqual(coachSuggestions('bryce',['Bryce Davidson','Bryce Davison']),['Bryce Davison']);
assert.deepEqual(filterCoachSchedule(rows,{...all,coach:'Bryce Davison'}).map(row=>row.id),['first','third']);
console.log(JSON.stringify({passed:14,allEvents:true,eventCoachDateIntersection:true,multiCoach:true,emptySelection:true,inputUnchanged:true,tableAndExportShareFilter:true,orphanPlansEventScoped:true,ownCoachFirst:true,hideOthersAndExtraCoaches:true,firstNameDropdownSearch:true}));
