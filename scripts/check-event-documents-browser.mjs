// Actual pages with isolated API data; no real member login or production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('work/browser-qa/browsers');
const {chromium,webkit}=await import(pathToFileURL(path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const origin=process.env.HSC_PREVIEW_ORIGIN||'http://127.0.0.1:5176',output=process.env.HSC_MOBILE_OUTPUT||path.resolve('work/event-documents-browser');
await fs.mkdir(output,{recursive:true});
const schedule='https://skateontario.org/wp-content/uploads/2026/08/Schedule.pdf';
const skater={id:'fixture',name:'Fixture Skater',coach:'Jennifer Jackson',training:true,categories:['STAR 2'],clubs:[],recordCount:1,eventCount:1,identityStatus:'fixture'};
const event={id:'SO-325865',name:'STAR 1-4 Niagara',url:'https://skateontario.org/event/star-1-4-niagara-2/',start:'2026-12-04',end:'2026-12-06',timezone:'America/Toronto',venue:'Meridian Community Centre',city:'Fonthill',updateText:'The schedule has been posted. Entry lists will follow soon.',documents:[{url:'https://skateontario.org/interim.pdf',kind:'entries',label:'Interim Entry Lists as of Nov. 4'},{url:schedule,kind:'schedule',label:'Schedule as of Nov. 11'}],participants:[{id:'entry',name:skater.name,category:'STAR 2',club:'Hamilton SC',section:'ON',skaterIds:[skater.id],sourceUrl:'https://skateontario.org/interim.pdf'}],blocks:[],needsReview:true,linksCheckedAt:'2026-11-16T16:00:00Z',linksAttemptedAt:'2026-11-16T16:00:00Z',detailCheckedAt:'2026-11-11T14:00:00Z',entryStatus:'Interim only',scheduleStatus:'Needs review',detailError:'fixture PDF date layout warning'};
const report=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true,...(engine===chromium&&process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,1280])for(const language of ['en','zh'])for(const role of ['parent','admin']){
  const member={id:'fixture-'+role,name:'Fixture Member',email:'fixture@example.test',role,status:'active',auth_version:1};
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-16T16:00:00Z'));
  await page.addInitScript(language=>localStorage.setItem('hsc-language',language),language);
  await context.route('**/api/**',route=>{
   const url=new URL(route.request().url()),action=url.searchParams.get('action');let data={};
   if(url.pathname==='/api/club')data={member,ownSkaterIds:[skater.id],writableSkaterIds:[],skaters:[skater],events:[event],plans:[],sync:{lastCalendarSuccess:'2026-11-16T15:15:02Z'},historyEvents:[],recent:[],asOf:'2026-11-16',summary:{category_records:0,team_records:0},reviews:[],limitations:[]};
   else if(url.pathname==='/api/member')data=action==='identity'?{identity:{name:member.name,email:member.email,provider:'password'}}:action==='me'?{member,skaterIds:[],preferredSkaterIds:[skater.id],claims:[]}:action==='requirements'?{requirements:[]}:action==='notifications'?{notifications:[]}:{};
   return route.fulfill({json:data});
  });
  await page.goto(origin+'/workspace?view=events&event='+event.id,{waitUntil:'networkidle'});
  const hero=page.locator('.club-event-hero');await hero.waitFor();
  const link=hero.locator('a').filter({hasText:language==='en'?'Official schedule PDF':'官方赛程 PDF'});
  assert.equal(await link.count(),1);assert.equal(await link.getAttribute('href'),schedule);
  assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.innerText(),/Nov\. 11/);
  assert.equal(await hero.locator('a').filter({hasText:/Interim/}).count(),1);
  const reference=page.locator('.club-reference');
  if(role==='parent'){assert.equal(await reference.count(),0);assert.ok(!(await page.locator('body').innerText()).includes('fixture PDF date layout warning'));}
  else{
   assert.equal(await reference.getAttribute('open'),null);await reference.locator(':scope > summary').click();
   const content=await reference.innerText();
   for(const label of language==='en'?['Official links last checked','Document import last attempted','Document import last fully succeeded']:['官方链接最近读取成功','文件导入最近尝试','文件导入最近全部成功'])assert.ok(content.includes(label));
   assert.ok(content.includes(language==='en'?'Not yet recorded':'尚无记录'));
   assert.ok(content.includes(language==='en'?'11:00':'11:00'));
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const screenshot=[engine.name(),width,language,role].join('-')+'.png';
  await page.screenshot({path:path.join(output,screenshot),fullPage:true});
  assert.deepEqual(errors,[]);report.push({engine:engine.name(),width,language,role,screenshot});await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({views:report.length,checks:report,fixtureOnly:true,productionWrites:0},null,2));
console.log(JSON.stringify({views:report.length,scheduleWithoutFinalEntryList:true,adminOnlyDiagnostics:true,noOverflow:true,output}));
