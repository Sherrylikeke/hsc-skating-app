import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {reconcileOfficialRoster} from '../lib/official-roster.ts';

const sql=new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE hsc_admissions (skater_id TEXT PRIMARY KEY,admitted INTEGER,payload TEXT,updated_by TEXT,updated_at TEXT);
  CREATE TABLE coach_assignments (skater_id TEXT PRIMARY KEY,coach TEXT);`);
const database={
  prepare(query){const statement=sql.prepare(query);return {bind(...args){return {
    changes:()=>statement.run(...args).changes,all:async()=>({results:statement.all(...args)}),
  };}};},
  async batch(statements){return statements.map(statement=>({meta:{changes:statement.changes()}}));},
};
const date='2026-11-23T19:00:00Z';
const official='https://skateontario.org/results/sample/current.pdf';
const old='https://skateontario.org/results/sample/removed.pdf';
const index={label:'Official list',url:'https://skateontario.org/results/sample/',entryFiles:[
  {url:official,checkedAt:date,hash:'verified'},
  {url:old,checkedAt:date,hash:'verified before removal',error:'removed'},
]};
const row=(name,club,sourceUrl=official)=>({name,club,sourceUrl,skaterIds:[],matchStatus:'pending'});
const roster=[{id:'manual',name:'Existing Athlete'},{id:'pending',name:'Pending Athlete',identityPending:true}];
const entries=[
  row('Existing Athlete','Burlington Skating Centre'),
  row('First Fixture','Hamilton SC'),
  row('FIRST FIXTURE','Hamilton S.C.'),
  row('Second Fixture','Hamilton Skating Club'),
  row('Other Fixture','Burlington Skating Centre'),
  row('Third Fixture','Hamilton Skating Club',old),
  row('Pending Athlete','Hamilton SC'),
  row('Ambiguous Fixture','Hamilton SC'),
  row('Ambiguous Fixture','Different Club'),
  row('Partner A / Partner B','Hamilton SC'),
];
sql.prepare('INSERT INTO coach_assignments VALUES (?,?)').run('manual','Fixture Coach');
const result=await reconcileOfficialRoster(database,roster,entries,index,date);
assert.equal(result.added,2);
assert.deepEqual(result.participants[0].skaterIds,['manual']);
assert.equal(result.participants[1].skaterIds[0],result.participants[2].skaterIds[0]);
assert.ok(result.participants[3].skaterIds[0].startsWith('HSC-OFFICIAL-'));
assert.ok(result.participants.slice(4).every(entry=>!entry.skaterIds.length));
assert.deepEqual(sql.prepare('SELECT admitted FROM hsc_admissions').all().map(row=>row.admitted),[0,0]);
assert.equal(sql.prepare('SELECT coach FROM coach_assignments WHERE skater_id=?').get('manual').coach,'Fixture Coach');
const retry=await reconcileOfficialRoster(database,roster,entries,index,date);
assert.equal(retry.added,0);
assert.deepEqual(retry.participants.map(entry=>entry.skaterIds),result.participants.map(entry=>entry.skaterIds));
sql.close();
console.log('Both official Hamilton labels create one roster profile per name, valid saved PDFs rematch renamed profiles, and permissions and coaches are preserved.');
