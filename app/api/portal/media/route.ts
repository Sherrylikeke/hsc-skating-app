import {env} from 'cloudflare:workers';
import {db} from '../../../../lib/club-store';
import {requestMember} from '../../../../lib/member-runtime';
import {AccessError,failure,json,rateLimit} from '../../../../lib/member-access';
import {assertPortalEditor} from '../../../../lib/portal-store';
import {boundedUpload,savePortalMedia} from '../../../../lib/portal-media';
export const dynamic='force-dynamic';
const bucket=()=> (env as unknown as {BUCKET?:R2Bucket}).BUCKET;
export async function GET(request:Request){try{
 const database=db(),id=new URL(request.url).searchParams.get('id');
 if(!id){await assertPortalEditor(database,await requestMember(request));return json({files:(await database.prepare('SELECT id,filename,visibility,byte_size,created_at FROM hsc_portal_media ORDER BY created_at DESC LIMIT 100').all()).results});}
 const file=await database.prepare('SELECT object_key,filename,mime_type,visibility FROM hsc_portal_media WHERE id=?').bind(id).first<{object_key:string;filename:string;mime_type:string;visibility:string}>();
 if(!file)throw new AccessError(404,'File not found.');
 if(file.visibility!=='public')await assertPortalEditor(database,await requestMember(request));
 const store=bucket();if(!store)throw new AccessError(503,'File storage is unavailable.');
 const object=await store.get(file.object_key);if(!object)throw new AccessError(404,'File not found.');
 return new Response(object.body,{headers:{'Content-Type':file.mime_type,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Content-Disposition':`${file.mime_type==='application/pdf'?'attachment':'inline'}; filename="${file.filename}"`,'Cache-Control':file.visibility==='public'?'public, max-age=3600':'private, no-store'}});
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new AccessError(403,'Submit uploads from this website.');
 const database=db(),member=await requestMember(request);await assertPortalEditor(database,member);await rateLimit(database,'portal-upload:'+member.id,20);
 const form=await boundedUpload(request),file=form.get('file');if(!file||typeof file==='string')throw new AccessError(400,'Choose a file.');
 return json(await savePortalMedia(database,bucket(),member,file as File,String(form.get('visibility')||'private')),201);
}catch(e){return failure(e);}}
