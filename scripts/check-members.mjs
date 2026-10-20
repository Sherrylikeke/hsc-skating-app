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
    if (url === 'test-stub:cloudflare:workers') return {format: 'module', source: 'export const env={get DB(){return globalThis.hscTestDatabase}};', shortCircuit: true};
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
const clubAPI = await import('../app/api/club/route.ts');
const coachAPI = await import('../app/api/coaches/route.ts');
const planAPI = await import('../app/api/plans/route.ts');
const syncAPI = await import('../app/api/sync/route.ts');
const mcpAPI = await import('../app/mcp/route.ts');
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
await route(users.parent, clubAPI.GET, '/api/club?skater=SK-C', undefined, 403, {'oai-authenticated-user-id': 'owner'});
await route(users.skater, clubAPI.GET, '/api/club?skater=SK-B', undefined, 403);
await route(users['other-coach'], clubAPI.GET, '/api/club?skater=SK-A', undefined, 403);
await route(users.parent, coachAPI.POST, '/api/coaches', {changes: []}, 403);
await route(users.parent, planAPI.POST, '/api/plans', {skaterId: 'SK-A'}, 403);
await route(users['other-coach'], planAPI.POST, '/api/plans', {skaterId: 'SK-A'}, 403);
await route(users.coach, syncAPI.POST, '/api/sync', {}, 403);
await route(users.coach, mcpAPI.POST, '/mcp', {method: 'tools/call', params: {name: 'sync_hsc_calendar'}}, 403);
const parentData = await route(users.parent, clubAPI.GET, '/api/club');
assert.equal(parentData.skaters.length, 2);
assert.ok(parentData.skaters.every(row => ['SK-A', 'SK-B'].includes(row.id)));
const ownMember = await actor(database, users.parent.identity, request(users.parent, 'me'));
await assertSkater(database, ownMember, 'SK-A');
await assert.rejects(() => assertSkater(database, ownMember, 'SK-C'));
check('actual legacy API handlers reject cross-skater reads, cross-coach writes, MCP misuse and forged request identity fields');

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
await route(users.parent, clubAPI.GET, '/api/club?skater=SK-A', undefined, 403);
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
assert.equal(database.database.prepare("SELECT coach FROM coach_assignments WHERE skater_id='SK-A'").get().coach, 'Jen Jackson/Bryce Davidson');
assert.equal(database.database.prepare("SELECT note FROM coach_plans WHERE id='legacy-plan'").get().note, 'keep this note');
const result = {passed: checks.length, checks, migrations, fixtureOnly: true, externalMessagesSent: 0, legacyDataPreserved: true};
fs.mkdirSync('work', {recursive: true});
fs.writeFileSync('work/phase2-test-results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
