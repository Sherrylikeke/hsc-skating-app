import * as SecureStore from 'expo-secure-store';
export const server='https://hsc-coach-roster.sherrylikeke.chatgpt.site';
const key='hsc-session';
let token:string|null=null;
export class APIError extends Error {constructor(message:string,public status:number){super(message);}}
export async function restoreToken(){token=await SecureStore.getItemAsync(key);return token;}
export async function forgetToken(){token=null;await SecureStore.deleteItemAsync(key);}
export async function request<T>(path:string,body?:unknown):Promise<T>{
  const response=await fetch(server+path,{method:body===undefined?'GET':'POST',credentials:'omit',headers:{Accept:'application/json',Origin:server,...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new APIError('The site is still owner-private. Mobile access needs administrator-approved hosting access before this app can connect.',403);
  const value=await response.json() as {error?:string|{message?:string};message?:string};
  if(!response.ok)throw new APIError(typeof value.error==='string'?value.error:value.error?.message||value.message||'Request failed. Please retry.',response.status);
  const signed=response.headers.get('set-auth-token');
  if(signed){token=signed;await SecureStore.setItemAsync(key,signed,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});}
  return value as T;
}
export const member=<T>(action:string,body?:unknown)=>request<T>('/api/member?action='+action,body);
