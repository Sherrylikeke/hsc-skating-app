import {AccessError, accessibleSkaters, schedulePreferences, scheduleSkaterIds, actor, admittedIDs, audit, bodyJSON, digest, failure, idsField, json, nowISO, parseIDs, randomToken, rateLimit, relationStatement, requireRole, roleField, sessionCookie, sessionHash, startSession, stringField} from './member-access.ts';
import type {Candidate, Identity, Member, Role} from './member-access.ts';
import {drainOutbox, listNotifications, markNotification, listRequirements, writeRequirement, receiptRequirement} from './member-messages.ts';
import {listReminders,saveReminder} from './reminders.ts';

type Context = {database: D1Database; identity: Identity | null; candidates: Candidate[]; ownerEmail: string};
type Invite = {id: string; email: string; role: Role; hash: string; skater_ids: string; expires_at: string; status: string; created_by: string};
type Claim = {id: string; member_id: string; kind: string; payload: string; status: string};
function revokePasswordSessions(database:D1Database,memberId:string) {
  return database.prepare("DELETE FROM hsc_auth_session WHERE 'password:'||user_id=? OR user_id IN (SELECT auth_user_id FROM hsc_auth_links WHERE member_id=?)").bind(memberId,memberId);
}

export async function memberRequest(context: Context, request: Request): Promise<Response> {
  try {
    const {database, identity, candidates, ownerEmail} = context;
    const operation = new URL(request.url).searchParams.get('action') || 'me';
    if (request.method === 'POST' && operation === 'session') {
      const body = await bodyJSON(request);
      return await startSession(database, identity, request, roleField(body.role), ownerEmail);
    }
    if (operation === 'identity' && request.method === 'GET') return json({identity: identity ? {name: identity.displayName, email: identity.email, provider:identity.provider || 'chatgpt',canRestore:!identity.provider&&identity.email.toLowerCase()===ownerEmail.toLowerCase()} : null});
    if (operation === 'logout' && request.method === 'POST') {
      await bodyJSON(request);
      // An expired/revoked membership or a full write quota must still allow this device to sign out.
      if(identity){
        await database.prepare('UPDATE hsc_sessions SET revoked_at=? WHERE hash=? AND member_id=? AND revoked_at IS NULL').bind(nowISO(),await sessionHash(request,identity),identity.userId).run();
      }
      return json({ok:true},200,{'Set-Cookie':sessionCookie(request,'',0)});
    }
    const member = await actor(database, identity, request, false);
    if (request.method === 'GET') {
      if (operation === 'me') {
        const allowed = await accessibleSkaters(database, member);
        const {results: claims} = await database.prepare('SELECT id,kind,payload,status,created_at FROM hsc_claims WHERE member_id=? ORDER BY created_at DESC LIMIT 30').bind(member.id).all();
        return json({member, skaterIds: allowed, ...(await schedulePreferences(database,member,allowed)), claims, channels: {inApp: member.status==='active', email: false, webPush: false}, syncIntervalMinutes: 60});
      }
      if (operation === 'match') {
        await rateLimit(database, `match:${member.id}`, 15);
        const name = stringField(new URL(request.url).searchParams.get('name'), 120).normalize('NFKC').toLocaleLowerCase();
        const {results} = await database.prepare('SELECT skater_id,payload FROM hsc_admissions').all<{skater_id: string; payload: string}>();
        const names = new Map(results.map(row => [row.skater_id, JSON.parse(row.payload).name as string]));
        return json({matches: candidates.filter(row => (names.get(row.id) || row.name).normalize('NFKC').toLocaleLowerCase() === name).slice(0, 10).map(row => ({id: row.id, name: names.get(row.id) || row.name, identityPending: row.identityPending || false})), explanation: '姓名仅用于找到候选资料；管理员审核后才能访问赛程。'});
      }
      if (operation === 'admin') return await adminData(database, member, candidates);
      requireRole(member, 'admin', 'coach', 'parent', 'skater');
      if (operation === 'notifications') return json({notifications: await listNotifications(database, member)});
      if (operation === 'requirements') return json({requirements: await listRequirements(database, member)});
      if (operation === 'reminders') return json(await listReminders(database,member));
      throw new AccessError(404, '操作不存在');
    }
    if (request.method !== 'POST') throw new AccessError(405, '请求方法无效');
    const body = await bodyJSON(request);
    await rateLimit(database, `write:${member.id}`, 80);
    if (operation === 'revoke-own-sessions') {
      await database.batch([database.prepare('UPDATE hsc_members SET auth_version=auth_version+1 WHERE id=?').bind(member.id),revokePasswordSessions(database,member.id)]);
      return json({ok: true}, 200, {'Set-Cookie': sessionCookie(request, '', 0)});
    }
    if (operation === 'accept-invite') return await acceptInvite(database, member, stringField(body.token, 100));
    if (operation === 'home-skater') {
      if (!['active','club-viewer'].includes(member.status)) throw new AccessError(403,'Sign in to manage your skater homepage.');
      const skaterId=stringField(body.skaterId,100);
      if(typeof body.pinned!=='boolean'||!candidates.some(candidate=>candidate.id===skaterId))throw new AccessError(400,'Choose a skater on the club list.');
      await database.batch([
        database.prepare('INSERT INTO hsc_home_skaters (id,member_id,skater_id,pinned,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET pinned=excluded.pinned,updated_at=excluded.updated_at').bind(JSON.stringify([member.id,skaterId]),member.id,skaterId,Number(body.pinned),nowISO()),
        audit(database,member.id,'home-skater',skaterId,{pinned:body.pinned}),
      ]);
      return json({preferredSkaterIds:await scheduleSkaterIds(database,member)});
    }
    if (operation === 'claim') return await submitClaim(database, member, body, candidates);
    requireRole(member, 'admin', 'coach', 'parent', 'skater');
    if (operation === 'notification-read') {await markNotification(database, member, stringField(body.id, 500)); return json({ok: true});}
    if (operation === 'requirement') return json({requirement: await writeRequirement(database, member, body)});
    if (operation === 'receipt') {await receiptRequirement(database, member, body); return json({ok: true});}
    if (operation === 'reminder') return json(await saveReminder(database,member,body));
    if (operation === 'unlink-own') {
      requireRole(member, 'coach');
      const skaterId = stringField(body.skaterId, 100);
      await database.batch([database.prepare("UPDATE hsc_relations SET active=0,updated_at=? WHERE member_id=? AND skater_id=? AND kind='coach'").bind(nowISO(), member.id, skaterId), audit(database, member.id, 'coach-unlink', skaterId, {})]);
      return json({ok: true});
    }
    requireRole(member, 'admin');
    return await adminWrite(database, member, operation, body, candidates);
  } catch (error) {return failure(error);}
}

async function adminData(database: D1Database, member: Member, candidates: Candidate[]) {
  requireRole(member, 'admin');
  const [members, admissions, relations, invites, claims, logs, assignments, outbox] = await Promise.all([
    database.prepare("SELECT m.id,m.email,m.name,m.role,m.requested_role,m.status,m.created_at,(SELECT u.email_verified FROM hsc_auth_user u WHERE 'password:'||u.id=m.id OR u.id IN (SELECT auth_user_id FROM hsc_auth_links WHERE member_id=m.id) LIMIT 1) AS email_verified FROM hsc_members m ORDER BY m.created_at DESC").all<Member&{email_verified:number|null}>(),
    database.prepare('SELECT * FROM hsc_admissions').all(),
    database.prepare('SELECT * FROM hsc_relations').all(),
    database.prepare('SELECT id,email,role,skater_ids,expires_at,status,used_by,created_at FROM hsc_invites ORDER BY created_at DESC LIMIT 100').all(),
    database.prepare('SELECT * FROM hsc_claims ORDER BY created_at DESC LIMIT 100').all(),
    database.prepare('SELECT * FROM hsc_audit ORDER BY created_at DESC LIMIT 100').all(),
    database.prepare("SELECT skater_id,coach FROM coach_assignments WHERE coach<>''").all<{coach: string; skater_id: string}>(),
    database.prepare('SELECT state,count(*) AS count FROM hsc_outbox GROUP BY state').all(),
  ]);
  const coaches = [...new Set(assignments.results.flatMap(row => row.coach.split(/\s*(?:\/|／|;|；|&)\s*/)).filter(Boolean))].sort();
  const parentHomes=await Promise.all(members.results.filter(parent=>parent.role==='parent'||!parent.role&&parent.requested_role==='parent').map(async parent=>({memberId:parent.id,skaterIds:await scheduleSkaterIds(database,parent),revision:(await database.prepare('SELECT MAX(updated_at) AS revision FROM hsc_home_skaters WHERE member_id=?').bind(parent.id).first<{revision:string|null}>())?.revision??null})));
  return json({members: members.results, parentHomes, candidates, admissions: admissions.results, relations: relations.results, invites: invites.results, claims: claims.results, logs: logs.results, coachCandidates: coaches, outbox: outbox.results});
}

async function submitClaim(database: D1Database, member: Member, body: Record<string, unknown>, candidates: Candidate[]) {
  if (member.status === 'active') requireRole(member, 'coach');
  await rateLimit(database, `claim:${member.id}`, 5, 3600000);
  const role = roleField(body.role);
  if (role === 'admin' || (member.status === 'active' && role !== 'coach')) throw new AccessError(403, '该身份需要管理员邀请');
  const skaterIds = idsField(body.skaterIds);
  const name = stringField(body.name, 120);
  const note = stringField(body.note, 1000);
  if (skaterIds.some(id => !candidates.some(row => row.id === id))) throw new AccessError(400, '候选资料无效');
  if (role === 'skater' && skaterIds.length > 1) throw new AccessError(400, '选手账号只能申请自己的资料');
  const kind = member.status === 'active' ? 'coach-link' : 'membership';
  if (await database.prepare("SELECT id FROM hsc_claims WHERE member_id=? AND status='pending'").bind(member.id).first()) throw new AccessError(409, '已有待审核申请，请等待管理员处理');
  const id = crypto.randomUUID();
  await database.batch([
    database.prepare('INSERT INTO hsc_claims (id,member_id,kind,payload,status,created_at) VALUES (?,?,?,?,\'pending\',?)').bind(id, member.id, kind, JSON.stringify({role, skaterIds, name, note}), nowISO()),
    audit(database, member.id, 'claim-submit', id, {role, skaterIds, name}),
  ]);
  return json({id, status: 'pending'}, 201);
}

async function acceptInvite(database: D1Database, member: Member, token: string) {
  await rateLimit(database, `invite:${member.id}`, 8);
  const invite = await database.prepare("SELECT * FROM hsc_invites WHERE hash=? AND email=? AND status='pending' AND expires_at>?").bind(await digest(token), member.email.toLowerCase(), nowISO()).first<Invite>();
  if (!invite) throw new AccessError(400, '邀请无效、已使用、已过期，或邀请邮箱与登录邮箱不符');
  const skaterIds = parseIDs(invite.skater_ids);
  await admittedIDs(database, skaterIds);
  if (member.role === 'admin' && invite.role !== 'admin') {
    const administrators = await database.prepare("SELECT count(*) AS count FROM hsc_members WHERE role='admin' AND status='active'").first<{count: number}>();
    if (!administrators || administrators.count < 2) throw new AccessError(409, '必须保留至少一位已启用的管理员');
  }
  const operationId = crypto.randomUUID();
  const gate = 'EXISTS (SELECT 1 FROM hsc_audit WHERE id=?)';
  const statements = [
    database.prepare("INSERT INTO hsc_audit (id,actor_id,action,subject_id,payload,created_at) SELECT ?,?,'invite-accept',?,'{}',? WHERE EXISTS (SELECT 1 FROM hsc_invites WHERE id=? AND status='pending' AND expires_at>?) AND EXISTS (SELECT 1 FROM hsc_members WHERE id=? AND status<>'disabled' AND auth_version=? AND (role IS NULL OR role<>'admin' OR ?='admin' OR (SELECT count(*) FROM hsc_members WHERE role='admin' AND status='active')>1))").bind(operationId, member.id, invite.id, nowISO(), invite.id, nowISO(), member.id, member.auth_version, invite.role),
    database.prepare(`UPDATE hsc_invites SET status='accepted',used_by=? WHERE id=? AND ${gate}`).bind(member.id, invite.id, operationId),
    database.prepare(`UPDATE hsc_members SET role=?,status='active',auth_version=auth_version+1 WHERE id=? AND ${gate}`).bind(invite.role, member.id, operationId),
    database.prepare(`UPDATE hsc_auth_user SET email_verified=1 WHERE email=? AND (id IN (SELECT auth_user_id FROM hsc_auth_links WHERE member_id=?) OR 'password:'||id=?) AND ${gate}`).bind(member.email,member.id,member.id,operationId),
    database.prepare(`UPDATE hsc_relations SET active=0 WHERE member_id=? AND (kind<>? OR ?='skater') AND ${gate}`).bind(member.id, invite.role, invite.role, operationId),
    ...skaterIds.map(id => database.prepare(`INSERT INTO hsc_relations (id,member_id,skater_id,kind,active,approved_by,updated_at) SELECT ?,?,?,?,1,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET active=1,approved_by=excluded.approved_by,updated_at=excluded.updated_at`).bind(`${member.id}|${invite.role}|${id}`, member.id, id, invite.role, invite.created_by, nowISO(), operationId)),
  ];
  const result = await database.batch(statements);
  if (!result[0].meta.changes) throw new AccessError(409, '邀请已处理，请重新登录');
  return json({ok: true, reauthenticate: true});
}

async function adminWrite(database: D1Database, member: Member, operation: string, body: Record<string, unknown>, candidates: Candidate[]) {
  if(operation==='parent-home-skaters'){
    const memberId=stringField(body.memberId,100),ids=idsField(body.skaterIds);
    const target=await database.prepare('SELECT * FROM hsc_members WHERE id=?').bind(memberId).first<Member>();
    if(!target||!(target.role==='parent'||!target.role&&target.requested_role==='parent')||!['active','club-viewer','pending'].includes(target.status))throw new AccessError(400,'Choose a registered parent account that is not disabled.');
    if(ids.some(id=>!candidates.some(candidate=>candidate.id===id)))throw new AccessError(400,'Choose skaters on the club list.');
    if(body.revision!==null&&typeof body.revision!=='string')throw new AccessError(400,'Reload the parent account before saving.');
    const previous=await scheduleSkaterIds(database,target);
    const operationId=crypto.randomUUID(),time=new Date(Math.max(Date.now(),(Date.parse(String(body.revision))||0)+1)).toISOString();
    const gate='EXISTS(SELECT 1 FROM hsc_audit WHERE id=?)';
    const allIds=[...new Set([...candidates.map(candidate=>candidate.id),...previous])];
    const result=await database.batch([
      database.prepare("INSERT INTO hsc_audit(id,actor_id,action,subject_id,payload,created_at) SELECT ?,?,'parent-home-skaters',?,?,? WHERE COALESCE((SELECT MAX(updated_at) FROM hsc_home_skaters WHERE member_id=?),'')=?")
        .bind(operationId,member.id,memberId,JSON.stringify({before:previous,after:ids,access:'homepage-only'}),time,memberId,body.revision??''),
      database.prepare(`INSERT INTO hsc_home_skaters(id,member_id,skater_id,pinned,updated_at) SELECT json_array(?,value),?,value,CASE WHEN value IN (SELECT value FROM json_each(?)) THEN 1 ELSE 0 END,? FROM json_each(?) WHERE ${gate} ON CONFLICT(id) DO UPDATE SET pinned=excluded.pinned,updated_at=excluded.updated_at`)
        .bind(memberId,memberId,JSON.stringify(ids),time,JSON.stringify(allIds),operationId),
    ]);
    if(!result[0].meta.changes)throw new AccessError(409,'This parent’s skaters changed in another window. Reload before saving.');
    return json({preferredSkaterIds:await scheduleSkaterIds(database,target)});
  }
  if (operation === 'admission') {
    const id = stringField(body.skaterId, 100);
    const candidate = candidates.find(row => row.id === id);
    const existing = await database.prepare('SELECT skater_id,payload FROM hsc_admissions WHERE skater_id=?').bind(id).first<{payload: string}>();
    if (!candidate && !existing && !/^HSC-NEW-[a-f0-9-]{36}$/.test(id)) throw new AccessError(400, '新增选手需要新的资料编号');
    const name = stringField(body.name || candidate?.name, 120);
    const payload = {name, training: body.training === true, identityPending: body.identityPending === true, representedClubs: stringField(body.representedClubs, 500, true)};
    await database.batch([
      database.prepare('INSERT INTO hsc_admissions (skater_id,admitted,payload,updated_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(skater_id) DO UPDATE SET admitted=excluded.admitted,payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(id, body.admitted === true ? 1 : 0, JSON.stringify(payload), member.id, nowISO()),
      audit(database, member.id, 'admission', id, {admitted: body.admitted === true, before: existing?.payload || candidate, after: payload}),
    ]);
    return json({ok: true});
  }
  if (operation === 'invite') {
    const email = stringField(body.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccessError(400, '邮箱格式无效');
    const role = roleField(body.role);
    const skaterIds = idsField(body.skaterIds);
    if (role === 'skater' && skaterIds.length !== 1) throw new AccessError(400, '选手邀请必须明确绑定一个选手');
    if (role === 'admin' && skaterIds.length) throw new AccessError(400, '管理员邀请不绑定选手');
    await admittedIDs(database, skaterIds);
    await database.prepare("UPDATE hsc_invites SET status='expired' WHERE email=? AND status='pending' AND expires_at<=?").bind(email, nowISO()).run();
    if (await database.prepare("SELECT id FROM hsc_invites WHERE email=? AND status='pending' AND expires_at>?").bind(email, nowISO()).first()) throw new AccessError(409, '该邮箱已有有效邀请，请先撤销旧邀请');
    const id = crypto.randomUUID();
    const token = randomToken();
    const hours = body.hours === undefined ? 48 : Number(body.hours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw new AccessError(400, '邀请有效期为1至168小时');
    const expires = new Date(Date.now() + hours * 3600000).toISOString();
    await database.batch([
      database.prepare('INSERT INTO hsc_invites (id,email,role,hash,skater_ids,expires_at,status,created_by,created_at) VALUES (?,?,?,?,?,?,\'pending\',?,?)').bind(id, email, role, await digest(token), JSON.stringify(skaterIds), expires, member.id, nowISO()),
      audit(database, member.id, 'invite-create', id, {email, role, skaterIds, expires}),
    ]);
    return json({id, token, expiresAt: expires, delivery: 'manual'}, 201);
  }
  if (operation === 'revoke-invite') {
    const id = stringField(body.id, 100);
    await database.batch([database.prepare("UPDATE hsc_invites SET status='revoked' WHERE id=? AND status='pending'").bind(id), audit(database, member.id, 'invite-revoke', id, {})]);
    return json({ok: true});
  }
  if (operation === 'review-claim') {
    const id = stringField(body.id, 100);
    const claim = await database.prepare("SELECT * FROM hsc_claims WHERE id=? AND status='pending'").bind(id).first<Claim>();
    if (!claim) throw new AccessError(409, '申请已处理或不存在');
    const requested = JSON.parse(claim.payload) as {role: Role; skaterIds: string[]};
    const accepted = body.approve === true;
    const ids = idsField(body.skaterIds ?? requested.skaterIds);
    const target = await database.prepare('SELECT * FROM hsc_members WHERE id=?').bind(claim.member_id).first<Member>();
    if (!target || target.status === 'disabled' || (claim.kind === 'membership' && !['pending','club-viewer'].includes(target.status))) throw new AccessError(400, '申请账号状态已变更，请重新核对');
    if (accepted) {
      if (requested.role === 'admin' || (claim.kind === 'coach-link' && target.role !== 'coach')) throw new AccessError(400, '申请身份已变更，请重新核对');
      if (requested.role === 'skater' && ids.length !== 1) throw new AccessError(400, '请明确选手账号的唯一资料');
      await admittedIDs(database, ids);
    }
    const operationId = crypto.randomUUID();
    const gate = 'EXISTS (SELECT 1 FROM hsc_audit WHERE id=?)';
    const statements = [database.prepare("INSERT INTO hsc_audit (id,actor_id,action,subject_id,payload,created_at) SELECT ?,?,'claim-review',?,?,? WHERE EXISTS (SELECT 1 FROM hsc_claims WHERE id=? AND status='pending')").bind(operationId, member.id, id, JSON.stringify({accepted, ids}), nowISO(), id),database.prepare(`UPDATE hsc_claims SET status=?,reviewed_by=? WHERE id=? AND ${gate}`).bind(accepted ? 'approved' : 'rejected', member.id, id, operationId)];
    if (accepted) {
      if (claim.kind === 'membership') statements.push(database.prepare(`UPDATE hsc_members SET role=?,status='active',auth_version=auth_version+1 WHERE id=? AND status IN ('pending','club-viewer') AND ${gate}`).bind(requested.role, claim.member_id, operationId));
      statements.push(...ids.map(skaterId => database.prepare(`INSERT INTO hsc_relations (id,member_id,skater_id,kind,active,approved_by,updated_at) SELECT ?,?,?,?,1,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET active=1,approved_by=excluded.approved_by,updated_at=excluded.updated_at`).bind(`${claim.member_id}|${requested.role}|${skaterId}`, claim.member_id, skaterId, requested.role, member.id, nowISO(), operationId)));
    }
    const result=await database.batch(statements);
    if(!result[0].meta.changes)throw new AccessError(409,'申请已被其他管理员处理');
    return json({ok: true});
  }
  if (operation === 'member') {
    const id = stringField(body.id, 100);
    const target = await database.prepare('SELECT * FROM hsc_members WHERE id=?').bind(id).first<Member>();
    if (!target) throw new AccessError(404, '账号不存在');
    const role = roleField(body.role);
    const status = body.status === 'active' ? 'active' : body.status === 'disabled' ? 'disabled' : null;
    if (!status) throw new AccessError(400, '账号状态无效');
    const result = await database.batch([
      database.prepare("UPDATE hsc_members SET role=?,status=?,auth_version=auth_version+1 WHERE id=? AND (role<>'admin' OR role IS NULL OR ?='admin' AND ?='active' OR (SELECT count(*) FROM hsc_members WHERE role='admin' AND status='active')>1) RETURNING id").bind(role, status, id, role, status),
      database.prepare('UPDATE hsc_relations SET active=0 WHERE member_id=? AND ?<>?').bind(id, target.role, role),
      audit(database, member.id, 'member-update', id, {before: {role: target.role, status: target.status}, role, status}),
    ]);
    if (!result[0].results.length) throw new AccessError(409, '必须保留至少一位已启用的管理员');
    return json({ok: true});
  }
  if (operation === 'revoke-sessions') {
    const id = stringField(body.id, 100);
    await database.batch([database.prepare('UPDATE hsc_members SET auth_version=auth_version+1 WHERE id=?').bind(id),revokePasswordSessions(database,id),audit(database, member.id, 'sessions-revoke', id, {})]);
    return json({ok: true});
  }
  if (operation === 'relation') {
    const targetId = stringField(body.memberId, 100);
    const skaterId = stringField(body.skaterId, 100);
    const target = await database.prepare("SELECT * FROM hsc_members WHERE id=? AND status='active'").bind(targetId).first<Member>();
    if (!target?.role || target.role === 'admin') throw new AccessError(400, '请先启用并核对账号身份');
    if (body.active === true) {
      await admittedIDs(database, [skaterId]);
      if (target.role === 'skater' && (await accessibleSkaters(database, target)).some(id => id !== skaterId)) throw new AccessError(409, '选手账号只能绑定自己的一个资料');
    }
    await database.batch([
      body.active === true ? relationStatement(database, targetId, skaterId, target.role, member.id) : database.prepare('UPDATE hsc_relations SET active=0,updated_at=? WHERE member_id=? AND skater_id=?').bind(nowISO(), targetId, skaterId),
      audit(database, member.id, 'relation-update', targetId, {skaterId, active: body.active === true, role: target.role}),
    ]);
    return json({ok: true});
  }
  if (operation === 'drain') return json(await drainOutbox(database));
  throw new AccessError(404, '操作不存在');
}
