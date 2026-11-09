// Run after the Capacitor build. The browser loads its actual static bundle.
// Only native plugin calls are substituted. No device profile or remote API is used.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const cache=path.resolve('work/browser-qa/browsers');
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync(cache))process.env.PLAYWRIGHT_BROWSERS_PATH=cache;
const {chromium,webkit}=await import(pathToFileURL(process.env.HSC_PLAYWRIGHT_MODULE||path.resolve('work/browser-qa/node_modules/playwright-core/index.mjs')).href);
const build=path.resolve('capacitor/dist'),origin='http://127.0.0.1:5174';
const key='capacitor-storage_hsc-session-v1',token='fixture-device-session';
const member={id:'fixture-native-parent',name:'Example Parent',email:'parent@example.test',role:'parent',requested_role:'parent',status:'active'};
const files=await fs.readdir(path.join(build,'assets'));
const report=[];

async function checkDevice(browser,platform,cold){
  const language=platform==='ios'?'zh':'en';
  const context=await browser.newContext({viewport:{width:390,height:844},locale:language==='zh'?'zh-CN':'en-CA'});
  const store=new Map([[key,JSON.stringify(token)]]);
  const calls=[],pageErrors=[],unexpectedNetwork=[];
  let offline=cold,pending=[],delivered=[],cachedExport=false;
  try{
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin==='https://fonts.googleapis.com'&&route.request().resourceType()==='stylesheet')return route.abort();
      if(url.origin===origin){
        if(url.pathname==='/')return route.fulfill({path:path.join(build,'index.html'),contentType:'text/html'});
        const file=url.pathname.slice('/assets/'.length);
        if(url.pathname.startsWith('/assets/')&&files.includes(file))return route.fulfill({path:path.join(build,'assets',file)});
        if(url.pathname==='/favicon.ico')return route.fulfill({status:204});
      }
      unexpectedNetwork.push(url.href);
      return route.abort();
    });
    await context.exposeBinding('hscPluginCall',(_source,plugin,method,options)=>{
      if(plugin==='SecureStorage'){
        if(method==='internalGetItem')return {data:store.get(options.prefixedKey)??null};
        if(method==='internalRemoveItem')return {success:store.delete(options.prefixedKey)};
      }
      if(plugin==='LocalNotifications'){
        if(method==='getPending')return {notifications:pending};
        if(method==='getDeliveredNotifications')return {notifications:delivered};
        if(method==='cancel')pending=[];
        if(method==='removeDeliveredNotifications')delivered=[];
        if(method==='checkPermissions')return {display:'granted'};
      }
      if(plugin==='Filesystem'&&method==='rmdir'&&options.path==='hsc-exports')cachedExport=false;
      if(plugin==='CapacitorHttp'){
        const url=new URL(options.url),action=url.searchParams.get('action')||url.pathname;
        const hasToken=options.headers.Authorization==='Bearer '+token;
        calls.push({action,hasToken,offline});
        if(offline)throw new Error('Fixture network is offline');
        let data={};
        if(action==='identity')data={identity:hasToken?{name:member.name,email:member.email,provider:'password'}:null};
        if(action==='me')data={member,skaterIds:[],preferredSkaterIds:[],claims:[]};
        if(action==='reminders')data={plans:[],rules:[]};
        return {status:200,headers:{'content-type':'application/json'},data:JSON.stringify(data)};
      }
      return {};
    });
    await context.addInitScript(({platform,language})=>{
      localStorage.setItem('hsc-language',language);
      window.CapacitorCustomPlatform={name:platform};
      const methods={App:['addListener','getLaunchUrl'],CapacitorHttp:['request'],HSCSession:['clearCookies'],CapacitorCookies:['clearAllCookies'],
        Filesystem:['rmdir'],SecureStorage:['setSynchronizeKeychain','internalGetItem','internalRemoveItem'],
        LocalNotifications:['addListener','getPending','cancel','getDeliveredNotifications','removeDeliveredNotifications','checkPermissions']};
      window.Capacitor={
        PluginHeaders:Object.entries(methods).map(([name,list])=>({name,methods:list.map(method=>({name:method,rtype:method==='addListener'?'callback':'promise'}))})),
        nativeCallback:()=>Promise.resolve('fixture-listener'),
        nativePromise:(plugin,method,options)=>window.hscPluginCall(plugin,method,options)
      };
    },{platform,language});
    const page=await context.newPage();
    page.on('pageerror',error=>pageErrors.push(String(error)));
    page.setDefaultTimeout(7500);
    await page.goto(origin+'/?tab=account');
    if(cold){
      const local=page.getByRole('button',{name:/Sign out on this device|从本机退出/i});
      await local.waitFor();assert(store.has(key));
      await local.click();
    }else{
      const account=page.locator('.member-account-panel');
      await account.getByText(member.name,{exact:true}).waitFor();
      assert(calls.some(call=>call.action==='identity'&&call.hasToken));
      offline=true;
      pending=[{id:1}];delivered=[{id:2}];cachedExport=true;
      await page.evaluate(()=>localStorage.setItem('hsc-coach-drafts-v1','fixture draft'));
      await account.getByText(/Other devices|其他设备/).click();
      await account.getByRole('button',{name:/Revoke all|撤销我的所有/}).click();
      await page.getByRole('alert').waitFor();
      assert(calls.some(call=>call.action==='revoke-own-sessions'&&call.offline&&call.hasToken));
      assert.equal(new URL(page.url()).searchParams.get('tab'),'account');
      assert(store.has(key));assert.equal(pending.length,1);
      await account.getByRole('button',{name:/^Sign out$|^退出登录$/}).click();
    }
    await page.waitForURL(url=>url.searchParams.get('signedOut')==='local');
    await page.locator('#hsc-login').waitFor();
    await page.getByRole('status').filter({hasText:/server could not confirm|服务器暂未确认/}).waitFor();
    if(!cold){
      for(const action of ['logout','/api/auth/sign-out'])assert(calls.some(call=>call.action===action&&call.offline&&call.hasToken),action);
      assert.equal(await page.evaluate(()=>localStorage.getItem('hsc-coach-drafts-v1')),null);
      assert.deepEqual(pending,[]);assert.deepEqual(delivered,[]);assert.equal(cachedExport,false);
    }
    assert.equal(store.has(key),false);
    if(process.env.HSC_MOBILE_OUTPUT){
      await fs.mkdir(process.env.HSC_MOBILE_OUTPUT,{recursive:true});
      await page.screenshot({path:path.join(process.env.HSC_MOBILE_OUTPUT,platform+'-'+(cold?'cold':'warm')+'-signed-out.png')});
    }
    offline=false;
    await page.goto(origin+'/?tab=account');
    await page.locator('#hsc-login').waitFor();
    assert.equal(calls.filter(call=>call.action==='identity').at(-1)?.hasToken,false);
    assert.deepEqual(unexpectedNetwork,[]);assert.deepEqual(pageErrors,[]);
    report.push({platform,language,cold,cleared:true,nextIdentityAnonymous:true});
  }finally{await context.close();}
}

for(const [engine,platform] of [[chromium,'android'],[webkit,'ios']]){
  const executable=process.env.HSC_CHROMIUM_EXECUTABLE||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
  const browser=await engine.launch({headless:true,...(engine===chromium&&executable?{executablePath:executable}:{})});
  try{for(const cold of [false,true])await checkDevice(browser,platform,cold);}
  finally{await browser.close();}
}
console.log(JSON.stringify({staticBundle:'capacitor/dist',fixtureNativeBridge:true,checks:report},null,2));
