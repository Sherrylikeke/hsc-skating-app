import { env } from 'cloudflare:workers';
import roster from '../../../data/roster.json';
import {requestMember} from '../../../lib/member-runtime';
import {audit,checkWrite,failure} from '../../../lib/member-access';

export const dynamic = 'force-dynamic';
const ids = new Set(roster.map(row => row.id));
const response = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store' },
});

async function database() {
  if (!env.DB) throw new Error('Database unavailable');
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM coach_assignments').first<{n:number}>();
  if ((count?.n ?? 0) < roster.length) {
    const now = new Date().toISOString();
    const seeds=[];
    for(let i=0;i<roster.length;i+=25){
      const chunk=roster.slice(i,i+25);
      seeds.push(env.DB.prepare(`INSERT INTO coach_assignments (skater_id, coach, revision, updated_at) VALUES ${chunk.map(()=>'(?, ?, 0, ?)').join(',')} ON CONFLICT(skater_id) DO NOTHING`).bind(...chunk.flatMap(row=>[row.id,row.coach,now])));
    }
    await env.DB.batch(seeds);
  }
  return env.DB;
}

export async function GET(request: Request) {
  try {
    await requestMember(request,['admin']);
    const db = await database();
    const {results} = await db.prepare('SELECT skater_id, coach, revision, updated_at FROM coach_assignments').all<{skater_id:string;coach:string;revision:number;updated_at:string}>();
    const saved = new Map(results.map(row => [row.skater_id, row]));
    return response({rows:roster.map(row => ({...row, coach:saved.get(row.id)?.coach ?? row.coach, revision:saved.get(row.id)?.revision ?? 0}))});
  } catch(error) { return failure(error); }
}

export async function POST(request: Request) {
  let member;
  try{member=await requestMember(request,['admin']);checkWrite(request);}catch(error){return failure(error);}
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return response({error:'请求来源无效'},403);
  if (!request.headers.get('content-type')?.includes('application/json')) return response({error:'请使用 JSON'},415);
  if (Number(request.headers.get('content-length') ?? 0) > 200000) return response({error:'数据过大'},413);
  let body: unknown;
  try { body = await request.json(); } catch { return response({error:'数据格式无效'},400); }
  const changes = (body as {changes?:unknown})?.changes;
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > roster.length) return response({error:'更新行数无效'},400);
  const seen = new Set<string>();
  for (const change of changes) {
    if (!change || typeof change.id !== 'string' || !ids.has(change.id) || seen.has(change.id) || typeof change.coach !== 'string' || change.coach.length > 500 || /[\r\n\t\x00]/.test(change.coach) || !Number.isSafeInteger(change.revision) || change.revision < 0) return response({error:'教练信息格式无效'},400);
    seen.add(change.id);
  }
  try {
    const db = await database();
    const now = new Date().toISOString();
    const updates=[];
    for(let i=0;i<changes.length;i+=25){
      const chunk=changes.slice(i,i+25);
      updates.push(db.prepare(`WITH incoming(id, coach, revision) AS (VALUES ${chunk.map(()=>'(?, ?, ?)').join(',')}) UPDATE coach_assignments SET coach = (SELECT coach FROM incoming WHERE id = skater_id), revision = revision + 1, updated_at = ? WHERE EXISTS (SELECT 1 FROM incoming WHERE id = skater_id AND incoming.revision = coach_assignments.revision) RETURNING skater_id AS id, coach, revision`).bind(...chunk.flatMap(change=>[change.id,change.coach,change.revision]),now));
    }
    updates.push(audit(db,member.id,'legacy-coaches-update','coach_assignments',changes));
    const results = await db.batch<{id:string;coach:string;revision:number}>(updates);
    const saved = results.flatMap(result => result.results);
    const savedIds = new Set(saved.map(row => row.id));
    const conflicts = changes.filter(change => !savedIds.has(change.id)).map(change => change.id);
    return response({saved,conflicts});
  } catch { return response({error:'保存失败，修改仍保留在页面中'},503); }
}
