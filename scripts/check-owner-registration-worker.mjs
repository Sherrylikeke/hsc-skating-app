// Run after the production build. Uses an ephemeral Worker and D1 with fixture credentials only.
import assert from 'node:assert/strict';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const origin='https://hsc-coach-roster.sherrylikeke.chatgpt.site';
const root=path.resolve('dist/server');
const runtime=JSON.parse(fs.readFileSync(path.join(root,'wrangler.json'),'utf8'));
const files=fs.readdirSync(root,{recursive:true}).filter(file=>/\.(m?js)$/.test(file)&&file!=='index.js');
const modules=['index.js',...files].map(file=>({type:'ESModule',path:path.join(root,file)}));
const pilotToken='a'.repeat(64),password='Fixture-only-Password-2026!';
const hash=value=>createHash('sha256').update(value).digest('hex');
const markFixture=JSON.parse(fs.readFileSync('tests/fixtures/results-skate-canada-marks.json','utf8'));
const startingFixture=JSON.parse(fs.readFileSync('tests/fixtures/sectionals-2026-starting-order-api.json','utf8'));
const fixtureCarson=JSON.parse(fs.readFileSync('data/roster.json','utf8')).find(row=>row.name==='Carson Wang');
const startingHtml='<script>var EVENT_ID="'+startingFixture.eventId+'";var API="/api/results";</script>';
let awardsFetches=0;
const fixtureHost='sc-css-public-api-cmh9d3htgxfpdkb7.canadacentral-01.azurewebsites.net';
let officialRequests=0;
const keswickReads=[];
const workerOptions={cf:false,modules,modulesRoot:root,compatibilityDate:runtime.compatibility_date,compatibilityFlags:runtime.compatibility_flags,d1Databases:['DB'],bindings:{
  BETTER_AUTH_SECRET:'isolated-tests-only-secret-0123456789-abcdef',
  HSC_PILOT_REGISTRATIONS:JSON.stringify([{email:'pilot-fixture@example.test',role:'parent',invitationHash:hash(pilotToken),expiresAt:new Date(Date.now()+3600000).toISOString()}]),
},outboundService:request=>{const url=new URL(request.url);
if(url.hostname==='skatingresults.ca'){if(url.pathname.endsWith('/categories'))return Response.json({Categories:[startingFixture.category]});if(url.pathname.endsWith('/segments'))return Response.json({Segments:startingFixture.segments});const id=url.pathname.match(/segment\/([^/]+)\/entries$/)?.[1];if(id)return Response.json(startingFixture.entries[id]);return new Response(startingHtml);}
if(url.hostname==='www.skateontario.org'){
if(url.pathname==='/fixture-home/')return new Response('<p>Public Registration: Registration opens November 12, 2026 and closes November 16, 2026.</p><a href="https://www.skateontario.org/fixture-interim.pdf">Interim List</a>');
if(url.pathname==='/fixture-interim.pdf')return new Response(fs.readFileSync('tests/fixtures/niagara-2026-interim-entry.pdf'));
if(url.pathname==='/fixture-max/')return new Response('<a href="https://www.skateontario.org/fixture-keswick-schedule.pdf">Schedule</a><a href="https://www.skateontario.org/fixture-max-entries.html">Entry List</a><a href="https://www.skateontario.org/results/27KES/27KesSTAR5MenU10FP2SO.pdf">Starting Order</a>');
if(url.pathname==='/fixture-keswick-schedule.pdf')return new Response(fs.readFileSync('tests/fixtures/keswick-2026-nov10-schedule.pdf'));
if(url.pathname==='/fixture-max-entries.html')return new Response('<table><tr data-category="STAR 5 Men (U10)" data-club="Hamilton SC" data-section="ON"><td>Max Wang</td></tr></table>');
if(url.pathname==='/fixture-keswick/')return new Response('<a href="https://www.skateontario.org/results/27KES/">Start Orders/Results</a>');
if(url.pathname==='/results/27KES/')return new Response(fs.readFileSync('tests/fixtures/keswick-2026-starting-order-index.html','utf8'));
if(url.pathname.startsWith('/results/27KES/')){
  keswickReads.push(url.pathname);
  if(url.pathname.endsWith('27KesPre-JuvenileWomenU11Group2FP2SO.pdf'))return new Response(fs.readFileSync('tests/fixtures/keswick-2026-preju-u11-group2-start.pdf'));
  if(url.pathname.endsWith('27KesSTAR7WomenO12Group1SP2SO.pdf'))return new Response(fs.readFileSync('tests/fixtures/keswick-2026-star7-o12-group1-start.pdf'));
  if(url.pathname.endsWith('27KesSTAR5MenU10FP2SO.pdf'))return new Response(fs.readFileSync('tests/fixtures/keswick-2026-star5-men-u10-start.pdf'));
  return new Response('Fixture failed read',{status:503});
}
if(url.pathname==='/fixture-low-star/')return new Response('<a href="https://www.skateontario.org/fixture-low-star-schedule.pdf">Schedule</a><a href="https://www.skateontario.org/fixture-low-star-entry.pdf">Entry List</a>');
if(url.pathname==='/fixture-low-star-schedule.pdf')return new Response(fs.readFileSync('tests/fixtures/star1-4-east-gwillimbury-2026-schedule.pdf'));
if(url.pathname==='/fixture-low-star-entry.pdf')return new Response(fs.readFileSync('tests/fixtures/star3-niagara-2025-entry.pdf'));

if(url.pathname==='/fixture-event/')return new Response('<a href="https://www.skateontario.org/Awards-Schedule.pdf">Awards Schedule</a><a href="https://www.skateontario.org/competition-schedule.pdf">Competition Schedule</a><a href="https://www.skateontario.org/fixture-entries.html">Entry List</a><a href="'+startingFixture.documentUrl+'">Start Orders &amp; Results</a>');
if(url.pathname==='/Awards-Schedule.pdf'){awardsFetches++;return new Response('Must not import awards as competition times',{status:500});}
if(url.pathname==='/competition-schedule.pdf')return new Response(fs.readFileSync('tests/fixtures/sectionals-2026-oct26-schedule.pdf'),{headers:{'Content-Type':'application/pdf'}});
if(url.pathname==='/fixture-entries.html')return new Response('<table><tr data-category="Pre-Novice Men" data-club="Hamilton SC"><td><span class="skater-name">Carson Wang</span></td></tr></table>');if(url.pathname.endsWith('CR.pdf'))return new Response(fs.readFileSync('tests/fixtures/results-provincials-2026-u10-category.pdf'),{headers:{'Content-Type':'application/pdf'}});if(url.pathname.endsWith('DRO.pdf'))return new Response(fs.readFileSync('tests/fixtures/results-provincials-2026-u10-detail.pdf'),{headers:{'Content-Type':'application/pdf'}});return new Response('<a href="26PROVSTAR5WomenU10FP2DRO.pdf">Detailed classification</a>');}if(url.hostname!==fixtureHost)return new Response('Unavailable fixture',{status:404});officialRequests++;if(url.pathname.endsWith('/elements'))return Response.json(markFixture.elements);if(url.pathname.endsWith('/components'))return Response.json(markFixture.components);return Response.json({CompetitorEntries:[{competitorEntryId:'fixture-entry-a',competitorName:'Fixture Alpha',competitorClub:'Fixture Club',segmentRank:1,categoryRank:1,tes:16.66,pcs:13.67,score:30.33,competitorStatus:'SCORED'},{competitorEntryId:'fixture-entry-b',competitorName:'Fixture Beta',competitorClub:'Other Fixture Club',segmentRank:2,categoryRank:2,tes:15,pcs:13,score:28,competitorStatus:'SCORED'}]});},serviceBindings:{ASSETS:()=>new Response('Missing',{status:404})}};
const mf=new Miniflare(convertV4MiniflareOptions(workerOptions));
const post=(route,body,headers={})=>mf.dispatchFetch(origin+route,{method:'POST',headers:{origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const cookies=response=>response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
try {
  const database=await mf.getD1Database('DB');
  for(const file of fs.readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort()){
    for(const sql of fs.readFileSync(path.join('drizzle',file),'utf8').split('--> statement-breakpoint').map(sql=>sql.trim()).filter(Boolean))await database.prepare(sql).run();
  }
  const email='owner-fixture@example.test',id='fixture-owner-platform',session='fixture-session-not-production';
  await database.prepare("INSERT INTO hsc_members (id,email,name,role,requested_role,status,auth_version,created_at) VALUES (?,?,?,'admin','parent','active',1,?)").bind(id,email,'Owner Fixture',new Date().toISOString()).run();
  await database.prepare('INSERT INTO hsc_sessions (hash,member_id,auth_version,expires_at,created_at) VALUES (?,?,1,?,?)').bind(hash(session),id,new Date(Date.now()+3600000).toISOString(),new Date().toISOString()).run();
  const platformHeaders={'oai-authenticated-user-id':id,'oai-authenticated-user-email':email,cookie:'__Host-hsc_session='+session};
  const registration={name:'owner.fixture',username:'owner.fixture',email,password,role:'parent',skaterName:'',linkExisting:true};
  const anonymous=await post('/api/auth/sign-up/email',registration);
  assert.equal(anonymous.status,503);assert.equal((await database.prepare('SELECT count(*) AS count FROM hsc_auth_user').first()).count,0);
  const signup=await post('/api/auth/sign-up/email',registration,platformHeaders);
  assert.equal(signup.status,200,await signup.clone().text());
  const user=(await signup.json()).user;assert.equal(user.emailVerified,false);
  const signin=await post('/api/auth/sign-in/email',{email,password});assert.equal(signin.status,200,await signin.clone().text());
  const passwordCookie=cookies(signin);
  const beforeLink=await mf.dispatchFetch(origin+'/api/member?action=identity',{headers:{cookie:passwordCookie}});
  assert.equal((await beforeLink.json()).identity.provider,'password');
  assert.equal((await database.prepare('SELECT count(*) AS count FROM hsc_auth_links').first()).count,0);
  const linked=await post('/api/link-password',{}, {...platformHeaders,cookie:platformHeaders.cookie+'; '+passwordCookie});
  assert.equal(linked.status,200,await linked.clone().text());
  assert.equal((await database.prepare('SELECT member_id FROM hsc_auth_links WHERE auth_user_id=?').bind(user.id).first()).member_id,id);
  assert.equal((await database.prepare('SELECT count(*) AS count FROM hsc_members').first()).count,1);
  const restored=await post('/api/member?action=session',{role:'parent'},{cookie:passwordCookie});
  assert.equal(restored.status,200,await restored.clone().text());
  const member=(await restored.json()).member;assert.equal(member.id,id);assert.equal(member.role,'admin');assert.equal(member.status,'active');
  assert.equal((await mf.dispatchFetch(origin+'/api/results?record=fixture-result')).status,401);
  assert.equal(officialRequests,0,'Anonymous requests must not fetch official sources');
  const resultRecord={record_id:'fixture-result',name:'Fixture Alpha',club:'Fixture Club',section:'ON',event_name:'Fixture Event',event_url:'https://example.test/official',event_key:'fixture-history',start_date:'2026-11-03',category:'STAR 5 Women U10',result_level:'category',rank:1,total_score:30.33,status:'result',source_url:'https://'+fixtureHost+'/segment/fixture/entries',skater_ids:[],entity_type:'individual'};
  await database.prepare('INSERT INTO history_records (id,event_id,payload) VALUES (?,?,?)').bind(resultRecord.record_id,resultRecord.event_key,JSON.stringify(resultRecord)).run();
  const resultsResponse=await mf.dispatchFetch(origin+'/api/results?record=fixture-result',{headers:platformHeaders});assert.equal(resultsResponse.status,200,await resultsResponse.clone().text());const results=await resultsResponse.json();assert.equal(results.boards[0].rows.length,2);assert.equal(results.boards[0].rows[0].tes,16.66);
  const detailUrl=origin+'/api/results?record=fixture-result&board='+encodeURIComponent(results.boards[0].id)+'&entry=fixture-entry-a';
  const detailResponse=await mf.dispatchFetch(detailUrl,{headers:platformHeaders});assert.equal(detailResponse.status,200,await detailResponse.clone().text());const marks=await detailResponse.json();assert.ok(marks.elements.length>0);assert.ok(marks.components.some(c=>c.label==='Presentation'));
  const countBefore=officialRequests;assert.equal((await mf.dispatchFetch(origin+'/api/results?record=fixture-result&board=evil&entry=https://evil.test/',{headers:platformHeaders})).status,502);assert.equal(officialRequests,countBefore,'Arbitrary board or entry cannot create an outbound request');
  assert.equal((await mf.dispatchFetch(origin+'/api/results?record=missing',{headers:platformHeaders})).status,404);
  const pdfRecord={...resultRecord,record_id:'fixture-pdf-result',name:'Fiora Dong',category:'STAR 5 Women (U10)',event_url:'https://www.skateontario.org/results/26PROVS/',source_url:'https://www.skateontario.org/results/26PROVS/26PROVSTAR5WomenU10CR.pdf',total_score:25.08};
  await database.prepare('INSERT INTO history_records (id,event_id,payload) VALUES (?,?,?)').bind(pdfRecord.record_id,pdfRecord.event_key,JSON.stringify(pdfRecord)).run();
  const pdfResponse=await mf.dispatchFetch(origin+'/api/results?record=fixture-pdf-result',{headers:platformHeaders});assert.equal(pdfResponse.status,200,await pdfResponse.clone().text());const pdfResults=await pdfResponse.json();assert.equal(pdfResults.boards.length,2);assert.equal(pdfResults.boards[0].rows.length,18);assert.equal(pdfResults.boards[0].rows[0].tes,13.23);assert.ok(pdfResults.boards[0].rows[0].elements.length>=8);
  const syncEvent={id:'SO-999991',name:'Isolated Sectionals Fixture',url:'https://www.skateontario.org/fixture-event/',start:'2026-11-05',end:'2026-11-08',timezone:'America/Toronto',venue:'Fixture',city:'Fixture',updateText:'',officialModified:'',checkedAt:new Date().toISOString(),documents:[],participants:[],blocks:[],source:'Skate Ontario'};
  await database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?)').bind(syncEvent.id,JSON.stringify(syncEvent),new Date().toISOString()).run();
  const syncResponse=await post('/api/sync',{eventId:syncEvent.id},platformHeaders);assert.equal(syncResponse.status,200,await syncResponse.clone().text());const synced=await syncResponse.json();const resolved=synced.schedulePreview.find(row=>row.name==='Carson Wang');assert.ok(resolved);assert.equal(resolved.startNumber,19);assert.equal(resolved.warmupGroup,4);assert.equal(resolved.start,'11:15');assert.equal(resolved.end,'12:15');assert.equal(resolved.uncertain,false);assert.equal(resolved.individualTime,null);assert.equal(awardsFetches,0);
  const savedSync=JSON.parse((await database.prepare('SELECT payload FROM live_events WHERE id=?').bind(syncEvent.id).first()).payload);assert.ok(savedSync.startingOrders.some(row=>row.skaterIds.includes(fixtureCarson.id)));assert.ok(savedSync.blocks.some(block=>block.category.includes('SHORT (16-25)')));
  const sydney=JSON.parse(fs.readFileSync('data/roster.json','utf8')).find(row=>row.name==='Sydney Mitchell');
  const keswickEvent={...syncEvent,id:'SO-999993',url:'https://www.skateontario.org/fixture-keswick/',participants:[{id:'fixture-sydney-entry',name:sydney.name,category:'Pre-Juvenile Women (U11 Group 2)',club:'Hamilton SC',section:'ON',skaterIds:[sydney.id],matchStatus:'fixture',sourceUrl:'https://skateontario.org/results/27KES/27KesPre-JuvenileWomenU11Group2EL.pdf'}]};
  await database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?)').bind(keswickEvent.id,JSON.stringify(keswickEvent),new Date().toISOString()).run();
  const keswickResponse=await post('/api/sync',{eventId:keswickEvent.id},platformHeaders);
  assert.equal(keswickResponse.status,200,await keswickResponse.clone().text());
  assert.deepEqual((await keswickResponse.json()).startingOrderFiles,{total:61,verified:1,pending:60});
  const keswickSaved=JSON.parse((await database.prepare('SELECT payload FROM live_events WHERE id=?').bind(keswickEvent.id).first()).payload);
  assert.equal(keswickSaved.documents.filter(document=>document.kind==='start-order').length,61);
  assert.ok(!keswickSaved.documents.some(document=>document.kind==='start-order'&&document.url.endsWith('/27KES/')));
  assert.equal(keswickReads.length,4);assert.ok(keswickReads[0].endsWith('27KesPre-JuvenileWomenU11Group2FP2SO.pdf'));
  const sydneyOrder=keswickSaved.startingOrders.find(order=>order.skaterIds.includes(sydney.id));
  assert.equal(sydneyOrder.startNumber,2);assert.equal(sydneyOrder.warmupGroup,1);assert.equal(sydneyOrder.individualTime,null);
  assert.equal(keswickSaved.documents.find(document=>document.url===sydneyOrder.sourceUrl).parserVersion,'starting-draw-3');
  const firstReads=[...keswickReads];
  assert.equal((await post('/api/sync',{eventId:keswickEvent.id},platformHeaders)).status,200);
  assert.equal(keswickReads.length,8);assert.ok(keswickReads.slice(4).every(url=>!firstReads.includes(url)));
  const staleDraw=JSON.parse((await database.prepare('SELECT payload FROM live_events WHERE id=?').bind(keswickEvent.id).first()).payload);
  for(const document of staleDraw.documents.filter(document=>document.kind==='start-order')){
    if(document.url===sydneyOrder.sourceUrl)document.parserVersion='starting-draw-2';
    else {document.parserVersion='starting-draw-3';document.attemptedAt='2099-01-01';document.checkedAt='2099-01-01';}
  }
  staleDraw.startingOrders.forEach(order=>order.warmupGroup=null);
  await database.prepare('UPDATE live_events SET payload=? WHERE id=?').bind(JSON.stringify(staleDraw),keswickEvent.id).run();
  assert.equal((await post('/api/sync',{eventId:keswickEvent.id},platformHeaders)).status,200);
  const reparsedDraw=JSON.parse((await database.prepare('SELECT payload FROM live_events WHERE id=?').bind(keswickEvent.id).first()).payload);
  assert.equal(reparsedDraw.startingOrders.find(order=>order.skaterIds.includes(sydney.id)).warmupGroup,1);
  assert.equal(reparsedDraw.documents.find(document=>document.url===sydneyOrder.sourceUrl).parserVersion,'starting-draw-3');
  console.log('Keswick combined Start Orders/Results hub expands to 61 PDF documents; the related Sydney group imports first, official #2 is preserved, and failed files rotate within the four-file limit.');
  const maxEvent={...syncEvent,id:'SO-999996',url:'https://www.skateontario.org/fixture-max/'};
  await database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?)').bind(maxEvent.id,JSON.stringify(maxEvent),new Date().toISOString()).run();
  const maxResponse=await post('/api/sync',{eventId:maxEvent.id},platformHeaders);assert.equal(maxResponse.status,200,await maxResponse.clone().text());
  const maxSync=await maxResponse.json(),maxRow=maxSync.schedulePreview.find(row=>row.name==='Max Wang');
  const maxSaved=JSON.parse((await database.prepare('SELECT payload FROM live_events WHERE id=?').bind(maxEvent.id).first()).payload);
  assert.ok(maxRow,JSON.stringify({entries:maxSaved.participants,blocks:maxSaved.blocks.filter(b=>b.date==='2026-11-20'&&b.start>='17:00'&&b.start<'18:00')}));
  assert.equal(maxRow.date,'2026-11-20');assert.equal(maxRow.start,'17:35');assert.equal(maxRow.end,'18:10');assert.equal(maxRow.rink,'BLUE RINK');assert.equal(maxRow.startNumber,2);assert.equal(maxRow.warmupGroup,1);
  console.log('Real Keswick PDF in Worker: Max Wang retains Friday 17:35–18:10 BLUE RINK, official #2 and warm-up 1 in the shared regular/NQ session.');
  const newSkater={name:'Fixture Added Skater',coach:'Jen Jackson/Bryce Davidson',training:true,identityPending:false,profileRevision:null,coachRevision:0};
  assert.equal((await post('/api/skaters',newSkater)).status,401);
  for(const role of ['parent','coach']){
    const memberId='roster-'+role,memberEmail=memberId+'@example.test',token='isolated-'+memberId;
    await database.prepare("INSERT INTO hsc_members (id,email,name,role,requested_role,status,auth_version,created_at) VALUES (?,?,?,?,?,'active',1,?)").bind(memberId,memberEmail,memberId,role,role,new Date().toISOString()).run();
    await database.prepare('INSERT INTO hsc_sessions (hash,member_id,auth_version,expires_at,created_at) VALUES (?,?,1,?,?)').bind(hash(token),memberId,new Date(Date.now()+3600000).toISOString(),new Date().toISOString()).run();
    const restricted={'oai-authenticated-user-id':memberId,'oai-authenticated-user-email':memberEmail,cookie:'__Host-hsc_session='+token};
    assert.equal((await post('/api/skaters',newSkater,restricted)).status,403);
    assert.equal((await mf.dispatchFetch(origin+'/api/skaters?id='+fixtureCarson.id,{headers:restricted})).status,403);
    assert.equal((await post('/api/coaches',{changes:[{id:fixtureCarson.id,coach:'No access',revision:0}]},restricted)).status,403);
  }
  const crossWrite=await post('/api/skaters',newSkater,{...platformHeaders,origin:'https://attacker.example.test'});assert.equal(crossWrite.status,403);
  const createdResponse=await post('/api/skaters',newSkater,platformHeaders);assert.equal(createdResponse.status,201,await createdResponse.clone().text());const created=(await createdResponse.json()).skater;
  assert.match(created.id,/^HSC-NEW-/);assert.equal(created.coach,newSkater.coach);assert.equal(created.coachRevision,1);
  assert.equal((await database.prepare('SELECT admitted FROM hsc_admissions WHERE skater_id=?').bind(created.id).first()).admitted,0);
  assert.equal((await database.prepare('SELECT count(*) AS count FROM hsc_relations WHERE skater_id=?').bind(created.id).first()).count,0);
  assert.equal((await post('/api/skaters',{...newSkater,name:' fixture   added skater '},platformHeaders)).status,409);
  assert.equal((await post('/api/skaters',{...newSkater,name:'carson wang'},platformHeaders)).status,409);
  assert.equal((await post('/api/skaters',{...newSkater,name:'Bad\nName'},platformHeaders)).status,400);
  const existingAdmission=await database.prepare('SELECT payload FROM hsc_admissions WHERE skater_id=?').bind(created.id).first();
  await database.prepare('UPDATE hsc_admissions SET admitted=1,payload=? WHERE skater_id=?').bind(JSON.stringify({...JSON.parse(existingAdmission.payload),representedClubs:'Official Fixture Club',retainedField:'keep'}),created.id).run();
  const editable=(await (await mf.dispatchFetch(origin+'/api/skaters?id='+created.id,{headers:platformHeaders})).json()).skater;
  const editBody={...editable,name:'Fixture Updated Skater',coach:'Updated Coach/Second Coach',training:false,identityPending:true};
  const editedResponse=await post('/api/skaters',editBody,platformHeaders);assert.equal(editedResponse.status,200,await editedResponse.clone().text());const edited=(await editedResponse.json()).skater;
  assert.equal(edited.id,created.id);assert.equal(edited.name,editBody.name);assert.equal(edited.coach,editBody.coach);assert.equal(edited.training,false);assert.equal(edited.identityPending,true);
  const retained=await database.prepare('SELECT admitted,payload FROM hsc_admissions WHERE skater_id=?').bind(created.id).first();assert.equal(retained.admitted,1);assert.equal(JSON.parse(retained.payload).representedClubs,'Official Fixture Club');assert.equal(JSON.parse(retained.payload).retainedField,'keep');
  assert.equal((await post('/api/skaters',{...editBody,coach:'Stale editor'},platformHeaders)).status,409);
  const bulkList=await mf.dispatchFetch(origin+'/api/coaches',{headers:platformHeaders});assert.equal(bulkList.status,200);const bulkSkater=(await bulkList.json()).rows.find(row=>row.id===created.id);assert.ok(bulkSkater);assert.equal(bulkSkater.name,editBody.name);assert.equal(bulkSkater.coach,editBody.coach);
  const bulkSave=await post('/api/coaches',{changes:[{id:created.id,coach:'Bulk Coach',revision:bulkSkater.revision}]},platformHeaders);assert.equal(bulkSave.status,200);assert.equal((await bulkSave.json()).saved.length,1);
  assert.equal((await post('/api/skaters',{...edited,coach:'Stale after bulk'},platformHeaders)).status,409);
  const latest=(await (await mf.dispatchFetch(origin+'/api/skaters?id='+created.id,{headers:platformHeaders})).json()).skater;assert.equal(latest.coach,'Bulk Coach');
  const raced=await Promise.all(['Race One','Race Two'].map(coach=>post('/api/skaters',{...latest,coach},platformHeaders)));assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);
  const duplicateRace=await Promise.all([1,2].map(()=>post('/api/skaters',{...newSkater,name:'Concurrent Added Fixture'},platformHeaders)));assert.deepEqual(duplicateRace.map(r=>r.status).sort(),[201,409]);
  const clubAfter=(await (await mf.dispatchFetch(origin+'/api/club',{headers:platformHeaders})).json()).skaters;assert.ok(clubAfter.some(row=>row.id===created.id&&row.name===editBody.name));assert.equal(clubAfter.find(row=>row.id===fixtureCarson.id).name,fixtureCarson.name);
  assert.ok((await database.prepare("SELECT count(*) AS count FROM hsc_audit WHERE action='skater-save'").first()).count>=4);
  console.log('Admin roster: create/edit, new skaters in bulk coaches, duplicate and stale-write rejection, concurrent writes, retained admission/club data and audit; anonymous, parent, coach and cross-origin writes blocked.');

  // Fiona is already in the original roster. Reuse that profile rather than creating an ambiguous duplicate.
  const homeEvent={...syncEvent,id:'SO-999994',name:'STAR 1-4 Homepage Fixture',url:'https://www.skateontario.org/fixture-home/',start:'2027-01-15',end:'2027-01-17',documents:[],participants:[],blocks:[],startingOrders:[]};
  await database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?)').bind(homeEvent.id,JSON.stringify(homeEvent),new Date().toISOString()).run();
  const homeSync=await post('/api/sync',{eventId:homeEvent.id},platformHeaders);assert.equal(homeSync.status,200,await homeSync.clone().text());const homeResult=await homeSync.json();assert.equal(homeResult.participants,547);assert.equal(homeResult.registrationPreview.find(window=>window.kind==='public').closes,'2026-11-16');
  const homeSaved=JSON.parse((await database.prepare('SELECT payload FROM live_events WHERE id=?').bind(homeEvent.id).first()).payload);
  assert.equal(homeSaved.registrations[0].opens,'2026-11-12');assert.equal(homeSaved.registrations[0].closes,'2026-11-16');assert.equal(homeSaved.registrations[0].url,'https://uplifterfigureskating.com/');assert.ok(homeSaved.offeredCategories.includes('STAR 2'));assert.equal(homeSaved.blocks.length,0);
  console.log('Worker homepage: current interim PDF persists 547 records without invented times, plus official registration windows and category metadata.');
  const lowEvent={...syncEvent,id:'SO-999992',name:'Isolated STAR 1-4 Fixture',url:'https://www.skateontario.org/fixture-low-star/',start:'2026-01-16',end:'2026-01-18'};await database.prepare('INSERT INTO live_events (id,payload,updated_at) VALUES (?,?,?)').bind(lowEvent.id,JSON.stringify(lowEvent),new Date().toISOString()).run();
  const lowResponse=await post('/api/sync',{eventId:lowEvent.id},platformHeaders);assert.equal(lowResponse.status,200,await lowResponse.clone().text());const lowResult=await lowResponse.json();assert.equal(lowResult.participants,7);assert.equal(lowResult.matchedSkaters,1);assert.equal(lowResult.blocks,78);const lowSaved=JSON.parse((await database.prepare('SELECT payload FROM live_events WHERE id=?').bind(lowEvent.id).first()).payload);assert.ok(lowSaved.blocks.some(row=>row.category==='STAR 1 - Group 2'&&row.rink==='WEST PAD'&&row.start==='08:30'));
  console.log('Worker STAR 1-4: real rotated schedule PDF and STAR3 entry PDF import 78 blocks / 7 entrants, explicit shared time and PAD preserved.');
  const customOrigin='https://hamiltonskatingclub.memberportal.dev';
  const customSignIn=await mf.dispatchFetch(customOrigin+'/api/auth/sign-in/email',{method:'POST',headers:{origin:customOrigin,'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(customSignIn.status,200,await customSignIn.clone().text());const customPasswordCookie=cookies(customSignIn);
  const customSession=await mf.dispatchFetch(customOrigin+'/api/member?action=session',{method:'POST',headers:{origin:customOrigin,'Content-Type':'application/json',cookie:customPasswordCookie},body:JSON.stringify({role:'parent'})});assert.equal(customSession.status,200,await customSession.clone().text());assert.equal((await customSession.json()).member.role,'admin');
  const customCookie=customPasswordCookie+'; '+cookies(customSession);assert.equal((await mf.dispatchFetch(customOrigin+'/api/results?record=fixture-result',{headers:{cookie:customCookie}})).status,200);
  const crossOrigin=await mf.dispatchFetch(customOrigin+'/api/auth/sign-in/email',{method:'POST',headers:{origin:'https://attacker.example.test','Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(crossOrigin.status,403);
  const usernameSignin=await post('/api/auth/sign-in/username',{username:'owner.fixture',password});assert.equal(usernameSignin.status,200);
  assert.equal((await post('/api/link-password',{}, {cookie:passwordCookie})).status,401);
  const pilotBody={name:'pilot.fixture',username:'pilot.fixture',email:'pilot-fixture@example.test',password,role:'parent',skaterName:'Carson Wang',pilotInvitation:pilotToken};
  assert.equal((await post('/api/auth/registration-skaters',{query:'Mike'})).status,503);
  const nameLookup=await post('/api/auth/registration-skaters',{query:'mike procheav',pilotInvitation:pilotToken});
  assert.equal(nameLookup.status,200,await nameLookup.clone().text());
  const suggested=await nameLookup.json();assert.deepEqual(Object.keys(suggested).sort(),['hasMore','names']);assert.ok(suggested.names.includes('Mike Pochaev'));
  assert.equal((await post('/api/auth/registration-skaters',{query:'Mike',pilotInvitation:pilotToken},{origin:'https://attacker.example.test'})).status,403);
  const pilot=await post('/api/auth/sign-up/email',pilotBody);assert.equal(pilot.status,200,await pilot.clone().text());
  assert.equal(pilot.headers.get('X-HSC-Registration-Mode'),'pilot');
  const pilotUser=(await pilot.json()).user;assert.equal(pilotUser.emailVerified,false);
  const pilotMember=await database.prepare('SELECT role,status FROM hsc_members WHERE id=?').bind('password:'+pilotUser.id).first();
  assert.equal(pilotMember.role,null);assert.equal(pilotMember.status,'club-viewer');
  assert.equal((await post('/api/auth/sign-up/email',pilotBody)).status,409);
  const viewerLogin=await post('/api/auth/sign-in/email',{email:pilotBody.email,password});assert.equal(viewerLogin.status,200);const viewerPassword=cookies(viewerLogin);
  const viewerSession=await post('/api/member?action=session',{role:'parent'},{cookie:viewerPassword});assert.equal(viewerSession.status,200);const viewerHeaders={cookie:viewerPassword+'; '+cookies(viewerSession)};
  assert.equal((await post('/api/auth/registration-skaters',{query:'Mike',pilotInvitation:pilotToken})).status,403);
  const parentAdmin=await (await mf.dispatchFetch(origin+'/api/member?action=admin',{headers:platformHeaders})).json();
  const parentHome=parentAdmin.parentHomes.find(row=>row.memberId==='password:'+pilotUser.id);assert.ok(parentHome);assert.ok(parentHome.skaterIds.includes(fixtureCarson.id));
  assert.equal(parentAdmin.members.find(row=>row.id===parentHome.memberId).email_verified,0);
  const parentChange={memberId:parentHome.memberId,skaterIds:[created.id],revision:parentHome.revision};
  assert.equal((await post('/api/member?action=parent-home-skaters',parentChange,viewerHeaders)).status,403);
  const changedParent=await post('/api/member?action=parent-home-skaters',parentChange,platformHeaders);assert.equal(changedParent.status,200,await changedParent.clone().text());
  assert.deepEqual((await changedParent.json()).preferredSkaterIds,[created.id]);
  assert.equal((await post('/api/member?action=parent-home-skaters',parentChange,platformHeaders)).status,409);
  assert.equal((await database.prepare('SELECT count(*) AS count FROM hsc_relations WHERE member_id=?').bind(parentHome.memberId).first()).count,0);
  console.log('Worker registration suggestions return names only, reject wrong origin and consumed pilot; admin parent homepage updates preserve role and private relations, reject non-admin and stale writes.');
  // Signup pinned Carson; explicitly replace that preference to exercise viewing another skater.
  assert.equal((await post('/api/member?action=home-skater',{skaterId:fixtureCarson.id,pinned:false},viewerHeaders)).status,200);
  assert.equal((await post('/api/member?action=home-skater',{skaterId:created.id,pinned:true},viewerHeaders)).status,200);
  await database.prepare('INSERT INTO coach_plans (id,skater_id,event_id,meeting_time,note,revision) VALUES (?,?,?,?,?,1)').bind(fixtureCarson.id+'|'+syncEvent.id+'|fixture-private',fixtureCarson.id,syncEvent.id,'2026-11-05T10:15','Fixture private coach note').run();
  const viewerClubResponse=await mf.dispatchFetch(origin+'/api/club',{headers:viewerHeaders});assert.equal(viewerClubResponse.status,200);const viewerClub=await viewerClubResponse.json();
  assert.equal(viewerClub.member.role,null);assert.equal(viewerClub.member.status,'club-viewer');assert.ok(viewerClub.ownSkaterIds.includes(created.id));assert.ok(!viewerClub.ownSkaterIds.includes(fixtureCarson.id));
  assert.ok(viewerClub.events.some(event=>event.participants.some(entry=>entry.skaterIds.includes(fixtureCarson.id))&&event.blocks.length>0),'A viewer sees another skater official schedule');assert.equal(viewerClub.plans.length,0);assert.equal(viewerClub.writableSkaterIds.length,0);assert.ok(!JSON.stringify(viewerClub).includes('Fixture private coach note'));
  assert.equal((await post('/api/plans',{skaterId:fixtureCarson.id,eventId:syncEvent.id,slotKey:'fixture',meetingTime:'',note:'Not permitted',revision:0},viewerHeaders)).status,403);
  assert.equal((await post('/api/skaters',newSkater,viewerHeaders)).status,403);assert.equal((await post('/api/sync',{eventId:syncEvent.id},viewerHeaders)).status,403);
  console.log('Shared coach schedule: role-null club viewer pins one skater and reads another skater official event, while private notes, roster edits, plan writes and official sync remain blocked.');

  const memberAction=(action,headers)=>mf.dispatchFetch(origin+'/api/member?action='+action,{headers});
  assert.equal((await memberAction('admin',viewerHeaders)).status,403);
  assert.equal((await memberAction('admin',{cookie:passwordCookie})).status,200);
  const secondLogin=await post('/api/auth/sign-in/email',{email:pilotBody.email,password});
  assert.equal(secondLogin.status,200);
  const secondDevice={cookie:cookies(secondLogin)};
  // A malformed record in this ephemeral D1 makes the roster service unavailable.
  const damagedId='fixture-unreadable-profile';
  await database.prepare('INSERT INTO hsc_admissions (skater_id,payload,updated_by,updated_at) VALUES (?,?,?,?)')
    .bind(damagedId,'{','fixture',new Date().toISOString()).run();
  assert.equal((await memberAction('admin',{cookie:passwordCookie})).status,503,'Confirm that roster reads are failing');
  const identity=await memberAction('identity',viewerHeaders);
  assert.equal(identity.status,200);
  assert.equal((await identity.json()).identity.email,pilotBody.email);
  assert.equal((await post('/api/member?action=session',{role:'parent'},secondDevice)).status,200);
  for(const action of ['logout','revoke-own-sessions']){
    assert.equal((await post('/api/member?action='+action,{}, {...viewerHeaders,origin:'https://other.example.test'})).status,403);
  }
  assert.equal((await memberAction('me',viewerHeaders)).status,200,'Rejected writes leave the current device signed in');
  const logout=()=>post('/api/member?action=logout',{},viewerHeaders);
  assert.equal((await logout()).status,200);
  assert.equal((await memberAction('me',viewerHeaders)).status,401);
  const repeated=await logout();
  assert.equal(repeated.status,200,'Retry after the HSC session was revoked');
  assert.match(repeated.headers.get('set-cookie')||'',/__Host-hsc_session=;.*Max-Age=0/);
  assert.equal((await post('/api/auth/sign-out',{},viewerHeaders)).status,200);
  assert.equal((await logout()).status,200,'The stale login cookie can also be cleared');
  assert.equal((await memberAction('me',viewerHeaders)).status,401);
  assert.equal((await post('/api/member?action=session',{role:'parent'},viewerHeaders)).status,401);
  assert.equal((await memberAction('me',secondDevice)).status,200);
  const thirdLogin=await post('/api/auth/sign-in/username',{username:pilotBody.username,password});
  assert.equal(thirdLogin.status,200);
  const thirdDevice={cookie:cookies(thirdLogin)};
  assert.equal((await post('/api/member?action=session',{role:'parent'},thirdDevice)).status,200);
  assert.equal((await post('/api/member?action=revoke-own-sessions',{},secondDevice)).status,200);
  for(const device of [secondDevice,thirdDevice]){
    assert.equal((await memberAction('me',device)).status,401);
    assert.equal((await post('/api/member?action=session',{role:'parent'},device)).status,401);
  }
  await database.prepare('DELETE FROM hsc_admissions WHERE skater_id=?').bind(damagedId).run();
  assert.equal((await memberAction('admin',{cookie:passwordCookie})).status,200);
  console.log('Account actions survive unreadable roster data. Device sign-out can be retried, cross-origin writes are rejected, and revoke-all only ends this account’s logins.');

  console.log('Worker registration: anonymous blocked; administrator signup, same-identity linking, email/username login and role preserved; pilot signup and single use passed; authenticated results, all opponents, detailed marks and arbitrary-source rejection and custom-domain login/same-origin protection passed; real Worker sync resolves Carson #19 / warm-up 4 to 11:15–12:15 and excludes awards.');
  const scheduleCoachId='fixture-shared-coach',scheduleCoachEmail='shared-coach@example.test';
  await database.prepare("INSERT INTO hsc_members(id,email,name,requested_role,status,auth_version,created_at) VALUES (?,?,?,'coach','club-viewer',1,?)").bind(scheduleCoachId,scheduleCoachEmail,'Jen fixture',new Date().toISOString()).run();
  await database.prepare("INSERT INTO hsc_claims(id,member_id,kind,payload,status,created_at) VALUES (?,?,'membership',?,'pending',?)").bind('fixture-coach-no-child',scheduleCoachId,JSON.stringify({role:'coach',coachName:'Jen Jackson',skaterIds:[]}),new Date().toISOString()).run();
  const scheduleCoachPlatform={'oai-authenticated-user-id':scheduleCoachId,'oai-authenticated-user-email':scheduleCoachEmail};
  const scheduleCoachLogin=await post('/api/member?action=session',{role:'coach'},scheduleCoachPlatform);assert.equal(scheduleCoachLogin.status,200);
  const scheduleCoachHeaders={...scheduleCoachPlatform,cookie:cookies(scheduleCoachLogin)};
  const noChildClubResponse=await mf.dispatchFetch(origin+'/api/club',{headers:scheduleCoachHeaders});assert.equal(noChildClubResponse.status,200);const noChildClub=await noChildClubResponse.json();
  assert.equal(noChildClub.scheduleCoachName,'Jen Jackson');assert.ok(noChildClub.skaters.length>=108);assert.ok(noChildClub.events.length>0);assert.equal(noChildClub.plans.length,0);assert.equal(noChildClub.writableSkaterIds.length,0);
  assert.equal((await post('/api/member?action=self-coach',{skaterId:created.id,coachName:'Bryce Davidson'},scheduleCoachHeaders)).status,400);
  const beforeSelf=(await database.prepare('SELECT coach FROM coach_assignments WHERE skater_id=?').bind(created.id).first()).coach;
  assert.equal((await post('/api/member?action=self-coach',{skaterId:created.id,coachName:'Jen Jackson'},scheduleCoachHeaders)).status,200);
  assert.equal((await database.prepare('SELECT coach FROM coach_assignments WHERE skater_id=?').bind(created.id).first()).coach,beforeSelf+'/Jen Jackson');
  assert.equal((await database.prepare('SELECT count(*) AS count FROM hsc_relations WHERE member_id=?').bind(scheduleCoachId).first()).count,0);
  assert.equal((await post('/api/plans',{skaterId:created.id,eventId:syncEvent.id,slotKey:'fixture',meetingTime:'',note:'No private access',revision:0},scheduleCoachHeaders)).status,403);
  assert.equal((await post('/api/skaters',newSkater,scheduleCoachHeaders)).status,403);
  const activeParentId='fixture-preactivated-parent';
  await database.prepare("INSERT INTO hsc_members(id,email,name,role,requested_role,status,auth_version,created_at) VALUES (?,?,?,'parent','parent','active',1,?)").bind(activeParentId,'activated-parent@example.test','Activated parent fixture',new Date().toISOString()).run();
  await database.prepare("INSERT INTO hsc_claims(id,member_id,kind,payload,status,created_at) VALUES (?,?,'membership',?,'pending',?)").bind('fixture-preactivated-claim',activeParentId,JSON.stringify({role:'parent',skaterIds:[fixtureCarson.id]}),new Date().toISOString()).run();
  assert.equal((await post('/api/member?action=admission',{skaterId:fixtureCarson.id,name:fixtureCarson.name,admitted:true},platformHeaders)).status,200);
  const approveActive=await post('/api/member?action=review-claim',{id:'fixture-preactivated-claim',approve:true},platformHeaders);assert.equal(approveActive.status,200,await approveActive.clone().text());
  assert.equal((await database.prepare("SELECT count(*) AS count FROM hsc_relations WHERE member_id=? AND kind='parent' AND active=1").bind(activeParentId).first()).count,1);
  assert.equal((await post('/api/member?action=review-claim',{id:'fixture-preactivated-claim',approve:true},platformHeaders)).status,409);
  console.log('Worker coach schedule: no-child coach sees all official skaters/events, self-assigns only own name preserving other labels, cannot read/write private plans or edit full profiles. Active same-role parent completes a pending claim once after admission.');
}finally{await mf.dispose();}
