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
        const candidate = new URL(specifier + '.ts', context.parentURL);
        if (fs.existsSync(candidate)) return {url: candidate.href, shortCircuit: true};
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (url === 'test-stub:cloudflare:workers') return {format: 'module', source: 'export const env={get DB(){return globalThis.hscTestDatabase},get BETTER_AUTH_SECRET(){return globalThis.hscTestAuthSecret}};', shortCircuit: true};
    if (url === 'test-stub:next/headers') return {format: 'module', source: 'export async function headers(){return globalThis.hscTestHeaders}', shortCircuit: true};
    if (url === 'test-stub:next/navigation') return {format: 'module', source: 'export function redirect(path){throw new Error(path)}', shortCircuit: true};
    if (url.startsWith('file:') && url.endsWith('.json')) return {format: 'module', source: 'export default ' + fs.readFileSync(new URL(url), 'utf8'), shortCircuit: true};
    if (url.startsWith('file:') && url.endsWith('.ts')) return {format: 'module', source: ts.transpileModule(fs.readFileSync(new URL(url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText, shortCircuit: true};
    return next(url, context);
  },
});
const {memberRequest} = await import('../lib/member-admin.ts');
const {actor, accessibleSkaters, assertSkater} = await import('../lib/member-access.ts');
const {drainOutbox} = await import('../lib/member-messages.ts');
const {eventWriteStatements} = await import('../lib/change-notifications.ts');
const {syncEvent} = await import('../lib/official-sync.ts');
const {createPasswordAuth} = await import('../lib/password-auth.ts');
const {registrationEligibility} = await import('../lib/registration.ts');
const {reminderPlans,reconcileReminders} = await import('../lib/reminders.ts');
const clubAPI = await import('../app/api/club/route.ts');
const coachAPI = await import('../app/api/coaches/route.ts');
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
const auth=createPasswordAuth(database,'isolated-tests-only-secret-0123456789-abcdef','http://127.0.0.1:5173');
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
for(const role of ['skater','parent','coach'])assert.equal((await registrationEligibility(registrationDatabase,{role,skaterName:'  CLUB  SKATER '},role)).skaterId,'approved');
for(const skaterName of ['External Skater','Unknown Identity','Candidate Only','Same Name','Missing Name'])await assert.rejects(()=>registrationEligibility(registrationDatabase,{role:'parent',skaterName},skaterName),error=>error.status===403);
const isolatedAuth=createPasswordAuth(registrationDatabase,'isolated-tests-only-secret-0123456789-abcdef','http://127.0.0.1:5173');
const limitedRequest=authRequest('sign-up/email',{...registrationBody,skaterName:'Missing Name'},{'cf-connecting-ip':'192.0.2.120'});
for(let attempt=0;attempt<8;attempt++)assert.equal((await isolatedAuth.handler(limitedRequest.clone())).status,403);
assert.equal((await isolatedAuth.handler(limitedRequest.clone())).status,429);
assert.equal(registrationDatabase.database.prepare('SELECT count(*) AS count FROM hsc_auth_user').get().count,0);
const beforeRegistrationCount=database.database.prepare('SELECT count(*) AS count FROM hsc_auth_user').get().count;
for(const route of ['sign-up/email/','sign-up/email//','sign-up%2Femail','SIGN-UP/EMAIL','/sign-up/email']) {
  const rejected=await auth.handler(authRequest(route,{...registrationBody,role:'admin'}));
  assert.equal(rejected.ok,false,'Registration gate bypass at '+route);
}
for(const [index,invalid] of [{role:'admin'},{role:'outsider'},{skaterName:''},{skaterName:'Not In Club'},{skaterName:'Nathaniel'},{skaterName:'Same Name'},{skaterName:'Test Alpha'},{role:'admin',linkExisting:true}].entries()) {
  const rejected=await auth.handler(authRequest('sign-up/email',{...registrationBody,...invalid},{'cf-connecting-ip':'192.0.2.'+(80+index)}));
  assert.ok([400,403].includes(rejected.status),await rejected.text());
}
assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_auth_user').get().count,beforeRegistrationCount);
const admission=database.database.prepare("SELECT payload FROM hsc_admissions WHERE skater_id='SK-A'").get();
const originalAdmission=JSON.parse(admission.payload);
database.database.prepare("UPDATE hsc_admissions SET admitted=1,payload=? WHERE skater_id='SK-A'").run(JSON.stringify({...originalAdmission,training:true}));
const signup=await auth.handler(authRequest('sign-up/email',{...registrationBody,skaterName:'  TEST   ALPHA  '}));
assert.equal(signup.status,200,await signup.clone().text());
const signupValue=await signup.json();
assert.equal(signupValue.user.emailVerified,false);
assert.match(signup.headers.get('set-cookie'),/HttpOnly/i);
const signedToken=signup.headers.get('set-auth-token');
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
assert.equal(passwordMember.status,'pending');
assert.equal(passwordMember.requested_role,'parent');
const registrationClaim=database.database.prepare("SELECT payload FROM hsc_claims WHERE member_id=? AND kind='membership'").get(passwordMember.id);
assert.deepEqual(JSON.parse(registrationClaim.payload).skaterIds,['SK-A']);
assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_relations WHERE member_id=?').get(passwordMember.id).count,0);
check('registration rejects invalid roles, missing/unapproved/ambiguous skaters before account creation; an approved club match records only a pending request');
assert.equal((await memberRequest(passwordContext,request(null,'me'))).status,200);
assert.equal((await memberRequest(passwordContext,request(null,'admin'))).status,403);
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
const sharedEvent={...fixture,id:'SO-SHARED',participants:[{...fixture.participants[0],name:'Same Name',skaterIds:['SK-C']}],blocks:[{...fixture.blocks[0],category:'NOVICE MEN SHORT',categoryKey:'NOVICE:MEN',group:null,range:null,sourceUrl:'https://skateontario.org/test/shared.pdf',page:1}],startingOrders:[]};
database.database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?)').run(sharedEvent.id,JSON.stringify(sharedEvent),new Date().toISOString());
database.database.prepare('INSERT INTO coach_plans (id,skater_id,event_id,meeting_time,note,revision) VALUES (?,?,?,?,?,1)').run('SO-SHARED|SK-C|NOVICE MEN SHORT:0','SK-C','SO-SHARED','2026-11-01T09:00','Private shared-event note');
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
const newSigned=correctPassword.headers.get('set-auth-token');
const signedOut=await auth.handler(authRequest('sign-out',{}, {authorization:'Bearer '+newSigned}));
assert.equal(signedOut.status,200);
assert.equal(await auth.api.getSession({headers:new Headers({authorization:'Bearer '+newSigned})}),null);
check('real password library hashes credentials, normalizes usernames, rejects CSRF/raw bearer tokens, revokes sessions, and never grants roles or merges accounts by email');
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
database.database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?)').run(reminderEvent.id,JSON.stringify(reminderEvent),new Date().toISOString());
database.database.exec("UPDATE hsc_admissions SET admitted=1 WHERE skater_id='SK-A'");
await call(users.owner,'reminder',{skaterId:'SK-A',arrivalMinutes:90,notifyMinutes:180,packing:'Skates, guards, water'});
const firstReminder=(await call(users.owner,'reminders')).value.plans.find(plan=>plan.eventId==='SO-REMINDER');
assert.ok(firstReminder);
await reconcileReminders(database);
assert.equal(database.database.prepare('SELECT count(*) AS count FROM hsc_outbox WHERE id=?').get(firstReminder.id).count,1);
const moved={...reminderEvent,blocks:reminderEvent.blocks.map(block=>({...block,start:'11:00',end:'12:00'}))};
await database.batch(eventWriteStatements(database,moved,reminderEvent));
await reconcileReminders(database);
assert.equal(database.database.prepare('SELECT state FROM hsc_outbox WHERE id=?').get(firstReminder.id).state,'cancelled');
const nextPlans=(await call(users.owner,'reminders')).value.plans;
assert.equal(nextPlans.find(plan=>plan.eventId==='SO-REMINDER').arrivalAt,'2026-11-01T14:30:00.000Z');
await call(users.owner,'reminder',{skaterId:'SK-A',arrivalMinutes:90,notifyMinutes:180,packing:'Skates',enabled:false});
assert.equal((await call(users.owner,'reminders')).value.plans.length,0);
check('reminders enforce 60-minute arrival, correct Toronto DST, skip uncertain groups, scope personal rules, deduplicate, reschedule and cancel disabled rules');
assert.equal(database.database.prepare("SELECT coach FROM coach_assignments WHERE skater_id='SK-A'").get().coach, 'Jen Jackson/Bryce Davidson');
assert.equal(database.database.prepare("SELECT note FROM coach_plans WHERE id='legacy-plan'").get().note, 'keep this note');
const result = {passed: checks.length, checks, migrations, fixtureOnly: true, externalMessagesSent: 0, legacyDataPreserved: true};
fs.mkdirSync('work', {recursive: true});
fs.writeFileSync('work/phase2-test-results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
