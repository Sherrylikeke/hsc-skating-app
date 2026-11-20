import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('work/browser-qa/browsers');
const {chromium,webkit}=await import(pathToFileURL(process.env.HSC_PLAYWRIGHT_MODULE||path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const origin=process.env.HSC_PREVIEW_ORIGIN||'http://127.0.0.1:5178',output=process.env.HSC_MOBILE_OUTPUT||path.resolve('work/official-notifications-browser');await fs.mkdir(output,{recursive:true});
const skater={id:'leia',name:'Leia Jin',coach:'Jennifer Jackson',training:true,categories:['STAR 2'],clubs:[],recordCount:1,eventCount:1,identityStatus:'fixture'};
const session={date:'2026-12-05',start:'08:00',end:'08:30',rink:'Duliban Rink',category:'STAR 2 - Group 1'};
const member={id:'notification-fixture',name:'Fixture Parent',email:'fixture@example.test',role:'parent',status:'active',auth_version:1};
const baseUpdate={changeId:'change-1',eventId:'SO-325865',eventName:'STAR 1-4 Niagara',skaterName:'Leia Jin',source:'https://skateontario.org/event/star-1-4-niagara-2/',checkedAt:'2026-11-18T16:00:00Z',entryChanged:true,scheduleChanged:true,removed:false,categories:['STAR 2 STAR 2 (Group 1)'],sessions:[session]};
const report=[];
for(const engine of [chromium,webkit]){const browser=await engine.launch({headless:true,...(engine===chromium&&process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});try{
 for(const width of [320,1280])for(const language of ['en','zh'])for(const view of ['member','personal']){
  const firstNotice={id:'notice-1',skater_id:'leia',read_at:null,created_at:'2026-11-18T16:00:00Z',payload:structuredClone(baseUpdate)};
  let notices=[firstNotice],current=session,clubCalls=0,readCalls=0;
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-11-18T16:00:00Z')});
  await page.addInitScript(language=>localStorage.setItem('hsc-language',language),language);
  await context.route('**/api/**',route=>{
   const req=route.request(),url=new URL(req.url()),action=url.searchParams.get('action');let data={};
   if(url.pathname==='/api/official-notifications'){
    if(req.method()==='POST'){const id=req.postDataJSON().id;assert.ok(notices.some(n=>n.id===id));notices=notices.filter(n=>n.id!==id);readCalls++;data={ok:true};}else data={notifications:notices};
   }else if(url.pathname==='/api/club'){
    clubCalls++;
    data={member,ownSkaterIds:['leia'],writableSkaterIds:[],skaters:[skater],events:[{id:'SO-325865',name:'STAR 1-4 Niagara',url:baseUpdate.source,start:'2026-12-04',end:'2026-12-06',timezone:'America/Toronto',venue:'Meridian Community Centre',city:'Fonthill',updateText:'',documents:[],participants:[{id:'entry',name:'Leia Jin',category:'STAR 2 STAR 2 (Group 1)',club:'Hamilton SC',skaterIds:['leia'],sourceUrl:baseUpdate.source}],blocks:[{id:'block',...current,categoryKey:'STAR 2:FREESKATE',group:1,range:null,activity:'competition',page:1,sourceUrl:'https://skateontario.org/schedule.pdf'}],needsReview:false}],plans:[],sync:{},historyEvents:[],recent:[],asOf:'2026-11-18',summary:{category_records:0,team_records:0},reviews:[],limitations:[]};
   }else if(url.pathname==='/api/member')data=action==='identity'?{identity:{name:member.name,email:member.email,provider:'password'}}:action==='me'?{member,skaterIds:[],preferredSkaterIds:['leia'],claims:[]}:action==='notifications'?{notifications:[]}:action==='requirements'?{requirements:[]}:{};
   return route.fulfill({json:data});
  });
  await page.goto(origin+(view==='member'?'/':'/workspace?view=personal'),{waitUntil:'networkidle',timeout:90000});
  const bell=page.locator('.official-bell');await bell.waitFor();await page.locator('.official-badge').waitFor();assert.equal(await page.locator('.official-badge').innerText(),'1');
  await bell.click();const panel=page.locator('.official-update-panel');await panel.waitFor();assert.ok((await panel.innerText()).includes('08:00–08:30 ET'));assert.ok((await panel.innerText()).includes('Leia Jin'));
  assert.equal(await panel.locator('a').first().getAttribute('href'),'/workspace?view=events&event=SO-325865');
  if(engine===chromium&&width===320&&language==='zh'&&view==='member')await page.screenshot({path:path.join(output,'preview-notifications-zh.png'),fullPage:true});
  await panel.getByRole('button',{name:language==='en'?'Mark read':'标记已读',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.official-badge'));assert.equal(readCalls,1);
  assert.equal(await panel.locator('article').count(),0);
  const before=clubCalls;current={...session,start:'08:30',end:'09:00'};
  notices=[{...firstNotice,id:'notice-2',payload:{...baseUpdate,changeId:'change-2',entryChanged:false,sessions:[current]}}];
  await page.clock.fastForward(61000);await page.waitForFunction(()=>document.querySelector('.official-update-panel')?.textContent?.includes('08:30–09:00 ET'));
  assert.ok(clubCalls>before,'A new notification reloads saved schedule data automatically');assert.equal(await page.locator('.official-badge').innerText(),'1');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const rect=await panel.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1);
  const screenshot=[engine.name(),width,language,view].join('-')+'.png';await page.screenshot({path:path.join(output,screenshot),fullPage:true});
  await page.reload({waitUntil:'networkidle'});await page.locator('.official-badge').waitFor();assert.equal(await page.locator('.official-badge').innerText(),'1','Read state survives reload');
  await bell.click();await panel.locator('article').waitFor();assert.doesNotMatch(await panel.innerText(),/08:00–08:30 ET/);
  assert.deepEqual(errors,[]);report.push({engine:engine.name(),width,language,view,screenshot,liveUpdateReload:true,readPersistence:true});await context.close();
 }
}finally{await browser.close();}}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({views:report.length,checks:report,fixtureOnly:true,productionWrites:0},null,2));console.log(JSON.stringify({views:report.length,unreadBadge:true,liveUpdateReload:true,readPersistence:true,output}));
