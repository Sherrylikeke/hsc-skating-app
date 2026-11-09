import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import ts from 'typescript';

class LocalD1 {
  database = new DatabaseSync(':memory:');
  failNotifications = false;
  failChanges = false;
  prepare(query) {
    const owner = this;
    return {
      query, values: [],
      bind(...values) {return {...this, values};},
      execute() {
        if (owner.failNotifications && query.includes('INSERT INTO hsc_notifications')) {owner.failNotifications = false; throw new Error('simulated delivery failure');}
        if (owner.failChanges && query.includes('INSERT INTO hsc_changes')) {owner.failChanges = false; throw new Error('simulated event transaction failure');}
        const results = owner.database.prepare(query).all(...this.values);
        return {results, success: true, meta: {changes: owner.database.prepare('SELECT changes() AS changes').get().changes}};
      },
      async all() {return this.execute();},
      async first() {return this.execute().results[0] || null;},
      async run() {return this.execute();},
      async raw() {const statement=owner.database.prepare(query);statement.setReturnArrays(true);return statement.all(...this.values);},
    };
  }
  async batch(statements) {
    this.database.exec('BEGIN IMMEDIATE');
    try {const result = statements.map(statement => statement.execute()); this.database.exec('COMMIT'); return result;}
    catch (error) {this.database.exec('ROLLBACK'); throw error;}
  }
}
const database = new LocalD1();
const migrations = fs.readdirSync('drizzle').filter(file => file.endsWith('.sql')).sort();
for (const file of migrations.slice(0, 2)) database.database.exec(fs.readFileSync(path.join('drizzle', file), 'utf8'));
database.database.exec("INSERT INTO coach_assignments VALUES ('SK-A','Jen Jackson/Bryce Davidson',7,'2026-10-20'); INSERT INTO coach_plans VALUES ('legacy-plan','SK-A','SO-TEST','2026-11-01T08:00','keep this note',4)");
for (const file of migrations.slice(2)) database.database.exec(fs.readFileSync(path.join('drizzle', file), 'utf8'));
assert.equal(database.database.prepare('SELECT coach FROM coach_assignments').get().coach, 'Jen Jackson/Bryce Davidson');
assert.equal(database.database.prepare('SELECT note FROM coach_plans').get().note, 'keep this note');

globalThis.hscTestDatabase = database;
globalThis.hscTestHeaders = new Headers();
registerHooks({
  resolve(specifier, context, next) {
    if (['cloudflare:workers', 'next/headers', 'next/navigation'].includes(specifier)) return {url: 'test-stub:' + specifier, shortCircuit: true};
    try {return next(specifier, context);} catch (error) {
      if (specifier.startsWith('.') && context.parentURL) {
        for(const extension of ['.ts','.tsx']){const candidate = new URL(specifier + extension, context.parentURL);if (fs.existsSync(candidate)) return {url: candidate.href, shortCircuit: true};}
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (url === 'test-stub:cloudflare:workers') return {format: 'module', source: 'export const env={get DB(){return globalThis.hscTestDatabase},get BETTER_AUTH_SECRET(){return globalThis.hscTestAuthSecret},get HSC_PILOT_REGISTRATIONS(){return globalThis.hscTestPilotConfiguration}};', shortCircuit: true};
    if (url === 'test-stub:next/headers') return {format: 'module', source: 'export async function headers(){return globalThis.hscTestHeaders}', shortCircuit: true};
    if (url === 'test-stub:next/navigation') return {format: 'module', source: 'export function redirect(path){throw new Error(path)}', shortCircuit: true};
    if (url.startsWith('file:') && url.endsWith('.json')) return {format: 'module', source: 'export default ' + fs.readFileSync(new URL(url), 'utf8'), shortCircuit: true};
    if (url.startsWith('file:') && /\.tsx?$/.test(url)) return {format: 'module', source: ts.transpileModule(fs.readFileSync(new URL(url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText, shortCircuit: true};
    return next(url, context);
  },
});
const {memberRequest} = await import('../lib/member-admin.ts');
const {actor, accessibleSkaters, assertSkater} = await import('../lib/member-access.ts');
const {drainOutbox} = await import('../lib/member-messages.ts');
const {eventWriteStatements} = await import('../lib/change-notifications.ts');
const {syncEvent} = await import('../lib/official-sync.ts');
const {createPasswordAuth} = await import('../lib/password-auth.ts');
const {clubEventResponse,clubSyncResponse} = await import('../lib/club-response.ts');
const {scheduleRows} = await import('../lib/official-parser.ts');
const {registrationEligibility} = await import('../lib/registration.ts');
const {reminderPlans,reconcileReminders} = await import('../lib/reminders.ts');
const clubAPI = await import('../app/api/club/route.ts');
const coachAPI = await import('../app/api/coaches/route.ts');
const {default:CoachesPage}=await import('../app/coaches/page.tsx');
const planAPI = await import('../app/api/plans/route.ts');
const syncAPI = await import('../app/api/sync/route.ts');
const mcpAPI = await import('../app/mcp/route.ts');
const mobileAPI = await import('../app/api/mobile/route.ts');
const memberAPI = await import('../app/api/member/route.ts');
const candidates = [{id: 'SK-A', name: 'Test Alpha'}, {id: 'SK-B', name: 'Test Beta'}, {id: 'SK-C', name: 'Same Name'}, {id: 'SK-D', name: 'Same Name'}, {id: 'SK-N', name: 'Nathaniel', identityPending: true}];
const ownerEmail = 'owner@example.test';
const identity = name => ({userId: name, email: name + '@example.test', displayName: name});
const users = Object.fromEntries(['owner', 'parent', 'other-parent', 'skater', 'coach', 'other-coach', 'third-coach', 'outsider'].map(name => [name, {identity: identity(name), cookie: ''}]));
const checks = [];
function check(name) {checks.push(name);}
function request(user, action, body, headers = {}) {
  return new Request('https://hsc.example.test/api/member?action=' + action, {method: body === undefined ? 'GET' : 'POST', headers: {cookie: user?.cookie || '', ...(body === undefined ? {} : {'Content-Type': 'application/json', origin: 'https://hsc.example.test'}), ...headers}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
}
async function call(user, action, body, expected = 200, headers) {
  const response = await memberRequest({database, identity: user?.identity || null, candidates, ownerEmail}, request(user, action, body, headers));
  const value = await response.json();
  assert.equal(response.status, expected, `${action}: ${JSON.stringify(value)}`);
  return {response, value};
}
async function login(user, role) {
  const {response} = await call(user, 'session', {role});
  user.cookie = response.headers.get('set-cookie').split(';')[0];
  return response;
}
async function inviteUser(name, role, skaterIds) {
  const user = users[name];
  const {value} = await call(users.owner, 'invite', {email: user.identity.email, role, skaterIds}, 201);
  await login(user, role);
  await call(user, 'accept-invite', {token: value.token});
  await login(user, role);
  return value;
}
const loginResponse = await login(users.owner, 'parent');
assert.match(loginResponse.headers.get('set-cookie'), /__Host-hsc_session=.*HttpOnly; SameSite=Lax; Max-Age=28800; Secure/);
assert.equal((await call(users.owner, 'me')).value.member.role, 'admin');
assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_admissions').get().count, 0);
check('owner bootstrap is explicit; historical roster never becomes admission');
await call(null, 'session', {role: 'admin'}, 401);
await login(users.outsider, 'admin');
assert.equal((await call(users.outsider, 'me')).value.member.role, null);
await call(users.outsider, 'admin', undefined, 403);
await call(users.outsider, 'member', {id: 'outsider', role: 'admin', status: 'active'}, 403);
await call(users.outsider, 'session', {role: 'admin'}, 403, {origin: 'https://evil.example'});
check('unauthenticated, role-tampering, pending-account and CSRF requests rejected');
for (const skater of candidates.slice(0, 4)) await call(users.owner, 'admission', {skaterId: skater.id, name: skater.name, admitted: true});
await call(users.owner, 'invite', {email: 'x@example.test', role: 'parent', skaterIds: ['SK-N']}, 400);
await call(users.owner, 'admission', {skaterId: 'SK-N', name: 'Nathaniel', identityPending: true, admitted: true});
const downgrade = await call(users.owner, 'invite', {email: ownerEmail, role: 'parent', skaterIds: ['SK-A']}, 201);
await call(users.owner, 'accept-invite', {token: downgrade.value.token}, 409);
await call(users.owner, 'revoke-invite', {id: downgrade.value.id});
const duplicate = await call(users.owner, 'invite', {email: 'pending@example.test', role: 'parent', skaterIds: ['SK-A']}, 201);
await call(users.owner, 'invite', {email: 'pending@example.test', role: 'parent', skaterIds: ['SK-A']}, 409);
database.database.prepare("UPDATE hsc_invites SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(duplicate.value.id);
await call(users.owner, 'invite', {email: 'pending@example.test', role: 'parent', skaterIds: ['SK-A']}, 201);
const expired = await call(users.owner, 'invite', {email: users.outsider.identity.email, role: 'parent', skaterIds: ['SK-A']}, 201);
database.database.prepare("UPDATE hsc_invites SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(expired.value.id);
await call(users.outsider, 'accept-invite', {token: expired.value.token}, 400);
const parentInvite = await inviteUser('parent', 'parent', ['SK-A', 'SK-B']);
await call(users.parent, 'accept-invite', {token: parentInvite.token}, 400);
await call(users.outsider, 'accept-invite', {token: parentInvite.token}, 400);
await inviteUser('other-parent', 'parent', ['SK-C']);
await inviteUser('skater', 'skater', ['SK-A']);
await inviteUser('coach', 'coach', ['SK-A', 'SK-B']);
await inviteUser('other-coach', 'coach', ['SK-C']);
await inviteUser('third-coach', 'coach', ['SK-A']);
assert.deepEqual((await call(users.parent, 'me')).value.skaterIds.sort(), ['SK-A', 'SK-B']);
assert.deepEqual((await call(users.skater, 'me')).value.skaterIds, ['SK-A']);
assert.equal(database.database.prepare("SELECT count(*) AS count FROM hsc_relations WHERE skater_id='SK-A' AND kind='coach' AND active=1").get().count, 2);
check('email-bound invitations expire, deduplicate, are single use; parents support multiple children and skaters support multiple coaches');
const same = await call(users.outsider, 'match&name=Same%20Name');
assert.equal(same.value.matches.length, 2);
await call(users.outsider, 'claim', {role: 'skater', name: 'Same Name', note: 'Review test identity manually', skaterIds: ['SK-D']}, 201);
await call(users.outsider, 'claim', {role: 'skater', name: 'Same Name', note: 'duplicate', skaterIds: ['SK-D']}, 409);
const claim = (await call(users.owner, 'admin')).value.claims.find(row => row.member_id === 'outsider');
await call(users.owner, 'review-claim', {id: claim.id, approve: true});
await call(users.outsider, 'me', undefined, 401);
await login(users.outsider, 'skater');
assert.deepEqual((await call(users.outsider, 'me')).value.skaterIds, ['SK-D']);
await call(users.owner, 'review-claim', {id: claim.id, approve: true}, 409);
check('same names stay distinct; identity claims require administrator review and reauthentication');

function setPlatform(user) {
  globalThis.hscTestHeaders = new Headers(user ? {'oai-authenticated-user-id': user.identity.userId, 'oai-authenticated-user-email': user.identity.email} : {});
}
async function route(user, handler, url, body, expected = 200, spoof = {}) {
  setPlatform(user);
  const response = await handler(new Request('https://hsc.example.test' + url, {method: body === undefined ? 'GET' : 'POST', headers: {cookie: user?.cookie || '', ...spoof, ...(body === undefined ? {} : {origin: 'https://hsc.example.test', 'Content-Type': 'application/json'})}, ...(body === undefined ? {} : {body: JSON.stringify(body)})}));
  const value = await response.json(); assert.equal(response.status, expected, JSON.stringify(value)); return value;
}
await route(null, clubAPI.GET, '/api/club', undefined, 401);
await route(users.parent, clubAPI.GET, '/api/club?skater=SK-C', undefined, 200, {'oai-authenticated-user-id': 'owner'});
await route(users.skater, clubAPI.GET, '/api/club?skater=SK-B', undefined, 200);
await route(users['other-coach'], clubAPI.GET, '/api/club?skater=SK-A', undefined, 200);
await route(users.parent, coachAPI.POST, '/api/coaches', {changes: []}, 403);
for(const user of [users.parent,users.skater,users.coach,users.outsider]){
  await route(user,coachAPI.GET,'/api/coaches',undefined,403);
  await route(user,coachAPI.POST,'/api/coaches',{changes:[]},403);
  setPlatform(user);globalThis.hscTestHeaders.set('cookie',user.cookie);
  await assert.rejects(()=>CoachesPage(),error=>error.message==='/');
}
await route(null,coachAPI.GET,'/api/coaches',undefined,401);
setPlatform(null);await assert.rejects(()=>CoachesPage(),error=>error.message==='/');
setPlatform(users.owner);globalThis.hscTestHeaders.set('cookie',users.owner.cookie);
const editorPage=await CoachesPage();assert.equal(typeof editorPage.type,'function');
const navigationMarkup=fs.readFileSync('app/coach-editor.tsx','utf8');
assert.ok(navigationMarkup.includes('href="/workspace?view=coach"'));assert.ok(navigationMarkup.includes('返回我的主页'));
check('coach maintenance page and GET/POST reject parents, skaters, coaches and viewers; anonymous page redirects, administrator enters, and explicit return navigation exists');
await route(users.parent, planAPI.POST, '/api/plans', {skaterId: 'SK-A'}, 403);
await route(users['other-coach'], planAPI.POST, '/api/plans', {skaterId: 'SK-A'}, 403);
await route(users.coach, syncAPI.POST, '/api/sync', {}, 403);
await route(users.coach, mcpAPI.POST, '/mcp', {method: 'tools/call', params: {name: 'sync_hsc_calendar'}}, 403);
database.database.prepare('INSERT INTO coach_plans (id,skater_id,event_id,meeting_time,note,revision) VALUES (?,?,?,?,?,1)').run('private-other-plan','SK-C','SO-TEST','2026-11-01T09:00','Private other-skater note');
const parentData = await route(users.parent, clubAPI.GET, '/api/club');
assert.ok(parentData.skaters.length>2);
assert.deepEqual(parentData.ownSkaterIds.sort(),['SK-A','SK-B']);
assert.deepEqual(parentData.skaters.slice(0,2).map(skater=>skater.id).sort(),['SK-A','SK-B']);
assert.deepEqual(parentData.writableSkaterIds,[]);
assert.ok(parentData.plans.every(plan=>['SK-A','SK-B'].includes(plan.skaterId)));
assert.equal(parentData.member.role,'parent');
assert.ok(!JSON.stringify(parentData.plans).includes('Private other-skater note'));
const ownMember = await actor(database, users.parent.identity, request(users.parent, 'me'));
await assertSkater(database, ownMember, 'SK-A');
await assert.rejects(() => assertSkater(database, ownMember, 'SK-C'));
check('club official schedules are shared with verified active members, own skaters are pinned first; private plans, writes, MCP and account identity remain protected');

const diagnosticMarker='fixture-source.pdf: private parser diagnostic';
const diagnosticTime='2026-10-26T12:00:00Z';
const diagnosticEvent={id:'SO-900001',name:'Isolated diagnostic event',url:'https://example.test/event',start:'2026-11-01',end:'2026-11-01',timezone:'America/Toronto',venue:'Test rink',city:'Test city',updateText:'Official notice',source:'Skate Ontario',officialModified:diagnosticTime,checkedAt:diagnosticTime,detailCheckedAt:diagnosticTime,detailError:diagnosticMarker,entryStatus:'30/58 verified',scheduleStatus:'Partial schedule',startingOrderStatus:diagnosticMarker,internalDiagnostic:diagnosticMarker,
  documents:[{url:'https://example.test/entries',label:'Official entries',kind:'entries',category:'Novice Men',hash:diagnosticMarker,matchingRosterHash:diagnosticMarker,checkedAt:diagnosticTime,attemptedAt:diagnosticTime,parserVersion:diagnosticMarker,entryCount:1,error:diagnosticMarker,internalDiagnostic:diagnosticMarker,entryFiles:[{url:'https://example.test/entry.pdf',label:'Entry file',kind:'entries',error:diagnosticMarker,entryFiles:[{error:diagnosticMarker}]}]}],
  participants:[{id:'fixture-participant',name:'Test Alpha',category:'Novice Men',club:'Test Club',section:'ON',skaterIds:['SK-A'],matchStatus:'Full-name match',sourceUrl:'https://example.test/entries',internalDiagnostic:diagnosticMarker}],
  blocks:[{id:'fixture-block',date:'2026-11-01',start:'09:00',end:'10:00',rink:'Test rink',category:'Novice Men',categoryKey:'NOVICE:MEN',group:null,range:null,activity:'competition',page:1,sourceUrl:'https://example.test/schedule.pdf',internalDiagnostic:diagnosticMarker}],
  startingOrders:[{id:'fixture-order',name:'Test Alpha',category:'Novice Men',program:'Free',startNumber:1,warmupGroup:1,individualTime:'09:05',sourceUrl:'https://example.test/start-order.pdf',page:1,skaterIds:['SK-A'],internalDiagnostic:diagnosticMarker}],
};
const originalDiagnosticEvent=structuredClone(diagnosticEvent);
const projectedEvent=clubEventResponse(diagnosticEvent,false);
const fixtureSkaters=[{id:'SK-A',name:'Test Alpha',coach:'Test Coach'}];
assert.equal(scheduleRows([projectedEvent],fixtureSkaters).length,1);
assert.deepEqual(scheduleRows([projectedEvent],fixtureSkaters),scheduleRows([diagnosticEvent],fixtureSkaters));
assert.deepEqual(diagnosticEvent,originalDiagnosticEvent);
assert.equal(clubEventResponse({...diagnosticEvent,detailError:undefined,documents:[]},false).needsReview,false);
assert.equal(clubEventResponse({...diagnosticEvent,detailError:undefined,documents:[{url:'https://example.test/entries',label:'Entries',kind:'entries',entryFiles:[{url:'https://example.test/pending.pdf',label:'Pending',kind:'entries'}]}]},false).needsReview,true);
assert.deepEqual(clubSyncResponse({},false),{needsReview:false});
database.database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?)').run(diagnosticEvent.id,JSON.stringify(diagnosticEvent),diagnosticTime);
database.database.prepare('INSERT INTO app_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('official-sync-status',JSON.stringify({error:diagnosticMarker,lastAttempt:diagnosticTime,lastSuccess:diagnosticTime,lastCalendarSuccess:diagnosticTime,events:1,entries:1,blocks:1,internalDiagnostic:diagnosticMarker}));
const viewer={identity:identity('viewer'),cookie:''};await login(viewer,'parent');
database.database.prepare("UPDATE hsc_members SET role=NULL,status='club-viewer' WHERE id='viewer'").run();
async function assertOrdinaryDiagnostics(user){
  const data=await route(user,clubAPI.GET,'/api/club',undefined,200,{'oai-authenticated-user-id':'owner'});
  const event=data.events.find(event=>event.id===diagnosticEvent.id);
  assert.equal(event.needsReview,true);assert.deepEqual(data.sync,{needsReview:true});
  for(const field of ['officialModified','checkedAt','detailCheckedAt','detailError','entryStatus','scheduleStatus','startingOrderStatus','internalDiagnostic'])assert.equal(Object.hasOwn(event,field),false,field);
  assert.deepEqual(event.documents,[{url:'https://example.test/entries',label:'Official entries',kind:'entries',category:'Novice Men'}]);
  assert.equal(event.participants[0].name,'Test Alpha');assert.equal(event.blocks[0].start,'09:00');assert.equal(event.startingOrders[0].individualTime,'09:05');
  assert.ok(!JSON.stringify({events:data.events,sync:data.sync}).includes(diagnosticMarker));
}
for(const user of [users.parent,users.skater,users.coach,viewer])await assertOrdinaryDiagnostics(user);
database.database.prepare("UPDATE hsc_members SET role='admin' WHERE id='viewer'").run();await assertOrdinaryDiagnostics(viewer);
database.database.prepare("UPDATE hsc_members SET role=NULL WHERE id='viewer'").run();
const diagnosticAdmin=await route(users.owner,clubAPI.GET,'/api/club');
assert.equal(diagnosticAdmin.sync.error,diagnosticMarker);assert.equal(diagnosticAdmin.sync.lastAttempt,diagnosticTime);
const adminEvent=diagnosticAdmin.events.find(event=>event.id===diagnosticEvent.id);
assert.equal(adminEvent.detailError,diagnosticMarker);assert.equal(adminEvent.documents[0].entryFiles[0].entryFiles[0].error,diagnosticMarker);
assert.equal(adminEvent.entryStatus,'30/58 verified');assert.equal(adminEvent.needsReview,true);
database.database.prepare('DELETE FROM live_events WHERE id=?').run(diagnosticEvent.id);
database.database.prepare('DELETE FROM app_meta WHERE key=?').run('official-sync-status');
check('club API projects diagnostics by the live server role: parents, skaters, coaches, viewers and inactive admin roles retain only review flags and official data; active administrators retain nested diagnostics');

const requirement = (await call(users.coach, 'requirement', {title: 'Test equipment', body: 'Bring guards and meet at the entrance.', skaterIds: ['SK-A', 'SK-B'], dueAt: '2026-11-01T09:00:00-05:00', authorId: 'other-coach'}, 200)).value.requirement;
assert.equal(requirement.author_id, 'coach');
assert.equal((await call(users.parent, 'requirements')).value.requirements.length, 1);
assert.equal((await call(users['other-parent'], 'requirements')).value.requirements.length, 0);
assert.equal((await call(users['third-coach'], 'requirements')).value.requirements.length, 0);
await call(users['other-coach'], 'requirement', {id: requirement.id, revision: 1, title: 'spoof', body: 'spoof', skaterIds: ['SK-C']}, 403);
await call(users.parent, 'receipt', {id: requirement.id, revision: 1, skaterId: 'SK-C', acknowledge: true}, 403);
await call(users.parent, 'receipt', {id: requirement.id, revision: 1, skaterId: 'SK-A', acknowledge: true});
await call(users.skater, 'receipt', {id: requirement.id, revision: 1, skaterId: 'SK-A'});
assert.equal((await call(users.coach, 'requirements')).value.requirements[0].receipts.length, 2);
await call(users.coach, 'requirement', {id: requirement.id, revision: 1, title: 'Updated equipment', body: 'Bring guards and water.', skaterIds: ['SK-A', 'SK-B']});
await call(users.parent, 'receipt', {id: requirement.id, revision: 1, skaterId: 'SK-A', acknowledge: true}, 409);
await call(users.parent, 'receipt', {id: requirement.id, revision: 2, skaterId: 'SK-A', acknowledge: true});
await call(users.coach, 'requirement', {id: requirement.id, revision: 1, state: 'withdrawn'}, 409);
await call(users.coach, 'requirement', {id: requirement.id, revision: 2, state: 'withdrawn'});
await call(users.parent, 'receipt', {id: requirement.id, revision: 3, skaterId: 'SK-A'}, 404);
assert.equal((await call(users.parent, 'requirements')).value.requirements[0].versions.length, 3);
check('coach sender cannot be forged; requirements have versioned edits, withdrawals and per-child per-account receipts');
await call(users['third-coach'], 'claim', {role: 'coach', name: 'Same Name', note: 'Coach requests administrator-reviewed additional athlete', skaterIds: ['SK-D']}, 201);
const coachClaim = (await call(users.owner, 'admin')).value.claims.find(row => row.member_id === 'third-coach');
await call(users.owner, 'review-claim', {id: coachClaim.id, approve: true});
assert.deepEqual((await call(users['third-coach'], 'me')).value.skaterIds.sort(), ['SK-A', 'SK-D']);
const revokedInvite = await call(users.owner, 'invite', {email: users.skater.identity.email, role: 'skater', skaterIds: ['SK-B']}, 201);
await call(users.owner, 'revoke-invite', {id: revokedInvite.value.id});
await call(users.skater, 'accept-invite', {token: revokedInvite.value.token}, 400);
check('coach relationship claims require review and preserve existing multi-coach links; revoked invitations cannot be redeemed');

const fixture = {id: 'SO-TEST', name: 'Isolated Test Event', url: 'https://skateontario.org/test/', start: '2026-11-01', end: '2026-11-01', venue: 'Rink A', timezone: 'America/Toronto', city: 'Test', officialModified: '', updateText: '', checkedAt: '2026-10-20T17:00:00Z', documents: [{kind: 'start-order', url: 'https://skateontario.org/test/order.pdf', hash: 'hash1'}], participants: [{id: 'p1', name: 'Test Alpha', category: 'Novice Men', club: 'Other Club', skaterIds: ['SK-A']}], blocks: [{id: 'b1', date: '2026-11-01', start: '10:00', end: '11:00', rink: 'A', category: 'Novice Men', activity: 'competition'}], startingOrders: [{id: 'o1', name: 'Test Alpha', category: 'Novice Men', program: 'Short', startNumber: 2, warmupGroup: null, individualTime: null, skaterIds: ['SK-A']}]};
await database.batch(eventWriteStatements(database, fixture, null));
const initialOutbox = database.database.prepare('SELECT count(*) AS count FROM hsc_outbox').get().count;
await database.batch(eventWriteStatements(database, {...fixture, checkedAt: '2026-10-20T18:00:00Z'}, fixture));
assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_outbox').get().count, initialOutbox);
database.failNotifications = true;
const failed = await drainOutbox(database);
assert.equal(failed.retried, 1);
assert.equal(database.database.prepare("SELECT count(*) AS count FROM hsc_notifications WHERE kind='schedule'").get().count, 0);
database.database.exec("UPDATE hsc_outbox SET available_at='2000-01-01T00:00:00.000Z'");
await drainOutbox(database);
const delivered = database.database.prepare("SELECT count(*) AS count FROM hsc_notifications WHERE kind='schedule'").get().count;
assert.equal(delivered, 4);
await drainOutbox(database);
assert.equal(database.database.prepare("SELECT count(*) AS count FROM hsc_notifications WHERE kind='schedule'").get().count, delivered);
const notifications = (await call(users.parent, 'notifications')).value.notifications;
const scheduleNotice = notifications.find(row => row.kind === 'schedule');
await call(users.parent, 'notification-read', {id: scheduleNotice.id});
await call(users['other-parent'], 'notification-read', {id: scheduleNotice.id}, 404);
const revised = {...fixture, venue: 'Rink B', startingOrders: [{...fixture.startingOrders[0], startNumber: 4, warmupGroup: 2, individualTime: '10:12'}]};
database.failChanges = true;
await assert.rejects(() => database.batch(eventWriteStatements(database, revised, fixture)));
assert.equal(JSON.parse(database.database.prepare("SELECT payload FROM live_events WHERE id='SO-TEST'").get().payload).venue, 'Rink A');
await database.batch(eventWriteStatements(database, revised, fixture));
const change = JSON.parse(database.database.prepare('SELECT payload FROM hsc_changes ORDER BY rowid DESC LIMIT 1').get().payload);
assert.equal(change.before.orders[0].startNumber, 2); assert.equal(change.after.orders[0].warmupGroup, 2);
await database.batch(eventWriteStatements(database, {...fixture, participants: [], startingOrders: []}, revised));
const cancellation = JSON.parse(database.database.prepare('SELECT payload FROM hsc_changes ORDER BY rowid DESC LIMIT 1').get().payload);
assert.equal(cancellation.after, null);
check('official snapshot and notification outbox commit atomically; hashes, before/after, removal, retry, dedupe and read ownership validated');

await call(users.owner, 'relation', {memberId: 'parent', skaterId: 'SK-A', active: false});
await route(users.parent, clubAPI.GET, '/api/club?skater=SK-A', undefined, 200);
assert.ok(!(await route(users.parent,clubAPI.GET,'/api/club')).ownSkaterIds.includes('SK-A'));
assert.ok((await call(users.parent, 'notifications')).value.notifications.every(row => row.skater_id !== 'SK-A'));
assert.deepEqual((await call(users.parent, 'requirements')).value.requirements[0].skater_ids, ['SK-B']);
await call(users.owner, 'relation', {memberId: 'coach', skaterId: 'SK-A', active: false});
const coachRequirements = (await call(users.coach, 'requirements')).value.requirements;
assert.ok(coachRequirements.every(row => row.receipts.every(receipt => receipt.skater_id !== 'SK-A')));
await call(users.coach, 'unlink-own', {skaterId: 'SK-B'});
assert.equal((await call(users.coach, 'requirements')).value.requirements.length, 0);
await call(users.owner, 'admission', {skaterId: 'SK-B', name: 'Test Beta', admitted: false});
assert.deepEqual((await call(users.parent, 'me')).value.skaterIds, []);
await call(users.owner, 'member', {id: 'other-coach', role: 'coach', status: 'disabled'});
await call(users['other-coach'], 'me', undefined, 401);
await call(users['other-coach'], 'session', {role: 'coach'}, 403);
await call(users.owner, 'member', {id: 'owner', role: 'parent', status: 'disabled'}, 409);
await call(users.skater, 'revoke-own-sessions', {});
await call(users.skater, 'me', undefined, 401);
await login(users.skater, 'skater');
database.database.prepare("UPDATE hsc_sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE member_id='skater'").run();
await call(users.skater, 'me', undefined, 401);
await login(users.skater, 'skater');
await call(users.skater, 'logout', {});
await call(users.skater, 'me', undefined, 401);
check('unbinding, withdrawal of admission, coach transfer, account disabling, session revocation and logout take effect on the next API request');

for (let attempt = 0; attempt < 15; attempt++) await call(users.outsider, 'match&name=Same%20Name', undefined, attempt < 14 ? 200 : 429);
check('server-side name matching rate limit enforced');
const rematchSkaterId = 'HSC-NEW-' + crypto.randomUUID();
const rematchEventId = 'SO-999001';
const rematchPayload = {name:'Verified Test Fullname',identityPending:true,training:true,representedClubs:''};
database.database.prepare('INSERT INTO hsc_admissions (skater_id,admitted,payload,updated_by,updated_at) VALUES (?,1,?,?,?)').run(rematchSkaterId,JSON.stringify(rematchPayload),'owner',new Date().toISOString());
database.database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?)').run(rematchEventId,JSON.stringify({...fixture,id:rematchEventId,url:'https://skateontario.org/rematch/',documents:[],participants:[],blocks:[],startingOrders:[]}),new Date().toISOString());
const originalFetch = globalThis.fetch;
globalThis.fetch = async input => new Response(new URL(input).pathname === '/rematch/entries.html' ? '<table><tr data-category="Novice Men" data-club="Test Club"><td><span class="skater-name">Verified Test Fullname</span></td></tr></table>' : '<a href="https://skateontario.org/rematch/entries.html">Entry List</a>');
try {
  await syncEvent(rematchEventId);
  const first = JSON.parse(database.database.prepare('SELECT payload FROM live_events WHERE id=?').get(rematchEventId).payload);
  assert.deepEqual(first.participants[0].skaterIds, []);
  database.database.prepare('UPDATE hsc_admissions SET payload=? WHERE skater_id=?').run(JSON.stringify({...rematchPayload,identityPending:false}),rematchSkaterId);
  await syncEvent(rematchEventId);
  const second = JSON.parse(database.database.prepare('SELECT payload FROM live_events WHERE id=?').get(rematchEventId).payload);
  assert.equal(second.documents[0].hash,first.documents[0].hash);
  assert.notEqual(second.documents[0].matchingRosterHash,first.documents[0].matchingRosterHash);
  assert.deepEqual(second.participants[0].skaterIds,[rematchSkaterId]);
  const count = database.database.prepare('SELECT count(*) AS count FROM hsc_changes WHERE event_id=?').get(rematchEventId).count;
  await syncEvent(rematchEventId);
  assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_changes WHERE event_id=?').get(rematchEventId).count,count);
} finally {globalThis.fetch=originalFetch;}
check('confirmed full names rematch unchanged official files; pending identity never matches and repeat sync creates no duplicate changes');
const importEventId='SO-999002',importUrl='https://skateontario.org/import-fixture/';
const scheduleBytes=fs.readFileSync('tests/fixtures/keswick-2026-schedule.pdf');
const entryBytes=fs.readFileSync('tests/fixtures/adult-2026-gold-entry.pdf');
const scheduleHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',scheduleBytes))).map(value=>value.toString(16).padStart(2,'0')).join('');
const importFixture={...fixture,id:importEventId,url:importUrl,documents:[{kind:'schedule',url:importUrl+'schedule.pdf',hash:scheduleHash,parserVersion:'schedule-bands-3'}],participants:[],startingOrders:[]};
database.database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?)').run(importEventId,JSON.stringify(importFixture),new Date().toISOString());
database.database.prepare('INSERT INTO hsc_admissions (skater_id,admitted,payload,updated_by,updated_at) VALUES (?,1,?,?,?)').run('fixture-gold',JSON.stringify({name:'Alexis Collins',identityPending:false,training:true}),'owner',new Date().toISOString());
let invalidImport=false;
globalThis.fetch=async input=>{
  const pathname=new URL(input).pathname;
  if(pathname.endsWith('.pdf'))return new Response(invalidImport?'invalid PDF revision':pathname.endsWith('schedule.pdf')?scheduleBytes:entryBytes);
  if(pathname.endsWith('/entries/'))return new Response(Array.from({length:6},(_,index)=>'<a href="entry-'+index+'.pdf">Entry List</a>').join(''));
  return new Response('<a href="'+importUrl+'entries/">Entry Lists</a><a href="'+importUrl+'schedule.pdf">Schedule</a>');
};
const readImport=()=>JSON.parse(database.database.prepare('SELECT payload FROM live_events WHERE id=?').get(importEventId).payload);
try{
  await syncEvent(importEventId);
  const first=readImport();
  assert.equal(first.participants.length,16);assert.equal(first.documents.find(document=>document.kind==='entries').entryFiles.filter(file=>file.checkedAt).length,4);
  assert.equal(first.blocks.length,40);assert.deepEqual([...new Set(first.blocks.map(block=>block.date))],['2026-11-20','2026-11-21','2026-11-22']);
  assert.equal(first.documents.find(document=>document.kind==='schedule').hash,scheduleHash);
  assert.equal(first.documents.find(document=>document.kind==='schedule').parserVersion,'schedule-bands-5');
  assert.match(first.entryStatus,/4\/6/);assert.match(first.scheduleStatus,/部分导入/);
  assert.equal(database.database.prepare("SELECT count(*) AS count FROM source_revisions WHERE event_id=? AND kind='entries'").get(importEventId).count,4);
  await syncEvent(importEventId);
  const second=readImport();assert.equal(second.participants.length,24);
  assert.ok(second.documents.find(document=>document.kind==='entries').entryFiles.every(file=>file.checkedAt&&!file.error));
  const changes=database.database.prepare('SELECT count(*) AS count FROM hsc_changes WHERE event_id=?').get(importEventId).count;assert.ok(changes>0);
  const outbox=database.database.prepare('SELECT count(*) AS count FROM hsc_outbox').get().count;
  invalidImport=true;
  await syncEvent(importEventId);
  const failed=readImport();assert.deepEqual(failed.participants,second.participants);assert.deepEqual(failed.blocks,second.blocks);assert.ok(failed.detailError);
  assert.equal(failed.documents.find(document=>document.kind==='schedule').hash,scheduleHash);
  invalidImport=false;
  await syncEvent(importEventId);
  assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_changes WHERE event_id=?').get(importEventId).count,changes);
  assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_outbox').get().count,outbox);
  assert.equal(database.database.prepare("SELECT count(*) AS count FROM source_revisions WHERE event_id=? AND kind='entries' AND url LIKE '%.pdf'").get(importEventId).count,6);
}finally{globalThis.fetch=originalFetch;}
check('real PDF batches persist progress and nested source revisions; unchanged schedules reparse after parser upgrades, failed revisions preserve records, and repeated sync deduplicates changes/outbox');
const verificationLinks=[];
const testDelivery={enabled:true,registrationEnabled:true,async send(email,url){verificationLinks.push({email,url});}};
const auth=createPasswordAuth(database,'isolated-tests-only-secret-0123456789-abcdef','http://127.0.0.1:5173',undefined,testDelivery);
const authRequest=(path,body,headers={})=>new Request('http://127.0.0.1:5173/api/auth/'+path,{method:'POST',headers:{origin:'http://127.0.0.1:5173','Content-Type':'application/json','cf-connecting-ip':'192.0.2.71',...headers},body:JSON.stringify(body)});
const testPassword='Isolated-Fixture-Password-2026!';
const registrationBody={email:'password-fixture@example.test',name:'Password Fixture',username:'fixture.account',password:testPassword,role:'parent',skaterName:'Test Alpha',emailVerified:true};
const registrationDatabase=new LocalD1();
for(const file of migrations)registrationDatabase.database.exec(fs.readFileSync(path.join('drizzle',file),'utf8'));
for(const [id,profile,admitted] of [
  ['approved',{name:'Club Skater',training:true,identityPending:false},1],
  ['external',{name:'External Skater',training:false,identityPending:false},1],
  ['pending',{name:'Unknown Identity',training:true,identityPending:true},1],
  ['not-admitted',{name:'Candidate Only',training:true,identityPending:false},0],
  ['duplicate-a',{name:'Same Name',training:true,identityPending:false},1],
  ['duplicate-b',{name:'Same Name',training:true,identityPending:false},1],
])registrationDatabase.database.prepare('INSERT INTO hsc_admissions (skater_id,admitted,payload,updated_by,updated_at) VALUES (?,?,?,?,?)').run(id,admitted,JSON.stringify(profile),'test',new Date().toISOString());
for(const role of ['skater','parent','coach'])assert.deepEqual((await registrationEligibility(registrationDatabase,{role,skaterName:'  CLUB  SKATER '},role)).skaterIds,['approved']);
for(const skaterName of ['External Skater','Unknown Identity','Candidate Only'])assert.equal((await registrationEligibility(registrationDatabase,{role:'parent',skaterName},skaterName)).skaterIds.length,1);
assert.equal((await registrationEligibility(registrationDatabase,{role:'parent',skaterName:'Same Name'},'duplicates')).skaterIds.length,2);
assert.equal((await registrationEligibility(registrationDatabase,{role:'parent',skaterName:'CARSON WANG'},'roster-only')).skaterIds.length,1);
await assert.rejects(()=>registrationEligibility(registrationDatabase,{role:'parent',skaterName:'Missing Name'},'missing'),error=>error.status===403);
const isolatedAuth=createPasswordAuth(registrationDatabase,'isolated-tests-only-secret-0123456789-abcdef','http://127.0.0.1:5173',undefined,testDelivery);
const limitedRequest=authRequest('sign-up/email',{...registrationBody,skaterName:'Missing Name'},{'cf-connecting-ip':'192.0.2.120'});
for(let attempt=0;attempt<8;attempt++)assert.equal((await isolatedAuth.handler(limitedRequest.clone())).status,403);
assert.equal((await isolatedAuth.handler(limitedRequest.clone())).status,429);
assert.equal(registrationDatabase.database.prepare('SELECT count(*) AS count FROM hsc_auth_user').get().count,0);
const beforeRegistrationCount=database.database.prepare('SELECT count(*) AS count FROM hsc_auth_user').get().count;
for(const route of ['sign-up/email/','sign-up/email//','sign-up%2Femail','SIGN-UP/EMAIL','/sign-up/email']) {
  const rejected=await auth.handler(authRequest(route,{...registrationBody,role:'admin'}));
  assert.equal(rejected.ok,false,'Registration gate bypass at '+route);
}
for(const [index,invalid] of [{role:'admin'},{role:'outsider'},{skaterName:''},{skaterName:'Not In Club'},{role:'admin',linkExisting:true}].entries()) {
  const rejected=await auth.handler(authRequest('sign-up/email',{...registrationBody,...invalid},{'cf-connecting-ip':'192.0.2.'+(80+index)}));
  assert.ok([400,403].includes(rejected.status),await rejected.text());
}
assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_auth_user').get().count,beforeRegistrationCount);
const signup=await auth.handler(authRequest('sign-up/email',{...registrationBody,skaterName:'  TEST   ALPHA  '}));
assert.equal(signup.status,200,await signup.clone().text());
const signupValue=await signup.json();
assert.equal(signupValue.registrationMode,'verification');
assert.equal(signupValue.verificationDelivery,'requested');
assert.equal(signupValue.user.emailVerified,false);
assert.equal(signupValue.token,null);
assert.equal(signup.headers.get('set-auth-token'),null);
assert.equal((await auth.handler(authRequest('sign-in/email',{email:registrationBody.email,password:testPassword}))).status,403);
assert.equal((await auth.handler(authRequest('sign-in/username',{username:registrationBody.username,password:testPassword}))).status,403);
assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_auth_session WHERE user_id=?').get(signupValue.user.id).count,0);
const verificationURL=verificationLinks.find(link=>link.email===registrationBody.email).url;
const tampered=new URL(verificationURL);tampered.searchParams.set('token','invalid-token');
assert.notEqual((await auth.handler(new Request(tampered))).status,200);
assert.equal(database.database.prepare('SELECT email_verified FROM hsc_auth_user WHERE id=?').get(signupValue.user.id).email_verified,0);
const {createEmailVerificationToken}=await import('better-auth/api');
const expiredVerificationToken=await createEmailVerificationToken('isolated-tests-only-secret-0123456789-abcdef',registrationBody.email,undefined,-1);
const expiredResponse=await auth.handler(new Request('http://127.0.0.1:5173/api/auth/verify-email?token='+expiredVerificationToken));
assert.notEqual(expiredResponse.status,200);
assert.equal(database.database.prepare('SELECT email_verified FROM hsc_auth_user WHERE id=?').get(signupValue.user.id).email_verified,0);
assert.equal((await auth.handler(authRequest('send-verification-email',{email:registrationBody.email,callbackURL:'http://127.0.0.1:5173/verify-email?verified=1'}))).status,200);
assert.equal((await auth.handler(authRequest('send-verification-email',{email:registrationBody.email,callbackURL:'http://127.0.0.1:5173/verify-email?verified=1'}))).status,429);
const verificationResponse=await auth.handler(new Request(verificationURL));
assert.ok([200,302].includes(verificationResponse.status));
assert.equal(database.database.prepare('SELECT email_verified FROM hsc_auth_user WHERE id=?').get(signupValue.user.id).email_verified,1);
const firstSignIn=await auth.handler(authRequest('sign-in/email',{email:registrationBody.email,password:testPassword}));
assert.equal(firstSignIn.status,200,await firstSignIn.clone().text());
assert.match(firstSignIn.headers.get('set-cookie'),/HttpOnly/i);
const signedToken=firstSignIn.headers.get('set-auth-token');
check('email verification blocks both sign-in methods until a real signed link succeeds; invalid and expired links cannot verify, and resend is rate-limited');
assert.ok(signedToken);
const signedSession=await auth.api.getSession({headers:new Headers({authorization:'Bearer '+signedToken})});
assert.equal(signedSession.user.id,signupValue.user.id);
assert.equal(await auth.api.getSession({headers:new Headers({authorization:'Bearer '+signupValue.token})}),null);
const storedPassword=database.database.prepare('SELECT password FROM hsc_auth_account WHERE user_id=?').get(signupValue.user.id).password;
assert.notEqual(storedPassword,testPassword);
assert.ok(storedPassword.length>60);
const passwordIdentity={userId:'password:'+signupValue.user.id,email:signupValue.user.email,displayName:signupValue.user.name,provider:'password',authToken:signedSession.session.token};
const passwordContext={database,identity:passwordIdentity,candidates,ownerEmail:passwordIdentity.email};
const passwordLogin=await memberRequest(passwordContext,request(null,'session',{role:'admin'}));
assert.equal(passwordLogin.status,200);
const passwordMember=(await passwordLogin.json()).member;
assert.equal(passwordMember.role,null);
assert.equal(passwordMember.status,'club-viewer');
assert.equal(passwordMember.requested_role,'parent');
const registrationClaim=database.database.prepare("SELECT payload FROM hsc_claims WHERE member_id=? AND kind='membership'").get(passwordMember.id);
assert.deepEqual(JSON.parse(registrationClaim.payload).skaterIds,['SK-A']);
assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_relations WHERE member_id=?').get(passwordMember.id).count,0);
check('email registration checks only name-list membership, including non-admitted and duplicate names; no ChatGPT or email-ownership assertion grants private relationships');
assert.equal((await memberRequest(passwordContext,request(null,'me'))).status,200);
assert.equal((await memberRequest(passwordContext,request(null,'admin'))).status,403);
const viewerMe=await memberRequest(passwordContext,request(null,'me')).then(response=>response.json());
assert.deepEqual(viewerMe.skaterIds,[]);assert.deepEqual(viewerMe.preferredSkaterIds,['SK-A']);
assert.equal(viewerMe.membershipClaimStatus,'pending');
assert.equal((await memberRequest(passwordContext,request(null,'notifications'))).status,403);
assert.equal((await memberRequest(passwordContext,request(null,'requirement',{title:'forged coach',body:'not allowed',skaterIds:['SK-A']}))).status,403);
globalThis.hscTestAuthSecret='isolated-tests-only-secret-0123456789-abcdef';globalThis.hscTestHeaders=new Headers();
const viewerRequest=new Request('https://hsc-coach-roster.sherrylikeke.chatgpt.site/api/mobile',{headers:{authorization:'Bearer '+signedToken}});
const viewerResponse=await mobileAPI.GET(viewerRequest);assert.equal(viewerResponse.status,200,await viewerResponse.clone().text());
const viewerData=await viewerResponse.json();assert.deepEqual(viewerData.privateSkaterIds,[]);assert.ok(viewerData.skaters.length>2);assert.equal(viewerData.skaters[0].id,'SK-A');assert.ok(viewerData.rows.every(row=>row.plan===null));
const viewerClub=await clubAPI.GET(new Request('https://hsc-coach-roster.sherrylikeke.chatgpt.site/api/club',{headers:{authorization:'Bearer '+signedToken}})).then(response=>response.json());
assert.deepEqual(viewerClub.plans,[]);assert.deepEqual(viewerClub.writableSkaterIds,[]);assert.deepEqual(viewerClub.ownSkaterIds,['SK-A']);
assert.equal(viewerClub.membershipClaimStatus,'pending');
const {filterHomeSchedule}=await import('../lib/home-schedule.ts');
const prefCall=(body)=>memberRequest(passwordContext,request(null,'home-skater',body));
assert.equal((await prefCall({skaterId:'SK-B',pinned:true,memberId:users.owner.identity.userId,role:'admin'})).status,200);
await prefCall({skaterId:'SK-B',pinned:true});
let homepage=await memberRequest(passwordContext,request(null,'me')).then(response=>response.json());
assert.deepEqual(homepage.preferredSkaterIds.sort(),['SK-A','SK-B']);assert.deepEqual(homepage.skaterIds,[]);assert.equal(homepage.member.role,null);
assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_relations WHERE member_id=?').get(passwordMember.id).count,0);
assert.equal((await prefCall({skaterId:'not-listed',pinned:true})).status,400);
assert.equal((await prefCall({skaterId:'SK-C',pinned:'true'})).status,400);
assert.equal((await memberRequest(passwordContext,request(null,'home-skater',{skaterId:'SK-C',pinned:true},{origin:'https://untrusted.example.test'}))).status,403);
const savedHome=await clubAPI.GET(new Request('https://hsc-coach-roster.sherrylikeke.chatgpt.site/api/club',{headers:{authorization:'Bearer '+signedToken}})).then(response=>response.json());
assert.deepEqual(savedHome.ownSkaterIds.sort(),['SK-A','SK-B']);assert.deepEqual(savedHome.plans,[]);assert.deepEqual(savedHome.writableSkaterIds,[]);
const sampleRows=[{skaterId:'SK-A'},{skaterId:'SK-C'},{skaterId:'SK-B'}];
assert.deepEqual(filterHomeSchedule(sampleRows,homepage.preferredSkaterIds,'mine').map(row=>row.skaterId),['SK-A','SK-B']);
assert.deepEqual(filterHomeSchedule(sampleRows,homepage.preferredSkaterIds,'skater:SK-C').map(row=>row.skaterId),['SK-C']);
assert.deepEqual(filterHomeSchedule(sampleRows,homepage.preferredSkaterIds,'team').map(row=>row.skaterId),['SK-A','SK-B','SK-C']);
assert.deepEqual((await memberRequest(passwordContext,request(null,'me')).then(response=>response.json())).preferredSkaterIds.sort(),['SK-A','SK-B']);
await memberRequest(passwordContext,request(null,'logout',{}));await memberRequest(passwordContext,request(null,'session',{role:'parent'}));
assert.deepEqual((await memberRequest(passwordContext,request(null,'me')).then(response=>response.json())).preferredSkaterIds.sort(),['SK-A','SK-B']);
const secondViewer={identity:identity('second-viewer'),cookie:''};await login(secondViewer,'parent');
database.database.prepare("UPDATE hsc_members SET status='club-viewer' WHERE id=?").run(secondViewer.identity.userId);
assert.deepEqual((await call(secondViewer,'me')).value.preferredSkaterIds,[]);
assert.equal((await call(secondViewer,'me')).value.membershipClaimStatus,null);
await call(secondViewer,'home-skater',{skaterId:'SK-C',pinned:true});
assert.deepEqual((await call(secondViewer,'me')).value.preferredSkaterIds,['SK-C']);
assert.deepEqual((await memberRequest(passwordContext,request(null,'me')).then(response=>response.json())).preferredSkaterIds.sort(),['SK-A','SK-B']);
await prefCall({skaterId:'SK-B',pinned:false});await prefCall({skaterId:'SK-A',pinned:false});
assert.deepEqual((await memberRequest(passwordContext,request(null,'me')).then(response=>response.json())).preferredSkaterIds,[]);
await prefCall({skaterId:'SK-A',pinned:true});
assert.equal((await memberRequest(passwordContext,request(null,'notifications'))).status,403);
assert.equal((await memberRequest(passwordContext,request(null,'admin'))).status,403);
const noMailAuth=createPasswordAuth(database,'isolated-tests-only-secret-0123456789-abcdef','http://127.0.0.1:5173');
assert.equal((await noMailAuth.handler(authRequest('sign-up/email',{...registrationBody,email:'blocked@example.test',username:'blocked.account'}))).status,503);
assert.equal(database.database.prepare('SELECT id FROM hsc_auth_user WHERE email=?').get('blocked@example.test'),undefined);
assert.equal((await noMailAuth.handler(authRequest('send-verification-email',{email:registrationBody.email}))).status,503);
check('multiple homepage skaters persist across sessions and account switches; filters and returning home never change preferences or private permissions; no mail setup never fakes verification or creates unusable new accounts');
globalThis.hscTestAuthSecret=undefined;
check('fresh email accounts immediately read shared club schedules and pin their list match without ChatGPT, while private notes, messages, coach writes and administration remain blocked');
await memberRequest(passwordContext,request(null,'logout',{}));
assert.equal((await memberRequest(passwordContext,request(null,'me'))).status,401);
const spoofedExisting={...passwordIdentity,email:users.owner.identity.email};
assert.equal((await memberRequest({...passwordContext,identity:spoofedExisting},request(null,'session',{role:'admin'}))).status,409);
await call(users.owner,'member',{id:passwordMember.id,role:'parent',status:'active'});
await memberRequest(passwordContext,request(null,'session',{role:'parent'}));
assert.equal((await memberRequest(passwordContext,request(null,'me')).then(response=>response.json())).member.status,'pending-verification');
assert.equal((await memberRequest(passwordContext,request(null,'notifications'))).status,403);
database.database.exec("UPDATE hsc_admissions SET admitted=1 WHERE skater_id='SK-A'");
const passwordInvite=(await call(users.owner,'invite',{email:passwordIdentity.email,role:'parent',skaterIds:['SK-A']},201)).value;
assert.equal((await memberRequest(passwordContext,request(null,'accept-invite',{token:passwordInvite.token}))).status,200);
const verifiedSession=await auth.api.getSession({headers:new Headers({authorization:'Bearer '+signedToken})});
assert.equal(verifiedSession.user.emailVerified,true);
passwordIdentity.authVerified=true;
await memberRequest(passwordContext,request(null,'session',{role:'parent'}));
assert.equal((await memberRequest(passwordContext,request(null,'notifications'))).status,200);
await call(users.owner,'relation',{memberId:passwordMember.id,skaterId:rematchSkaterId,active:true});
globalThis.hscTestAuthSecret='isolated-tests-only-secret-0123456789-abcdef';
globalThis.hscTestHeaders=new Headers();
const nativeRequest=new Request('https://hsc-coach-roster.sherrylikeke.chatgpt.site/api/mobile',{headers:{authorization:'Bearer '+signedToken}});
const sharedDay=new Date(Date.now()+86400000).toISOString().slice(0,10);
const sharedEvent={...fixture,start:sharedDay,end:sharedDay,id:'SO-SHARED',participants:[{...fixture.participants[0],name:'Same Name',skaterIds:['SK-C']}],blocks:[{...fixture.blocks[0],date:sharedDay,category:'NOVICE MEN SHORT',categoryKey:'NOVICE:MEN',group:null,range:null,sourceUrl:'https://skateontario.org/test/shared.pdf',page:1}],startingOrders:[]};
database.database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?)').run(sharedEvent.id,JSON.stringify(sharedEvent),new Date().toISOString());
database.database.prepare('INSERT INTO coach_plans (id,skater_id,event_id,meeting_time,note,revision) VALUES (?,?,?,?,?,1)').run('SO-SHARED|SK-C|NOVICE MEN SHORT:0','SK-C','SO-SHARED',sharedDay+'T09:00','Private shared-event note');
const nativeResponse=await mobileAPI.GET(nativeRequest);
assert.equal(nativeResponse.status,200,await nativeResponse.clone().text());
const nativeData=await nativeResponse.json();
assert.deepEqual(nativeData.privateSkaterIds.sort(),['SK-A',rematchSkaterId].sort());
assert.ok(nativeData.skaters.length>2);assert.deepEqual(nativeData.skaters.slice(0,2).map(skater=>skater.id).sort(),['SK-A',rematchSkaterId].sort());
const sharedSession=nativeData.rows.find(row=>row.skaterId==='SK-C');assert.ok(sharedSession);assert.equal(sharedSession.isOwn,false);assert.equal(sharedSession.plan,null);
assert.ok(!JSON.stringify(nativeData).includes('Private shared-event note'));
assert.equal((await memberAPI.GET(new Request('https://hsc-coach-roster.sherrylikeke.chatgpt.site/api/member?action=me',{headers:{authorization:'Bearer '+signedToken}}))).status,200);
await call(users.owner,'revoke-sessions',{id:passwordMember.id});
assert.equal(await auth.api.getSession({headers:new Headers({authorization:'Bearer '+signedToken})}),null);
assert.equal((await mobileAPI.GET(nativeRequest)).status,401);
globalThis.hscTestAuthSecret=undefined;
const badOrigin=await auth.handler(authRequest('sign-in/username',{username:'fixture.account',password:testPassword},{origin:'https://untrusted.example.test'}));
assert.equal(badOrigin.status,403);
const wrongPassword=await auth.handler(authRequest('sign-in/username',{username:'fixture.account',password:'wrong-password'}));
assert.notEqual(wrongPassword.status,200);
const correctPassword=await auth.handler(authRequest('sign-in/username',{username:'FIXTURE.ACCOUNT',password:testPassword}));
assert.equal(correctPassword.status,200);
const emailSignIn=await auth.handler(authRequest('sign-in/email',{email:passwordIdentity.email,password:testPassword}));
assert.equal(emailSignIn.status,200);assert.equal((await emailSignIn.json()).user.id,signupValue.user.id);
const newSigned=correctPassword.headers.get('set-auth-token');
const signedOut=await auth.handler(authRequest('sign-out',{}, {authorization:'Bearer '+newSigned}));
assert.equal(signedOut.status,200);
assert.equal(await auth.api.getSession({headers:new Headers({authorization:'Bearer '+newSigned})}),null);
check('real password library hashes credentials, normalizes usernames, rejects CSRF/raw bearer tokens, revokes sessions, and never grants roles or merges accounts by email');
const {verificationDelivery}=await import('../lib/verification-mail.ts');
assert.equal(verificationDelivery({}).enabled,false);
assert.equal(verificationDelivery({HSC_EMAIL_VERIFICATION_ENABLED:'true',RESEND_API_KEY:'fixture-only'}).enabled,false);
const providerRequests=[],providerFetch=globalThis.fetch;
const mailConfig={HSC_EMAIL_VERIFICATION_ENABLED:'true',RESEND_API_KEY:'fixture-only',HSC_EMAIL_FROM:'HSC <verify@example.test>'};
try{
  globalThis.fetch=async(url,options)=>{providerRequests.push({url,options});return Response.json({id:'fixture-email'});};
  await verificationDelivery(mailConfig).send('recipient@example.test','https://hsc.example.test/verify');
  assert.equal(providerRequests[0].url,'https://api.resend.com/emails');
  const mailBody=JSON.parse(providerRequests[0].options.body);
  assert.deepEqual(mailBody.to,['recipient@example.test']);assert.equal(mailBody.from,mailConfig.HSC_EMAIL_FROM);assert.ok(mailBody.text.includes('https://hsc.example.test/verify'));
  assert.equal(providerRequests[0].options.headers.Authorization,'Bearer fixture-only');assert.ok(providerRequests[0].options.signal instanceof AbortSignal);
  globalThis.fetch=async()=>new Response('sensitive provider diagnostic',{status:401});
  await assert.rejects(()=>verificationDelivery(mailConfig).send('recipient@example.test','https://hsc.example.test/verify'),error=>error.message==='Verification email could not be sent. Please retry later.');
  globalThis.fetch=async()=>{throw new DOMException('fixture timeout','TimeoutError');};
  await assert.rejects(()=>verificationDelivery(mailConfig).send('recipient@example.test','https://hsc.example.test/verify'),error=>error.name==='TimeoutError');
}finally{globalThis.fetch=providerFetch;}
const failedDeliveryAuth=createPasswordAuth(registrationDatabase,'isolated-tests-only-secret-0123456789-abcdef','http://127.0.0.1:5173',undefined,{enabled:true,registrationEnabled:true,async send(){throw new Error('fixture-only mail failure');}});
const failedDeliveryResponse=await failedDeliveryAuth.handler(authRequest('sign-up/email',{...registrationBody,email:'mail-failure@example.test',username:'mail.failure',skaterName:'Club Skater'},{'cf-connecting-ip':'192.0.2.185'}));
assert.equal(failedDeliveryResponse.status,200);
const failedSignup=await failedDeliveryResponse.json();
assert.equal(failedSignup.registrationMode,'verification');
assert.equal(failedSignup.verificationDelivery,'retry-needed');
assert.equal(failedDeliveryResponse.headers.get('set-auth-token'),null);
const failedUser=registrationDatabase.database.prepare("SELECT id,email_verified FROM hsc_auth_user WHERE email='mail-failure@example.test'").get();
assert.ok(failedUser);assert.equal(failedUser.email_verified,0);
assert.equal(registrationDatabase.database.prepare('SELECT status FROM hsc_members WHERE id=?').get('password:'+failedUser.id).status,'club-viewer');
assert.equal(registrationDatabase.database.prepare('SELECT count(*) AS count FROM hsc_auth_session WHERE user_id=?').get(failedUser.id).count,0);
const failedResend=await failedDeliveryAuth.handler(authRequest('send-verification-email',{email:'mail-failure@example.test',callbackURL:'http://127.0.0.1:5173/verify-email?verified=1'},{'cf-connecting-ip':'192.0.2.187'}));
assert.equal(failedResend.status,503);
assert.equal((await failedResend.json()).code,'MAIL_UNAVAILABLE');
const recoveredResend=await isolatedAuth.handler(authRequest('send-verification-email',{email:'mail-failure@example.test',callbackURL:'http://127.0.0.1:5173/verify-email?verified=1'},{'cf-connecting-ip':'192.0.2.188'}));
assert.equal(recoveredResend.status,200);
const recoveredVerification=verificationLinks.find(link=>link.email==='mail-failure@example.test');
assert.ok(recoveredVerification);
await isolatedAuth.handler(new Request(recoveredVerification.url));
assert.equal(registrationDatabase.database.prepare('SELECT email_verified FROM hsc_auth_user WHERE id=?').get(failedUser.id).email_verified,1);
database.database.prepare('UPDATE hsc_auth_user SET email_verified=0 WHERE id=?').run(signupValue.user.id);
const oldLogin=await noMailAuth.handler(authRequest('sign-in/email',{email:passwordIdentity.email,password:testPassword},{'cf-connecting-ip':'192.0.2.188'}));
assert.equal(oldLogin.status,200);
const oldAccountSession=await noMailAuth.api.getSession({headers:new Headers({authorization:'Bearer '+oldLogin.headers.get('set-auth-token')})});
const oldIdentity={...passwordIdentity,authToken:oldAccountSession.session.token,authVerified:false,emailVerificationRequired:true};
await memberRequest({...passwordContext,identity:oldIdentity},request(null,'session',{role:'parent'}));
assert.equal((await memberRequest({...passwordContext,identity:oldIdentity},request(null,'me'))).status,403);
database.database.prepare('UPDATE hsc_auth_user SET email_verified=1 WHERE id=?').run(signupValue.user.id);
check('mail transport uses stub success, failure and timeout; failed delivery keeps a retryable unverified account, old login survives missing configuration, and activation rejects unverified sessions');
const reminderRule={id:'fixture-rule',member_id:'owner',skater_id:'SK-A',arrival_minutes:90,notify_minutes:180,packing:'Skates, guards, water',enabled:1,revision:1};
const reminderEvent={...fixture,id:'SO-REMINDER',blocks:fixture.blocks.map(block=>({...block,categoryKey:'NOVICE|MEN',group:null,range:null,sourceUrl:'https://skateontario.org/test/schedule.pdf'}))};
const {categoryKey}=await import('../lib/official-parser.ts');
reminderEvent.blocks[0].categoryKey=categoryKey('Novice Men');
const planned=reminderPlans([reminderEvent],[reminderRule],Date.parse('2026-10-20T00:00:00Z'));
assert.equal(planned.length,1);
assert.equal(planned[0].startAt,'2026-11-01T15:00:00.000Z');
assert.equal(planned[0].arrivalAt,'2026-11-01T13:30:00.000Z');
assert.equal(planned[0].notifyAt,'2026-11-01T12:00:00.000Z');
const summer={...reminderEvent,blocks:reminderEvent.blocks.map(block=>({...block,date:'2026-07-01'}))};
assert.equal(reminderPlans([summer],[reminderRule],0)[0].startAt,'2026-07-01T14:00:00.000Z');
for(const [date,start] of [['2026-11-01','01:30'],['2026-03-08','02:30']])assert.equal(reminderPlans([{...reminderEvent,blocks:reminderEvent.blocks.map(block=>({...block,date,start}))}],[reminderRule],0).length,0);
const ambiguous={...reminderEvent,blocks:reminderEvent.blocks.map(block=>({...block,group:3}))};
assert.equal(reminderPlans([ambiguous],[reminderRule],0).length,0);
await call(users.owner,'reminder',{skaterId:'SK-A',arrivalMinutes:30,notifyMinutes:180,packing:'Skates'},400);
await call(users.parent,'reminder',{skaterId:'SK-B',arrivalMinutes:90,notifyMinutes:180,packing:'Skates'},403);
const activeReminderEvent={...reminderEvent,start:sharedDay,end:sharedDay,blocks:reminderEvent.blocks.map(block=>({...block,date:sharedDay}))};
database.database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?)').run(activeReminderEvent.id,JSON.stringify(activeReminderEvent),new Date().toISOString());
database.database.exec("UPDATE hsc_admissions SET admitted=1 WHERE skater_id='SK-A'");
await call(users.owner,'reminder',{skaterId:'SK-A',arrivalMinutes:90,notifyMinutes:180,packing:'Skates, guards, water'});
const firstReminder=(await call(users.owner,'reminders')).value.plans.find(plan=>plan.eventId==='SO-REMINDER');
assert.ok(firstReminder);
await reconcileReminders(database);
assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_outbox WHERE id=?').get(firstReminder.id).count,1);
const moved={...activeReminderEvent,blocks:activeReminderEvent.blocks.map(block=>({...block,start:'11:00',end:'12:00'}))};
await database.batch(eventWriteStatements(database,moved,activeReminderEvent));
await reconcileReminders(database);
assert.equal(database.database.prepare('SELECT state FROM hsc_outbox WHERE id=?').get(firstReminder.id).state,'cancelled');
const nextPlans=(await call(users.owner,'reminders')).value.plans;
assert.equal(nextPlans.find(plan=>plan.eventId==='SO-REMINDER').arrivalAt,new Date(Date.parse(firstReminder.arrivalAt)+3600000).toISOString());
await call(users.owner,'reminder',{skaterId:'SK-A',arrivalMinutes:90,notifyMinutes:180,packing:'Skates',enabled:false});
assert.equal((await call(users.owner,'reminders')).value.plans.length,0);
check('reminders enforce 60-minute arrival, correct Toronto DST, skip uncertain groups, scope personal rules, deduplicate, reschedule and cancel disabled rules');
assert.equal(database.database.prepare("SELECT coach FROM coach_assignments WHERE skater_id='SK-A'").get().coach, 'Jen Jackson/Bryce Davidson');
assert.equal(database.database.prepare("SELECT note FROM coach_plans WHERE id='legacy-plan'").get().note, 'keep this note');
const {pilotInvitationFor,pilotUsedKey}=await import('../lib/pilot-registration.ts');
const {digest:pilotDigest}=await import('../lib/member-access.ts');
const {passwordAuth:runtimePasswordAuth}=await import('../lib/member-runtime.ts');
const pilotEmail='pilot-parent@example.test',pilotToken='a'.repeat(64),coachPilotToken='b'.repeat(64),expiredPilotToken='c'.repeat(64);
const pilotEntry={email:pilotEmail,role:'parent',invitationHash:await pilotDigest(pilotToken),expiresAt:new Date(Date.now()+3600000).toISOString()};
const coachPilotEntry={email:'pilot-coach@example.test',role:'coach',invitationHash:await pilotDigest(coachPilotToken),expiresAt:pilotEntry.expiresAt};
const expiredPilotEntry={email:'expired-pilot@example.test',role:'parent',invitationHash:await pilotDigest(expiredPilotToken),expiresAt:new Date(Date.now()-1000).toISOString()};
const pilotConfiguration=JSON.stringify([pilotEntry,coachPilotEntry,expiredPilotEntry]);
assert.equal(await pilotInvitationFor(pilotConfiguration,''),null);
assert.equal(await pilotInvitationFor(pilotConfiguration,'d'.repeat(64)),null);
assert.equal(await pilotInvitationFor(pilotConfiguration,pilotToken,'another@example.test'),null);
assert.equal(await pilotInvitationFor(pilotConfiguration,expiredPilotToken),null);
assert.equal(await pilotInvitationFor('{bad',pilotToken),null);
assert.equal(await pilotInvitationFor(JSON.stringify([{...pilotEntry,role:'admin'}]),pilotToken),null);
assert.equal(await pilotInvitationFor(JSON.stringify([pilotEntry,{...pilotEntry,role:'coach'}]),pilotToken),null);
assert.equal((await pilotInvitationFor(pilotConfiguration,pilotToken,'PILOT-PARENT@EXAMPLE.TEST')).role,'parent');
check('public pilot links require an unexpired 256-bit token bound to one email and non-admin role; missing, wrong, expired, malformed and ambiguous grants are rejected');
globalThis.hscTestAuthSecret='isolated-tests-only-secret-0123456789-abcdef';
globalThis.hscTestPilotConfiguration=pilotConfiguration;
globalThis.hscTestHeaders=new Headers();
const pilotAuth=runtimePasswordAuth(authRequest('config',{}));
const pilotGetConfig=()=>pilotAuth.handler(new Request('http://127.0.0.1:5173/api/auth/config')).then(response=>response.json());
const pilotPublicConfig=await pilotGetConfig();assert.equal(pilotPublicConfig.pilotRegistrationAllowed,false);assert.ok(!JSON.stringify(pilotPublicConfig).includes(pilotEmail));
const pilotBody={...registrationBody,email:pilotEmail,username:'pilot.parent',role:'parent',skaterName:'Test Alpha',emailVerified:true};
const forbiddenPilot=await pilotAuth.handler(authRequest('sign-up/email',pilotBody,{'cf-connecting-ip':'192.0.2.201','oai-authenticated-user-email':pilotEmail,'oai-authenticated-user-id':'forged'}));
assert.equal(forbiddenPilot.status,503);
const undisclosedName=await pilotAuth.handler(authRequest('sign-up/email',{...pilotBody,skaterName:'Not on the club list'},{'cf-connecting-ip':'192.0.2.219'}));assert.equal(undisclosedName.status,503);assert.equal(await undisclosedName.text(),await forbiddenPilot.clone().text());
assert.equal(database.database.prepare('SELECT id FROM hsc_auth_user WHERE email=?').get(pilotEmail),undefined);
const invitationRequest=(token,ip='192.0.2.210')=>authRequest('pilot-invitation',{token},{'cf-connecting-ip':ip});
assert.equal((await pilotAuth.handler(invitationRequest('d'.repeat(64)))).status,403);
assert.equal((await pilotAuth.handler(invitationRequest(expiredPilotToken))).status,403);
assert.equal((await pilotAuth.handler(authRequest('pilot-invitation',{token:pilotToken},{origin:'https://untrusted.example.test'}))).status,403);
assert.equal((await pilotAuth.handler(authRequest('pilot-invitation',{token:'a'.repeat(600)}))).status,413);
const inviteInfo=await pilotAuth.handler(invitationRequest(pilotToken));assert.equal(inviteInfo.status,200);
const pilotConfig=await inviteInfo.json();assert.equal(pilotConfig.pilotRegistrationAllowed,true);assert.equal(pilotConfig.emailVerificationRequired,false);assert.equal(pilotConfig.pilotRole,'parent');assert.equal(pilotConfig.email,pilotEmail);
assert.ok(!JSON.stringify(pilotConfig).includes(pilotToken));assert.ok(!JSON.stringify(pilotConfig).includes(pilotEntry.invitationHash));
assert.equal(database.database.prepare('SELECT value FROM app_meta WHERE key=?').get(pilotUsedKey(pilotEntry)),undefined);
const invitedPilotBody={...pilotBody,pilotInvitation:pilotToken};
assert.equal((await pilotAuth.handler(authRequest('sign-up/email',{...invitedPilotBody,role:'coach'},{'cf-connecting-ip':'192.0.2.202'}))).status,403);
assert.equal((await pilotAuth.handler(authRequest('sign-up/email',{...invitedPilotBody,email:'other-pilot@example.test'},{'cf-connecting-ip':'192.0.2.203'}))).status,403);
assert.equal((await pilotAuth.handler(authRequest('sign-up/email',invitedPilotBody,{origin:'https://untrusted.example.test','cf-connecting-ip':'192.0.2.204'}))).status,403);
const shortPilotPassword=await pilotAuth.handler(authRequest('sign-up/email',{...invitedPilotBody,password:'short'},{'cf-connecting-ip':'192.0.2.211'}));assert.equal(shortPilotPassword.status,400);
assert.equal(database.database.prepare('SELECT value FROM app_meta WHERE key=?').get(pilotUsedKey(pilotEntry)),undefined);
check('anonymous invitation checks disclose only the token holder email/role, do not consume the link, enforce origin/size limits and do not allow email or role substitution');
const pilotFetch=globalThis.fetch;let pilotExternalCalls=0;
try{
  globalThis.fetch=async()=>{pilotExternalCalls++;throw new Error('Pilot must not send email');};
  const pilotCreated=await pilotAuth.handler(authRequest('sign-up/email',invitedPilotBody,{'cf-connecting-ip':'192.0.2.205'}));
  assert.equal(pilotCreated.status,200,await pilotCreated.clone().text());assert.equal(pilotCreated.headers.get('X-HSC-Registration-Mode'),'pilot');const pilotUser=(await pilotCreated.json()).user;
  assert.equal(pilotUser.emailVerified,false);
  assert.equal(database.database.prepare('SELECT email_verified FROM hsc_auth_user WHERE id=?').get(pilotUser.id).email_verified,0);
  const usedInvitation=database.database.prepare('SELECT value FROM app_meta WHERE key=?').get(pilotUsedKey(pilotEntry));assert.equal(JSON.parse(usedInvitation.value).userId,pilotUser.id);assert.ok(!usedInvitation.value.includes(pilotToken));
  assert.equal((await pilotAuth.handler(invitationRequest(pilotToken))).status,409);
  assert.equal((await pilotAuth.handler(authRequest('sign-up/email',{...invitedPilotBody,password:'Different-Pilot-Password-2026!'},{'cf-connecting-ip':'192.0.2.212'}))).status,409);
  const pilotStoredPassword=database.database.prepare('SELECT password FROM hsc_auth_account WHERE user_id=?').get(pilotUser.id).password;assert.notEqual(pilotStoredPassword,testPassword);
  const pilotLogin=await pilotAuth.handler(authRequest('sign-in/email',{email:pilotEmail,password:testPassword},{'cf-connecting-ip':'192.0.2.206'}));assert.equal(pilotLogin.status,200);
  assert.equal((await pilotAuth.handler(authRequest('sign-in/username',{username:'pilot.parent',password:testPassword},{'cf-connecting-ip':'192.0.2.207'}))).status,200);
  const pilotSession=await pilotAuth.api.getSession({headers:new Headers({authorization:'Bearer '+pilotLogin.headers.get('set-auth-token')})});
  const pilotMemberIdentity={userId:'password:'+pilotUser.id,email:pilotEmail,displayName:'Pilot',provider:'password',authToken:pilotSession.session.token,authVerified:false,emailVerificationRequired:false};
  const pilotContext={database,identity:pilotMemberIdentity,candidates,ownerEmail};
  await memberRequest(pilotContext,request(null,'session',{role:'admin'}));
  const pilotMe=await memberRequest(pilotContext,request(null,'me')).then(response=>response.json());
  assert.equal(pilotMe.member.status,'club-viewer');assert.equal(pilotMe.member.role,null);assert.equal(pilotMe.member.requested_role,'parent');assert.deepEqual(pilotMe.skaterIds,[]);
  assert.equal((await memberRequest(pilotContext,request(null,'admin'))).status,403);
  assert.equal((await memberRequest(pilotContext,request(null,'requirement',{title:'not allowed',body:'no',skaterIds:['SK-A']}))).status,403);
  assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_relations WHERE member_id=?').get(pilotMe.member.id).count,0);
  assert.equal((await pilotAuth.handler(authRequest('send-verification-email',{email:pilotEmail},{'cf-connecting-ip':'192.0.2.208'}))).status,503);
  assert.equal(pilotExternalCalls,0);
  const coachSignup=await pilotAuth.handler(authRequest('sign-up/email',{...pilotBody,email:coachPilotEntry.email,username:'pilot.coach',role:'coach',pilotInvitation:coachPilotToken},{'cf-connecting-ip':'192.0.2.213'}));assert.equal(coachSignup.status,200);
  const coachUser=(await coachSignup.json()).user;const coachMember=database.database.prepare('SELECT role,requested_role,status FROM hsc_members WHERE id=?').get('password:'+coachUser.id);assert.equal(coachMember.role,null);assert.equal(coachMember.requested_role,'coach');assert.equal(coachMember.status,'club-viewer');
  assert.equal(database.database.prepare('SELECT role FROM hsc_members WHERE id=?').get(users.owner.identity.userId).role,'admin');
  globalThis.hscTestPilotConfiguration=undefined;
  assert.equal((await pilotAuth.handler(invitationRequest(coachPilotToken))).status,403);
  assert.equal((await pilotAuth.handler(authRequest('sign-up/email',{...invitedPilotBody,email:'other-pilot@example.test',username:'other.pilot'},{'cf-connecting-ip':'192.0.2.209'}))).status,403);
  check('personal links create hashed-password accounts without platform login or email mail; links become single-use, email stays unverified, parent/coach requests grant no private role and the original administrator survives');
  const publicProtectedChecks=[
    ['club',()=>clubAPI.GET(new Request('https://hsc-coach-roster.sherrylikeke.chatgpt.site/api/club'))],
    ['mobile',()=>mobileAPI.GET(new Request('https://hsc-coach-roster.sherrylikeke.chatgpt.site/api/mobile'))],
    ['coaches',()=>coachAPI.GET(new Request('https://hsc-coach-roster.sherrylikeke.chatgpt.site/api/coaches'))],
    ['members',()=>memberAPI.GET(new Request('https://hsc-coach-roster.sherrylikeke.chatgpt.site/api/member?action=admin'))],
    ['plans',()=>planAPI.POST(new Request('https://hsc-coach-roster.sherrylikeke.chatgpt.site/api/plans',{method:'POST',headers:{Origin:'https://hsc-coach-roster.sherrylikeke.chatgpt.site','Content-Type':'application/json'},body:'{}'}))],
    ['sync',()=>syncAPI.POST(new Request('https://hsc-coach-roster.sherrylikeke.chatgpt.site/api/sync',{method:'POST',headers:{Origin:'https://hsc-coach-roster.sherrylikeke.chatgpt.site','Content-Type':'application/json'},body:'{}'}))],
    ['mcp',()=>mcpAPI.POST(new Request('https://hsc-coach-roster.sherrylikeke.chatgpt.site/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'tools/list'})}))],
  ];
  for(const [name,read] of publicProtectedChecks){const response=await read();assert.equal(response.status,401,name);assert.ok(!/keep this note|Private shared-event note|pilot-parent@example/.test(await response.text()),name);}
  check('opening the public page does not expose club/mobile/member/coach data, plan writes, official sync or MCP to anonymous requests');
}finally{globalThis.fetch=pilotFetch;globalThis.hscTestHeaders=new Headers();globalThis.hscTestPilotConfiguration=undefined;globalThis.hscTestAuthSecret=undefined;}

const resetLinks=[];
const mailOnlyAuth=createPasswordAuth(database,'isolated-tests-only-secret-0123456789-abcdef','http://127.0.0.1:5173',undefined,{...testDelivery,registrationEnabled:false});
assert.equal((await mailOnlyAuth.handler(authRequest('sign-up/email',{...registrationBody,email:'not-open@example.test',username:'not.open'},{'cf-connecting-ip':'192.0.2.240'}))).status,503);
assert.equal(database.database.prepare('SELECT id FROM hsc_auth_user WHERE email=?').get('not-open@example.test'),undefined);
const recoveryAuth=createPasswordAuth(database,'isolated-tests-only-secret-0123456789-abcdef','http://127.0.0.1:5173',undefined,{...testDelivery,async sendReset(email,url){resetLinks.push({email,url});}});
const resetRequest=(email,ip)=>authRequest('request-password-reset',{email,redirectTo:'http://127.0.0.1:5173/reset-password'},{'cf-connecting-ip':ip});
assert.equal((await noMailAuth.handler(resetRequest(pilotEmail,'192.0.2.230'))).status,503);
assert.equal((await recoveryAuth.handler(authRequest('request-password-reset',{email:pilotEmail,redirectTo:'https://untrusted.example.test/reset-password'}))).status,400);
assert.equal((await recoveryAuth.handler(authRequest('send-verification-email',{email:pilotEmail,callbackURL:'https://untrusted.example.test/verify-email'}))).status,400);
const pilotActivated=await recoveryAuth.handler(authRequest('sign-in/email',{email:pilotEmail,password:testPassword},{'cf-connecting-ip':'192.0.2.231'}));
assert.equal(pilotActivated.status,200);
assert.equal((await recoveryAuth.handler(authRequest('sign-in/username',{username:'pilot.parent',password:testPassword},{'cf-connecting-ip':'192.0.2.232'}))).status,200);
const activatedSession=await recoveryAuth.api.getSession({headers:new Headers({authorization:'Bearer '+pilotActivated.headers.get('set-auth-token')})});
assert.equal(activatedSession.user.emailVerified,false);
const {isRegisteredPilot}=await import('../lib/pilot-registration.ts');
assert.equal(await isRegisteredPilot(database,activatedSession.user.id),true);
assert.equal(await isRegisteredPilot(database,signupValue.user.id),false);
assert.equal((await recoveryAuth.handler(resetRequest(pilotEmail,'192.0.2.233'))).status,200);
assert.equal((await recoveryAuth.handler(resetRequest(pilotEmail,'192.0.2.233'))).status,429);
const unknownReset=await recoveryAuth.handler(resetRequest('unknown@example.test','192.0.2.234'));
assert.equal(unknownReset.status,200);assert.equal(resetLinks.length,1);
const resetLink=new URL(resetLinks[0].url);
assert.equal(resetLink.searchParams.get('callbackURL'),'http://127.0.0.1:5173/reset-password');
const resetCallback=await recoveryAuth.handler(new Request(resetLink));
assert.equal(resetCallback.status,302);
const resetToken=new URL(resetCallback.headers.get('location')).searchParams.get('token');assert.ok(resetToken);
const resetPassword='New-Isolated-Password-2026!';
assert.equal((await recoveryAuth.handler(authRequest('reset-password',{token:resetToken,newPassword:resetPassword},{origin:'https://untrusted.example.test'}))).status,403);
assert.equal((await recoveryAuth.handler(authRequest('reset-password',{token:resetToken,newPassword:'short'}))).status,400);
database.database.prepare('UPDATE hsc_auth_verification SET expires_at=? WHERE identifier=?').run(Date.now()-1000,'reset-password:'+resetToken);
assert.equal((await recoveryAuth.handler(authRequest('reset-password',{token:resetToken,newPassword:resetPassword}))).status,400);
assert.equal((await recoveryAuth.handler(resetRequest(pilotEmail,'192.0.2.235'))).status,200);
const freshToken=new URL(resetLinks[1].url).pathname.split('/').pop();
// Disabling new mail must not invalidate an already-issued password reset.
assert.equal((await noMailAuth.handler(authRequest('reset-password',{token:freshToken,newPassword:resetPassword},{'cf-connecting-ip':'192.0.2.236'}))).status,200);
assert.equal((await recoveryAuth.handler(authRequest('reset-password',{token:freshToken,newPassword:resetPassword},{'cf-connecting-ip':'192.0.2.237'}))).status,400);
assert.equal(await recoveryAuth.api.getSession({headers:new Headers({authorization:'Bearer '+pilotActivated.headers.get('set-auth-token')})}),null);
assert.notEqual((await recoveryAuth.handler(authRequest('sign-in/email',{email:pilotEmail,password:testPassword},{'cf-connecting-ip':'192.0.2.238'}))).status,200);
assert.equal((await recoveryAuth.handler(authRequest('sign-in/email',{email:pilotEmail,password:resetPassword},{'cf-connecting-ip':'192.0.2.239'}))).status,200);
assert.equal(database.database.prepare('SELECT email_verified FROM hsc_auth_user WHERE id=?').get(activatedSession.user.id).email_verified,0);
assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_relations WHERE member_id=?').get('password:'+activatedSession.user.id).count,0);
check('registered pilots retain unverified sign-in after mail activation; reset links are private, throttled, expiring and single-use, revoke sessions, reject old passwords and never verify email or grant relationships');
const result = {passed: checks.length, checks, migrations, fixtureOnly: true, externalMessagesSent: 0, legacyDataPreserved: true};
fs.mkdirSync('work', {recursive: true});
fs.writeFileSync('work/phase2-test-results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
