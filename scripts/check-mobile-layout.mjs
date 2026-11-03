// Real browser rendering with isolated API fixtures; never reads personal browser profiles or production sessions.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const modulePath=process.env.HSC_PLAYWRIGHT_MODULE||path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs');
const {chromium,webkit,devices}=await import(pathToFileURL(modulePath).href);
const origin=process.env.HSC_PREVIEW_ORIGIN||'http://127.0.0.1:5175';
const output=process.env.HSC_MOBILE_OUTPUT||path.resolve('work/mobile-layout');await fs.mkdir(output,{recursive:true});
// Schedule fixture stays intentionally small. Official parser coverage is in check-starting-order-api.mjs.
const testRole=process.env.HSC_MOBILE_ROLE||'parent';
const member={id:'fixture-parent',name:'Alexandra Fixture Parent',email:'parent@example.test',role:testRole,requested_role:testRole,status:'active',auth_version:1};
const carson={id:'fixture-carson',name:'Carson Wang',coach:'Jen Jackson/Bryce Davidson',training:true,categories:['Pre-Novice Men'],clubs:['Hamilton SC'],recordCount:0,eventCount:0,identityStatus:'Fixture'};
const event={id:'fixture-sectionals',name:'2027 Skate Ontario Junior & Senior Sectional Championships',url:'https://skateontario.org/event/fixture/',start:'2026-11-05',end:'2026-11-08',timezone:'America/Toronto',venue:'Komoka Wellness Centre',city:'Komoka',source:'Skate Ontario',updateText:'',documents:[],needsReview:false,participants:[{id:'fixture-entry',name:'Carson Wang',category:'Pre-Novice Men',club:'Hamilton SC',section:'ON',skaterIds:[carson.id],matchStatus:'Fixture',sourceUrl:'https://skateontario.org/entry.pdf'}],blocks:[{id:'fixture-short',category:'PRE-NOVICE MEN SHORT (16-25)',categoryKey:'PRENOVICE:MEN',group:null,range:[16,25],activity:'competition',date:'2026-11-05',start:'11:15',end:'12:15',rink:'MOLSON RINK',page:1,sourceUrl:'https://skateontario.org/schedule.pdf'}],startingOrders:[{id:'fixture-order',name:'Carson Wang',category:'Pre-Novice Men - Short Program',program:'short',startNumber:19,warmupGroup:4,individualTime:null,sourceUrl:'https://skatingresults.ca/fixture/#/seg/fixture/start',page:0,skaterIds:[carson.id]}]};
const club={member,ownSkaterIds:[carson.id],writableSkaterIds:[],skaters:[carson],events:[event],plans:[],sync:{},historyEvents:[],recent:[],asOf:'2026-11-03',summary:{category_records:0,team_records:0},reviews:[],limitations:[]};
const browserType=process.env.HSC_MOBILE_ENGINE==='webkit'?webkit:chromium;
const readyUntil=Date.now()+90000;let previewReady=false;while(Date.now()<readyUntil){try{const response=await fetch(origin+'/favicon.svg',{signal:AbortSignal.timeout(2000)});if(response.ok){previewReady=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(previewReady,'Local preview must be ready before browser checks');
const browser=await browserType.launch({headless:true,...(browserType===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
const report=[];
try{for(const width of (process.env.HSC_MOBILE_WIDTHS||'320,375,390,430,1280').split(',').map(Number))for(const language of ['en','zh']){
  const context=await browser.newContext({...devices[width===1280?(browserType===webkit?'Desktop Safari':'Desktop Chrome'):(browserType===webkit?'iPhone 13':'Pixel 7')],viewport:{width,height:width===1280?900:844},deviceScaleFactor:1});
  const page=await context.newPage();page.setDefaultNavigationTimeout(90000);await page.addInitScript(locale=>{localStorage.setItem('hsc-language',locale);},language);
  await page.route('**/api/**',async route=>{const url=new URL(route.request().url());let payload={};
    if(url.pathname==='/api/club')payload=club;
    else if(url.pathname==='/api/member'){const action=url.searchParams.get('action');payload=action==='identity'?{identity:{name:member.name,email:member.email,provider:'password'}}:action==='me'?{member,skaterIds:[carson.id],preferredSkaterIds:[carson.id],claims:[]}:action==='notifications'?{notifications:[]}:action==='requirements'?{requirements:[]}:action==='admin'?{members:[],candidates:[carson],admissions:[],relations:[],invites:[],claims:[],logs:[],coachCandidates:[],outbox:[]}:{};}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  for(const route of ['/','/workspace?view=coach']){
    await page.goto(origin+route,{waitUntil:'networkidle'});await page.locator(route==='/'?'.member-header':'.club-topbar').waitFor();
    if(route==='/')await page.getByRole('button',{name:/Sign out|退出登录/}).waitFor();else {await page.getByText('Carson Wang',{exact:true}).first().waitFor();await page.getByRole('link',{name:/Start #19|出场 #19/}).waitFor();}
    const selector=route==='/'?'.member-header':'.club-topbar';
    const layout=await page.locator(selector).evaluate(header=>{const rect=header.getBoundingClientRect();const targets=[...header.querySelectorAll('a,button,select')].filter(el=>el.getClientRects().length).map(el=>{const b=el.getBoundingClientRect();return {label:el.textContent?.trim().slice(0,60),x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};});return {header:{x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom,height:rect.height},targets,viewport:innerWidth,pageWidth:document.documentElement.scrollWidth};});
    const issues=layout.targets.filter(t=>t.x<-.5||t.right>width+.5||t.y<layout.header.y-.5||t.bottom>layout.header.bottom+.5).map(t=>'outside: '+t.label);
    for(let a=0;a<layout.targets.length;a++)for(let b=a+1;b<layout.targets.length;b++){const first=layout.targets[a],second=layout.targets[b];if(Math.min(first.right,second.right)-Math.max(first.x,second.x)>2&&Math.min(first.bottom,second.bottom)-Math.max(first.y,second.y)>2)issues.push('overlap: '+first.label+' / '+second.label);}
    if(width<=430&&route==='/'&&layout.targets[0]?.height>64)issues.push('Brand text is compressed into too many lines');
    if(route!=='/'&&width<=430){const nav=await page.locator('.club-sidebar nav').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,buttons:[...el.querySelectorAll('button')].map(b=>({text:b.textContent.trim(),left:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right}))}));layout.navigation=nav;for(const b of nav.buttons)if(b.left<0||b.right>width+.5)issues.push('Navigation clipped: '+b.text);}
    if(route!=='/'&&width<=430){const actions=await page.locator('.club-data-controls>button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,center:(r.top+r.bottom)/2};}));layout.actions=actions;layout.actionStyle=await page.locator('.club-data-controls').evaluate(el=>{const s=getComputedStyle(el);return {width:s.width,maxWidth:s.maxWidth,flexDirection:s.flexDirection};});if(actions.some(a=>a.left<0||a.right>width+.5))issues.push('Page actions overflow');if(testRole==='admin'&&width>=375&&actions.length>1&&Math.min(actions[0].bottom,actions[1].bottom)-Math.max(actions[0].top,actions[1].top)<Math.min(actions[0].height,actions[1].height)/2)issues.push('Admin page actions should share one row');}
    const filename=`${browserType.name()}-${width}-${language}-${route==='/'?'home':'coach'}.png`;await page.screenshot({path:path.join(output,filename),fullPage:false});report.push({width,language,route,layout,issues,screenshot:filename});
  }await context.close();
}await fs.writeFile(path.join(output,'report.json'),JSON.stringify({engine:browserType.name(),role:testRole,fixtureOnly:true,realAccountLogin:false,checks:report},null,2));
const failures=report.filter(r=>r.issues.length);console.log(JSON.stringify({engine:browserType.name(),views:report.length,failures:failures.map(({width,language,route,issues})=>({width,language,route,issues})),output},null,2));
if(process.env.HSC_MOBILE_BASELINE!=='1')assert.equal(failures.length,0,'Header controls must fit without overlap');
}finally{await browser.close();}
