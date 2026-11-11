// Render real pages with isolated API fixtures; no production accounts or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('work/browser-qa/browsers');
const {chromium,webkit}=await import(pathToFileURL(path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const origin=process.env.HSC_PREVIEW_ORIGIN||'http://127.0.0.1:5174';
const output=process.env.HSC_MOBILE_OUTPUT||path.resolve('work/home-recommendations-browser');
await fs.mkdir(output,{recursive:true});
const member={id:'fixture-recommendations',name:'Fixture Parent',email:'fixture@example.test',role:'parent',status:'active',auth_version:1};
const base={coach:'Jennifer Jackson',training:true,clubs:[],identityStatus:'fixture',recordCount:1,eventCount:1};
const breken={...base,id:'senior',name:'Breken Brezden',categories:['Senior Women','Women'],hasRegistrationHistory:true,registrationHistory:[{date:'2026-10-15',category:'Senior Women / Singles'},{date:'2026-10-01',category:'Women'}]};
const beginner={...base,id:'beginner',name:'New Fixture Skater',categories:[],recordCount:0,eventCount:0,hasRegistrationHistory:false,registrationHistory:[]};
const progressed={...base,id:'progressed',name:'Progressing Fixture Skater',categories:['STAR 3','STAR 5 Women','STAR 2/3 Solo Dance'],hasRegistrationHistory:true,registrationHistory:[{date:'2026-01-01',category:'STAR 3'},{date:'2026-10-01',category:'STAR 5 Women Free Group 2'},{date:'2026-09-01',category:'STAR 2/3 Solo Dance'}]};
const prototype={url:'https://skateontario.org/event/fixture/',start:'2027-01-15',end:'2027-01-17',timezone:'America/Toronto',venue:'Fixture Arena',city:'Hamilton',source:'Skate Ontario',documents:[],participants:[],blocks:[],startingOrders:[],needsReview:false,registrations:[{kind:'public',opens:'2026-11-12',closes:'2026-11-16',url:'https://uplifterfigureskating.com/',sourceUrl:'https://skateontario.org/event/fixture/'}]};
const events=[
 {...prototype,id:'star',name:'STAR 1-4 Fixture Cup',offeredCategories:['STAR 1','STAR 2','STAR 3','STAR 4']},
 {...prototype,id:'provincial',name:'Provincial Series Fixture Cup',offeredCategories:['STAR 5 Women','Women']},
 {...prototype,id:'sectional',name:'Sectional Series Fixture Cup',offeredCategories:['Senior Women']},
 {...prototype,id:'dance',name:'Solo Dance Fixture Cup',offeredCategories:['STAR 2/3 Solo Dance']},
];
const scenarios=[
 {id:'senior',skaters:[breken],expected:['Sectional Series Fixture Cup']},
 {id:'beginner',skaters:[beginner],expected:['STAR 1-4 Fixture Cup']},
 {id:'progressed',skaters:[progressed],expected:['Provincial Series Fixture Cup','Solo Dance Fixture Cup']},
 {id:'siblings',skaters:[breken,beginner],expected:['Sectional Series Fixture Cup','STAR 1-4 Fixture Cup']},
];
const historyMeta=JSON.parse(await fs.readFile('data/history-meta.json','utf8')).skaters.find(row=>row.name==='Ava Medeiros');
const ava={...base,id:historyMeta.skater_id,name:historyMeta.name,categories:historyMeta.categories,recordCount:historyMeta.record_count,hasRegistrationHistory:true,registrationHistory:JSON.parse(await fs.readFile('data/history-records.json','utf8')).filter(row=>row.skater_ids.includes(historyMeta.skater_id)&&row.status!=='withdrawn'&&row.start_date>='2025-11-11'&&row.start_date<='2026-11-11').map(row=>({date:row.start_date,category:row.category}))};
const lake=JSON.parse(await fs.readFile('tests/fixtures/lake-superior-2027-registration.json','utf8')).event;
const avaScenarios=[
 {id:'ava-generic',skaters:[ava],events:[{...lake,offeredCategories:['Juvenile']}],expected:[lake.name]},
 {id:'ava-specific',skaters:[ava],events:[{...lake,offeredCategories:['Juvenile Women U14']}],expected:[lake.name]},
];
const activeScenarios=process.env.HSC_RECOMMENDATION_CASE==='ava'?avaScenarios:scenarios;
const report=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,1280])for(const language of ['en','zh']){
  let scenario=activeScenarios[0];
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-11T15:00:00Z'));
  await page.addInitScript(language=>localStorage.setItem('hsc-language',language),language);
  await context.route('**/api/**',route=>{
   const url=new URL(route.request().url()),action=url.searchParams.get('action'),ownIds=scenario.skaters.map(skater=>skater.id);let data={};
   if(url.pathname==='/api/club')data={member,ownSkaterIds:ownIds,writableSkaterIds:[],skaters:[breken,beginner,progressed,ava],events:scenario.events||events,plans:[],sync:{},historyEvents:[],recent:[],asOf:'2026-11-11',summary:{category_records:0,team_records:0},reviews:[],limitations:[]};
   else if(url.pathname==='/api/member')data=action==='identity'?{identity:{name:member.name,email:member.email,provider:'password'}}:action==='me'?{member,skaterIds:[],preferredSkaterIds:ownIds,claims:[]}:action==='requirements'?{requirements:[]}:action==='notifications'?{notifications:[]}:{};
   return route.fulfill({json:data});
  });
  for(scenario of activeScenarios){
   await page.goto(origin+'/workspace?view=home',{waitUntil:'networkidle'});
   await page.locator('.home-event').first().waitFor();
   assert.deepEqual(await page.locator('.home-event h3').allTextContents(),scenario.expected,scenario.id);
   for(const card of await page.locator('.home-event').all()){
    const title=await card.locator('h3').innerText(),names=await card.locator('.home-event-skaters').innerText();
    if(title.includes('STAR 1-4'))assert.equal(names,beginner.name);
    if(title.includes('Sectional'))assert.equal(names,breken.name);
    if(scenario.id.startsWith('ava-'))assert.equal(names,ava.name);
    const portal=card.locator('.home-register-link');assert.equal(await portal.getAttribute('href'),scenario.id.startsWith('ava-')?lake.registrations[0].url:'https://uplifterfigureskating.com/');
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const screenshot=[engine.name(),width,language,scenario.id].join('-')+'.png';
   await page.screenshot({path:path.join(output,screenshot),fullPage:true});
   report.push({engine:engine.name(),width,language,scenario:scenario.id,events:scenario.expected,screenshot});
  }
  assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({views:report.length,checks:report,fixtureOnly:true,productionWrites:0},null,2));
console.log(JSON.stringify({views:report.length,engines:['chromium','webkit'],widths:[320,1280],languages:['en','zh'],scenarios:activeScenarios.map(scenario=>scenario.id),noOverflow:true,output}));
