import type {LiveEvent} from './club-types.ts';
import {outboxStatement} from './member-messages.ts';
import {nowISO} from './member-access.ts';

export function officialSnapshot(event: LiveEvent | null, skaterId: string) {
  if (!event) return null;
  const entries = event.participants.filter(row => row.skaterIds.includes(skaterId)).map(row => ({name: row.name, category: row.category, club: row.club})).sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)));
  const orders = (event.startingOrders || []).filter(row => row.skaterIds.includes(skaterId)).map(row => ({name: row.name, category: row.category, program: row.program, startNumber: row.startNumber, warmupGroup: row.warmupGroup, individualTime: row.individualTime})).sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)));
  if (!entries.length && !orders.length) return null;
  const categories = new Set([...entries, ...orders].map(row => row.category.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')));
  const blocks = event.blocks.filter(block => {
    const key = block.category.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
    return [...categories].some(category => key.includes(category) || category.includes(key));
  }).map(block => ({date: block.date, start: block.start, end: block.end, rink: block.rink, category: block.category, activity: block.activity})).sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)));
  return {event: event.name, start: event.start, end: event.end, venue: event.venue, timezone: event.timezone, officialNotice: event.updateText, entries, blocks, orders};
}
export function eventWriteStatements(database: D1Database, event: LiveEvent, previous: LiveEvent | null) {
  const time = nowISO();
  const statements = [database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(event.id, JSON.stringify(event), time)];
  const documents = event.documents.flatMap(document => [document, ...(document.entryFiles || [])]).filter(document => document.hash && !document.error);
  for (const document of documents) statements.push(database.prepare('INSERT INTO source_revisions (id,event_id,kind,url,hash,checked_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(`${event.id}|${document.kind}|${document.url}|${document.hash}`, event.id, document.kind, document.url, document.hash!, document.checkedAt || time));
  const ids = new Set([...(previous?.participants || []), ...event.participants, ...(previous?.startingOrders || []), ...(event.startingOrders || [])].flatMap(row => row.skaterIds));
  for (const skaterId of ids) {
    const before = officialSnapshot(previous, skaterId), after = officialSnapshot(event, skaterId);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const id = crypto.randomUUID();
    const payload = {eventId: event.id, eventName: event.name, before, after, action: !before ? '新增官方安排' : !after ? '已从官方名单移除，请核对' : '官方安排有实质修订', source: event.url, documents: documents.map(document => ({url: document.url, hash: document.hash, checkedAt: document.checkedAt})), checkedAt: event.detailCheckedAt || event.checkedAt || time};
    statements.push(database.prepare('INSERT INTO hsc_changes (id,event_id,skater_id,payload,created_at) VALUES (?,?,?,?,?)').bind(id, event.id, skaterId, JSON.stringify(payload), time));
    statements.push(outboxStatement(database, {id: `schedule|${id}`, kind: 'schedule', subjectId: id, skaterId, payload}));
  }
  return statements;
}
