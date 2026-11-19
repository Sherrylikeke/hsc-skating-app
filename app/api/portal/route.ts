import {db} from '../../../lib/club-store';
import {requestMember} from '../../../lib/member-runtime';
import {AccessError,bodyJSON,failure,json,rateLimit,requireRole,stringField,nowISO,digest} from '../../../lib/member-access';
import {canEditPortal,publishedPortalPages,publishedPortalCoaches,portalEditorState,savePortalPage,portalVersions,grantPortalEditor,exportPortalContent} from '../../../lib/portal-store';
import {portalCatalogue} from '../../../lib/portal-content';
import {readPortalCart,updatePortalCart} from '../../../lib/portal-cart';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const url=new URL(request.url),action=url.searchParams.get('action')||'pages',database=db();
 if(action==='pages')return json({pages:await publishedPortalPages(database),coaches:await publishedPortalCoaches(database)});
 if(action==='catalogue')return json({items:portalCatalogue,observedAt:'2026-11-18',checkoutEnabled:false});
 const member=await requestMember(request);
 if(action==='permissions')return json({editor:await canEditPortal(database,member),admin:member.role==='admin'&&member.status==='active',name:member.name});
 if(action==='editor')return json({pages:await portalEditorState(database,member)});
 if(action==='versions')return json({versions:await portalVersions(database,member,url.searchParams.get('path')||'')});
 if(action==='export')return json(await exportPortalContent(database,member),200,{'Content-Disposition':'attachment; filename="hsc-portal-content.json"'});
 if(action==='cart')return json(await readPortalCart(database,member));
 if(action==='skaters'){requireRole(member,'admin','parent','skater','coach');const rows=member.role==='admin'?(await database.prepare('SELECT skater_id,payload FROM hsc_admissions WHERE admitted=1').all<{skater_id:string;payload:string}>()).results:(await database.prepare('SELECT a.skater_id,a.payload FROM hsc_admissions a JOIN hsc_relations r ON r.skater_id=a.skater_id WHERE a.admitted=1 AND r.member_id=? AND r.kind=? AND r.active=1').bind(member.id,member.role).all<{skater_id:string;payload:string}>()).results;return json({skaters:rows.map(row=>({id:row.skater_id,name:JSON.parse(row.payload).name||row.skater_id}))});}
 if(action==='administration'){requireRole(member,'admin');return json({members:(await database.prepare("SELECT m.id,m.name,m.email,COALESCE(e.active,0) AS editor FROM hsc_members m LEFT JOIN hsc_portal_editors e ON e.member_id=m.id WHERE m.status='active' ORDER BY m.name").all()).results,contacts:(await database.prepare('SELECT id,name,email,department,message,state,created_at FROM hsc_portal_contacts ORDER BY created_at DESC LIMIT 100').all()).results});}
 throw new AccessError(404,'This operation is not available.');
}catch(error){return failure(error);}}
export async function POST(request:Request){try{
 const body=await bodyJSON(request),action=new URL(request.url).searchParams.get('action'),database=db();
 if(action==='contact'){
  if(body.website)return json({received:true});
  const name=stringField(body.name,120),email=stringField(body.email,254),department=stringField(body.department,100),message=stringField(body.message,5000);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['HSC Board of Directors','Director of Skating','Learn to Skate Director'].includes(department))throw new AccessError(400,'Check your email and department.');
  await rateLimit(database,'portal-contact:'+await digest(request.headers.get('cf-connecting-ip')||'local'),5,3600000);
  await database.prepare('INSERT INTO hsc_portal_contacts (id,name,email,department,message,state,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),name,email,department,message,'new',nowISO()).run();
  return json({received:true},201);
 }
 const member=await requestMember(request);await rateLimit(database,'portal-write:'+member.id,80);
 if(action==='save')return json(await savePortalPage(database,member,body));
 if(action==='grant')return json(await grantPortalEditor(database,member,body));
 if(action==='cart')return json(await updatePortalCart(database,member,body));
 if(action==='checkout')throw new AccessError(409,'Checkout is not enabled. No payment or registration was created.');
 throw new AccessError(404,'This operation is not available.');
}catch(error){return failure(error);}}
