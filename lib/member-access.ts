export type Role = 'admin' | 'parent' | 'skater' | 'coach';
export type Identity = {userId: string; email: string; displayName: string; provider?: 'password'; authToken?: string; authVerified?:boolean};
export type Member = {id: string; email: string; name: string; role: Role | null; requested_role: Role; status: string; auth_version: number};
export type Candidate = {id: string; name: string; identityPending?: boolean; training?: boolean; coach?: string};
export class AccessError extends Error {
  constructor(public status: number, message: string) {super(message);}
}
export const nowISO = () => new Date().toISOString();
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('');
export const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
export const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(value, {status, headers: {'Cache-Control': 'private, no-store', ...headers}});
export const failure = (error: unknown) => json({error: error instanceof AccessError ? error.message : '操作暂未完成，请重试'}, error instanceof AccessError ? error.status : 503);
export function requireRole(member: Member, ...roles: Role[]) {
  if (member.status !== 'active' || !member.role || !roles.includes(member.role)) throw new AccessError(403, '此账号没有该操作权限');
}
export function checkWrite(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new AccessError(403, '请求来源无效，请从本站操作');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AccessError(415, '请使用 JSON');
}
export async function bodyJSON(request: Request): Promise<Record<string, unknown>> {
  checkWrite(request);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 65536) throw new AccessError(413, '提交内容过长');
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {throw new AccessError(400, '提交格式无效');}
}
export function stringField(value: unknown, max = 1500, optional = false): string {
  if (optional && (value === null || value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.length > max || /\x00/.test(value)) throw new AccessError(400, '请填写有效内容');
  return value.trim();
}
export function roleField(value: unknown): Role {
  if (!['admin', 'parent', 'skater', 'coach'].includes(String(value))) throw new AccessError(400, '身份无效');
  return value as Role;
}
export function idsField(value: unknown, max = 108): string[] {
  if (!Array.isArray(value) || value.length > max || value.some(item => typeof item !== 'string' || !item || item.length > 100)) throw new AccessError(400, '选手名单格式无效');
  return [...new Set(value as string[])];
}
export const parseIDs = (value: string): string[] => JSON.parse(value);
export function audit(database: D1Database, actor: string, action: string, subject: string, payload: unknown) {
  return database.prepare('INSERT INTO hsc_audit (id,actor_id,action,subject_id,payload,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(), actor, action, subject, JSON.stringify(payload), nowISO());
}
export async function rateLimit(database: D1Database, key: string, limit = 20, interval = 600000) {
  const time = Date.now();
  const id = `${key}:${Math.floor(time / interval)}`;
  const row = await database.prepare('INSERT INTO hsc_rate_limits (id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(id, time + interval).first<{count: number}>();
  if (!row || row.count > limit) throw new AccessError(429, '操作过于频繁，请稍后重试');
}
export function cookieName(request: Request) {
  return new URL(request.url).protocol === 'https:' ? '__Host-hsc_session' : 'hsc_session';
}
export function sessionCookie(request: Request, token: string, age = 28800) {
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
function cookieToken(request: Request) {
  const name = cookieName(request) + '=';
  return (request.headers.get('cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith(name))?.slice(name.length) || '';
}
export async function sessionHash(request: Request, identity?: Identity | null) {return digest(identity?.authToken ? 'password:' + identity.authToken : cookieToken(request));}
export async function actor(database: D1Database, identity: Identity | null, request: Request, active = true): Promise<Member> {
  if (!identity) throw new AccessError(401, '请先使用邮箱或用户名登录');
  const member = await database.prepare('SELECT m.* FROM hsc_members m JOIN hsc_sessions s ON s.member_id=m.id AND s.auth_version=m.auth_version WHERE m.id=? AND lower(m.email)=? AND s.hash=? AND s.revoked_at IS NULL AND s.expires_at>?').bind(identity.userId, identity.email.toLowerCase(), await sessionHash(request, identity), nowISO()).first<Member>();
  if (!member) throw new AccessError(401, '请进入会员入口重新登录');
  if (member.status === 'disabled') throw new AccessError(403, '账号已停用，请联系管理员');
  if (identity.provider==='password'&&!identity.authVerified&&member.status==='active') {
    if(active)throw new AccessError(403,'Confirm account ownership using an administrator-issued invitation before accessing private records.');
    return {...member,status:'pending-verification'};
  }
  if (active && member.status !== 'club-viewer' && (member.status !== 'active' || !member.role)) throw new AccessError(403, '账号正在等待管理员批准');
  return member;
}
export async function accessibleSkaters(database: D1Database, member: Member): Promise<string[]> {
  if (member.role === 'admin' && member.status === 'active') return [];
  if (member.status !== 'active' || !member.role) return [];
  const {results} = await database.prepare('SELECT r.skater_id FROM hsc_relations r JOIN hsc_admissions a ON a.skater_id=r.skater_id AND a.admitted=1 WHERE r.member_id=? AND r.kind=? AND r.active=1').bind(member.id, member.role).all<{skater_id: string}>();
  return results.map(row => row.skater_id);
}
export async function assertSkater(database: D1Database, member: Member, skaterId: string, write = false) {
  requireRole(member, ...(write ? ['admin', 'coach'] as Role[] : ['admin', 'coach', 'parent', 'skater'] as Role[]));
  if (member.role !== 'admin' && !(await accessibleSkaters(database, member)).includes(skaterId)) throw new AccessError(403, '无权访问该选手');
}
export async function scheduleSkaterIds(database:D1Database,member:Member):Promise<string[]> {
  if(member.status!=='club-viewer')return accessibleSkaters(database,member);
  const claim=await database.prepare("SELECT payload FROM hsc_claims WHERE member_id=? AND kind='membership' ORDER BY created_at DESC LIMIT 1").bind(member.id).first<{payload:string}>();
  const ids=claim?JSON.parse(claim.payload).skaterIds:[];
  return Array.isArray(ids)?ids.filter((id:unknown):id is string=>typeof id==='string'):[];
}
export async function admittedIDs(database: D1Database, ids: string[]) {
  const {results} = await database.prepare('SELECT skater_id FROM hsc_admissions WHERE admitted=1 AND skater_id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all<{skater_id: string}>();
  if (ids.some(id => !results.some(row => row.skater_id === id))) throw new AccessError(400, '请先由管理员确认选手会员准入');
}
export function relationStatement(database: D1Database, memberId: string, skaterId: string, kind: Role, approvedBy: string) {
  if (kind === 'admin') throw new AccessError(400, '管理员不使用选手绑定');
  return database.prepare('INSERT INTO hsc_relations (id,member_id,skater_id,kind,active,approved_by,updated_at) VALUES (?,?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET active=1,approved_by=excluded.approved_by,updated_at=excluded.updated_at').bind(`${memberId}|${kind}|${skaterId}`, memberId, skaterId, kind, approvedBy, nowISO());
}
export async function startSession(database: D1Database, identity: Identity | null, request: Request, requestedRole: Role, ownerEmail: string) {
  if (!identity) throw new AccessError(401, '请先使用邮箱或用户名登录');
  await rateLimit(database, `session:${identity.userId}`, 15);
  const time = nowISO();
  const collision = await database.prepare('SELECT id FROM hsc_members WHERE lower(email)=? AND id<>?').bind(identity.email.toLowerCase(), identity.userId).first();
  if (collision) throw new AccessError(409, 'An account already uses this email. Sign in or contact the club administrator. Accounts are never merged by email alone.');
  await database.prepare('INSERT INTO hsc_members (id,email,name,requested_role,status,created_at) VALUES (?,?,?,?,\'pending\',?) ON CONFLICT(id) DO NOTHING').bind(identity.userId, identity.email.toLowerCase(), identity.displayName, requestedRole, time).run();
  if (!identity.provider && identity.email.toLowerCase() === ownerEmail.toLowerCase()) {
    await database.batch([
      database.prepare("INSERT INTO hsc_audit (id,actor_id,action,subject_id,payload,created_at) SELECT ?,?,'owner-bootstrap',?,'{}',? WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key='hsc-admin-bootstrap')").bind(crypto.randomUUID(), identity.userId, identity.userId, time),
      database.prepare("UPDATE hsc_members SET role='admin',status='active' WHERE id=? AND NOT EXISTS (SELECT 1 FROM app_meta WHERE key='hsc-admin-bootstrap')").bind(identity.userId),
      database.prepare("INSERT INTO app_meta (key,value) SELECT 'hsc-admin-bootstrap',? WHERE NOT EXISTS (SELECT 1 FROM app_meta WHERE key='hsc-admin-bootstrap')").bind(identity.userId),
    ]);
  }
  const member = await database.prepare('SELECT * FROM hsc_members WHERE id=?').bind(identity.userId).first<Member>();
  if (!member || member.email.toLowerCase() !== identity.email.toLowerCase() || member.status === 'disabled') throw new AccessError(403, '账号不可用，请联系管理员');
  const token = randomToken();
  await database.batch([
    database.prepare('INSERT INTO hsc_sessions (hash,member_id,auth_version,expires_at,created_at) VALUES (?,?,?,?,?) ON CONFLICT(hash) DO UPDATE SET auth_version=excluded.auth_version,expires_at=excluded.expires_at,revoked_at=NULL').bind(identity.authToken ? await sessionHash(request, identity) : await digest(token), member.id, member.auth_version, new Date(Date.now() + 28800000).toISOString(), time),
    database.prepare('DELETE FROM hsc_sessions WHERE expires_at<?').bind(time),
    database.prepare('DELETE FROM hsc_rate_limits WHERE expires_at<?').bind(Date.now()),
  ]);
  return json({member}, 200, identity.authToken ? {} : {'Set-Cookie': sessionCookie(request, token)});
}
