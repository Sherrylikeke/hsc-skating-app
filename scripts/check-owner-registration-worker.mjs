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
const fixtureHost='sc-css-public-api-cmh9d3htgxfpdkb7.canadacentral-01.azurewebsites.net';
let officialRequests=0;
const mf=new Miniflare({modules,modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{
  BETTER_AUTH_SECRET:'isolated-tests-only-secret-0123456789-abcdef',
  HSC_PILOT_REGISTRATIONS:JSON.stringify([{email:'pilot-fixture@example.test',role:'parent',invitationHash:hash(pilotToken),expiresAt:new Date(Date.now()+3600000).toISOString()}]),
},outboundService:request=>{const url=new URL(request.url);if(url.hostname==='www.skateontario.org'){if(url.pathname.endsWith('CR.pdf'))return new Response(fs.readFileSync('tests/fixtures/results-provincials-2026-u10-category.pdf'),{headers:{'Content-Type':'application/pdf'}});if(url.pathname.endsWith('DRO.pdf'))return new Response(fs.readFileSync('tests/fixtures/results-provincials-2026-u10-detail.pdf'),{headers:{'Content-Type':'application/pdf'}});return new Response('<a href="26PROVSTAR5WomenU10FP2DRO.pdf">Detailed classification</a>');}if(url.hostname!==fixtureHost)return new Response('Unavailable fixture',{status:404});officialRequests++;if(url.pathname.endsWith('/elements'))return Response.json(markFixture.elements);if(url.pathname.endsWith('/components'))return Response.json(markFixture.components);return Response.json({CompetitorEntries:[{competitorEntryId:'fixture-entry-a',competitorName:'Fixture Alpha',competitorClub:'Fixture Club',segmentRank:1,categoryRank:1,tes:16.66,pcs:13.67,score:30.33,competitorStatus:'SCORED'},{competitorEntryId:'fixture-entry-b',competitorName:'Fixture Beta',competitorClub:'Other Fixture Club',segmentRank:2,categoryRank:2,tes:15,pcs:13,score:28,competitorStatus:'SCORED'}]});},serviceBindings:{ASSETS:()=>new Response('Missing',{status:404})}});
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
  console.log('Worker registration: anonymous blocked; administrator signup, same-identity linking, email/username login and role preserved; pilot signup and single use passed; authenticated results, all opponents, detailed marks and arbitrary-source rejection and custom-domain login/same-origin protection passed.');
}finally{await mf.dispose();}
