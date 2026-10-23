import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterCoachSchedule} from '../lib/coach-schedule.ts';

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
assert.ok(app.includes('renderSchedule(filteredSchedule)'));assert.ok(app.includes('filteredSchedule.map(row=>'));
assert.ok(app.includes('!coachEventFilter||plan.eventId===coachEventFilter'));
console.log(JSON.stringify({passed:8,allEvents:true,eventCoachDateIntersection:true,multiCoach:true,emptySelection:true,inputUnchanged:true,tableAndExportShareFilter:true,orphanPlansEventScoped:true}));
