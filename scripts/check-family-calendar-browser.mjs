import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const cache=path.resolve('work/browser-qa/browsers');
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync(cache)) process.env.PLAYWRIGHT_BROWSERS_PATH=cache;
const pw=await import(pathToFileURL(process.env.HSC_PLAYWRIGHT_MODULE || path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const origin=process.env.HSC_PREVIEW_ORIGIN||'http://127.0.0.1:5173';
const output=process.env.HSC_MOBILE_OUTPUT||path.resolve('work/family-calendar');
const day='2026-11-14',source='https://example.test/cup';
const own=['ana','ben'];
const skaters=[['ana','Ana Reed'],['ben','Ben Reed']].map(([id,name])=>({id,name,coach:'',training:true,categories:[],clubs:[],recordCount:0,eventCount:0,identityStatus:'Fixture'}));
const participants=[['ana','Ana Reed','Senior Women'],['ben','Ben Reed','Junior Men'],['','Nora Lin','Senior Men'],['ana','Ana Reed','Novice Women']].map(([id,name,category],i)=>({
  id:'p'+i,name,category,club:id?'Home Club':'Guest Club',section:'ON',skaterIds:id?[id]:[],matchStatus:'Fixture',sourceUrl:source
}));
const blocks=[['Senior Women','13:00','13:35','Red'],['Junior Men','13:20','13:50','Blue'],['Senior Men','13:50','14:20','Blue']].map(([category,start,end,rink],i)=>({
  id:'slot'+i,date:day,start,end,rink,category:category+' SHORT',group:null,range:null,activity:'competition',page:1,sourceUrl:source
}));
const event={id:'cup',name:'November Cup',start:day,end:day,timezone:'America/Toronto',venue:'Hamilton Arena',city:'Hamilton',url:source,
  documents:[],needsReview:false,participants,blocks,startingOrders:[{id:'order',name:'Nora Lin',skaterIds:[],category:'Senior Men SHORT',program:'short',
    startNumber:8,warmupGroup:2,individualTime:'14:05',sourceUrl:source+'/order',page:0}]};
const parent={id:'family-a',name:'Taylor Reed',email:'parent@example.test',role:'parent',status:'active'};

async function walk(browser,profile,language,orientation,folder) {
  const context=await browser.newContext({...profile,locale:language==='zh'?'zh-CN':'en-CA',timezoneId:'America/Vancouver'});
  const page=await context.newPage(),errors=[],writes=[];
  page.setDefaultTimeout(12_000);
  let member=parent;
  const ui=(en,zh)=>language==='en'?en:zh;
  const shot=name=>page.screenshot({path:path.join(folder,name+'.png'),scale:'css',animations:'disabled'});
  try {
    await page.clock.setFixedTime(new Date('2026-11-08T17:15:00Z'));
    await page.addInitScript(lang=>localStorage.setItem('hsc-language',lang),language);
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(req.method()!=='GET') writes.push(url.pathname);
      const club={member,ownSkaterIds:own,writableSkaterIds:[],skaters,events:[event],plans:[],sync:{},historyEvents:[],recent:[],asOf:day,
        summary:{category_records:0,team_records:0},reviews:[],limitations:[]};
      const actions={identity:{identity:{name:member.name,email:member.email,provider:'password'}},me:{member,skaterIds:own,preferredSkaterIds:own,claims:[]},
        notifications:{notifications:[]},requirements:{requirements:[]}};
      await route.fulfill({json:url.pathname==='/api/club'?club:(actions[url.searchParams.get('action')]||{})});
    });
    // Follow the non-roster friend through the real picker; never seed a storage key.
    await page.goto(origin+'/workspace?view=watch&event=cup');
    await page.locator('.watch-friends summary').click();
    await page.getByRole('checkbox',{name:/Nora Lin/}).check();
    await page.goto(origin+'/');
    await page.locator('.member-heading').getByRole('link',{name:ui('Schedule calendar','赛程日历')}).click();
    const saturday=page.getByRole('link',{name:new RegExp('^'+day+' · 4')});
    await saturday.waitFor();await page.evaluate(()=>document.fonts.ready);
    await page.getByRole('button',{name:ui('Next month','下个月')}).click();
    await page.getByRole('button',{name:ui('Previous month','上个月')}).click();
    await saturday.waitFor();
    if(orientation==='portrait') {
      const box=await saturday.boundingBox(),nav=await page.locator('.club-sidebar').boundingBox();
      assert.ok(box.height>=44 && box.y+box.height<=nav.y,'next Saturday needs a full touch target on the first screen');
    } else await saturday.scrollIntoViewIfNeeded();
    await shot('month');await saturday.click();
    const conflict=page.locator('.cal-overlaps');
    await conflict.waitFor();assert.match(await conflict.innerText(),/15 (分钟|min)/);
    assert.match(await conflict.innerText(),/Ana Reed \/ Ben Reed · 13:20–13:35/);
    const slots=page.locator('.cal-slot');
    await slots.filter({hasText:'Nora Lin'}).waitFor();
    assert.equal(await slots.count(),3);
    assert.match(await slots.filter({hasText:'Nora Lin'}).innerText(),/14:05/);
    assert.match(await page.locator('.cal-pending').innerText(),/Novice Women/);
    if(orientation==='portrait') {
      const box=await conflict.boundingBox(),nav=await page.locator('.club-sidebar').boundingBox();
      assert.ok(box.y>=0 && box.y+box.height<=nav.y,'overlap must be visible on arrival');
    } else await conflict.scrollIntoViewIfNeeded();
    await shot('overlap');
    await page.getByRole('combobox',{name:ui('Ice surface','比赛冰面')}).click();
    await page.getByRole('option',{name:'Blue',exact:true}).click();
    const friend=slots.filter({hasText:'Nora Lin'});
    assert.equal(await slots.filter({hasText:'Ana Reed'}).count(),0);
    assert.equal(await slots.count(),2);
    assert.match(await friend.innerText(),/13:50–14:20 · Blue/);assert.match(await friend.innerText(),/Friend|本场朋友/);
    const friendSummary=page.locator('.cal-cheering').getByRole('button',{name:/Nora Lin/});
    await friendSummary.waitFor();await friendSummary.scrollIntoViewIfNeeded();await shot('blue');
    await friend.click();assert.match(await page.locator('#calendar-session-detail').innerText(),/14:05/);
    await page.reload();await friend.waitFor();assert.equal(await slots.count(),2);
    await page.getByRole('button',{name:ui('Month','月历'),exact:true}).click();
    await saturday.waitFor();assert.equal(await saturday.locator('.cal-selected').count(),1);
    await page.goBack();await friend.waitFor();assert.equal(await slots.count(),2);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    member={...parent,id:'family-b'};
    await page.reload();await slots.filter({hasText:'Ben Reed'}).waitFor();
    assert.equal(await friend.count(),0,'friend belongs to the original account');
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  } catch(error) {
    await shot('failure').catch(()=>{});
    console.error({url:page.url(),errors,calendar:await page.locator('.family-calendar').ariaSnapshot().catch(()=>'')});
    throw error;
  } finally {await context.close();}
}
for(const model of process.argv.length>2?process.argv.slice(2):['iPhone 17 Pro','Galaxy Z Flip 6','iPhone 17 Pro Max']) {
  const engine=pw.devices[model].defaultBrowserType;
  const browser=await pw[engine].launch(engine==='chromium'&&process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try {
    for(const orientation of ['portrait','landscape']) for(const language of ['zh','en']) {
      const profile=pw.devices[model+(orientation==='landscape'?' landscape':'')];
      const folder=path.join(output,model.replaceAll(' ','-')+'-'+orientation+'-'+language);
      await fs.mkdir(folder,{recursive:true});await walk(browser,profile,language,orientation,folder);
      console.log(JSON.stringify({model,orientation,language,viewport:profile.viewport,overlapMinutes:15,friend:'Nora Lin'}));
    }
  } finally {await browser.close();}
}
