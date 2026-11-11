import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH??=path.resolve('work/browser-qa/browsers');
const {chromium,webkit}=await import(pathToFileURL(path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const origin=process.env.HSC_PREVIEW_ORIGIN||'http://127.0.0.1:5174';
const output=process.env.HSC_MOBILE_OUTPUT||path.resolve('work/home-records-browser');
await fs.mkdir(output,{recursive:true});
const child={id:'fixture-child',name:'My Fixture Skater',coach:'Jen Jackson',training:true,categories:[],clubs:[],recordCount:1,eventCount:1,identityStatus:'fixture'};
const other={...child,id:'fixture-other',name:'Other Fixture Skater'};
const base={club:'Hamilton SC',section:'ON',event_url:'https://skateontario.org/event/fixture/',event_key:'fixture-event',start_date:'2026-10-01',category:'STAR 2',result_level:'category',rank:1,total_score:20,status:'result',source_url:'https://skateontario.org/results.pdf',entity_type:'skater'};
const own={...base,record_id:'own',name:child.name,event_name:'My Imported Cup',skater_ids:[child.id]};
const foreign={...base,record_id:'foreign',name:other.name,event_name:'Other Imported Cup',skater_ids:[other.id]};
const report=[];
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
 try{for(const width of [320,1280])for(const language of ['en','zh'])for(const role of ['viewer','parent','skater','coach','admin']){
  const member={id:'fixture-'+role,name:'Fixture Member',email:role+'@example.test',role:role==='viewer'?null:role,requested_role:role==='viewer'?'parent':role,status:role==='viewer'?'club-viewer':'active',auth_version:1};
  let ownSkaterIds=[child.id];
  const club=()=>({member,ownSkaterIds,writableSkaterIds:[],skaters:[child,other],events:[],plans:[],sync:{},historyEvents:[],recent:[foreign,own],asOf:'2026-11-11',summary:{category_records:2,team_records:0},reviews:[{name_a:'Admin Review Fixture',name_b:'Similar Name Fixture',issue:'similar'}],limitations:[]});
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(language=>localStorage.setItem('hsc-language',language),language);
  await context.route('**/api/**',route=>{
   const url=new URL(route.request().url()),action=url.searchParams.get('action');let data={};
   if(url.pathname==='/api/club')data=club();
   else if(url.pathname==='/api/member')data=action==='identity'?{identity:{name:member.name,email:member.email,provider:'password'}}:action==='me'?{member,skaterIds:[],preferredSkaterIds:ownSkaterIds,claims:[]}:action==='admin'?{members:[],parentHomes:[],candidates:[],admissions:[],relations:[],invites:[],claims:[],logs:[],coachCandidates:[],outbox:[]}:action==='requirements'?{requirements:[]}:action==='notifications'?{notifications:[]}:{};
   return route.fulfill({json:data});
  });
  await page.goto(origin+'/workspace?view=home',{waitUntil:'networkidle'});
  const recent=page.locator('section.club-panel').filter({has:page.getByRole('heading',{name:/Recently imported competition records|最近收录的比赛记录/})});
  await recent.getByText('My Imported Cup',{exact:true}).waitFor();
  assert.equal(await recent.getByText('Other Imported Cup',{exact:true}).count(),role==='admin'?1:0);
  assert.equal(await page.getByRole('heading',{name:/^Record review$|^资料核对$/}).count(),role==='admin'?1:0);
  assert.equal((await page.locator('.club-review-list').allTextContents()).some(value=>value.includes('Admin Review Fixture')),role==='admin');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const screenshot=[engine.name(),width,language,role].join('-')+'.png';
  await page.screenshot({path:path.join(output,screenshot),fullPage:true});
  if(role!=='admin'){
   ownSkaterIds=[];await page.reload({waitUntil:'networkidle'});
   await page.getByText(/No competition records have been imported for My Skaters yet.|暂未收录 My Skaters 的比赛记录。/).waitFor();
   assert.equal(await recent.locator('tbody tr').count(),0);
  }else{
   await page.goto(origin+'/?tab=admin',{waitUntil:'networkidle'});
   await page.getByText(/Registered users can already view shared official schedules.|注册用户已经可以查看共享官方赛程。/).waitFor();
  }
  assert.deepEqual(errors,[]);report.push({engine:engine.name(),width,language,role,screenshot});await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(path.join(output,'report.json'),JSON.stringify({views:report.length,checks:report,adminOnlyReview:true,ownRecordsOnly:true,emptyState:true,adminApprovalExplanation:true,fixtureOnly:true,productionWrites:0},null,2));
console.log(JSON.stringify({views:report.length,engines:['chromium','webkit'],widths:[320,1280],languages:['en','zh'],roles:['viewer','parent','skater','coach','admin'],adminOnlyReview:true,ownRecordsOnly:true,emptyState:true,adminApprovalExplanation:true,output}));
