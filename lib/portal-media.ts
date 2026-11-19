import {AccessError,audit,nowISO} from './member-access';
import type {Member} from './member-access';
import {assertPortalEditor} from './portal-store';
export function portalFileType(bytes:Uint8Array){
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return {mime:'image/jpeg',extension:'jpg'};
 if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return {mime:'image/png',extension:'png'};
 const first=new TextDecoder().decode(bytes.slice(0,12));
 if(first.startsWith('%PDF-'))return {mime:'application/pdf',extension:'pdf'};
 if(first.startsWith('RIFF')&&first.slice(8,12)==='WEBP')return {mime:'image/webp',extension:'webp'};
 throw new AccessError(415,'Choose a JPEG, PNG, WebP or PDF file.');
}
export async function savePortalMedia(database:D1Database,bucket:R2Bucket|undefined,member:Member,file:File,visibility:string){
 await assertPortalEditor(database,member);if(!bucket)throw new AccessError(503,'File storage is not connected. Please try again later.');
 if(file.size===0||file.size>5*1024*1024)throw new AccessError(413,'Choose a file smaller than 5 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer()),type=portalFileType(bytes),id=crypto.randomUUID(),key='portal/'+id+'.'+type.extension;
 const filename=file.name.replace(/[^a-zA-Z0-9_. -]/g,'_').slice(0,120)||'document.'+type.extension;
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 await bucket.put(key,bytes,{httpMetadata:{contentType:type.mime},customMetadata:{sha256:hash}});
 try{await database.batch([database.prepare('INSERT INTO hsc_portal_media (id,object_key,filename,mime_type,byte_size,sha256,visibility,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,key,filename,type.mime,file.size,hash,visibility==='public'?'public':'private',member.id,nowISO()),audit(database,member.id,'portal.media',id,{visibility:visibility==='public'?'public':'private',bytes:file.size})]);}
 catch(error){await bucket.delete(key);throw error;}
 return {id,url:'/api/portal/media?id='+id,visibility:visibility==='public'?'public':'private'};
}
export async function boundedUpload(request:Request){
 const limit=5*1024*1024+16384;
 if(Number(request.headers.get('content-length')||0)>limit)throw new AccessError(413,'Choose a file smaller than 5 MB.');
 const reader=request.body?.getReader();if(!reader)throw new AccessError(400,'Choose a file.');
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new AccessError(413,'Choose a file smaller than 5 MB.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();}catch{throw new AccessError(400,'Upload a valid form with a file.');}
}
