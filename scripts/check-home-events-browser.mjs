import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('work/browser-qa/browsers');
const {chromium,webkit}=await import(pathToFileURL(path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const origin=process.env.HSC_PREVIEW_ORIGIN||'http://127.0.0.1:5174';
const output=process.env.HSC_MOBILE_OUTPUT||path.resolve('work/home-events-browser');
await fs.mkdir(output,{recursive:true});
const member={id:'fixture-home',name:'Fixture Parent',email:'parent@example.test',role:'parent',status:'active',auth_version:1};
const skater={id:'fixture-child',name:'Fixture Child',coach:'Jen Jackson',training:true,categories:['STAR 2'],clubs:['Hamilton SC'],recordCount:0,eventCount:0,identityStatus:'fixture'};
const other={...skater,id:'other',name:'Other Skater',categories:['Pre-Novice Men']};
const entry={id:'entry',name:skater.name,category:'STAR 2',club:'Hamilton SC',section:'ON',skaterIds:[skater.id],matchStatus:'fixture',sourceUrl:'https://skateontario.org/interim.pdf'};
const event={id:'fixture-upcoming',name:'Upcoming Interim Cup',url:'https://skateontario.org/event/fixture/',start:'2026-12-04',end:'2026-12-06',timezone:'America/Toronto',venue:'Fixture Arena',city:'Hamilton',source:'Skate Ontario',needsReview:false,documents:[{kind:'entries',label:'Interim List',url:entry.sourceUrl},...['A','B'].map(category=>({kind:'start-order',label:'Starting Order',url:'https://skateontario.org/'+category+'.pdf'}))],participants:[entry],blocks:[],startingOrders:[]};
const reminder={...event,id:'registration',name:'January Registration Cup',start:'2027-01-15',end:'2027-01-17',participants:[],documents:[],offeredCategories:['STAR 2'],registrations:[{kind:'public',opens:'2026-11-12',closes:'2026-11-16',url:'https://uplifterfigureskating.com/',sourceUrl:event.url}]};
const unrelated={...reminder,id:'unrelated',name:'Unrelated Senior Cup',offeredCategories:['Senior Men']};
event.registrations=reminder.registrations;
const scheduled={...event,id:'scheduled',name:'Published Schedule Cup',start:'2026-11-20',end:'2026-11-22',blocks:[{id:'official-block',category:'STAR 2',categoryKey:'STAR 2:FREESKATE',group:null,range:null,activity:'competition',date:'2026-11-20',start:'10:00',end:'10:30',rink:'BLUE RINK',page:1,sourceUrl:'https://skateontario.org/schedule.pdf'}]};
const closed={...reminder,id:'closed',name:'Closed Public Registration Cup',start:'2027-01-08',end:'2027-01-10',registrations:[{...reminder.registrations[0],opens:'2026-11-01',closes:'2026-11-09'},{...reminder.registrations[0],kind:'assigned',opens:'2026-11-01',closes:'2026-12-31'}]};
const unknown={...reminder,id:'unknown',name:'Unknown Registration Deadline Cup',registrations:[{...reminder.registrations[0],closes:undefined}]};
const club={member,ownSkaterIds:[skater.id],writableSkaterIds:[],skaters:[skater,other],events:[reminder,event,closed,scheduled,unknown,unrelated],plans:[],sync:{},historyEvents:[],recent:[],asOf:'2026-11-11',summary:{category_records:0,team_records:0},reviews:[],limitations:[]};
const report=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,390,1280])for(const language of ['en','zh']){
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-11T15:00:00Z'));
  await page.addInitScript(language=>localStorage.setItem('hsc-language',language),language);
  await context.route('**/api/**',route=>{
   const url=new URL(route.request().url()),action=url.searchParams.get('action');
   let data={};
   if(url.pathname==='/api/club')data=club;
   else if(url.pathname==='/api/member')data=action==='identity'?{identity:{name:member.name,email:member.email,provider:'password'}}:action==='me'?{member,skaterIds:[skater.id],preferredSkaterIds:[skater.id],claims:[]}:action==='requirements'?{requirements:[]}:action==='notifications'?{notifications:[]}:{};
   return route.fulfill({json:data});
  });
  for(const route of ['/','/workspace?view=home','/workspace?view=personal']){
   await page.goto(origin+route,{waitUntil:'networkidle'});
   await page.locator('.home-event').filter({hasText:'Upcoming Interim Cup'}).waitFor();
   await page.locator('.home-event').filter({hasText:'January Registration Cup'}).waitFor();
   assert.deepEqual(await page.locator('.home-event h3').allTextContents(),['Published Schedule Cup','Upcoming Interim Cup','January Registration Cup']);
   const scheduleCard=page.locator('.home-event').filter({hasText:'Published Schedule Cup'});
   await scheduleCard.locator('.home-event-sessions').getByText('2026-11-20 · 10:00–10:30 · BLUE RINK',{exact:true}).waitFor();
   assert.equal(await scheduleCard.locator('.home-registration').count(),0);
   const portal=page.locator('.home-register-link');assert.equal(await portal.getAttribute('href'),'https://uplifterfigureskating.com/');assert.equal(await portal.getAttribute('target'),'_blank');
   const official=page.locator('.home-event-links a[href="https://skateontario.org/event/fixture/"]');assert.equal(await official.count(),3);
   const geometry=await page.locator('.home-events').evaluate(el=>({width:innerWidth,pageWidth:document.documentElement.scrollWidth,cards:[...el.querySelectorAll('.home-event')].map(card=>{const rect=card.getBoundingClientRect();return {left:rect.left,right:rect.right};})}));
   if(geometry.pageWidth>width+1){await page.screenshot({path:path.join(output,'overflow.png'),fullPage:true});console.log(JSON.stringify({route,width,language,engine:engine.name(),overflow:await page.locator('body *').evaluateAll(nodes=>nodes.filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+1}).slice(0,20).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.slice(0,80),rect:el.getBoundingClientRect().toJSON()})))}));}
   assert.ok(geometry.pageWidth<=width+1,JSON.stringify(geometry));assert.ok(geometry.cards.every(card=>card.left>=0&&card.right<=width+1));
   const filename=[engine.name(),width,language,route==='/'?'member':route.endsWith('home')?'overview':'personal'].join('-')+'.png';
   await page.screenshot({path:path.join(output,filename),fullPage:false});
   report.push({engine:engine.name(),width,language,route,geometry,screenshot:filename});
  }
  await page.locator('.home-event').filter({hasText:'Upcoming Interim Cup'}).locator('h3 a').click();
  await page.locator('.club-event-hero').waitFor();
  assert.equal(await page.locator('.club-documents a').filter({hasText:'Starting Order'}).count(),0);
  assert.equal(await page.locator('.club-documents a[href="https://skateontario.org/event/fixture/"]').count(),1);
  await page.goto(origin+'/workspace?view=home',{waitUntil:'networkidle'});
  await page.clock.setFixedTime(new Date('2026-11-17T15:00:00Z'));await page.reload({waitUntil:'networkidle'});
  assert.deepEqual(await page.locator('.home-event h3').allTextContents(),['Published Schedule Cup','Upcoming Interim Cup'],'Expired public registration disappears while registered events remain');
  scheduled.blocks[0].group=1;scheduled.blocks[0].category='STAR 2 Group 1';
  await page.reload({waitUntil:'networkidle'});
  const pendingCard=page.locator('.home-event').filter({hasText:'Published Schedule Cup'});
  await pendingCard.getByText(/Group time to be confirmed|组别时段待确认/).waitFor();
  assert.ok(!(await pendingCard.innerText()).includes('10:00–10:30'));
  scheduled.blocks[0].group=null;scheduled.blocks[0].category='STAR 2';
  await page.goto(origin+'/workspace?view=events',{waitUntil:'networkidle'});
  await page.locator('.club-event-card').first().waitFor();
  const eventDates=(await page.locator('.club-event-card h2').allTextContents()).map(name=>club.events.find(event=>event.name===name).start);
  assert.deepEqual(eventDates,[...eventDates].sort());
  assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({views:report.length,checks:report,fixtureOnly:true,productionWrites:0},null,2));
console.log(JSON.stringify({views:report.length,engines:['chromium','webkit'],widths:[320,390,1280],languages:['en','zh'],interimOnly:true,registrationLinks:true,officialLinks:true,publicCloseRequired:true,noRepeatRegistration:true,competitionDateOrder:true,publishedSchedule:true,uncertainTimeNotClaimed:true,expiry:true,noPageOverflow:true,output}));
