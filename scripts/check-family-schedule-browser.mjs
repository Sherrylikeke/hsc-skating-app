import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const modulePath = process.env.HSC_PLAYWRIGHT_MODULE || path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs');
const {chromium, webkit, devices} = await import(pathToFileURL(modulePath).href);
const engine = process.env.HSC_MOBILE_ENGINE === 'webkit' ? webkit : chromium;
const origin = process.env.HSC_PREVIEW_ORIGIN || 'http://127.0.0.1:5175';
const output = process.env.HSC_MOBILE_OUTPUT || path.resolve('work/family-schedule', engine.name());
const widths = (process.env.HSC_MOBILE_WIDTHS || '320,390,1280').split(',').map(Number);
const languages = (process.env.HSC_MOBILE_LANGUAGES || 'en,zh').split(',');
await fs.mkdir(output, {recursive:true});

const member = {id:'parent', name:'Taylor Reed', email:'parent@example.test', role:'parent', status:'active'};
const skaters = [['ana','Ana Reed'], ['ben','Ben Reed'], ['kim','Kim Park']].map(([id,name]) => ({
  id, name, coach:'', training:true, categories:[], clubs:[], recordCount:0, eventCount:0, identityStatus:'Fixture'
}));
const ownIds = ['ana','ben'];
const day = '2026-11-08';
const source = 'https://example.test/official';
const event = {
  id:'autumn', name:'Autumn Invitational', start:'2026-11-07', end:day, timezone:'America/Toronto',
  url:source, venue:'Arena', city:'Hamilton', documents:[], needsReview:false,
  participants:skaters.map(({id,name},i) => ({
    id, name, category:['Pre-Novice Women','Pre-Novice Men','Senior Men'][i], skaterIds:[id],
    club:'Fixture Club', section:'ON', matchStatus:'Fixture', sourceUrl:source
  })),
  blocks:[], startingOrders:[{id:'ana-short', name:'Ana Reed', skaterIds:['ana'], category:'Pre-Novice Women - Short Program',
    program:'short', startNumber:8, warmupGroup:2, individualTime:'11:38', page:1, sourceUrl:source}]
};
function addBlock(category, start, end, options = {}) {
  event.blocks.push({id:'slot-' + event.blocks.length, date:day, category, start, end, activity:'competition',
    group:null, range:null, rink:'North Rink', sourceUrl:source, page:1, ...options});
}
addBlock('Pre-Novice Women SHORT', '15:00', '15:30', {date:'2026-11-07',activity:'practice'});
addBlock('Pre-Novice Women SHORT', '11:15', '12:00');
addBlock('Pre-Novice Men SHORT', '13:00', '13:40');
addBlock('Pre-Novice Women FREE (1-10)', '15:00', '15:40', {range:[1,10]});
addBlock('Pre-Novice Women FREE (11-20)', '16:00', '16:40', {range:[11,20]});
addBlock('Senior Men SHORT', '12:00', '12:40');
const club = {member, ownSkaterIds:ownIds, writableSkaterIds:[], skaters, events:[event], plans:[], sync:{},
  historyEvents:[], recent:[], asOf:day, summary:{category_records:0, team_records:0}, reviews:[], limitations:[]};

async function walk(width, language, browser) {
  const desktop = width >= 1000;
  const device = desktop ? (engine === webkit ? 'Desktop Safari':'Desktop Chrome') : (engine === webkit ? 'iPhone 13':'Pixel 7');
  const context = await browser.newContext({...devices[device], viewport:{width,height:844}, deviceScaleFactor:1});
  try {
    const page = await context.newPage();
    let savedClub = club;
    const writes = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-08T14:00:00Z'));
    await page.addInitScript(lang => localStorage.setItem('hsc-language',lang), language);
    await page.route('**/api/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() !== 'GET') writes.push(request.method() + ' ' + url.pathname);
      const payloads = {
        identity:{identity:{name:member.name,email:member.email,provider:'password'}},
        me:{member,skaterIds:ownIds,preferredSkaterIds:savedClub.ownSkaterIds,claims:[]},
        notifications:{notifications:[]}, requirements:{requirements:[]}
      };
      const payload = url.pathname === '/api/club' ? (url.search ? {records:[]} : savedClub) : payloads[url.searchParams.get('action')] || {};
      await route.fulfill({json:payload});
    });
    const shot = name => page.screenshot({path:path.join(output, width+'-'+language+'-'+name+'.png'), animations:'disabled'});
    const y = locator => locator.evaluate(el => Math.round(el.getBoundingClientRect().top + window.scrollY));
    const rows = page.locator('.club-schedule-table tbody tr:visible');
    const picker = page.locator('.club-personal-picker');
    async function select(value, label) {
      const filter = picker.getByRole('combobox',{name:language==='en'?'Show schedule for':'查看谁的赛程'});
      if (desktop) await filter.selectOption(value);
      else {
        await filter.click();
        await picker.getByRole('option', {name:label, exact:true}).click();
      }
    }
    await page.goto(origin + '/');
    const entry = page.locator('.member-heading a[href="/workspace?view=personal"]');
    await entry.waitFor();
    await page.evaluate(() => document.fonts.ready);
    const entryY = await y(entry);
    assert.ok(await entry.evaluate(el=>el.getBoundingClientRect().bottom < innerHeight), 'Schedule entry must fit on the first screen');
    await shot('home');
    await entry.click();
    await rows.first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const firstRowY = await y(rows.first());
    const firstRow = await rows.first().innerText();
    const current = page.locator('.family-upcoming tbody tr');
    assert.deepEqual(await current.locator('.club-session-skater>.club-text-button').allTextContents(),['Ana Reed','Ben Reed']);
    assert.ok(firstRow.includes('11:15–12:00') && firstRow.includes('11:38') && firstRow.includes('#8'));
    assert.match(await current.first().locator('.family-arrival').innerText(), /10:15/);
    const navTop = desktop ? 844 : await page.locator('.club-sidebar').evaluate(el=>el.getBoundingClientRect().top);
    assert.ok(firstRowY >= 0 && firstRowY < navTop, 'The first current session must be visible without scrolling');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1),false,'No page-wide scrolling');
    const pending = page.locator('.family-pending tbody tr');
    assert.equal(await pending.count(),1);
    assert.match(await pending.innerText(), /FREE/);
    assert.doesNotMatch(await pending.innerText(), /#8|11:38/);
    assert.equal(await pending.locator('.family-arrival').count(),0);
    assert.equal(await page.locator('.family-past').getAttribute('open'),null);
    await shot('mine');
    await rows.first().evaluate(el => el.scrollIntoView({block:'start'}));
    await shot('first');
    await pending.locator('.club-candidate-times summary').click();
    assert.match(await pending.innerText(), /15:00–15:40/);
    assert.match(await pending.innerText(), /16:00–16:40/);
    await shot('pending');
    await page.locator('.family-past summary').click();
    assert.match(await page.locator('.family-past tbody').innerText(), /2026.11.07/);
    await select('skater:ben','Ben Reed');
    assert.equal(await rows.count(),1);
    assert.ok((await rows.first().innerText()).includes('Ben Reed'));
    assert.match(await current.first().locator('.family-arrival').innerText(), /12:00/);
    assert.match(await current.first().innerText(), /Individual time pending|个人时间待公布/);
    await rows.first().evaluate(el => el.scrollIntoView({block:'start'}));
    await shot('ben');
    await rows.getByRole('button',{name:'Ben Reed',exact:true}).click();
    const detailBack=page.locator('main > .club-back');
    const scheduleLabel=language==='en'?'Back to personal schedule':'返回个人赛程';
    assert.equal(await detailBack.innerText(),scheduleLabel);
    const detailLength=await page.evaluate(()=>history.length);
    await page.reload();
    await detailBack.click();
    await current.getByRole('button',{name:'Ben Reed',exact:true}).waitFor();
    assert.equal(await rows.count(),1,'Returning to the source keeps the selected skater');
    assert.equal(await page.evaluate(()=>history.length),detailLength,'In-page Back traverses the existing history');
    await shot('back-to-ben');
    await page.goForward();
    await page.getByRole('heading',{name:'Ben Reed',level:1}).waitFor();
    await shot('back-to-schedule-button');
    await page.goBack();
    await current.getByRole('button',{name:'Ben Reed',exact:true}).waitFor();
    await page.reload();
    await current.getByRole('button',{name:'Ben Reed',exact:true}).waitFor();
    assert.equal(await rows.count(),1,'A reloaded history entry retains its filter');
    await select('team', language==='en'?'Whole team':'全队');
    await rows.getByRole('button',{name:'Kim Park',exact:true}).waitFor();
    await shot('team');
    await rows.getByRole('button',{name:'Kim Park',exact:true}).click();
    await page.getByRole('heading',{level:1,name:'Kim Park'}).waitFor();
    await page.locator('.club-topbar-home').click();
    await page.getByRole('heading',{name:language==='en'?'All my skaters':'我的全部',exact:true}).waitFor();
    assert.equal(await rows.getByRole('button',{name:'Kim Park',exact:true}).count(),0);
    assert.equal(await rows.getByRole('button',{name:'Ben Reed',exact:true}).count(),1);
    assert.equal(await rows.getByRole('button',{name:'Ana Reed',exact:true}).count()>0,true);
    await shot('return');
    const manager = picker.locator('details.home-skaters');
    await manager.locator('summary').click();
    assert.deepEqual(await manager.locator('li a').allTextContents(),['Ana Reed','Ben Reed']);
    savedClub = {...club, ownSkaterIds:[], plans:[{id:'ben-meeting',skaterId:'ben',eventId:event.id,slotKey:'PRE-NOVICE MEN SHORT:0',meetingTime:day+'T11:30',note:'',revision:1}]};
    await page.reload();
    await manager.locator('form').waitFor();
    await page.getByText(language==='en'?'Add a skater above to see their schedule.':'在上方添加选手，即可查看赛程。').waitFor();
    await select('skater:ben','Ben Reed');
    assert.match(await current.locator('.club-session-time .club-meeting').innerText(), /11:30/);
    assert.equal(await current.locator('.family-arrival').count(),0,'An earlier coach meeting supersedes the arrival guide');
    const nav = page.locator('.club-sidebar nav');
    const overview = nav.getByRole('button',{name:/Club overview|俱乐部概览/i});
    await overview.click();
    await page.locator('.club-metrics').waitFor();
    assert.equal(await page.locator('a[href="/coaches"]').count(),0,'Parent navigation must not offer administrator maintenance');
    assert.equal(new URL(page.url()).searchParams.get('view'),'home','Overview needs its own restorable URL');
    const historyLength = await page.evaluate(()=>history.length);
    await overview.click();
    assert.equal(await page.evaluate(()=>history.length),historyLength,'Repeated taps must not add duplicate history entries');
    await page.reload();
    await page.locator('.club-metrics').waitFor();
    await nav.getByRole('button',{name:/Personal schedule|个人赛程/i}).click();
    await page.getByRole('heading',{name:language==='en'?'All my skaters':'我的全部',exact:true}).waitFor();
    await page.goBack();
    await page.locator('.club-metrics').waitFor();
    await page.goto(origin+'/');
    const tabs=page.locator('.member-tabs');
    await tabs.getByRole('button',{name:/Notification|通知中心/}).click();
    await tabs.getByRole('button',{name:/Coach instructions|教练要求/i}).click();
    await page.goBack();
    await tabs.locator('[aria-current="page"]').filter({hasText:/Notification|通知中心/}).waitFor();
    await page.goForward();
    await page.reload();
    await tabs.locator('[aria-current="page"]').filter({hasText:/Coach instructions|教练要求/i}).waitFor();
    await page.goto(origin+'/?tab=admin');
    await tabs.getByRole('button',{name:/My workspace|我的工作区/i}).waitFor();
    assert.equal(await tabs.getByRole('button',{name:/Member management|会员管理/i}).count(),0);
    assert.equal(new URL(page.url()).searchParams.has('tab'),false,'Parent cannot enter a restricted tab');
    await page.locator('.member-skater-list a').filter({hasText:'Ben Reed'}).first().click();
    await detailBack.waitFor();
    assert.equal(await detailBack.innerText(),language==='en'?'Back to member workspace':'返回会员工作区');
    await detailBack.click();
    await tabs.waitFor();
    const direct=await context.newPage();
    await direct.route('**/api/club*',route=>route.fulfill({json:new URL(route.request().url()).search?{records:[]}:club}));
    await direct.goto(origin+'/workspace?view=skaters&skater=ben');
    await direct.locator('main > .club-back').click();
    await direct.locator('.club-skater-card').first().waitFor();
    await direct.close();
    assert.deepEqual(writes,[]);
    assert.deepEqual(errors,[]);
    return {width,language,entryY,firstRowY,firstRow};
  } finally {
    await context.close();
  }
}
const launch = engine === chromium && process.platform === 'win32' ? {executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'} : {};
const browser = await engine.launch({headless:true,...launch});
try {
  const report = [];
  for (const width of widths) for (const language of languages) report.push(await walk(width,language,browser));
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
