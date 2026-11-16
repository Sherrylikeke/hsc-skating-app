import {phoneGroups,browserGroup} from './browser-devices.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {scheduleRows} from '../lib/official-parser.ts';

const cache=path.resolve('work/browser-qa/browsers');
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync(cache))process.env.PLAYWRIGHT_BROWSERS_PATH=cache;
const pw=await import(pathToFileURL(process.env.HSC_PLAYWRIGHT_MODULE||path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const origin=process.env.HSC_PREVIEW_ORIGIN||'http://127.0.0.1:5173';
const output=process.env.HSC_PLANNING_OUTPUT||path.resolve('work/planning-browser');
const day='2026-11-20',nextDay='2026-11-21',source='https://example.test/november-cup';
const own=['ana','ben'];
const skaters=[['ana','Ana Reed','Senior Women'],['ben','Ben Reed','Junior Men'],['nora','Nora Lin','Senior Women']].map(([id,name,category])=>({
  id,name,coach:'Fixture Coach',training:true,categories:[category],clubs:['Home Club'],recordCount:1,eventCount:1,identityStatus:'Fixture',
  registrationHistory:[{date:'2026-10-01',category}],hasRegistrationHistory:true,
}));
const participants=skaters.map((skater,i)=>({id:'entry'+i,name:skater.name,category:skater.categories[0],club:'Home Club',section:'ON',skaterIds:[skater.id],matchStatus:'Fixture',sourceUrl:source+'/entries'}));
const block=(id,category,start,end,extra={})=>({id,date:day,category,categoryKey:'',group:null,range:null,activity:'competition',start,end,rink:id==='ben-short'?'Red':'Blue',page:1,sourceUrl:source+'/schedule',...extra});
const blocks=[block('ana-short','Senior Women SHORT','11:00','11:30'),block('ana-free','Senior Women FREE','14:00','14:40'),
  block('ben-short','Junior Men SHORT','12:00','12:30'),block('ben-free-pending','Junior Men FREE (1-6)','16:01','16:40',{range:[1,6]}),
  block('ana-next','Senior Women SHORT','10:00','10:30',{date:nextDay})];
const startingOrders=[['ana-short','Ana Reed','ana','Senior Women SHORT','short',1,'11:04'],['ben-short','Ben Reed','ben','Junior Men SHORT','short',1,'12:05'],
  ['ana-free','Ana Reed','ana','Senior Women FREE','free',1,null],['nora-free','Nora Lin','nora','Senior Women FREE','free',2,null]]
  .map(([id,name,skaterId,category,program,startNumber,individualTime])=>({id,name,category,program,startNumber,individualTime,warmupGroup:1,skaterIds:[skaterId],sourceUrl:source+'/order-'+program,page:1}));
const event={id:'november',name:'November Cup',start:day,end:nextDay,timezone:'America/Toronto',venue:'Fixture Arena',city:'Hamilton',url:source,
  documents:[],needsReview:true,source:'Skate Ontario',participants,blocks,startingOrders,
  sourceStatus:{lastSuccess:'2026-11-19T22:00:00Z',lastAttempt:'2026-11-20T05:00:00Z',needsReview:true,retainedSchedule:true}};
const future={...event,id:'winter',name:'Winter Cup',start:'2026-12-12',end:'2026-12-13',participants:[],blocks:[],startingOrders:[],needsReview:false,
  sourceStatus:{lastSuccess:'2026-11-19T22:00:00Z',needsReview:false},registrations:[{kind:'public',opens:'2026-11-18',closes:'2026-12-01',opensTime:'12:00',closesTime:'23:59',timezone:'America/Toronto',url:'https://registration.example.test/cup',sourceUrl:source}]};
const officialRows=scheduleRows([event],skaters);
const first=officialRows.find(row=>row.skaterId==='ana'&&row.date===day&&row.category.endsWith('SHORT'));
assert.ok(first);
const approvedPlan={id:'approved',skaterId:'ana',eventId:event.id,slotKey:first.slotKey,meetingTime:day+'T09:30',note:'Approved coach meeting point: rink entrance.',revision:1};
const parent={id:'family-a',name:'Taylor Reed',email:'parent@example.test',role:'parent',status:'active'};

async function journey(browser,profile,language,folder,engine) {
  const context=await browser.newContext({...profile,locale:language==='zh'?'zh-CN':'en-CA',timezoneId:'America/Vancouver'});
  const page=await context.newPage(),errors=[],writes=[],registrationPlans=new Map(),subscriptions=new Map();
  page.setDefaultTimeout(12_000);
  let member=parent;
  const ui=(english,chinese)=>language==='en'?english:chinese;
  const screenshot=name=>page.screenshot({path:path.join(folder,name+'.png'),scale:'css',animations:'disabled'});
  const choose=async(label,value)=>{
    // Read the native option label, then use the same phone picker as a real user.
    const text=await page.locator('select[aria-label="'+label+'"]').locator('option').evaluateAll((options,value)=>options.find(option=>option.value===value)?.textContent,value);
    assert.ok(text,'picker option exists: '+label+' = '+value);
    await page.getByRole('combobox',{name:label,exact:true}).click();
    await page.getByRole('option',{name:text,exact:true}).click();
  };
  const readyChecklist=()=>page.waitForFunction(()=>document.querySelector('.day-checklist input')?.disabled===false);
  const checkboxState=async checked=>{
    await page.waitForFunction(checked=>{const input=document.querySelector('.day-checklist input');return input&&!input.disabled&&input.checked===checked;},checked);
    assert.equal(await anaCheckbox().isChecked(),checked);
  };
  const anaCheckbox=()=>page.getByRole('group',{name:'Ana Reed',exact:true}).getByRole('checkbox',{name:ui('Skates & guards','冰鞋与刀套'),exact:true});
  const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'mobile page has no horizontal overflow');
  try {
    // Toronto is already Nov 20 while this browser's Vancouver clock is still Nov 19.
    await page.clock.setFixedTime(new Date('2026-11-20T05:30:00Z'));
    await page.addInitScript(language=>localStorage.setItem('hsc-language',language),language);
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/**',async route=>{
      const request=route.request(),url=new URL(request.url()),method=request.method();
      if(method!=='GET')writes.push({path:url.pathname,method,body:request.postDataJSON()});
      if(url.pathname==='/api/registrations'){
        const plans=registrationPlans.get(member.id)||[];
        if(method==='GET')return route.fulfill({json:{plans}});
        const body=request.postDataJSON(),plan=body.status?{...body,updatedAt:'2026-11-20T05:30:00Z'}:null;
        registrationPlans.set(member.id,[...plans.filter(plan=>plan.skaterId!==body.skaterId||plan.eventId!==body.eventId),...(plan?[plan]:[])]);
        return route.fulfill({json:{plan}});
      }
      if(url.pathname==='/api/calendar/subscription'){
        if(method==='GET')return route.fulfill({json:{active:subscriptions.has(member.id)}});
        const {action}=request.postDataJSON();
        if(action==='revoke'){subscriptions.delete(member.id);return route.fulfill({json:{active:false}});}
        const token=(action==='replace'?'b':'a').repeat(64);subscriptions.set(member.id,token);
        return route.fulfill({json:{active:true,createdAt:'2026-11-20T05:30:00Z',updatedAt:'2026-11-20T05:30:00Z',url:origin+'/api/calendar/feed?token='+token}});
      }
      const club={member,ownSkaterIds:own,writableSkaterIds:[],skaters,events:[event,future],plans:member.id===parent.id?[approvedPlan]:[],
        sync:{sourceStatus:{lastSuccess:'2026-11-19T22:00:00Z',needsReview:false}},historyEvents:[],recent:[],asOf:day,summary:{category_records:0,team_records:0},reviews:[],limitations:[]};
      const actions={identity:{identity:{name:member.name,email:member.email,provider:'password'}},me:{member,skaterIds:own,preferredSkaterIds:own,claims:[]},notifications:{notifications:[]},requirements:{requirements:[]}};
      return route.fulfill({json:url.pathname==='/api/club'?club:actions[url.searchParams.get('action')]||{}});
    });

    await page.goto(origin+'/workspace?view=day');
    await readyChecklist();
    const cards=page.locator('.day-session');
    assert.equal(await cards.count(),4,'SHORT/FREE remain two sessions per child');
    assert.match(await cards.filter({hasText:'Senior Women SHORT'}).innerText(),/09:30/);
    assert.match(await cards.filter({hasText:'Senior Women FREE'}).innerText(),/Estimated warm-up|预计上冰热身/);
    const pending=cards.filter({hasText:'Junior Men FREE'});
    assert.match(await pending.innerText(),/To be confirmed|待确认/);assert.ok(!(await pending.innerText()).includes('16:01'));
    assert.match(await page.locator('.day-source').innerText(),/last valid schedule|上次有效赛程/);
    assert.ok(!(await page.locator('.competition-day').innerText()).includes('Nora Lin'));
    await anaCheckbox().check();
    await page.reload();await checkboxState(true);
    await choose(ui('Skaters on competition day','比赛日选手'),'ana');assert.equal(await cards.count(),2);
    await choose(ui('Competition day date','比赛日日期'),nextDay);await checkboxState(false);assert.equal(await cards.count(),1);
    await choose(ui('Competition day date','比赛日日期'),day);await checkboxState(true);
    await choose(ui('Skaters on competition day','比赛日选手'),'');
    await noOverflow();await page.evaluate(()=>scrollTo(0,0));await screenshot('competition-day');
    const navigation=await page.locator('.club-sidebar').boundingBox();
    for(const value of await cards.first().locator('.day-time-grid strong').all()){
      const box=await value.boundingBox();
      assert.ok(box.y>=0&&box.y+box.height<=navigation.y-4,'first arrival and official time fit above phone navigation: '+JSON.stringify({text:await value.innerText(),box,navigation}));
    }
    await page.screenshot({path:path.join(folder,'competition-day-full.png'),fullPage:true,scale:'css',animations:'disabled'});
    await page.evaluate(()=>{window.__planningPrintCount=0;window.print=()=>{window.__planningPrintCount++;};});
    await page.getByRole('button',{name:ui('Print / Save PDF','打印 / 保存 PDF'),exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__planningPrintCount),1);
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('.day-controls').isVisible(),false);
    assert.equal(await page.locator('.club-page-heading').isVisible(),false);
    assert.equal(await page.locator('.club-back').isVisible(),false);
    assert.equal(await page.locator('.day-checklist').isVisible(),true);
    if(engine==='chromium')await page.pdf({path:path.join(folder,'competition-day.pdf'),format:'A4',printBackground:true});
    await page.emulateMedia({media:'screen'});
    member={...parent,id:'family-b'};await page.reload();await checkboxState(false);
    assert.ok(!(await page.locator('.competition-day').innerText()).includes(approvedPlan.note),'another account receives no approved private meeting');
    member=parent;await page.reload();await checkboxState(true);

    await page.goto(origin+'/workspace?view=registrations');
    await page.locator('.registration-board').waitFor();
    const eventCard=page.locator('.reg-event').filter({has:page.getByRole('heading',{name:'November Cup',exact:true})});
    const anaRow=eventCard.locator('.reg-skater').filter({has:page.getByRole('heading',{name:'Ana Reed',exact:true})});
    await anaRow.waitFor();
    const officialBefore=await anaRow.locator('.reg-official').innerText();
    await choose(ui('Personal plan for ','个人计划：')+'Ana Reed · November Cup','submitted');
    await page.locator('.reg-message').filter({hasText:/saved|已保存/}).waitFor();
    assert.equal(await anaRow.locator('.reg-official').innerText(),officialBefore,'personal plan does not alter the official list');
    await page.reload();await anaRow.waitFor();
    await page.waitForFunction(()=>document.querySelector('.reg-personal select')?.disabled===false);
    assert.equal(await anaRow.locator('.reg-personal select').inputValue(),'submitted');
    assert.equal(await anaRow.locator('.reg-official').innerText(),officialBefore);
    await choose(ui('Event for this plan','本计划的赛事'),'winter');
    await page.getByRole('button',{name:ui('Add as considering','添加为考虑报名'),exact:true}).click();
    const winter=page.locator('.reg-event').filter({has:page.getByRole('heading',{name:'Winter Cup',exact:true})});
    await winter.waitFor();assert.match(await winter.locator('.reg-official').innerText(),/Not found|未找到/);
    assert.equal(await winter.locator('.reg-personal select').inputValue(),'considering');
    await noOverflow();await screenshot('registrations');
    await page.screenshot({path:path.join(folder,'registrations-full.png'),fullPage:true,scale:'css',animations:'disabled'});
    await page.reload();await winter.waitFor();assert.equal(await winter.locator('.reg-personal select').inputValue(),'considering');

    await page.goto(origin+'/workspace?view=calendar');
    const subscription=page.locator('.calendar-subscription');
    await subscription.getByRole('button',{name:ui('Create subscription URL','创建订阅网址'),exact:true}).click();
    const subscriptionURL=page.locator('#calendar-subscription-url');
    await subscriptionURL.waitFor();const originalURL=await subscriptionURL.inputValue();assert.match(originalURL,/a{64}$/);
    await subscription.getByRole('button',{name:ui('Replace URL','更换网址'),exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#calendar-subscription-url')?.value.endsWith('b'.repeat(64)));
    assert.notEqual(await subscriptionURL.inputValue(),originalURL);
    await noOverflow();await subscription.scrollIntoViewIfNeeded();await screenshot('subscription');
    await subscription.getByRole('button',{name:ui('Revoke subscription','撤销订阅'),exact:true}).click();
    await subscriptionURL.waitFor({state:'detached'});
    await subscription.getByRole('button',{name:ui('Create subscription URL','创建订阅网址'),exact:true}).waitFor();
    assert.deepEqual(writes.filter(write=>write.path==='/api/calendar/subscription').map(write=>write.body.action),['create','replace','revoke']);
    assert.ok(writes.every(write=>['/api/registrations','/api/calendar/subscription'].includes(write.path)),'only the intended planning APIs are written');
    assert.deepEqual(errors,[]);
  } catch(error) {
    await screenshot('failure').catch(()=>{});
    console.error({url:page.url(),errors,snapshot:await page.locator('main').ariaSnapshot().catch(()=>'')});
    throw error;
  } finally {await context.close();}
}

const originalProfiles=[
  {name:'320px Chromium',folder:'chromium',profile:{...pw.devices['Galaxy Z Flip 6'],viewport:{width:320,height:740}}},
  {name:'390px WebKit',folder:'webkit',profile:{...pw.devices['iPhone 17 Pro'],viewport:{width:390,height:844}}},
];
const namedModels=process.argv.slice(2);
const profiles=namedModels.length?namedModels.map(name=>({name,folder:name.replaceAll(' ','-'),profile:pw.devices[name]})):[
  ...(browserGroup!=='representative'?originalProfiles:[]),
  ...(browserGroup!=='existing'?phoneGroups.representative.map(name=>({name,folder:name.replaceAll(' ','-'),profile:pw.devices[name]})):[]),
];
const languages=process.env.HSC_PLANNING_LANGUAGE?[process.env.HSC_PLANNING_LANGUAGE]:['en','zh'];
if(process.env.HSC_PLANNING_ENGINE)assert.ok(['chromium','webkit'].includes(process.env.HSC_PLANNING_ENGINE),'HSC_PLANNING_ENGINE must be chromium or webkit');
const browsers=new Map();
try {
  for(const {name,folder:prefix,profile} of profiles){
    assert.ok(profile,'Unknown device profile: '+name);
    const engine=profile.defaultBrowserType;
    if(process.env.HSC_PLANNING_ENGINE&&engine!==process.env.HSC_PLANNING_ENGINE)continue;
    if(!browsers.has(engine))browsers.set(engine,await pw[engine].launch(engine==='chromium'&&process.platform==='win32'?{executablePath:process.env.HSC_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{}));
    for(const language of languages){
      assert.ok(['en','zh'].includes(language),'HSC_PLANNING_LANGUAGE must be en or zh');
      const folder=path.join(output,prefix+'-'+language);await fs.mkdir(folder,{recursive:true});
      await journey(browsers.get(engine),profile,language,folder,engine);
      console.log(JSON.stringify({model:name,engine,language,viewport:profile.viewport,competitionDay:true,registrations:true,subscriptionLifecycle:true}));
    }
  }
}finally{await Promise.all([...browsers.values()].map(browser=>browser.close()));}
