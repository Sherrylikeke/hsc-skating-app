export const serverOrigin='https://hsc-coach-roster.sherrylikeke.chatgpt.site';
export const verificationURL=serverOrigin+'/verify-email?verified=1';
export function apiURL(path:string){
  if(!path.startsWith('/api/')||path.includes('\\'))throw new Error('Invalid API path');
  const url=new URL(path,serverOrigin);
  if(url.origin!==serverOrigin||!url.pathname.startsWith('/api/'))throw new Error('Invalid API destination');
  return url.href;
}
export function deepLinkPath(value:string){
  try{
    const url=new URL(value);
    if(url.protocol!=='hscskating:'||url.hostname!=='verify-email'||(url.pathname!==''&&url.pathname!=='/'))return null;
    return '/verify-email'+(url.searchParams.get('verified')==='1'?'?verified=1':'?error=invalid');
  }catch{return null;}
}
export type DevicePlan={id:string;memberId:string;basis:string;notifyAt:string;arrivalAt:string;startAt:string;eventName:string;category:string;packing:string};
export function devicePlans(plans:DevicePlan[],memberId:string,time=Date.now()){
  return [...new Map(plans.filter(plan=>plan.memberId===memberId&&plan.basis==='official-group-start'&&Date.parse(plan.notifyAt)>time&&Date.parse(plan.arrivalAt)-Date.parse(plan.notifyAt)>=3600000&&Date.parse(plan.startAt)-Date.parse(plan.arrivalAt)>=3600000).map(plan=>[plan.id,plan])).values()].sort((first,second)=>Date.parse(first.notifyAt)-Date.parse(second.notifyAt)).slice(0,60);
}
