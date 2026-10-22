import {Capacitor,CapacitorHttp,CapacitorCookies,registerPlugin} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {LocalNotifications} from '@capacitor/local-notifications';
import {SecureStorage,KeychainAccess} from '@aparajita/capacitor-secure-storage';
import {installClientPlatform} from '../../lib/client-platform';
import type {ReminderPlan} from '../../lib/reminders';
import {apiURL,deepLinkPath,devicePlans,serverOrigin,verificationURL} from './policy';

const sessionKey='hsc-session-v1';
const nativeSession=registerPlugin<{clearCookies:()=>Promise<void>}>('HSCSession');
const clearCookies=()=>Capacitor.getPlatform()==='android'?nativeSession.clearCookies():CapacitorCookies.clearAllCookies();
let token:string|null=null;
let memberId='';
let generation=0;
let reminderQueue:Promise<unknown>=Promise.resolve();
let storageQueue:Promise<unknown>=Promise.resolve();
let httpQueue:Promise<unknown>=Promise.resolve();
function queueHTTP<T>(work:()=>Promise<T>):Promise<T>{const result=httpQueue.then(work);httpQueue=result.catch(()=>{});return result;}
function queueStorage<T>(work:()=>Promise<T>):Promise<T>{const result=storageQueue.then(work);storageQueue=result.catch(()=>{});return result;}
function queueReminders<T>(work:()=>Promise<T>):Promise<T>{const result=reminderQueue.then(work);reminderQueue=result.catch(()=>{});return result;}
async function cancelReminders(){
  const pending=await LocalNotifications.getPending();
  if(pending.notifications.length)await LocalNotifications.cancel(pending);
  const delivered=await LocalNotifications.getDeliveredNotifications();
  if(delivered.notifications.length)await LocalNotifications.removeDeliveredNotifications(delivered);
}
async function logout(){
  generation++;token=null;memberId='';
  try{localStorage.removeItem('hsc-coach-drafts-v1');}catch{}
  try{await queueStorage(()=>SecureStorage.remove(sessionKey));}
  finally{
    await Promise.all([
      queueReminders(cancelReminders),clearCookies(),
      Filesystem.rmdir({path:'hsc-exports',directory:Directory.Cache,recursive:true}).catch(()=>{}),
    ]);
  }
}
async function scheduleReminders(plans:ReminderPlan[],askPermission:boolean){
  const requestedGeneration=generation;
  return queueReminders(async()=>{
    await cancelReminders();
    if(requestedGeneration!==generation||!token||!memberId)return 'Please sign in first. / 请先登录。';
    const permission=await (askPermission?LocalNotifications.requestPermissions():LocalNotifications.checkPermissions());
    if(permission.display!=='granted')return 'Phone alert permission is not enabled. / 尚未允许本机提醒。';
    const selected=devicePlans(plans,memberId);
    if(requestedGeneration!==generation)return '';
    if(selected.length)await LocalNotifications.schedule({notifications:selected.map((plan,index)=>({
      id:index+1,title:'HSC · '+plan.eventName,body:plan.category+' · '+plan.packing,
      schedule:{at:new Date(plan.notifyAt)},isExactNotification:false,extra:{memberId,planId:plan.id},
    }))});
    return selected.length+' on-device reminders scheduled. Check official updates. / 已安排 '+selected.length+' 条本机提醒，请核对官网更新。';
  });
}
async function request(path:string,init:RequestInit={}):Promise<Response>{
  const url=apiURL(path);
  const method=(init.method||'GET').toUpperCase();
  if(!['GET','POST'].includes(method))throw new Error('Unsupported request method');
  const headers:Record<string,string>={Accept:'application/json',Origin:serverOrigin};
  if(token)headers.Authorization='Bearer '+token;
  if(init.body!==undefined)headers['Content-Type']='application/json';
  const requestedGeneration=generation;
  const signingOut=new URL(url).pathname==='/api/auth/sign-out';
  try{
    const result=await queueHTTP(async()=>{
      if(requestedGeneration!==generation)throw new Error('Session changed. Please retry.');
      await clearCookies();
      try{return await CapacitorHttp.request({url,method,headers,responseType:'text',disableRedirects:true,
        connectTimeout:15000,readTimeout:30000,...(init.body===undefined?{}:{data:JSON.parse(String(init.body))}),
      });}finally{await clearCookies();}
    });
    if(requestedGeneration!==generation)throw new Error('Session changed. Please retry.');
    const responseHeaders=new Headers(result.headers);
    if(!responseHeaders.get('content-type')?.includes('application/json'))throw new Error('The private hosting gateway requires separate access approval. App login cannot unlock it. / 私人托管网关需要独立访问授权，应用账号无法解锁。');
    const raw=typeof result.data==='string'?result.data:JSON.stringify(result.data);
    const value=JSON.parse(raw);
    const signed=responseHeaders.get('set-auth-token');
    if(result.status>=200&&result.status<300&&signed){
      await queueStorage(async()=>{
        if(requestedGeneration!==generation)return;
        await SecureStorage.set(sessionKey,signed);
        if(requestedGeneration!==generation){await SecureStorage.remove(sessionKey);return;}
        token=signed;
      });
    }
    if(result.status===401){await logout();window.dispatchEvent(new Event('hsc-session-expired'));}
    if(result.status>=200&&result.status<300&&value.member?.id){
      if(memberId&&memberId!==value.member.id)await queueReminders(cancelReminders);
      memberId=value.member.id;
    }
    if(result.status>=200&&result.status<300&&Array.isArray(value.plans)&&new URL(url).pathname==='/api/member'){
      await scheduleReminders(value.plans,false);
    }
    return new Response(raw,{status:result.status,headers:{'Content-Type':'application/json'}});
  }finally{if(signingOut)await logout();}
}
async function refreshReminders(){
  if(!token)return;
  try{
    const me=await request('/api/member?action=me');
    if(!me.ok){await queueReminders(cancelReminders);return;}
    const response=await request('/api/member?action=reminders');
    if(!response.ok)await queueReminders(cancelReminders);
  }catch{await queueReminders(cancelReminders);}
}
async function saveText(filename:string,value:string){
  if(!token||!memberId)throw new Error('Please sign in before exporting. / 请登录后导出。');
  const cleanName=filename.replace(/[^\p{L}\p{N}_.-]/gu,'_').slice(0,100);
  await Filesystem.rmdir({path:'hsc-exports',directory:Directory.Cache,recursive:true}).catch(()=>{});
  const saved=await Filesystem.writeFile({path:'hsc-exports/'+cleanName,data:value,directory:Directory.Cache,encoding:Encoding.UTF8,recursive:true});
  await Share.share({title:cleanName,files:[saved.uri]});
}
function applyDeepLink(value:string){
  const path=deepLinkPath(value);
  if(path){history.replaceState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));}
}
export async function bootstrap(){
  if(!Capacitor.isNativePlatform())return;
  await SecureStorage.setSynchronize(false);
  await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
  const stored=await SecureStorage.get(sessionKey);token=typeof stored==='string'?stored:null;
  await clearCookies();
  try{localStorage.removeItem('hsc-coach-drafts-v1');}catch{}
  await Filesystem.rmdir({path:'hsc-exports',directory:Directory.Cache,recursive:true}).catch(()=>{});
  installClientPlatform({request,saveText,scheduleReminders,logout,verificationURL});
  await queueReminders(cancelReminders);
  document.addEventListener('click',event=>{
    const anchor=(event.target as Element).closest?.('a');
    if(!anchor||!anchor.href)return;
    const url=new URL(anchor.href,location.href);
    if(url.origin===location.origin&&['/','/workspace','/coaches','/verify-email'].includes(url.pathname)){
      event.preventDefault();history.pushState({},'',url.pathname+url.search);window.dispatchEvent(new PopStateEvent('popstate'));return;
    }
    event.preventDefault();
    if(url.protocol==='https:')void Browser.open({url:url.href}).catch(()=>window.alert('Unable to open source. / 无法打开来源。'));
  });
  await App.addListener('appUrlOpen',event=>applyDeepLink(event.url));
  const launch=await App.getLaunchUrl();if(launch?.url)applyDeepLink(launch.url);
  await App.addListener('backButton',({canGoBack})=>{
    if(document.querySelector('[role="dialog"],.modal-backdrop')){window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));return;}
    if(canGoBack){history.back();return;}
    if(location.pathname!=='/'||location.search){history.replaceState({},'','/');window.dispatchEvent(new PopStateEvent('popstate'));}
    else void App.minimizeApp();
  });
  await App.addListener('appStateChange',event=>{if(event.isActive)location.reload();});
  await LocalNotifications.addListener('localNotificationActionPerformed',()=>{history.replaceState({},'','/');window.dispatchEvent(new PopStateEvent('popstate'));});
  window.addEventListener('hsc-session-expired',()=>{history.replaceState({},'','/');location.reload();},{once:true});
  await refreshReminders();
}
