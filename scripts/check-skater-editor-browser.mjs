// Isolated API fixtures in real phone/desktop browsers; never uses production identities.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {chromium,webkit,devices}=await import(pathToFileURL(path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const engine=process.env.HSC_MOBILE_ENGINE==='webkit'?webkit:chromium,origin=process.env.HSC_PREVIEW_ORIGIN||'http://127.0.0.1:5175';
const output=process.env.HSC_MOBILE_OUTPUT||path.resolve('work/skater-editor-qa');await fs.mkdir(output,{recursive:true});
const readyUntil=Date.now()+90000;let ready=false;while(Date.now()<readyUntil){try{if((await fetch(origin+'/favicon.svg',{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready,'Local preview must be ready');
const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
const report=[];
try{
  for(const width of [320,390,1280])for(const language of ['en','zh']){
    const context=await browser.newContext({...devices[width===1280?(engine===webkit?'Desktop Safari':'Desktop Chrome'):(engine===webkit?'iPhone 13':'Pixel 7')],viewport:{width,height:844},deviceScaleFactor:1});
    const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(90000);await page.addInitScript(locale=>localStorage.setItem('hsc-language',locale),language);
    const member={id:'fixture-admin',name:'Fixture Administrator',email:'fixture@example.test',role:'admin',requested_role:'parent',status:'active',auth_version:1};
    const initial={id:'fixture-skater',name:'Existing Fixture',coach:'Existing Coach',training:true,categories:[],clubs:[],recordCount:0,eventCount:0,identityStatus:'Fixture',profileRevision:null,coachRevision:0};
    let skaters=[initial],failNext=false,writes=0;
    await page.route('**/api/**',async route=>{
      const request=route.request(),url=new URL(request.url());let payload={},status=200;
      if(url.pathname==='/api/club')payload=url.search?{records:[]}:{member,ownSkaterIds:[],writableSkaterIds:skaters.map(row=>row.id),skaters,events:[],plans:[],sync:{},historyEvents:[],recent:[],asOf:'2026-11-03',summary:{category_records:0,team_records:0},reviews:[],limitations:[]};
      else if(url.pathname==='/api/skaters'&&request.method()==='GET')payload={skater:skaters.find(row=>row.id===url.searchParams.get('id'))};
      else if(url.pathname==='/api/skaters'){
        const body=request.postDataJSON();
        if(failNext){failNext=false;status=503;payload={error:'Fixture save failed; edits retained.'};}
        else {const creating=!body.id,existing=skaters.find(row=>row.id===body.id);const saved={...initial,...existing,...body,id:body.id||'fixture-created',profileRevision:'fixture-'+(++writes),coachRevision:(existing?.coachRevision||0)+1};skaters=creating?[...skaters,saved]:skaters.map(row=>row.id===saved.id?saved:row);payload={skater:saved};status=creating?201:200;}
      }
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(payload)});
    });
    await page.goto(origin+'/workspace?view=skaters',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:/^Add skater$|^新增选手$/}).click();
    const dialog=page.getByRole('dialog'),name=dialog.locator('input[name="skaterName"]'),coach=dialog.locator('input[name="coach"]');
    await name.fill('Fixture New Skater');await coach.fill('Coach One/Coach Two');
    const bounds=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,pageWidth:document.documentElement.scrollWidth};});
    assert.ok(bounds.left>=0&&bounds.right<=width+.5&&bounds.top>=0&&bounds.bottom<=844.5,JSON.stringify(bounds));
    const shot=engine.name()+'-'+width+'-'+language+'-add.png';await page.screenshot({path:path.join(output,shot)});
    await dialog.getByRole('button',{name:/^Save skater$|^保存选手$/}).click();
    await page.getByRole('heading',{name:'Fixture New Skater',exact:true,level:1}).waitFor();await page.getByText('Coach One/Coach Two',{exact:true}).waitFor();
    await page.getByRole('button',{name:/Edit skater & coaches|编辑选手及教练/}).click();
    await name.fill('Fixture Updated Skater');await coach.fill('Updated Coach');await dialog.locator('input[name="training"]').uncheck();
    failNext=true;await dialog.getByRole('button',{name:/^Save skater$|^保存选手$/}).click();await dialog.getByRole('alert').waitFor();assert.equal(await name.inputValue(),'Fixture Updated Skater');assert.equal(await coach.inputValue(),'Updated Coach');
    await dialog.getByRole('button',{name:/^Save skater$|^保存选手$/}).click();await page.getByRole('heading',{name:'Fixture Updated Skater',exact:true,level:1}).waitFor();await page.getByText('Updated Coach',{exact:true}).waitFor();
    const editBounds=await page.locator('.club-profile-edit').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};});assert.ok(editBounds.width>0&&editBounds.left>=0&&editBounds.right<=width+.5,JSON.stringify(editBounds));if(width<=390){const profileFit=await page.locator('.club-profile-info').evaluate(el=>{const r=el.getBoundingClientRect(),button=el.parentElement.querySelector('.club-profile-edit').getBoundingClientRect(),title=el.querySelector('h2');return {overlap:Math.min(r.right,button.right)-Math.max(r.left,button.left)>1&&Math.min(r.bottom,button.bottom)-Math.max(r.top,button.top)>1,titleWidth:title.clientWidth,titleScroll:title.scrollWidth};});assert.equal(profileFit.overlap,false);assert.ok(profileFit.titleScroll<=profileFit.titleWidth+1,JSON.stringify(profileFit));}await page.screenshot({path:path.join(output,engine.name()+'-'+width+'-'+language+'-profile.png')});
    assert.equal(skaters.length,2);assert.equal(skaters.find(row=>row.id==='fixture-created').training,false);assert.equal(writes,2);
    report.push({engine:engine.name(),width,language,create:true,edit:true,failedSaveRetainsDraft:true,bounds,screenshot:shot});await context.close();
  }
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({fixtureOnly:true,productionAccount:false,views:report},null,2));console.log(JSON.stringify({engine:engine.name(),views:report.length,createEditAndDraftRetention:true,output}));
}finally{await browser.close();}
