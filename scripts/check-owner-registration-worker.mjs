// Run after the production build. Uses an ephemeral Worker and D1 with fixture credentials only.
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const origin='https://hsc-coach-roster.sherrylikeke.chatgpt.site';
const root=path.resolve('dist/server');
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
const mf=new Miniflare({modules,modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{
  BETTER_AUTH_SECRET:'isolated-tests-only-secret-0123456789-abcdef',
  HSC_PILOT_REGISTRATIONS:JSON.stringify([{email:'pilot-fixture@example.test',role:'parent',invitationHash:hash(pilotToken),expiresAt:new Date(Date.now()+3600000).toISOString()}]),
},outboundService:request=>{const url=new URL(request.url);
if(url.hostname==='skatingresults.ca'){if(url.pathname.endsWith('/categories'))return Response.json({Categories:[startingFixture.category]});if(url.pathname.endsWith('/segments'))return Response.json({Segments:startingFixture.segments});const id=url.pathname.match(/segment\/([^/]+)\/entries$/)?.[1];if(id)return Response.json(startingFixture.entries[id]);return new Response(startingHtml);}
if(url.hostname==='www.skateontario.org'){
if(url.pathname==='/fixture-low-star/')return new Response('<a href="https://www.skateontario.org/fixture-low-star-schedule.pdf">Schedule</a><a href="https://www.skateontario.org/fixture-low-star-entry.pdf">Entry List</a>');
if(url.pathname==='/fixture-low-star-schedule.pdf')return new Response(fs.readFileSync('tests/fixtures/star1-4-east-gwillimbury-2026-schedule.pdf'));
if(url.pathname==='/fixture-low-star-entry.pdf')return new Response(fs.readFileSync('tests/fixtures/star3-niagara-2025-entry.pdf'));

if(url.pathname==='/fixture-event/')return new Response('<a href="https://www.skateontario.org/Awards-Schedule.pdf">Awards Schedule</a><a href="https://www.skateontario.org/competition-schedule.pdf">Competition Schedule</a><a href="https://www.skateontario.org/fixture-entries.html">Entry List</a><a href="'+startingFixture.documentUrl+'">Start Orders &amp; Results</a>');
if(url.pathname==='/Awards-Schedule.pdf'){awardsFetches++;return new Response('Must not import awards as competition times',{status:500});}
if(url.pathname==='/competition-schedule.pdf')return new Response(fs.readFileSync('tests/fixtures/sectionals-2026-oct26-schedule.pdf'),{headers:{'Content-Type':'application/pdf'}});
if(url.pathname==='/fixture-entries.html')return new Response('<table><tr data-category="Pre-Novice Men" data-club="Hamilton SC"><td><span class="skater-name">Carson Wang</span></td></tr></table>');if(url.pathname.endsWith('CR.pdf'))return new Response(fs.readFileSync('tests/fixtures/results-provincials-2026-u10-category.pdf'),{headers:{'Content-Type':'application/pdf'}});if(url.pathname.endsWith('DRO.pdf'))return new Response(fs.readFileSync('tests/fixtures/results-provincials-2026-u10-detail.pdf'),{headers:{'Content-Type':'application/pdf'}});return new Response('<a href="26PROVSTAR5WomenU10FP2DRO.pdf">Detailed classification</a>');}if(url.hostname!==fixtureHost)return new Response('Unavailable fixture',{status:404});officialRequests++;if(url.pathname.endsWith('/elements'))return Response.json(markFixture.elements);if(url.pathname.endsWith('/components'))return Response.json(markFixture.components);return Response.json({CompetitorEntries:[{competitorEntryId:'fixture-entry-a',competitorName:'Fixture Alpha',competitorClub:'Fixture Club',segmentRank:1,categoryRank:1,tes:16.66,pcs:13.67,score:30.33,competitorStatus:'SCORED'},{competitorEntryId:'fixture-entry-b',competitorName:'Fixture Beta',competitorClub:'Other Fixture Club',segmentRank:2,categoryRank:2,tes:15,pcs:13,score:28,competitorStatus:'SCORED'}]});},serviceBindings:{ASSETS:()=>new Response('Missing',{status:404})}});
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
  // Admin roster writes use the real Worker routes and isolated D1; no production data is changed.
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

  await database.prepare('INSERT INTO hsc_admissions (skater_id,admitted,payload,updated_by,updated_at) VALUES (?,0,?,?,?)').bind('fixture-low-fiona',JSON.stringify({name:'Fiona Villella',training:true,identityPending:false}),'fixture',new Date().toISOString()).run();
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
  const pilot=await post('/api/auth/sign-up/email',pilotBody);assert.equal(pilot.status,200,await pilot.clone().text());
  assert.equal(pilot.headers.get('X-HSC-Registration-Mode'),'pilot');
  const pilotUser=(await pilot.json()).user;assert.equal(pilotUser.emailVerified,false);
  const pilotMember=await database.prepare('SELECT role,status FROM hsc_members WHERE id=?').bind('password:'+pilotUser.id).first();
  assert.equal(pilotMember.role,null);assert.equal(pilotMember.status,'club-viewer');
  assert.equal((await post('/api/auth/sign-up/email',pilotBody)).status,409);
  const viewerLogin=await post('/api/auth/sign-in/email',{email:pilotBody.email,password});assert.equal(viewerLogin.status,200);const viewerPassword=cookies(viewerLogin);
  const viewerSession=await post('/api/member?action=session',{role:'parent'},{cookie:viewerPassword});assert.equal(viewerSession.status,200);const viewerHeaders={cookie:viewerPassword+'; '+cookies(viewerSession)};
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

  console.log('Worker registration: anonymous blocked; administrator signup, same-identity linking, email/username login and role preserved; pilot signup and single use passed; authenticated results, all opponents, detailed marks and arbitrary-source rejection and custom-domain login/same-origin protection passed; real Worker sync resolves Carson #19 / warm-up 4 to 11:15–12:15 and excludes awards.');
}finally{await mf.dispose();}
