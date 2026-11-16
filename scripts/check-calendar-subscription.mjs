import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import ts from 'typescript';

class LocalD1 {
  database=new DatabaseSync(':memory:');
  prepare(query){
    const owner=this;
    return {values:[],bind(...values){return {...this,values};},execute(){const results=owner.database.prepare(query).all(...this.values);return {results,success:true,meta:{changes:owner.database.prepare('SELECT changes() AS count').get().count}};},async all(){return this.execute();},async first(){return this.execute().results[0]??null;},async run(){return this.execute();}};
  }
  async batch(statements){this.database.exec('BEGIN');try{const results=statements.map(statement=>statement.execute());this.database.exec('COMMIT');return results;}catch(error){this.database.exec('ROLLBACK');throw error;}}
}
const database=new LocalD1();
for(const file of fs.readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())database.database.exec(fs.readFileSync('drizzle/'+file,'utf8'));
globalThis.calendarTestDB=database;
globalThis.calendarTestHeaders=new Headers();
globalThis.calendarVerification=false;
registerHooks({
  resolve(specifier,context,next){
    if(['cloudflare:workers','next/headers','next/navigation'].includes(specifier))return {url:'calendar-stub:'+specifier,shortCircuit:true};
    try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&context.parentURL){for(const extension of ['.ts','.tsx']){const candidate=new URL(specifier+extension,context.parentURL);if(fs.existsSync(candidate))return {url:candidate.href,shortCircuit:true};}}throw error;}
  },
  load(url,context,next){
    if(url==='calendar-stub:cloudflare:workers')return {format:'module',source:`export const env={get DB(){return globalThis.calendarTestDB},get HSC_EMAIL_VERIFICATION_ENABLED(){return globalThis.calendarVerification?'true':undefined},get RESEND_API_KEY(){return globalThis.calendarVerification?'captured-test-only':undefined},get HSC_EMAIL_FROM(){return globalThis.calendarVerification?'test@example.test':undefined}}`,shortCircuit:true};
    if(url==='calendar-stub:next/headers')return {format:'module',source:'export async function headers(){return globalThis.calendarTestHeaders}',shortCircuit:true};
    if(url==='calendar-stub:next/navigation')return {format:'module',source:'export function redirect(path){throw new Error(path)}',shortCircuit:true};
    if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8'),shortCircuit:true};
    if(url.startsWith('file:')&&/\.tsx?$/.test(url))return {format:'module',source:ts.transpileModule(fs.readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const management=await import('../app/api/calendar/subscription/route.ts');
const feed=await import('../app/api/calendar/feed/route.ts');
const {digest}=await import('../lib/member-access.ts');
const {calendarExport}=await import('../lib/calendar-export.ts');
const {scheduleRows}=await import('../lib/official-parser.ts');
const sql=database.database,origin='http://localhost:5173',member='calendar-parent',session='calendar-local-session',day='2026-11-20';
sql.prepare('INSERT INTO hsc_members (id,email,name,role,requested_role,status,auth_version,created_at) VALUES (?,?,?,?,?,?,?,?)').run(member,'calendar@example.test','Test Parent','parent','parent','active',1,day);
sql.prepare('INSERT INTO hsc_sessions (hash,member_id,auth_version,expires_at,created_at) VALUES (?,?,?,?,?)').run(await digest(session),member,1,'2099-01-01T00:00:00Z',day);
for(const [id,name] of [['calendar-a','Calendar Alice'],['calendar-b','Calendar Ben'],['calendar-friend','Calendar Friend']])sql.prepare('INSERT INTO hsc_admissions VALUES (?,1,?,?,?)').run(id,JSON.stringify({name,training:true,identityPending:false}),'test',day);
sql.prepare('INSERT INTO hsc_relations VALUES (?,?,?,?,1,?,?)').run('relation',member,'calendar-a','parent','test',day);
sql.prepare('INSERT INTO hsc_home_skaters VALUES (?,?,?,?,?)').run('home-a',member,'calendar-a',1,day);
sql.prepare('INSERT INTO coach_plans VALUES (?,?,?,?,?,?)').run('private-plan','calendar-a','calendar-cup','2026-11-20T06:00','PRIVATE-NOTE',1);
const block=(category,start,activity='competition',range=null)=>({id:day+'|Ice|'+start+'|'+category,date:day,start,end:start.slice(0,2)+':45',rink:'Ice',category,group:null,range,activity,page:1,sourceUrl:'https://example.test/official.pdf'});
const event={id:'calendar-cup',name:'Calendar Cup',url:'https://example.test/cup',start:day,end:day,timezone:'America/Toronto',participants:[['calendar-a','Calendar Alice'],['calendar-b','Calendar Ben'],['calendar-friend','Calendar Friend']].map(([id,name])=>({id,name,category:'Senior Women',club:'HSC',section:'ON',skaterIds:[id],sourceUrl:'https://example.test/entries'})),blocks:[block('Senior Women SHORT','13:00'),block('Senior Women FREE','14:00'),block('Senior Women SHORT','12:00','practice'),block('Senior Women SHORT (1-10)','15:00','competition',[1,10])],startingOrders:[]};
const saveEvent=()=>sql.prepare('INSERT INTO live_events VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(event.id,JSON.stringify(event),day);
saveEvent();
function identity(enabled=true){globalThis.calendarTestHeaders=enabled?new Headers({'oai-authenticated-user-id':member,'oai-authenticated-user-email':'calendar@example.test'}):new Headers();}
function request(method='GET',body,headers={}){return new Request(origin+'/api/calendar/subscription',{method,headers:{Cookie:'hsc_session='+session,...(method==='POST'?{Origin:origin,'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});}
async function update(action,headers){return management.POST(request('POST',{action},headers));}
const pull=url=>feed.GET(new Request(url));
const unfolded=value=>value.replace(/\r\n /g,'');
const uids=value=>[...unfolded(value).matchAll(/UID:([^\r]+)/g)].map(match=>match[1]);

identity(false);
assert.equal((await management.GET(request())).status,401);
identity();
assert.deepEqual(await (await management.GET(request())).json(),{active:false});
assert.equal((await update('create',{Origin:'https://other.test'})).status,403,'same-origin write protection');
assert.equal((await update('create',{'Content-Type':'text/plain'})).status,415);
const created=await update('create');assert.equal(created.status,200);
const first=await created.json(),token=new URL(first.url).searchParams.get('token');
assert.match(token,/^[a-f0-9]{64}$/);
const stored=sql.prepare('SELECT * FROM hsc_calendar_subscriptions').get();
assert.equal(stored.hash,await digest(token));assert.ok(!Object.values(stored).includes(token),'only hash persisted');
const status=await (await management.GET(request())).json();
assert.equal(status.active,true);assert.equal('url' in status,false);assert.equal('token' in status,false);
assert.equal((await update('create')).status,409);
assert.equal((await pull(origin+'/api/calendar/feed?token=invalid')).status,404);
const initial=await pull(first.url);assert.equal(initial.status,200);
assert.match(initial.headers.get('cache-control'),/no-store/);
let content=await initial.text();
assert.equal(uids(content).length,3,'short/free/practice included; uncertain range omitted');
assert.equal(new Set(uids(content)).size,3,'short/free/practice have distinct identities');
assert.ok(content.includes('Calendar Alice'));assert.ok(!content.includes('Calendar Ben')&&!content.includes('Calendar Friend')&&!content.includes('PRIVATE-NOTE'));
assert.ok(!content.includes('VALARM'));assert.match(unfolded(content),/DTSTART:20261120T180000Z/);

const originalUIDs=uids(content);
event.blocks[0]={...event.blocks[0],id:'revised-block',start:'13:10',end:'13:55',rink:'New Ice'};saveEvent();
content=await (await pull(first.url)).text();
assert.deepEqual(uids(content),originalUIDs,'start/rink revision retains UID and updates event');
assert.match(unfolded(content),/DTSTART:20261120T181000Z/);
sql.prepare('UPDATE hsc_home_skaters SET pinned=0 WHERE member_id=?').run(member);
sql.prepare('INSERT INTO hsc_home_skaters VALUES (?,?,?,?,?)').run('home-b',member,'calendar-b',1,day);
content=await (await pull(first.url)).text();
assert.ok(content.includes('Calendar Ben')&&!content.includes('Calendar Alice'),'feed follows current home selections, not private relations');
sql.prepare('UPDATE hsc_home_skaters SET pinned=0 WHERE member_id=?').run(member);
assert.equal(uids(await (await pull(first.url)).text()).length,0,'empty current home list produces empty calendar');

const rotated=await (await update('replace')).json();
assert.notEqual(rotated.url,first.url);assert.equal((await pull(first.url)).status,404);assert.equal((await pull(rotated.url)).status,200);
sql.prepare("UPDATE hsc_members SET status='disabled' WHERE id=?").run(member);
assert.equal((await pull(rotated.url)).status,404,'disabled member immediately denied');
sql.prepare("UPDATE hsc_members SET status='pending' WHERE id=?").run(member);
assert.equal((await pull(rotated.url)).status,404,'unapproved member denied');
sql.prepare("UPDATE hsc_members SET status='active',auth_version=2 WHERE id=?").run(member);
assert.equal((await pull(rotated.url)).status,404,'session revocation version invalidates subscription');
sql.prepare('UPDATE hsc_sessions SET auth_version=2 WHERE member_id=?').run(member);
const current=await (await update('replace')).json();assert.equal((await pull(current.url)).status,200);
assert.equal((await update('revoke')).status,200);assert.equal((await pull(current.url)).status,404);
assert.equal(sql.prepare('SELECT count(*) AS count FROM hsc_calendar_subscriptions').get().count,0);

// A password account is rechecked against current email verification as well.
sql.prepare('INSERT INTO hsc_auth_user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('calendar-auth','Test Parent','calendar@example.test',0,0,0);
sql.prepare('INSERT INTO hsc_auth_links VALUES (?,?,?)').run('calendar-auth',member,day);
const unverified=await (await update('create')).json();
assert.equal((await pull(unverified.url)).status,404,'unverified active password member cannot bypass account checks');
sql.prepare("UPDATE hsc_members SET status='club-viewer',role=NULL WHERE id=?").run(member);
assert.equal((await pull(unverified.url)).status,200,'existing shared-viewer access remains available when verification delivery is disabled');
globalThis.calendarVerification=true;
assert.equal((await pull(unverified.url)).status,404,'new verification requirement is enforced live');
sql.prepare('UPDATE hsc_auth_user SET email_verified=1 WHERE id=?').run('calendar-auth');
assert.equal((await pull(unverified.url)).status,200);

identity(false);
assert.equal((await management.GET(new Request(origin+'/api/calendar/subscription?token='+token))).status,401,'feed capability cannot access management API');
const row=scheduleRows([event],[{id:'calendar-a',name:'Calendar Alice',coach:'PRIVATE-COACH'}])[0];
assert.equal(uids(calendarExport([row],0).content)[0],uids(calendarExport([{...row,id:'new-id',date:'2026-11-21',start:'09:00',end:'09:45'}],0).content)[0],'export UID remains stable across official date/time changes');
console.log('Calendar subscription: authenticated same-origin management, one-time hash-only token, replace/revoke, live member/email/My Skaters checks, official-only privacy and stable distinct UIDs passed.');
