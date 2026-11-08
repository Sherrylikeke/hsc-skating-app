import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const cache=path.resolve('work/browser-qa/browsers');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(cache)) process.env.PLAYWRIGHT_BROWSERS_PATH=cache;
const pw=await import(pathToFileURL(process.env.HSC_PLAYWRIGHT_MODULE || path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const origin=process.env.HSC_PREVIEW_ORIGIN || 'http://127.0.0.1:5173';
const output=process.env.HSC_MOBILE_OUTPUT || path.resolve('work/event-watch');
const day='2026-11-08', source='https://example.test/event';
const names=['Ana Reed','Ben Reed','Nora Lin','Kai Park','Jules Ray'];
const categories=['Senior Women','Junior Men','Novice Women','Senior Men','Junior Women'];
const skaters=names.slice(0,4).map((name,i)=>({id:'s'+i,name,coach:'Alex Taylor',training:true,categories:[],clubs:[],recordCount:0,eventCount:0,identityStatus:'Fixture'}));
const entries=names.map((name,i)=>({id:'p'+i,name,category:categories[i],club:i===4?'Guest Club':'Home Club',section:'ON',
  skaterIds:i===4?[]:['s'+i],matchStatus:'Fixture',sourceUrl:source}));
const times=[['10:00','10:35'],['13:00','13:30'],['12:00','12:30'],['13:05','13:40'],['12:30','13:00']];
const blocks=times.map(([start,end],i)=>({id:'b'+i,date:day,start,end,rink:i%2===0?'Blue':'Red',category:categories[i]+' SHORT',
  categoryKey:'',group:null,range:null,activity:'competition',page:1,sourceUrl:source}));
blocks[3].rink='Blue';
const orders=[1,2,4].map(i=>({id:'o'+i,name:names[i],category:categories[i]+' SHORT',program:'short',startNumber:i===1?2:18,
  warmupGroup:i===1?1:3,individualTime:i===2?'12:03':null,sourceUrl:source+'/order',page:0,skaterIds:entries[i].skaterIds}));
const event={id:'autumn',name:'Autumn Cup',start:day,end:day,timezone:'America/Toronto',venue:'Arena',city:'Hamilton',url:source,documents:[],
  needsReview:false,participants:entries,blocks,startingOrders:orders};
const second={...event,id:'winter',name:'Winter Cup',blocks:[],startingOrders:[]};
const own=['s0','s1'];
const parent={id:'family-a',name:'Taylor Reed',email:'parent@example.test',role:'parent',status:'active'};

async function walk(browser,profile,language,folder) {
  const context=await browser.newContext({...profile,locale:language==='zh'?'zh-CN':'en-CA'});
  const page=await context.newPage(),writes=[],errors=[];
  let member=parent;
  const ui=(en,zh)=>language==='en'?en:zh;
  const shot=name=>page.screenshot({path:path.join(folder,name+'.png'),scale:'css',animations:'disabled'});
  const row=name=>page.locator('.watch-timeline li').filter({has:page.getByText(name,{exact:true})});
  const choose=async (label,option)=>{
    await page.getByRole('combobox',{name:label}).click();
    await page.getByRole('option',{name:option,exact:true}).click();
  };
  try {
    await page.clock.setFixedTime(new Date('2026-11-08T17:15:00Z'));
    await page.addInitScript(lang=>localStorage.setItem('hsc-language',lang),language);
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(request.method()!=='GET') writes.push(url.pathname);
      const club={member,ownSkaterIds:own,writableSkaterIds:[],skaters,events:[event,second],plans:[],sync:{},
        historyEvents:[],recent:[],asOf:day,summary:{category_records:0,team_records:0},reviews:[],limitations:[]};
      const actions={identity:{identity:{name:member.name,email:member.email,provider:'password'}},me:{member,skaterIds:own,preferredSkaterIds:own,claims:[]},
        notifications:{notifications:[]},requirements:{requirements:[]}};
      await route.fulfill({json:url.pathname==='/api/club'?club:(actions[url.searchParams.get('action')]||{})});
    });
    await page.goto(origin+'/');
    await page.locator('.member-heading .watch-entry').click();
    await row(names[1]).waitFor();
    assert.equal(await row(names[0]).count(),0);
    const summary=page.locator('.watch-friends summary');
    await summary.click();
    assert.equal(await page.evaluate(()=>document.activeElement.type==='search'),false);
    const search=page.getByRole('searchbox');
    await search.fill('Guest Club');
    assert.equal(await page.getByRole('checkbox').count(),1);
    await page.getByRole('checkbox',{name:/Jules Ray/}).check();
    await search.fill('');
    for (const name of names.slice(2,4)) await page.getByRole('checkbox',{name:new RegExp(name)}).check();
    await summary.click();
    const timeline=page.locator('.watch-timeline');
    assert.deepEqual(await timeline.locator('.watch-person strong').allTextContents(),[names[2],names[4],names[1],names[3]]);
    assert.match(await row(names[2]).innerText(),/Group in progress|组别进行中/);
    assert.match(await row(names[2]).innerText(),/12:03/);
    assert.match(await row(names[4]).innerText(),/#18/);
    assert.match(await row(names[4]).innerText(),/Individual time pending|个人时间待公布/);
    const firstBottom=await row(names[2]).evaluate(el=>Math.round(el.getBoundingClientRect().bottom));
    const usableBottom=await page.locator('.club-sidebar').evaluate(el=>el.getBoundingClientRect().top);
    assert.ok(firstBottom<=usableBottom,'First complete row must fit above the bottom navigation: '+firstBottom+' / '+usableBottom);
    await shot('from-now');
    await choose(ui('Ice surface','比赛冰面'),'Red');
    assert.deepEqual(await timeline.locator('.watch-person strong').allTextContents(),[names[1]]);
    const whole=page.getByRole('button',{name:ui('Whole event','整场比赛'),exact:true});
    await whole.click();
    const watchUrl=page.url();
    await page.locator('.watch-panel .cal-entry').click();
    await page.locator('.family-calendar').waitFor();
    await page.locator('.club-back').click();
    await timeline.waitFor();
    assert.equal(page.url(),watchUrl);
    assert.equal(await whole.getAttribute('aria-pressed'),'true');
    assert.deepEqual(await timeline.locator('.watch-person strong').allTextContents(),[names[1]],'Return to the selected rink');
    await choose(ui('Ice surface','比赛冰面'),ui('All rinks','所有冰面'));
    await page.getByRole('button',{name:ui('Whole event','整场比赛'),exact:true}).click();
    await row(names[0]).waitFor();
    await page.getByRole('button',{name:ui('From now','从现在看'),exact:true}).click();
    assert.equal(await row(names[0]).count(),0);
    await choose(ui('Competition to watch','关注的比赛'),'Winter Cup · '+day);
    assert.equal(await row(names[4]).count(),0);
    await page.goBack();
    await row(names[4]).waitFor();
    await page.reload(); await row(names[4]).waitFor();
    await page.locator('.club-topbar-home').click();
    await page.locator('.family-upcoming').waitFor();
    assert.deepEqual(await page.locator('.family-upcoming .club-session-skater>.club-text-button').allTextContents(),[names[1]]);
    await page.locator('.family-controls .watch-entry').click();
    await row(names[4]).waitFor();
    assert.equal(await page.evaluate(()=>scrollY),0);
    assert.ok(await row(names[2]).evaluate(el=>el.getBoundingClientRect().bottom)<=usableBottom);
    await page.locator('.club-sidebar nav button').last().click();
    const coachRow=page.locator('.coach-day-row').filter({has:page.getByRole('button',{name:names[1],exact:true})}).first();
    await coachRow.locator('.coach-overlap-toggle').click();
    const comparison=page.locator('.coach-overlap-row:visible').first();
    assert.match(await comparison.innerText(),/13:05–13:30/);
    const pair=comparison.locator('section').filter({hasText:names[3]}).first();
    assert.match(await pair.innerText(),/Red/);assert.match(await pair.innerText(),/Blue/);
    assert.match(await pair.innerText(),/#2/);assert.match(await pair.innerText(),/Start order pending|出场顺序待公布/);
    await pair.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await shot('coach');
    await coachRow.locator('.coach-overlap-toggle').click();
    assert.equal(await comparison.count(),0);
    await page.goto(origin+'/workspace?view=events&event=autumn');
    await page.locator('.club-documents .watch-entry').click();
    await row(names[4]).waitFor();
    await summary.click();await page.getByRole('checkbox',{name:/Jules Ray/}).uncheck();await summary.click();
    assert.equal(await row(names[4]).count(),0);
    member={...parent,id:'family-b'};
    await page.reload();await row(names[1]).waitFor();
    assert.equal(await row(names[2]).count(),0);
    assert.deepEqual(writes,[]); assert.deepEqual(errors,[]);
    return {firstBottom,usableBottom};
  } catch(error) {
    await shot('failure').catch(()=>{});
    throw error;
  } finally { await context.close(); }
}

const models=process.argv.length>2?process.argv.slice(2):['iPhone 17 Pro','Galaxy Z Flip 6','iPhone 17 Pro Max'];
for(const model of models) {
  const profile=pw.devices[model],engine=profile.defaultBrowserType;
  const browser=await pw[engine].launch(engine==='chromium'&&process.platform==='win32'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try {
    for(const language of ['zh','en']) {
      const folder=path.join(output,model.replaceAll(' ','-')+'-'+language);
      await fs.mkdir(folder,{recursive:true});
      console.log(JSON.stringify({model,language,...await walk(browser,profile,language,folder)}));
    }
  } finally { await browser.close(); }
}
