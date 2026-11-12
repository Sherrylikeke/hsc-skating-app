// Real pages, isolated API fixtures, and published registration facts only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('work/browser-qa/browsers');
const {chromium,webkit}=await import(pathToFileURL(path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const origin=process.env.HSC_PREVIEW_ORIGIN||'http://127.0.0.1:5174',output=process.env.HSC_MOBILE_OUTPUT||path.resolve('work/registration-phases-browser');
await fs.mkdir(output,{recursive:true});
const facts=JSON.parse(await fs.readFile('tests/fixtures/registration-phases-2027.json','utf8'));
const member={id:'fixture-phases',name:'Fixture Parent',email:'fixture@example.test',role:'parent',status:'active',auth_version:1};
const base={coach:'Jennifer Jackson',training:true,clubs:[],identityStatus:'fixture',eventCount:1};
const ava={...base,id:'ava',name:'Ava Medeiros',categories:['Juvenile Women U14'],recordCount:1,hasRegistrationHistory:true,registrationHistory:[{date:'2026-10-15',category:'Juvenile Women U14'}]};
const beginner={...base,id:'new',name:'First-time Fixture Skater',categories:[],recordCount:0,hasRegistrationHistory:false,registrationHistory:[]};
const scenarios=[{id:'milton',skater:ava,event:facts.milton},{id:'waterloo',skater:beginner,event:facts.waterloo}],report=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true,...(engine===chromium&&process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,1280])for(const language of ['en','zh']){
  let scenario=scenarios[0];
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-12T14:00:00Z'));
  await page.addInitScript(language=>localStorage.setItem('hsc-language',language),language);
  await context.route('**/api/**',route=>{
   const url=new URL(route.request().url()),action=url.searchParams.get('action'),ownIds=[scenario.skater.id];let data={};
   if(url.pathname==='/api/club')data={member,ownSkaterIds:ownIds,writableSkaterIds:[],skaters:[ava,beginner],events:[facts.milton,facts.waterloo],plans:[],sync:{},historyEvents:[],recent:[],asOf:'2026-11-12',summary:{category_records:0,team_records:0},reviews:[],limitations:[]};
   else if(url.pathname==='/api/member')data=action==='identity'?{identity:{name:member.name,email:member.email,provider:'password'}}:action==='me'?{member,skaterIds:[],preferredSkaterIds:ownIds,claims:[]}:action==='requirements'?{requirements:[]}:action==='notifications'?{notifications:[]}:{};
   return route.fulfill({json:data});
  });
  for(scenario of scenarios)for(const view of ['home','personal']){
   await page.goto(origin+'/workspace?view='+view,{waitUntil:'networkidle'});
   const card=page.locator('.home-event');await card.first().waitFor();
   assert.equal(await card.count(),1);assert.deepEqual(await card.locator('h3').allTextContents(),[scenario.event.name]);
   assert.equal(await card.locator('.home-event-skaters').innerText(),scenario.skater.name);
   const phases=card.locator('.home-registration-phase');assert.equal(await phases.count(),2);
   for(const [index,window] of scenario.event.registrations.entries()){
    const phase=phases.nth(index),content=await phase.innerText();
    assert.ok(content.includes(window.opens+' · '+window.opensTime+' ET'),content);
    assert.ok(content.includes(window.closes+' · '+window.closesTime+' ET'),content);
    assert.match(await phase.locator('strong').innerText(),index===0?/Assigned/:/Public/);
   }
   assert.match(await card.locator('.home-registration small').innerText(),/official assignment|官方分配/);
   assert.equal(await card.locator('.home-register-link').getAttribute('href'),'https://uplifterfigureskating.com/');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const screenshot=[engine.name(),width,language,scenario.id,view].join('-')+'.png';
   await page.screenshot({path:path.join(output,screenshot),fullPage:true});
   report.push({engine:engine.name(),width,language,event:scenario.id,view,screenshot});
  }
  assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({views:report.length,checks:report,fixtureOnly:true,productionWrites:0},null,2));
console.log(JSON.stringify({views:report.length,assignedAndPublic:true,allFourOfficialTimes:true,categoryScope:true,easternTime:true,engines:['chromium','webkit'],output}));
