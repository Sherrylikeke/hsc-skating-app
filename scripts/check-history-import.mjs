import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {importHistory,resultCatalog,resultRecords,selectHistoryImport} from '../lib/history-import.ts';

const sql=new DatabaseSync(':memory:');
sql.exec('CREATE TABLE app_meta (key TEXT PRIMARY KEY,value TEXT); CREATE TABLE history_records (id TEXT PRIMARY KEY,event_id TEXT,payload TEXT); CREATE TABLE history_events (id TEXT PRIMARY KEY,payload TEXT)');
const database={
  prepare(query){
    const statement=sql.prepare(query);
    return {bind(...args){return {all:async()=>({results:statement.all(...args)}),first:async()=>statement.get(...args),run:()=>statement.run(...args)};}};
  },
  async batch(statements){
    sql.exec('BEGIN');
    try{for(const statement of statements)statement.run();sql.exec('COMMIT');}
    catch(error){sql.exec('ROLLBACK');throw error;}
  }
};
const hub='https://skateontario.org/results/27KES/';
const catalog=Array.from({length:15},(_,i)=>`<tr><td>STAR 7 Women U12 Group ${i+1}</td><td><a href="group${i+1}CR.pdf">RESULTS</a></td></tr>`).join('');
const links=catalog+'<tr><td>Other</td><td><a href="https://example.test/wrongCR.pdf">RESULTS</a><a href="../oldCR.pdf">RESULTS</a><a href="group0EL.pdf">ENTRY LIST</a></td></tr>';
const files=resultCatalog(links,hub);
assert.equal(files.length,15);
assert.ok(files.every(file=>file.url.startsWith(hub)));
assert.deepEqual(resultCatalog(links,'https://skateontario.org/results/entries/27STRAT/'),[]);
const event={id:'SO-325449',name:'Keswick fixture',start:'2026-11-20',end:'2026-11-22',url:'https://skateontario.org/event/keswick-fixture/',participants:[],documents:[]};
const pending={...event,id:'SO-111',end:'2026-11-23'};
const future={...event,id:'SO-112',end:'2026-11-24'};
const skater={id:'fixture',name:'Fixture Athlete',clubs:['Hamilton SC']};
const item=(str,x,y)=>({str,x,y});
const pages=[[
  item('STAR 7 Women U12',140,720),item('Rank',30,660),item('Competitor(s)',95,660),item('Club',235,660),item('Section',405,660),item('Points',490,660),
  item('2',39,630),item('Fixture Athlete',96,630),item('Hamilton SC',235,630),item('ON',405,630),item('22.50',446,630),item('22.50',496,630),
]];
const encode=new TextEncoder();
const fetch=(url)=>url===hub?encode.encode(links):encode.encode(url);
const parse=()=>pages;
const clock='2026-11-23T15:00:00Z';
assert.equal((await selectHistoryImport(database,[future,event],clock.slice(0,10),Date.parse(clock))).id,event.id);
const first=await importHistory(database,event,[skater],clock,fetch,parse);
assert.deepEqual([first.files,first.verified,first.records],[15,12,12]);
assert.equal((await selectHistoryImport(database,[event,pending],clock.slice(0,10),Date.parse(clock))).id,pending.id);
const second=await importHistory(database,event,[skater],'2026-11-23T16:00:00Z',fetch,parse);
assert.deepEqual([second.files,second.verified,second.records],[15,15,15]);
const third=await importHistory(database,event,[skater],'2026-11-23T17:00:00Z',fetch,parse);
assert.equal(third.records,15);
assert.equal(sql.prepare('SELECT count(*) AS n FROM history_events').get().n,1);
const saved=JSON.parse(sql.prepare('SELECT payload FROM history_records ORDER BY id LIMIT 1').get().payload);
assert.deepEqual([saved.rank,saved.total_score,saved.skater_ids,saved.status],[2,22.5,['fixture'],'result']);
assert.deepEqual(await resultRecords(event,[skater,{...skater,id:'same-name'}],files[0].category,hub,pages,files[0].url),[]);
const failed=await importHistory(database,event,[skater],'2026-11-24T17:00:00Z',fetch,()=>{throw Error('broken PDF');});
assert.equal(failed.records,15);
sql.close();
console.log('Official results catalog, source boundaries, recent-event rotation, bounded progress, exact identities and persistent idempotent history passed.');
