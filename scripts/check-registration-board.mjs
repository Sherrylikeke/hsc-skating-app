import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import ts from 'typescript';

// The same SQLite-backed D1 shape used by the membership regression suite.
class LocalD1 {
  database=new DatabaseSync(':memory:');
  prepare(query){
    const owner=this;
    return {values:[],bind(...values){return {...this,values};},execute(){
      const results=owner.database.prepare(query).all(...this.values);
      return {results,success:true,meta:{changes:owner.database.prepare('SELECT changes() AS changes').get().changes}};
    },async all(){return this.execute();},async first(){return this.execute().results[0]??null;},async run(){return this.execute();}};
  }
}
const database=new LocalD1();
for(const file of fs.readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())database.database.exec(fs.readFileSync(path.join('drizzle',file),'utf8'));
globalThis.hscTestDatabase=database;
globalThis.hscTestHeaders=new Headers();
registerHooks({
  resolve(specifier,context,next){
    if(['cloudflare:workers','next/headers','next/navigation'].includes(specifier))return {url:'test-stub:'+specifier,shortCircuit:true};
    try{return next(specifier,context);}catch(error){
      if(specifier.startsWith('.')&&context.parentURL){
        const candidate=new URL(specifier+'.ts',context.parentURL);
        if(fs.existsSync(candidate))return {url:candidate.href,shortCircuit:true};
      }
      throw error;
    }
  },
  load(url,context,next){
    if(url==='test-stub:cloudflare:workers')return {format:'module',source:'export const env={get DB(){return globalThis.hscTestDatabase}};',shortCircuit:true};
    if(url==='test-stub:next/headers')return {format:'module',source:'export async function headers(){return globalThis.hscTestHeaders}',shortCircuit:true};
    if(url==='test-stub:next/navigation')return {format:'module',source:'export function redirect(path){throw new Error(path)}',shortCircuit:true};
    if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8'),shortCircuit:true};
    if(url.startsWith('file:')&&url.endsWith('.ts'))return {format:'module',source:ts.transpileModule(fs.readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const {digest}=await import('../lib/member-access.ts');
const {registrationBoardCards}=await import('../lib/registration-board.ts');
const api=await import('../app/api/registrations/route.ts');
const roster=JSON.parse(fs.readFileSync('data/roster.json','utf8'));
const [first,second,other]=roster;
const skaters=roster.map(skater=>({...skater,categories:[],recordCount:0,eventCount:0,clubs:[],identityStatus:''}));
for(const id of ['parent-a','parent-b','viewer']){
  database.database.prepare('INSERT INTO hsc_members(id,email,name,role,requested_role,status,auth_version,created_at) VALUES (?,?,?,?,?,?,1,?)')
    .run(id,id+'@example.test',id,id==='viewer'?null:'parent','parent',id==='viewer'?'club-viewer':'active',new Date().toISOString());
  database.database.prepare('INSERT INTO hsc_sessions(hash,member_id,auth_version,expires_at,created_at) VALUES (?,?,1,?,?)')
    .run(await digest(id+'-token'),id,'2099-01-01T00:00:00Z',new Date().toISOString());
  for(const skater of [first,second])database.database.prepare('INSERT INTO hsc_home_skaters VALUES (?,?,?,1,?)').run(id+'|'+skater.id,id,skater.id,new Date().toISOString());
}
const url='https://skateontario.org/event/fixture/';
const event={id:'fixture-cup',name:'STAR 1-4 Fixture Cup',url,start:'2099-01-10',end:'2099-01-12',timezone:'America/Toronto',participants:[],blocks:[],documents:[],offeredCategories:['STAR 1','STAR 2','STAR 3','STAR 4'],registrations:[{kind:'public',opens:'2099-01-01',closes:'2099-01-03',url:'https://uplifterfigureskating.com/',sourceUrl:url}],source:'Skate Ontario'};
const manual={...event,id:'manual-cup',name:'Manual Cup',start:'2099-01-20',end:'2099-01-22',registrations:[],offeredCategories:[]};
const past={...event,id:'past-cup',start:'2020-01-10',end:'2020-01-12'};
for(const item of [event,manual,past])database.database.prepare('INSERT INTO live_events VALUES (?,?,?)').run(item.id,JSON.stringify(item),new Date().toISOString());
async function call(id,body,expected=200,headers={}){
  globalThis.hscTestHeaders=new Headers(id?{'oai-authenticated-user-id':id,'oai-authenticated-user-email':id+'@example.test'}:{});
  const request=new Request('https://hsc.example.test/api/registrations',{method:body===undefined?'GET':'POST',headers:{cookie:id?'__Host-hsc_session='+id+'-token':'',...(body===undefined?{}:{origin:'https://hsc.example.test','Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const response=await (body===undefined?api.GET(request):api.POST(request));
  const value=await response.json();
  assert.equal(response.status,expected,JSON.stringify(value));
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  return value;
}
await call(null,undefined,401);
assert.deepEqual((await call('parent-a')).plans,[]);
const input={skaterId:first.id,eventId:event.id,status:'considering'};
assert.equal((await call('parent-a',{...input,memberId:'parent-b'})).plan.status,'considering');
assert.equal(database.database.prepare('SELECT member_id FROM hsc_registration_plans').get().member_id,'parent-a');
await call('parent-a',{...input,status:'submitted'});
await call('parent-a',{...input,skaterId:second.id,status:'waitlisted'});
assert.equal((await call('parent-a')).plans.length,2,'multi-child plans survive a fresh database read');
assert.deepEqual((await call('parent-b')).plans,[],'same home skaters do not expose another account’s plans');
await call('parent-b',{...input,status:'not-attending'});
assert.equal((await call('parent-a')).plans.find(plan=>plan.skaterId===first.id).status,'submitted');
assert.equal((await call('parent-b')).plans[0].status,'not-attending');
await call('parent-a',{...input,status:null});
assert.equal((await call('parent-a')).plans.length,1);
assert.equal((await call('parent-b')).plans.length,1,'clearing a plan is restricted to its owner');
await call('parent-a',{...input,eventId:'unknown-event'},404);
await call('parent-a',{...input,eventId:past.id},400);
await call('parent-a',{...input,skaterId:other.id},403);
await call('parent-a',{...input,status:'confirmed'},400);
await call('parent-a',input,403,{origin:'https://evil.example'});
await call('parent-a',input,403,{'sec-fetch-site':'cross-site'});
await call('parent-a',input,415,{'Content-Type':'text/plain'});
await call('viewer',input);
assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_relations').get().count,0,'personal plans never grant approved private relationships');
database.database.prepare('UPDATE hsc_home_skaters SET pinned=0 WHERE member_id=? AND skater_id=?').run('parent-a',second.id);
assert.deepEqual((await call('parent-a')).plans,[],'removed home skaters are filtered on the server');
await call('parent-a',{...input,skaterId:second.id},403);
database.database.prepare("UPDATE hsc_members SET status='disabled' WHERE id='viewer'").run();
await call('viewer',undefined,403);

const plans=[{skaterId:first.id,eventId:manual.id,status:'submitted',updatedAt:'2099-01-01'}];
const listed={...event,participants:[{id:'entry',skaterIds:[second.id],name:second.name,category:'STAR 2',sourceUrl:url}]};
const cards=registrationBoardCards([manual,listed,past],skaters,[first.id,second.id],plans,'2099-01-01');
assert.deepEqual(cards.map(card=>card.event.id),[event.id,manual.id],'recommended, official-listed and manually recorded future events share one ordered board');
assert.equal(cards.find(card=>card.event.id===event.id).rows.find(row=>row.skater.id===second.id).entries.length,1);
assert.equal(cards.find(card=>card.event.id===manual.id).rows[0].entries.length,0,'submitted does not create an official entry');
assert.equal(JSON.parse(database.database.prepare('SELECT payload FROM live_events WHERE id=?').get(event.id).payload).participants.length,0,'plan writes leave official data unchanged');
assert.equal(registrationBoardCards([manual],skaters,[second.id],plans,'2099-01-01').length,0,'another child’s plan is not reused');
database.database.close();
console.log('Registration board passed: authenticated SQLite API, account and multi-child isolation, save/clear, My Skaters/event validation, CSRF, official separation, recommendations and manual future events.');
