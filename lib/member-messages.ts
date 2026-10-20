import {AccessError, accessibleSkaters, admittedIDs, assertSkater, idsField, nowISO, parseIDs, requireRole, stringField} from './member-access.ts';
import type {Member} from './member-access.ts';
import {reconcileReminders,reminderIsCurrent} from './reminders.ts';

type Requirement = {id: string; author_id: string; title: string; body: string; skater_ids: string; event_id: string | null; slot_key: string | null; due_at: string | null; state: string; revision: number; created_at: string; updated_at: string};
type Outbox = {id: string; kind: string; subject_id: string; skater_id: string; author_id: string | null; payload: string; attempts: number};
type Notification = {id: string; skater_id: string; kind: string; author_id: string | null; payload: string; read_at: string | null; created_at: string};
export function outboxStatement(database: D1Database, input: {id: string; kind: string; subjectId: string; skaterId: string; authorId?: string; payload: unknown}, gate?: string) {
  const values = [input.id, input.kind, input.subjectId, input.skaterId, input.authorId || null, JSON.stringify(input.payload), nowISO(), nowISO()];
  return database.prepare(`INSERT INTO hsc_outbox (id,kind,subject_id,skater_id,author_id,payload,available_at,created_at) SELECT ?,?,?,?,?,?,?,? ${gate ? 'WHERE EXISTS (SELECT 1 FROM hsc_audit WHERE id=?)' : ''} ON CONFLICT(id) DO NOTHING`).bind(...values, ...(gate ? [gate] : []));
}
export async function drainOutbox(database: D1Database, limit = 30) {
  await reconcileReminders(database);
  const time = nowISO();
  const {results} = await database.prepare("SELECT * FROM hsc_outbox WHERE (state='pending' AND available_at<=?) OR (state='processing' AND lease_until<?) ORDER BY created_at,id LIMIT ?").bind(time, time, limit).all<Outbox>();
  let delivered = 0, retried = 0;
  for (const item of results) {
    const lease = new Date(Date.now() + 120000).toISOString();
    const acquired = await database.prepare("UPDATE hsc_outbox SET state='processing',lease_until=?,attempts=attempts+1 WHERE id=? AND ((state='pending' AND available_at<=?) OR (state='processing' AND lease_until<?)) RETURNING id").bind(lease, item.id, time, time).first();
    if (!acquired) continue;
    try {
      if (item.kind==='reminder' && !(await reminderIsCurrent(database,item.id))) {
        await database.prepare("UPDATE hsc_outbox SET state='cancelled',lease_until=NULL WHERE id=?").bind(item.id).run();
        continue;
      }
      const {results: recipients} = item.kind==='reminder'
        ? await database.prepare("SELECT id FROM hsc_members WHERE id=? AND status='active'").bind(item.author_id).all<{id:string}>()
        : await database.prepare("SELECT DISTINCT m.id FROM hsc_members m JOIN hsc_relations r ON r.member_id=m.id AND r.kind=m.role AND r.active=1 JOIN hsc_admissions a ON a.skater_id=r.skater_id AND a.admitted=1 WHERE m.status='active' AND r.skater_id=? AND (?='schedule' OR m.role IN ('parent','skater') OR m.id=?)").bind(item.skater_id, item.kind, item.author_id).all<{id: string}>();
      await database.batch([
        ...recipients.map(recipient => database.prepare('INSERT INTO hsc_notifications (id,outbox_id,member_id,skater_id,kind,subject_id,author_id,payload,created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(`${item.id}|${recipient.id}`, item.id, recipient.id, item.skater_id, item.kind, item.subject_id, item.author_id, item.payload, nowISO())),
        database.prepare("UPDATE hsc_outbox SET state='delivered',lease_until=NULL,error=NULL WHERE id=? AND lease_until=?").bind(item.id, lease),
      ]);
      delivered++;
    } catch {
      retried++;
      const delay = Math.min(3600000, 30000 * 2 ** Math.min(item.attempts, 7));
      await database.prepare("UPDATE hsc_outbox SET state='pending',lease_until=NULL,error='站内投递失败，等待重试',available_at=? WHERE id=? AND lease_until=?").bind(new Date(Date.now() + delay).toISOString(), item.id, lease).run();
    }
  }
  return {delivered, retried, channel: 'in-app'};
}
export async function listNotifications(database: D1Database, member: Member) {
  const {results} = await database.prepare('SELECT * FROM hsc_notifications WHERE member_id=? ORDER BY created_at DESC LIMIT 200').bind(member.id).all<Notification>();
  const allowed = await accessibleSkaters(database, member);
  return results.filter(row => (member.role === 'admin' || allowed.includes(row.skater_id)) && (member.role !== 'coach' || row.kind === 'schedule' || row.author_id === member.id)).map(row => ({...row, payload: JSON.parse(row.payload)}));
}
export async function markNotification(database: D1Database, member: Member, id: string) {
  if (!(await listNotifications(database, member)).some(row => row.id === id)) throw new AccessError(404, '通知不存在或已无访问权限');
  await database.prepare('UPDATE hsc_notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND member_id=?').bind(nowISO(), id, member.id).run();
}
async function visibleRecipients(database: D1Database, member: Member, requirement: Requirement) {
  const recipients = parseIDs(requirement.skater_ids);
  if (member.role === 'admin') return recipients;
  if (member.role === 'coach' && requirement.author_id !== member.id) return [];
  const allowed = await accessibleSkaters(database, member);
  return recipients.filter(id => allowed.includes(id));
}
export async function listRequirements(database: D1Database, member: Member) {
  const scope = await accessibleSkaters(database, member);
  const {results} = await database.prepare("SELECT * FROM hsc_requirements WHERE (?='admin' OR (?<>'coach' OR author_id=?) AND EXISTS (SELECT 1 FROM json_each(hsc_requirements.skater_ids) recipient WHERE recipient.value IN (SELECT value FROM json_each(?)))) ORDER BY updated_at DESC LIMIT 50").bind(member.role, member.role, member.id, JSON.stringify(scope)).all<Requirement>();
  const visible = [];
  for (const requirement of results) {
    const recipients = await visibleRecipients(database, member, requirement);
    if (!recipients.length) continue;
    const {results: receipts} = await database.prepare('SELECT * FROM hsc_receipts WHERE requirement_id=? ORDER BY revision DESC').bind(requirement.id).all<{skater_id: string; member_id: string}>();
    const {results: versions} = await database.prepare('SELECT revision,payload,created_at FROM hsc_requirement_versions WHERE requirement_id=? ORDER BY revision DESC').bind(requirement.id).all<{revision: number; payload: string; created_at: string}>();
    visible.push({...requirement, skater_ids: recipients, receipts: receipts.filter(row => recipients.includes(row.skater_id) && (member.role === 'admin' || member.role === 'coach' || row.member_id === member.id)), versions: versions.filter(row => parseIDs(JSON.parse(row.payload).skater_ids).some(id => recipients.includes(id))).map(row => {
      const payload = JSON.parse(row.payload) as Requirement;
      return {...row, payload: {...payload, skater_ids: parseIDs(payload.skater_ids).filter(id => recipients.includes(id))}};
    })});
  }
  return visible;
}
export async function writeRequirement(database: D1Database, member: Member, body: Record<string, unknown>) {
  requireRole(member, 'admin', 'coach');
  const id = body.id ? stringField(body.id, 100) : crypto.randomUUID();
  const existing = await database.prepare('SELECT * FROM hsc_requirements WHERE id=?').bind(id).first<Requirement>();
  if (body.id && !existing) throw new AccessError(404, '教练要求不存在');
  if (existing && member.role !== 'admin' && existing.author_id !== member.id) throw new AccessError(403, '只能编辑自己发送的要求');
  if (existing && body.revision !== existing.revision) throw new AccessError(409, '要求已更新，请刷新后重试');
  if (existing?.state === 'withdrawn') throw new AccessError(409, '已撤回的要求不能再次编辑');
  const withdrawn = body.state === 'withdrawn';
  const skaterIds = withdrawn && existing ? parseIDs(existing.skater_ids) : idsField(body.skaterIds);
  if (!skaterIds.length) throw new AccessError(400, '请选择至少一个接收选手');
  const allIds = [...new Set([...skaterIds, ...(existing ? parseIDs(existing.skater_ids) : [])])];
  if (member.role !== 'admin') {
    const allowed = await accessibleSkaters(database, member);
    if (allIds.some(id => !allowed.includes(id))) throw new AccessError(403, '无权向该选手发送要求');
  }
  await admittedIDs(database, skaterIds);
  const title = withdrawn && existing ? existing.title : stringField(body.title, 160);
  const content = withdrawn && existing ? existing.body : stringField(body.body, 4000);
  const eventId = withdrawn && existing ? existing.event_id : stringField(body.eventId, 100, true) || null;
  const slotKey = withdrawn && existing ? existing.slot_key : stringField(body.slotKey, 350, true) || null;
  const dueAt = withdrawn && existing ? existing.due_at : stringField(body.dueAt, 40, true) || null;
  if (dueAt && (!/^20\d\d-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(dueAt) || Number.isNaN(Date.parse(dueAt)))) throw new AccessError(400, '截止时间必须包含时区');
  if (eventId) {
    const event = await database.prepare('SELECT payload FROM live_events WHERE id=?').bind(eventId).first<{payload: string}>();
    if (!event) throw new AccessError(400, '比赛不存在');
    if (slotKey) {
      const blocks = JSON.parse(event.payload).blocks as {id: string}[];
      if (!blocks.some(block => block.id === slotKey)) throw new AccessError(400, '比赛分项不存在或已调整');
    }
  } else if (slotKey) throw new AccessError(400, '关联分项需要先选择比赛');
  const time = nowISO();
  const requirement: Requirement = {id, author_id: existing?.author_id || member.id, title, body: content, skater_ids: JSON.stringify(skaterIds), event_id: eventId, slot_key: slotKey, due_at: dueAt, state: withdrawn ? 'withdrawn' : 'active', revision: (existing?.revision || 0) + 1, created_at: existing?.created_at || time, updated_at: time};
  const operationId = crypto.randomUUID();
  const gate = 'EXISTS (SELECT 1 FROM hsc_audit WHERE id=?)';
  const statements = [
    database.prepare(`INSERT INTO hsc_audit (id,actor_id,action,subject_id,payload,created_at) SELECT ?,?,'requirement-write',?,?,? WHERE ${existing ? 'EXISTS (SELECT 1 FROM hsc_requirements WHERE id=? AND revision=?)' : 'NOT EXISTS (SELECT 1 FROM hsc_requirements WHERE id=?)'}`).bind(operationId, member.id, id, JSON.stringify({revision: requirement.revision, state: requirement.state, skaterIds}), time, id, ...(existing ? [existing.revision] : [])),
    database.prepare(`INSERT INTO hsc_requirements (id,author_id,title,body,skater_ids,event_id,slot_key,due_at,state,revision,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,skater_ids=excluded.skater_ids,event_id=excluded.event_id,slot_key=excluded.slot_key,due_at=excluded.due_at,state=excluded.state,revision=excluded.revision,updated_at=excluded.updated_at`).bind(requirement.id, requirement.author_id, title, content, requirement.skater_ids, eventId, slotKey, dueAt, requirement.state, requirement.revision, requirement.created_at, time, operationId),
    database.prepare(`INSERT INTO hsc_requirement_versions (id,requirement_id,revision,payload,actor_id,created_at) SELECT ?,?,?,?,?,? WHERE ${gate}`).bind(`${id}|${requirement.revision}`, id, requirement.revision, JSON.stringify(requirement), member.id, time, operationId),
    ...allIds.map(skaterId => outboxStatement(database, {id: `requirement|${id}|${requirement.revision}|${skaterId}`, kind: 'requirement', subjectId: id, skaterId, authorId: requirement.author_id, payload: {title, revision: requirement.revision, state: requirement.state, action: withdrawn ? '已撤回' : existing ? '已修改，请重新查看并确认' : '新教练要求', dueAt}}, operationId)),
  ];
  const result = await database.batch(statements);
  if (!result[0].meta.changes) throw new AccessError(409, '要求已由其他页面更新');
  await drainOutbox(database).catch(() => {});
  return requirement;
}
export async function receiptRequirement(database: D1Database, member: Member, body: Record<string, unknown>) {
  requireRole(member, 'parent', 'skater');
  const id = stringField(body.id, 100);
  const skaterId = stringField(body.skaterId, 100);
  await assertSkater(database, member, skaterId);
  const requirement = await database.prepare("SELECT * FROM hsc_requirements WHERE id=? AND state='active'").bind(id).first<Requirement>();
  if (!requirement || !parseIDs(requirement.skater_ids).includes(skaterId)) throw new AccessError(404, '要求不存在或无权查看');
  if (body.revision !== requirement.revision) throw new AccessError(409, '要求有新修改，请查看最新版后确认');
  const time = nowISO();
  const result = await database.prepare("INSERT INTO hsc_receipts (id,requirement_id,skater_id,member_id,revision,read_at,acknowledged_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM hsc_requirements WHERE id=? AND revision=? AND state='active') ON CONFLICT(id) DO UPDATE SET acknowledged_at=COALESCE(hsc_receipts.acknowledged_at,excluded.acknowledged_at) RETURNING id").bind(`${id}|${skaterId}|${member.id}|${requirement.revision}`, id, skaterId, member.id, requirement.revision, time, body.acknowledge === true ? time : null, id, requirement.revision).first();
  if (!result) throw new AccessError(409, '要求已修改，请刷新');
}
