import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';

const requests=[],scheduled=[],listeners=new Map(),stored=new Map(),events=[];
let responder=async()=>({status:200,headers:{'content-type':'application/json'},data:'{}'});
let pending=[];
let blockStorage;
const secure={setSynchronize:async()=>{},setDefaultKeychainAccess:async()=>{},get:async key=>stored.get(key),remove:async key=>stored.delete(key),set:async(key,value)=>{if(blockStorage)await blockStorage;stored.set(key,value);}};
globalThis.hscNativeMocks={
  core:{Capacitor:{isNativePlatform:()=>true},CapacitorHttp:{request:async options=>{requests.push(options);return responder(options);}}},
  app:{App:{addListener:async(name,listener)=>{listeners.set(name,listener);},getLaunchUrl:async()=>null,minimizeApp:async()=>events.push('minimize')}},
  browser:{Browser:{open:async options=>events.push(options)}},
  filesystem:{Filesystem:{rmdir:async()=>{},writeFile:async options=>({uri:'file:///cache/'+options.path})},Directory:{Cache:'CACHE'},Encoding:{UTF8:'utf8'}},
  share:{Share:{share:async options=>events.push(options)}},
  'local-notifications':{LocalNotifications:{
    getPending:async()=>({notifications:pending}),cancel:async()=>{pending=[];},
    getDeliveredNotifications:async()=>({notifications:[]}),removeDeliveredNotifications:async()=>{},
    checkPermissions:async()=>({display:'granted'}),requestPermissions:async()=>({display:'granted'}),
    schedule:async options=>{pending=options.notifications;scheduled.push(options);},addListener:async()=>{},
  }},
  secure:{SecureStorage:secure,KeychainAccess:{whenUnlockedThisDeviceOnly:1}},
};
globalThis.document={addEventListener:(name,listener)=>listeners.set('document-'+name,listener),querySelector:()=>null};
globalThis.window={addEventListener:(name,listener)=>listeners.set(name,listener),dispatchEvent:event=>{events.push(event.type);listeners.get(event.type)?.(event);},alert:()=>{}};
globalThis.localStorage={removeItem:key=>events.push('clear:'+key)};
globalThis.location={origin:'https://localhost',pathname:'/',search:'',reload:()=>events.push('reload')};
globalThis.history={replaceState:()=>{},pushState:()=>{},back:()=>events.push('back')};
registerHooks({
  resolve(specifier,context,next){
    if(specifier.startsWith('@capacitor/')||specifier==='@aparajita/capacitor-secure-storage')return {url:'native-mock:'+specifier,shortCircuit:true};
    try{return next(specifier,context);}catch(error){
      if(specifier.startsWith('.')){const candidate=new URL(specifier+'.ts',context.parentURL);if(fs.existsSync(candidate))return {url:candidate.href,shortCircuit:true};}
      throw error;
    }
  },
  load(url,context,next){
    if(url.startsWith('native-mock:')){
      const key=url.includes('@aparajita/')?'secure':url.split('/').at(-1);
      return {format:'module',source:Object.keys(globalThis.hscNativeMocks[key]).map(name=>`export const ${name}=globalThis.hscNativeMocks[${JSON.stringify(key)}].${name};`).join('\n'),shortCircuit:true};
    }
    if(url.endsWith('.ts'))return {format:'module',source:ts.transpileModule(fs.readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const {apiURL,deepLinkPath,devicePlans,serverOrigin}=await import('../src/policy.ts');
const {bootstrap}=await import('../src/native.ts');
const {apiFetch,clearClientSession,scheduleDeviceReminders,saveTextFile}=await import('../../lib/client-platform.ts');
const checks=[];
function passed(name){checks.push(name);}
assert.equal(apiURL('/api/member?action=me'),serverOrigin+'/api/member?action=me');
for(const path of ['https://evil.test/api/','//evil.test/api/','/api/../admin','/api/../../','/api/\\evil.test'])assert.throws(()=>apiURL(path));
assert.equal(deepLinkPath('hscskating://verify-email?verified=1&token=not-used'),'/verify-email?verified=1');
for(const url of ['hscskating://sign-in?token=unsafe','https://evil.test/verify-email','hscskating://verify-email/other'])assert.equal(deepLinkPath(url),null);
passed('API destinations and deep links reject external hosts, path traversal and token handoff');
globalThis.fetch=async()=>new Response('<html>Private gateway</html>',{headers:{'content-type':'text/html'}});
const webFailure=await apiFetch('/api/member?action=identity');
assert.equal(webFailure.status,502);assert.match((await webFailure.json()).error,/private site access/);
passed('shared browser transport reports a connection failure instead of parsing gateway HTML');
await bootstrap();
assert.equal(stored.size,0);
responder=async()=>({status:200,headers:{'content-type':'application/json','set-auth-token':'fixture-signed'},data:'{}'});
await apiFetch('/api/auth/sign-in/email',{method:'POST',body:JSON.stringify({email:'fixture@example.test',password:'fixture-only'})});
assert.equal(stored.get('hsc-session-v1'),'fixture-signed');
responder=async()=>({status:200,headers:{'content-type':'application/json'},data:JSON.stringify({member:{id:'parent-a'}})});
await apiFetch('/api/member?action=me');
const last=requests.at(-1);
assert.equal(last.headers.Origin,serverOrigin);assert.equal(last.headers.Authorization,'Bearer fixture-signed');assert.equal(last.disableRedirects,true);
assert.equal(last.url,serverOrigin+'/api/member?action=me');
passed('signed bearer uses native HTTP with fixed origin and no redirect following');
listeners.get('backButton')({canGoBack:true});assert.ok(events.includes('back'));
await listeners.get('backButton')({canGoBack:false});assert.ok(events.includes('minimize'));
let prevented=false;
listeners.get('document-click')({target:{closest:()=>({href:'javascript:alert(1)'})},preventDefault:()=>{prevented=true;}});
assert.equal(prevented,true);assert.equal(events.some(item=>item.url==='javascript:alert(1)'),false);
passed('Android back uses local history; source links never execute javascript URLs');
const time=Date.now(),plan={id:'fixture-plan',memberId:'parent-a',basis:'official-group-start',notifyAt:new Date(time+3600000).toISOString(),arrivalAt:new Date(time+7200000).toISOString(),startAt:new Date(time+10800000).toISOString(),eventName:'Fixture event',category:'SHORT',packing:'Skates'};
const plans=[plan,{...plan,id:'other',memberId:'parent-b'},{...plan,id:'uncertain',basis:'estimated'},{...plan,id:'late',notifyAt:new Date(time-1).toISOString()},{...plan,id:'arrival',arrivalAt:plan.startAt}];
assert.deepEqual(devicePlans(plans,'parent-a',time).map(item=>item.id),['fixture-plan']);
await scheduleDeviceReminders(plans,true);assert.equal(pending.length,1);assert.equal(pending[0].isExactNotification,false);
await scheduleDeviceReminders([],false);assert.equal(pending.length,0);
await saveTextFile('HSC.csv','fixture-only');assert.ok(events.some(item=>item.files?.[0]==='file:///cache/hsc-exports/HSC.csv'));
passed('device reminders isolate account, skip uncertain/past times, cancel revisions; CSV uses cache/share');
responder=async()=>({status:401,headers:{'content-type':'text/html'},data:'<html>Private gateway</html>'});
await assert.rejects(apiFetch('/api/club'),/private hosting gateway/);
assert.equal(stored.get('hsc-session-v1'),'fixture-signed');
passed('private gateway is reported without treating HTML or browser cookies as an app session');
responder=async()=>({status:401,headers:{'content-type':'application/json'},data:'{"error":"expired"}'});
await apiFetch('/api/club');assert.equal(stored.size,0);assert.equal(pending.length,0);assert.ok(events.includes('reload'));
passed('401 clears secure token, pending alerts and private in-memory view');
let releaseStorage;
blockStorage=new Promise(resolve=>{releaseStorage=resolve;});
responder=async()=>({status:200,headers:{'content-type':'application/json','set-auth-token':'stale-fixture'},data:'{}'});
const signingIn=apiFetch('/api/auth/sign-in/email',{method:'POST',body:'{}'});
await new Promise(resolve=>setImmediate(resolve));
const signingOut=clearClientSession();releaseStorage();await Promise.all([signingIn,signingOut]);blockStorage=undefined;
assert.equal(stored.size,0);
responder=async()=>({status:200,headers:{'content-type':'application/json','set-auth-token':'fixture-before-failed-signout'},data:'{}'});
await apiFetch('/api/auth/sign-in/email',{method:'POST',body:'{}'});
assert.equal(stored.size,1);
responder=async()=>{throw new Error('fixture network failure');};
await assert.rejects(apiFetch('/api/auth/sign-out',{method:'POST',body:'{}'}),/network failure/);assert.equal(stored.size,0);
passed('logout wins concurrent token writes and clears an existing token even if sign-out transport fails');
const config=fs.readFileSync(new URL('../capacitor.config.ts',import.meta.url),'utf8');
assert.doesNotMatch(config,/server\s*:\s*\{[^}]*\burl\s*:/);
const files=fs.readdirSync(new URL('../dist/assets/',import.meta.url)).filter(name=>name.endsWith('.js'));
const bundle=files.map(name=>fs.readFileSync(new URL('../dist/assets/'+name,import.meta.url),'utf8')).join('\n');
assert.doesNotMatch(bundle,/cloudflare:workers|drizzle-orm|hsc_auth_user|BETTER_AUTH_SECRET|RESEND_API_KEY/);
passed('static bundle excludes Worker, database, authentication secrets and remote server.url');
console.log(JSON.stringify({passed:checks.length,checks,fixtureOnly:true,externalMessagesSent:0},null,2));
