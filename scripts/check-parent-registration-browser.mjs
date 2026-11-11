import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('work/browser-qa/browsers');
const {chromium,webkit}=await import(pathToFileURL(path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const origin=process.env.HSC_PREVIEW_ORIGIN||'http://127.0.0.1:5174',output=process.env.HSC_MOBILE_OUTPUT||path.resolve('work/parent-registration-browser');
await fs.mkdir(output,{recursive:true});const report=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,1280])for(const language of ['en','zh']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[],writes=[];
  let loggedIn=false;
  const member={id:'fixture-admin',name:'Admin Fixture',email:'admin@example.test',role:'admin',requested_role:'admin',status:'active',auth_version:1};
  const child={id:'known',name:'Known Fixture Child',training:true,identityPending:false,coach:'',categories:[],clubs:[],recordCount:0,eventCount:0,identityStatus:'fixture'};
  const candidates=[child],admissions=[],claims=[{id:'known-parent',member_id:'known-parent',kind:'membership',status:'pending',payload:JSON.stringify({role:'parent',name:child.name,skaterIds:[child.id],registrationMatch:'matched'})},{id:'missing-parent',member_id:'missing-parent',kind:'membership',status:'pending',payload:JSON.stringify({role:'parent',name:'Unlisted Fixture Child',skaterIds:[],registrationMatch:'missing'})}];
  page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(language=>localStorage.setItem('hsc-language',language),language);
  await context.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),action=url.searchParams.get('action');let data={};
   if(url.pathname==='/api/auth/config')data={deliveryConfigured:true,registrationConfigured:true};
   else if(url.pathname==='/api/auth/registration-skaters')data={names:request.postDataJSON().query.includes('Known')?[child.name]:[],hasMore:false};
   else if(url.pathname==='/api/auth/sign-up/email'){writes.push({action:'signup',...request.postDataJSON()});data={user:{email:'parent@example.test'},token:null,registrationMode:'verification',verificationDelivery:'requested'};}
   else if(url.pathname==='/api/club')data={member,skaters:candidates,events:[]};
   else if(url.pathname==='/api/member'){
    if(action==='identity')data={identity:loggedIn?{name:member.name,email:member.email,provider:'password'}:null};
    else if(action==='me')data={member,skaterIds:[],preferredSkaterIds:[],claims:[]};
    else if(action==='admin')data={members:[],parentHomes:[],candidates,admissions,claims,invites:[],relations:[],logs:[],coachCandidates:[],outbox:[]};
    else if(action==='notifications')data={notifications:[]};
    else if(action==='requirements')data={requirements:[]};
    else if(request.method()==='POST'){
     const body=request.postDataJSON();writes.push({action,...body});
     if(action==='admission'){candidates.push({...child,id:body.skaterId,name:body.name});admissions.push({skater_id:body.skaterId,admitted:1,payload:JSON.stringify(body)});}
     if(action==='review-claim')claims.find(claim=>claim.id===body.id).status=body.approve?'approved':'rejected';
     data={ok:true};
    }
   }
   return route.fulfill({json:data});
  });
  // The parent can submit an unlisted full name; the skater role still needs a list selection.
  await page.goto(origin+'/?role=parent',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/^Create an account$|^创建账号$/}).first().click();
  await page.getByLabel(/^(Username|用户名)$/).fill('parent.fixture');
  await page.getByLabel(/^(Password|密码)$/,{exact:true}).fill('Fixture-Password-2026');
  await page.getByLabel(/^(Confirm password|确认密码)$/).fill('Fixture-Password-2026');
  await page.getByLabel(/^(Your email|你的邮箱)$/).fill('parent@example.test');
  await page.getByLabel(/^(Role|身份)$/).selectOption('parent');
  await page.getByRole('combobox',{name:/Child.s full name|孩子的完整姓名/}).fill('Unlisted Fixture Child');
  await page.getByText(/No matching skater. You can register|未找到匹配选手。可填写完整姓名/).waitFor();
  await page.screenshot({path:path.join(output,[engine.name(),width,language,'signup'].join('-')+'.png'),fullPage:true});
  await page.getByRole('button',{name:/^Create account$|^创建账号$/}).last().click();
  await page.getByRole('heading',{name:/^Verify your email$|^验证邮箱$/}).waitFor();
  assert.equal(writes.find(write=>write.action==='signup').skaterName,'Unlisted Fixture Child');
  assert.equal(writes.find(write=>write.action==='signup').role,'parent');
  // Existing child needs one approval; a missing child must complete the admission form first.
  loggedIn=true;await page.goto(origin+'/?tab=admin',{waitUntil:'networkidle'});
  const known=page.locator('[data-claim-id="known-parent"]'),missing=page.locator('[data-claim-id="missing-parent"]');
  await known.waitFor();
  await missing.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,[engine.name(),width,language,'review'].join('-')+'.png'),fullPage:false});
  assert.equal(await known.getByRole('button',{name:/Review skater admission|核验选手准入/}).count(),0);
  await known.getByRole('button',{name:/Approve parent relationship|批准亲子关系/}).click();
  await known.waitFor({state:'detached'});
  assert.deepEqual(writes.find(write=>write.id==='known-parent').skaterIds,['known']);
  assert.equal(await missing.getByRole('button',{name:/Approve parent relationship|批准亲子关系/}).isDisabled(),true);
  await missing.getByRole('button',{name:/Review skater admission|核验选手准入/}).click();
  const form=page.locator('#member-admissions');assert.equal(await form.getByLabel(/^(Name|姓名)$/).inputValue(),'Unlisted Fixture Child');
  await form.getByLabel(/Administrator-confirmed admission|管理员确认准入/).check();
  await form.getByRole('button',{name:/Save admission and record|保存准入与资料/}).click();
  await missing.getByRole('button',{name:/Approve parent relationship|批准亲子关系/}).click();
  await missing.waitFor({state:'detached'});
  const admitted=writes.find(write=>write.action==='admission'),approved=writes.find(write=>write.id==='missing-parent');
  assert.equal(admitted.admitted,true);assert.equal(admitted.name,'Unlisted Fixture Child');assert.deepEqual(approved.skaterIds,[admitted.skaterId]);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  const screenshot=[engine.name(),width,language].join('-')+'.png';await page.screenshot({path:path.join(output,screenshot),fullPage:true});
  report.push({engine:engine.name(),width,language,unlistedParentSignup:true,knownRelationshipOnly:true,missingAdmissionThenRelationship:true,privateWrites:0,screenshot});await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({views:report.length,checks:report,fixtureOnly:true,productionWrites:0},null,2));console.log(JSON.stringify({views:report.length,checksPassed:true,output}));
