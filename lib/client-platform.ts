import type {ReminderPlan} from './reminders';

export type ClientPlatform = {
  request:(path:string,init?:RequestInit)=>Promise<Response>;
  saveText:(filename:string,value:string)=>Promise<void>;
  scheduleReminders:(plans:ReminderPlan[],askPermission:boolean)=>Promise<string>;
  logout:()=>Promise<void>;
  verificationURL:string;
};
let platform:ClientPlatform|undefined;
export function installClientPlatform(value:ClientPlatform){platform=value;}
export function isNativeClient(){return !!platform;}
export async function apiFetch(path:string,init?:RequestInit){
  const response=await (platform?platform.request(path,init):fetch(path,init));
  if(!response.headers.get('content-type')?.includes('application/json')){
    const message='Unable to connect. Check your network and private site access. / 无法连接服务，请检查网络及私人站点访问授权。';
    return Response.json({error:message,message},{status:502});
  }
  return response;
}
export function verificationReturnURL(){return platform?.verificationURL||location.origin+'/verify-email?verified=1';}
export async function clearClientSession(){await platform?.logout();}
export async function scheduleDeviceReminders(plans:ReminderPlan[],askPermission=false){return platform?platform.scheduleReminders(plans,askPermission):'';}
export async function saveTextFile(filename:string,value:string){
  if(platform)return platform.saveText(filename,value);
  const url=URL.createObjectURL(new Blob([value],{type:'text/csv;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
