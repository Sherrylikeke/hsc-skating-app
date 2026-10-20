import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
export type Plan={id:string;eventName:string;category:string;skaterId:string;notifyAt:string;arrivalAt:string;packing:string;timezone:string;source:string};
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
export async function clearAlerts(){
  const existing=await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing.filter(item=>item.content.data?.hsc===true).map(item=>Notifications.cancelScheduledNotificationAsync(item.identifier)));
}
export async function enableAlerts(){
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('hsc-reminders',{name:'HSC preparation reminders',importance:Notifications.AndroidImportance.HIGH});
  const permission=await Notifications.getPermissionsAsync();
  if(permission.granted)return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}
export async function syncAlerts(plans:Plan[],locale:'en'|'zh',details=false){
  const permission=await Notifications.getPermissionsAsync();
  if(!permission.granted){await clearAlerts();return 0;}
  const upcoming=plans.filter(plan=>Date.parse(plan.notifyAt)>Date.now()).sort((first,second)=>first.notifyAt.localeCompare(second.notifyAt)).slice(0,50);
  const existing=await Notifications.getAllScheduledNotificationsAsync();
  const desired=new Set(upcoming.map(plan=>plan.id+'|'+locale+'|'+details));
  for(const item of existing.filter(item=>item.content.data?.hsc===true))if(!desired.has(String(item.content.data?.signature)))await Notifications.cancelScheduledNotificationAsync(item.identifier);
  for(const plan of upcoming){
    const signature=plan.id+'|'+locale+'|'+details;
    if(existing.some(item=>item.content.data?.signature===signature))continue;
    const arrival=new Intl.DateTimeFormat(locale==='en'?'en-CA':'zh-CN',{timeZone:plan.timezone,dateStyle:'short',timeStyle:'short'}).format(new Date(plan.arrivalAt));
    await Notifications.scheduleNotificationAsync({content:{title:locale==='en'?'HSC · Prepare for your skate':'HSC · 上冰准备提醒',body:details?(locale==='en'?`Arrive by ${arrival}. Bring: ${plan.packing}`:`到场不晚于 ${arrival}。携带：${plan.packing}`):(locale==='en'?'Your preparation reminder is ready. Open HSC for details.':'准备提醒已到，请打开 HSC 查看详情。'),sound:'default',data:{hsc:true,signature,eventId:plan.id}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:new Date(plan.notifyAt),...(Platform.OS==='android'?{channelId:'hsc-reminders'}:{})}});
  }
  return upcoming.length;
}
