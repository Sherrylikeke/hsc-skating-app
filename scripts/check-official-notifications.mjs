import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import ts from 'typescript';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&context.parentURL)for(const ext of ['.ts','.tsx']){const url=new URL(specifier+ext,context.parentURL);if(fs.existsSync(url))return {url:url.href,shortCircuit:true};}throw error;}},load(url,context,next){if(url.startsWith('file:')&&/\.tsx?$/.test(url))return {format:'module',source:ts.transpileModule(fs.readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(url,context);}});
const {eventWriteStatements}=await import('../lib/change-notifications.ts');
const {drainOutbox,listNotifications,markNotification}=await import('../lib/member-messages.ts');
const {listOfficialNotices,readOfficialNotice}=await import('../lib/official-updates.ts');
const {accessibleSkaters,assertSkater}=await import('../lib/member-access.ts');
class D1{
 database=new DatabaseSync(':memory:');failPublic=false;
 prepare(query){const owner=this;return {values:[],bind(...values){return {...this,values};},execute(){if(owner.failPublic&&query.includes('INSERT INTO hsc_notifications')&&this.values[4]==='official-update'){owner.failPublic=false;throw Error('Simulated public notification failure');}const results=owner.database.prepare(query).all(...this.values);return {results,meta:{changes:owner.database.prepare('SELECT changes() AS changes').get().changes}};},async all(){return this.execute();},async first(){return this.execute().results[0]||null;},async run(){return this.execute();}};}
 async batch(statements){this.database.exec('BEGIN IMMEDIATE');try{const r=statements.map(s=>s.execute());this.database.exec('COMMIT');return r;}catch(error){this.database.exec('ROLLBACK');throw error;}}
}
const database=new D1();for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())database.database.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const members={};
for(const [id,status,role,skater] of [['follower','active','parent','SK-A'],['viewer','club-viewer',null,'SK-A'],['approved','active','parent',null],['other','active','parent','SK-B'],['disabled','disabled','parent','SK-A']]){
 database.database.prepare('INSERT INTO hsc_members (id,email,name,role,requested_role,status,auth_version,created_at) VALUES (?,?,?,?,?,?,1,?)').run(id,id+'@example.test',id,role,'parent',status,new Date().toISOString());
 members[id]={id,email:id+'@example.test',name:id,role,requested_role:'parent',status,auth_version:1};
 if(skater)database.database.prepare('INSERT INTO hsc_home_skaters (id,member_id,skater_id,pinned,updated_at) VALUES (?,?,?,1,?)').run(id+'|'+skater,id,skater,new Date().toISOString());
}
database.database.prepare('INSERT INTO hsc_admissions (skater_id,admitted,payload,updated_by,updated_at) VALUES (?,1,?,?,?)').run('SK-A',JSON.stringify({name:'Fixture Skater',identityPending:false}),'fixture',new Date().toISOString());
database.database.prepare('INSERT INTO hsc_relations (id,member_id,skater_id,kind,active,approved_by,updated_at) VALUES (?,?,?,?,1,?,?)').run('approved|SK-A','approved','SK-A','parent','fixture',new Date().toISOString());
const participant={id:'p',name:'Fixture Skater',category:'STAR 2 STAR 2 (Group 1)',club:'Hamilton SC',section:'ON',skaterIds:['SK-A'],matchStatus:'fixture',sourceUrl:'https://skateontario.org/entry.pdf'};
const block={id:'b',date:'2026-12-05',start:'08:00',end:'08:30',rink:'Duliban Rink',category:'STAR 2 - Group 1',categoryKey:'STAR 2:FREESKATE',group:1,range:null,activity:'competition',page:1,sourceUrl:'https://skateontario.org/schedule.pdf'};
const event={id:'SO-325865',name:'Niagara Fixture',url:'https://skateontario.org/event/fixture/',start:'2026-12-04',end:'2026-12-06',timezone:'America/Toronto',venue:'Fixture',city:'Fixture',source:'Skate Ontario',updateText:'Official',officialModified:'2026-11-18',checkedAt:'2026-11-18T16:00:00Z',detailCheckedAt:'2026-11-18T16:00:00Z',documents:[],participants:[participant],blocks:[block],privateNote:'PRIVATE-NOTE-MUST-NEVER-LEAK'};
await database.batch(eventWriteStatements(database,event,null));await drainOutbox(database);
for(const id of ['follower','viewer','approved']){const rows=await listOfficialNotices(database,members[id]);assert.equal(rows.length,1,id);assert.equal(rows[0].payload.sessions[0].start,'08:00');assert.equal(rows[0].payload.sessions[0].end,'08:30');assert.ok(!JSON.stringify(rows).includes('PRIVATE-NOTE'));}
for(const id of ['other','disabled']){if(id==='disabled')await assert.rejects(()=>listOfficialNotices(database,members[id]));else assert.deepEqual(await listOfficialNotices(database,members[id]),[]);}
assert.deepEqual(await accessibleSkaters(database,members.follower),[]);await assert.rejects(()=>assertSkater(database,members.follower,'SK-A',true));
assert.deepEqual(await listNotifications(database,members.follower),[],'Public preference must not grant private notification access');
const notice=(await listOfficialNotices(database,members.follower))[0];
const storedNotice=id=>database.database.prepare('SELECT * FROM hsc_notifications WHERE id=?').get(id);
await assert.rejects(()=>readOfficialNotice(database,members.other,notice.id));
await readOfficialNotice(database,members.follower,notice.id);
assert.deepEqual(await listOfficialNotices(database,members.follower),[]);
assert.equal(storedNotice(notice.id),undefined,'A dismissed notice must be deleted from storage');
await assert.rejects(()=>readOfficialNotice(database,members.follower,notice.id));
assert.equal((await listOfficialNotices(database,members.viewer)).length,1);
const approvedNotice=(await listOfficialNotices(database,members.approved))[0];
await readOfficialNotice(database,members.approved,approvedNotice.id);
assert.ok((await listNotifications(database,members.approved))[0].read_at,'The matching private schedule notice is marked read');
const legacyId=approvedNotice.id;
database.database.prepare("INSERT INTO hsc_notifications (id,outbox_id,member_id,skater_id,kind,subject_id,author_id,payload,read_at,created_at) SELECT ?,outbox_id,?,skater_id,kind,subject_id,author_id,payload,created_at,created_at FROM hsc_notifications WHERE id=?").run(legacyId,members.approved.id,(await listOfficialNotices(database,members.viewer))[0].id);
assert.deepEqual(await listOfficialNotices(database,members.approved),[]);
assert.equal(storedNotice(legacyId),undefined,'Previously stored read updates are cleaned up');
const count=database.database.prepare('SELECT count(*) AS n FROM hsc_notifications').get().n;
await database.batch(eventWriteStatements(database,{...event,checkedAt:'2026-11-18T17:00:00Z'},event));await drainOutbox(database);assert.equal(database.database.prepare('SELECT count(*) AS n FROM hsc_notifications').get().n,count);
const revised={...event,blocks:[{...block,start:'08:30',end:'09:00'}]};await database.batch(eventWriteStatements(database,revised,event));database.failPublic=true;const first=await drainOutbox(database);assert.equal(first.retried,1);database.database.prepare("UPDATE hsc_outbox SET available_at='2000-01-01T00:00:00Z' WHERE state='pending'").run();await drainOutbox(database);
const updated=await listOfficialNotices(database,members.viewer);assert.equal(updated.length,2);assert.ok(updated.some(n=>n.payload.scheduleChanged&&n.payload.sessions[0].start==='08:30'));
await drainOutbox(database);assert.equal((await listOfficialNotices(database,members.viewer)).length,2);
const newFollowerNotice=(await listOfficialNotices(database,members.follower))[0];
assert.equal(newFollowerNotice.payload.sessions[0].start,'08:30','A new official revision still appears');
database.database.prepare("UPDATE hsc_home_skaters SET pinned=0 WHERE member_id='follower'").run();
assert.deepEqual(await listOfficialNotices(database,members.follower),[]);
await assert.rejects(()=>readOfficialNotice(database,members.follower,newFollowerNotice.id));
assert.ok(storedNotice(newFollowerNotice.id),'A hidden unread update cannot be dismissed');
const privateRevision=(await listNotifications(database,members.approved)).find(row=>!row.read_at);
await markNotification(database,members.approved,privateRevision.id);
assert.deepEqual(await listOfficialNotices(database,members.approved),[]);
const latest={...event,blocks:[{...block,start:'09:00',end:'09:30'}]};
await database.batch(eventWriteStatements(database,latest,revised));
database.failPublic=true;
assert.equal((await drainOutbox(database)).retried,1);
await markNotification(database,members.approved,(await listNotifications(database,members.approved)).find(row=>!row.read_at).id);
database.database.prepare("UPDATE hsc_outbox SET available_at='2000-01-01T00:00:00Z' WHERE state='pending'").run();
await drainOutbox(database);
assert.deepEqual(await listOfficialNotices(database,members.approved),[],'A late retry must not deliver a change already read in the notification center');
assert.ok((await listOfficialNotices(database,members.viewer)).some(row=>row.payload.sessions[0].start==='09:00'));
database.database.close();console.log(JSON.stringify({mySkaterOnly:true,publicViewerSupported:true,noPrivateAccessGranted:true,removedPreferenceHidesUpdates:true,readOwnershipAndPersistence:true,scheduleChangesAndRetryDeduplicated:true,productionWrites:0}));
