import {AccessError,audit,nowISO,stringField,requireRole} from './member-access';
import type {Member} from './member-access';
import {portalPages,portalEditablePages,portalSnapshot,portalCoachKey} from './portal-content';

type Content={title:string;body:string};
type PageRow={path:string;published:string|null;draft:string;revision:number;updated_at:string;updated_by:string};
export async function canEditPortal(database:D1Database,member:Member){
 if(member.status!=='active')return false;
 if(member.role==='admin')return true;
 return Boolean(await database.prepare('SELECT member_id FROM hsc_portal_editors WHERE member_id=? AND active=1').bind(member.id).first());
}
export async function assertPortalEditor(database:D1Database,member:Member){if(!await canEditPortal(database,member))throw new AccessError(403,'Content editing permission is required.');}
export async function publishedPortalPages(database:D1Database){
 const {results}=await database.prepare('SELECT path,published,revision FROM hsc_portal_pages WHERE published IS NOT NULL').all<Pick<PageRow,'path'|'published'|'revision'>>();
 const saved=new Map(results.map(r=>[r.path,r]));
 return portalPages.map(page=>{const row=saved.get(page.path);return row?{...page,...JSON.parse(row.published!),revision:row.revision}:page;});
}
export async function portalEditorState(database:D1Database,member:Member){
 await assertPortalEditor(database,member);
 const {results}=await database.prepare('SELECT path,published,draft,revision,updated_at,updated_by FROM hsc_portal_pages').all<PageRow>();
 const saved=new Map(results.map(r=>[r.path,r]));
 return portalEditablePages.map(p=>{const row=saved.get(p.path);return {path:p.path,title:p.title,revision:row?.revision||0,draft:row?JSON.parse(row.draft):{title:p.title,body:p.body},published:row?.published?JSON.parse(row.published):{title:p.title,body:p.body},updatedAt:row?.updated_at||null};});
}
export async function publishedPortalCoaches(database:D1Database){const rows=(await database.prepare("SELECT path,published FROM hsc_portal_pages WHERE path LIKE 'coach:%' AND published IS NOT NULL").all<{path:string;published:string}>()).results;const saved=new Map(rows.map(r=>[r.path,JSON.parse(r.published) as Content]));return portalSnapshot.coaches.map(c=>{const update=saved.get(portalCoachKey(c.name));return update?{...c,name:update.title,body:update.body}:c;});}
export async function savePortalPage(database:D1Database,member:Member,body:Record<string,unknown>){
 await assertPortalEditor(database,member);
 const path=stringField(body.path,240),page=portalEditablePages.find(p=>p.path===path);
 if(!page||page.path!==path)throw new AccessError(400,'Choose an existing website page.');
 const revision=body.revision;
 if(!Number.isSafeInteger(revision)||Number(revision)<0)throw new AccessError(400,'A valid page revision is required.');
 const value:Content={title:stringField(body.title,150),body:stringField(body.body,58000,true)};
 const content=JSON.stringify(value),publish=body.publish===true,operation=crypto.randomUUID(),time=nowISO(),next=Number(revision)+1;
 const changed=await database.batch([
  database.prepare('INSERT INTO hsc_portal_pages (path,published,draft,revision,updated_by,updated_at,operation_id) SELECT ?,?,?,?, ?,?,? WHERE ?=0 OR EXISTS (SELECT 1 FROM hsc_portal_pages WHERE path=?) ON CONFLICT(path) DO UPDATE SET published=CASE WHEN ? THEN excluded.draft ELSE hsc_portal_pages.published END,draft=excluded.draft,revision=?,updated_by=?,updated_at=?,operation_id=? WHERE hsc_portal_pages.revision=? RETURNING revision').bind(path,publish?content:null,content,next,member.id,time,operation,revision,path,publish?1:0,next,member.id,time,operation,revision),
  database.prepare('INSERT INTO hsc_portal_versions (id,path,revision,content,published,actor_id,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM hsc_portal_pages WHERE path=? AND operation_id=?)').bind(operation,path,next,content,publish?1:0,member.id,time,path,operation),
  database.prepare('INSERT INTO hsc_audit (id,actor_id,action,subject_id,payload,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM hsc_portal_pages WHERE path=? AND operation_id=?)').bind(crypto.randomUUID(),member.id,publish?'portal.publish':'portal.draft',path,JSON.stringify({revision:next}),time,path,operation),
 ]);
 if(!changed[0].results?.length)throw new AccessError(409,'This page changed in another session. Reload before saving.');
 return {revision:next,published:publish};
}
export async function portalVersions(database:D1Database,member:Member,path:string){await assertPortalEditor(database,member);return (await database.prepare('SELECT id,revision,content,published,created_at FROM hsc_portal_versions WHERE path=? ORDER BY revision DESC LIMIT 30').bind(path).all()).results;}
export async function grantPortalEditor(database:D1Database,member:Member,body:Record<string,unknown>){
 requireRole(member,'admin');const target=stringField(body.memberId,160);
 if(!await database.prepare("SELECT id FROM hsc_members WHERE id=? AND status='active'").bind(target).first())throw new AccessError(400,'Choose an active club member.');
 const active=body.active===true?1:0;
 await database.batch([database.prepare('INSERT INTO hsc_portal_editors (member_id,active,updated_by,updated_at) VALUES (?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET active=excluded.active,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(target,active,member.id,nowISO()),audit(database,member.id,'portal.editor',target,{active:Boolean(active)})]);
 return {memberId:target,active:Boolean(active)};
}
export async function exportPortalContent(database:D1Database,member:Member){
 await assertPortalEditor(database,member);
 // One D1 batch read transaction, scoped to portal content only. This is NOT a database backup.
 const data=await database.batch([database.prepare('SELECT path,published,draft,revision,updated_at FROM hsc_portal_pages ORDER BY path'),database.prepare('SELECT path,revision,content,published,created_at FROM hsc_portal_versions ORDER BY path,revision'),database.prepare('SELECT id,object_key,filename,mime_type,byte_size,sha256,visibility,created_at FROM hsc_portal_media ORDER BY id')]);
 return {format:'hsc-portal-content-export',version:1,exportedAt:nowISO(),scope:'Portal content and file metadata only; no accounts, transactions, file bytes or full database backup.',baseline:portalEditablePages,pages:data[0].results,versions:data[1].results,media:data[2].results};
}
