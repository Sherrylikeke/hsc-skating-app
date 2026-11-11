import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkRegistrationFeedback} from './registration-browser.mjs';
import {checkAccountRecovery} from './account-recovery-browser.mjs';

const cache = path.resolve('work/browser-qa/browsers');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(cache)) process.env.PLAYWRIGHT_BROWSERS_PATH = cache;
const playwright = await import(pathToFileURL(process.env.HSC_PLAYWRIGHT_MODULE || path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const origin = process.env.HSC_PREVIEW_ORIGIN || 'http://127.0.0.1:5173';
const output = process.env.HSC_MOBILE_OUTPUT || path.resolve('work/device-interactions');
const models = process.argv.length>2 ? process.argv.slice(2) : ['iPhone 17 Pro', 'Galaxy Z Flip 6', 'iPhone 17 Pro Max'];
const orientations = ['portrait','landscape'];
const locales = ['en','zh'];
const day = '2026-11-08';
const member = {id:'test-parent',name:'Taylor Montgomery-Richardson',role:'parent',requested_role:'parent',status:'active',email:'taylor.montgomery-richardson@example.test'};
const skaters = Array.from({length:28},(_,i)=>({
  id:'child-'+i, name:i===0?'Alexandra Montgomery-Richardson':i===1?'Ben Reed':i===27?'Jamie End-of-Roster':'Club Skater '+i,
  coach:'Rowan Mitchell / Morgan Blake',categories:['Pre-Novice Women'],clubs:['Fixture Club'],training:true,
  recordCount:0,eventCount:0,identityStatus:'Fixture'
}));
const source = 'https://example.test/official';
const events = Array.from({length:12},(_,i)=>{
  const skater = skaters[i];
  return {
    id:'event-'+i,name:(i===0?'Autumn Invitational and Regional Synchronized Skating Championships':'Invitational '+i),
    start:day,end:day,url:source,venue:'First Arena',city:'Hamilton',timezone:'America/Toronto',source:'Skate Ontario',
    documents:[],needsReview:false,
    participants:[{id:'entry-'+i,name:skater.name,category:'Pre-Novice Women',skaterIds:[skater.id],club:'Fixture Club',section:'ON',matchStatus:'Fixture',sourceUrl:source}],
    blocks:[{id:'short-'+i,category:'Pre-Novice Women Short Program',categoryKey:'PRENOVICE:WOMEN',group:null,range:null,
      activity:'competition',date:day,start:'13:00',end:'14:00',rink:'North Arena',page:1,sourceUrl:source}],
    startingOrders:[]
  };
});
const ownIds = [skaters[0].id,skaters[1].id];
const club = {member,ownSkaterIds:ownIds,writableSkaterIds:[],skaters,events,plans:[],sync:{},historyEvents:[],recent:[],
  asOf:day,summary:{category_records:0,team_records:0},reviews:[],limitations:[]};

// Geometry checks use text ranges: overflow:hidden can conceal clipped text even on a page that fits.
async function inspectText(page, selector, stage, issues) {
  const problems = await page.locator(selector).evaluateAll(nodes=>{
    const problems = [];
    if (document.documentElement.scrollWidth > innerWidth+1) problems.push('horizontal page overflow');
    for (const node of nodes) {
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const clipped = [...range.getClientRects()].some(rect=>rect.width>0 && (rect.left < -1 || rect.right > innerWidth+1));
      if (clipped || node.scrollWidth > node.clientWidth+1 || node.scrollHeight > node.clientHeight+1)
        problems.push(node.textContent.trim().slice(0,70));
    }
    return problems;
  });
  issues.push(...problems.map(problem=>stage+' · '+problem));
}

async function walk(browser,profile,locale,folder,report) {
  const context = await browser.newContext({...profile,locale:locale==='zh'?'zh-CN':'en-CA'});
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const issues = report.issues;
  page.on('pageerror', error=>issues.push(error.message));
  const shot = name=>page.screenshot({path:path.join(folder,name+'.png'),animations:'disabled',scale:'css'});
  await page.clock.setFixedTime(new Date('2026-11-08T15:00:00Z'));
  await page.addInitScript(lang=>localStorage.setItem('hsc-language',lang),locale);
  await page.route('**/api/**', async route=>{
    const url = new URL(route.request().url());
    if (route.request().method()!=='GET') issues.push('Unexpected write '+url.pathname);
    const memberData = {identity:{identity:{name:member.name,email:member.email,provider:'password'}},
      me:{member,skaterIds:ownIds,preferredSkaterIds:ownIds,claims:[]},notifications:{notifications:[]},requirements:{requirements:[]}};
    const payload = url.pathname==='/api/club' ? (url.search ? {records:[]} : club) : memberData[url.searchParams.get('action')] || {};
    await route.fulfill({json:payload});
  });
  try {
    await page.goto(origin);
    const entry = page.locator('.member-heading a[href*="view=personal"]');
    await entry.waitFor();
    await inspectText(page,'.member-heading h1,.member-account-summary','member',issues);
    await shot('member');
    await entry.tap();
    const picker = page.locator('.family-filter').getByRole('combobox');
    await picker.waitFor();
    await inspectText(page,'.club-page-heading h1,.family-upcoming h2,.club-session-skater .club-text-button','family',issues);
    await shot('family');
    await picker.tap();
    const list = page.getByRole('listbox');
    await list.waitFor();
    const editFocus = ()=>page.evaluate(()=>document.activeElement.matches('input,textarea,[contenteditable=true]'));
    assert.equal(await editFocus(),false,'Opening the picker must not focus a text field');
    const options = list.getByRole('option');
    assert.equal(await options.count(),skaters.length+2);
    const visibleCount = await list.evaluate(el=>{
      const rect=el.getBoundingClientRect(), visible=window.visualViewport;
      const top=Math.max(rect.top,visible.offsetTop), bottom=Math.min(rect.bottom,visible.offsetTop+visible.height);
      return [...el.querySelectorAll('[role=option]')].filter(option=>{
        const row=option.getBoundingClientRect();
        return row.top>=top-1 && row.bottom<=bottom+1 && document.elementFromPoint(row.x+row.width/2,row.y+row.height/2)?.closest('[role=option]')===option;
      }).length;
    });
    report.fullyVisibleOptions=visibleCount;
    if (visibleCount < (report.orientation==='portrait'?8:3)) issues.push('Only '+visibleCount+' complete options visible');
    await shot('picker');
    const dialog=page.getByRole('dialog');
    const edge=await dialog.evaluate(el=>{
      const box=el.getBoundingClientRect();
      const x=innerWidth/2, y=innerHeight/2;
      if (box.top>2) return {x,y:box.top/2};
      if (box.left>2) return {x:box.left/2,y};
      return null;
    });
    if (edge) {
      await page.touchscreen.tap(edge.x,edge.y);
      await dialog.waitFor({state:'hidden'});
      await picker.tap();
    }
    const search=page.getByLabel(/Search options|搜索选项/);
    await search.tap();
    assert.equal(await editFocus(),true,'Search focuses only after an explicit tap');
    await search.fill('end-of-roster');
    assert.equal(await options.count(),1);
    await search.press('Escape');
    await list.waitFor({state:'hidden'});
    assert.equal(await editFocus(),false);
    assert.equal(await picker.evaluate(el=>el===document.activeElement),true);
    await picker.tap();
    assert.equal(await search.inputValue(),'');
    // Select the last roster entry through the actual scrolling list.
    await list.getByRole('option',{name:skaters.at(-1).name,exact:true}).tap();
    await page.getByRole('heading',{name:skaters.at(-1).name,exact:true}).waitFor();
    assert.equal(await editFocus(),false);

    const nav = page.locator('.club-sidebar nav');
    await nav.getByRole('button',{name:/Club overview|俱乐部概览/}).tap();
    await page.locator('.home-events .home-event').first().waitFor();
    assert.equal(await page.locator('.home-events .home-event').count(),ownIds.length,'Homepage shows the selected skaters’ entered events');
    await nav.getByRole('button',{name:/Competition centre|比赛中心/}).tap();
    const eventCard=page.locator('.club-event-card').filter({hasText:events[0].name});
    await eventCard.waitFor();
    await inspectText(page,'.club-event-card h2','event list',issues);
    await eventCard.tap();
    await page.getByRole('heading',{name:events[0].name,exact:true}).waitFor();
    await inspectText(page,'.club-event-hero h2','event detail',issues);
    await page.locator('.club-back').tap();
    await eventCard.waitFor();
    await nav.getByRole('button',{name:/Coach master schedule|教练总赛程/}).tap();
    const row = page.locator('.coach-day-row').first();
    await row.waitFor();
    await inspectText(page,'h1,.coach-day-skater>button,.coach-day-category,.coach-day-coach,.coach-day-event','coach',issues);
    const details=row.locator('.coach-day-action button');
    const size=await details.boundingBox();
    if (!size || Math.min(size.height,size.width)<44) issues.push('Coach details touch target smaller than 44px');
    await row.scrollIntoViewIfNeeded();
    await shot('coach');
    await details.tap();
    assert.equal(await details.getAttribute('aria-expanded'),'true');
    await details.tap();
    assert.equal(await details.getAttribute('aria-expanded'),'false');
    const eventFilter=page.getByRole('combobox',{name:/Coach schedule competition filter|教练总表比赛筛选/});
    await eventFilter.tap();
    await list.getByRole('option',{name:new RegExp(events[0].name)}).tap();
    assert.equal(await page.locator('.coach-day-row').count(),1);
    const toggle=page.locator('.club-filter-toggle');
    const fields=page.locator('#coach-filter-fields');
    if (!await fields.isVisible()) await toggle.tap();
    await fields.locator('input[type=date]').fill('2026-11-09');
    assert.equal(await row.count(),0);
    const actions=fields.locator('.club-filter-actions button');
    assert.equal(await actions.last().isDisabled(),true);
    await actions.first().tap();
    assert.equal(await page.locator('.coach-day-row').count(),events.length);
    const downloaded=page.waitForEvent('download');
    await actions.last().tap();
    assert.match((await downloaded).suggestedFilename(),/\.csv$/i);
    if (await toggle.isVisible()) await toggle.tap();
    await page.locator('.coach-day-row').getByRole('button',{name:skaters[0].name,exact:true}).tap();
    await page.getByRole('heading',{level:1,name:skaters[0].name}).waitFor();
    await inspectText(page,'.club-page-heading h1','skater',issues);
    await page.locator('.club-topbar-home').tap();
    await page.locator('.family-upcoming h2').waitFor();
    assert.equal(await page.locator('.family-upcoming tbody tr').count(),2);
  } catch (error) {
    issues.push(error.message);
    await shot('failure').catch(()=>{});
  } finally {
    await context.close();
  }
}

await fs.mkdir(output,{recursive:true});
const reports=[];
const browsers=new Map();
try {
  for (const model of models) {
    for (const orientation of orientations) for (const locale of locales) {
      const profile=playwright.devices[model+(orientation==='landscape'?' landscape':'')];
      const engine=profile.defaultBrowserType;
      if (!browsers.has(engine)) {
        const launch=engine==='chromium' && process.platform==='win32' ? {executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'} : {};
        browsers.set(engine,await playwright[engine].launch(launch));
        await checkRegistrationFeedback(browsers.get(engine),profile,origin);
        await checkAccountRecovery(browsers.get(engine),profile,origin);
      }
      const folder=path.join(output,[model.replaceAll(' ','-').toLowerCase(),orientation,locale].join('-'));
      await fs.mkdir(folder,{recursive:true});
      const report={model,orientation,locale,engine,viewport:profile.viewport,deviceScaleFactor:profile.deviceScaleFactor,issues:[]};
      await walk(browsers.get(engine),profile,locale,folder,report);
      reports.push(report);
      console.log(JSON.stringify(report));
    }
  }
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(reports,null,2));
  assert.equal(reports.filter(report=>report.issues.length).length,0,'Device journeys with layout or interaction failures');
} finally {
  await Promise.all([...browsers.values()].map(browser=>browser.close()));
}
