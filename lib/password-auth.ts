import {betterAuth} from 'better-auth/minimal';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {bearer, username} from 'better-auth/plugins';
import {drizzle} from 'drizzle-orm/d1';
import {authUser, authSession, authAccount, authVerification} from '../db/schema';

export const productionOrigin = 'https://hsc-coach-roster.sherrylikeke.chatgpt.site';
export function createPasswordAuth(database: D1Database, secret: string, origin = productionOrigin) {
  const local = origin === 'http://127.0.0.1:5173' || origin === 'http://localhost:5173';
  if (!secret || secret.length < 32) throw new Error('Password authentication is not configured');
  const schema = {user:authUser, session:authSession, account:authAccount, verification:authVerification};
  const auth = betterAuth({
    appName:'HSC Skating', baseURL:origin, basePath:'/api/auth', secret,
    database:drizzleAdapter(drizzle(database,{schema}),{provider:'sqlite',schema,transaction:false}),
    emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128,autoSignIn:true},
    session:{expiresIn:28800,updateAge:3600,cookieCache:{enabled:false}},
    account:{accountLinking:{enabled:false}},
    disabledPaths:['/is-username-available','/request-password-reset','/reset-password','/delete-user'],
    trustedOrigins:[origin,'hscskating://'],
    advanced:{useSecureCookies:!local,ipAddress:{ipAddressHeaders:['cf-connecting-ip']}},
    rateLimit:{
      enabled:true,window:60,max:60,
      customRules:{'/sign-in/username':{window:60,max:8},'/sign-in/email':{window:60,max:8},'/sign-up/email':{window:3600,max:5}},
      customStorage:{async consume(key,rule){
        const windowMs=rule.window*1000, time=Date.now();
        const id=`auth:${key}:${Math.floor(time/windowMs)}`;
        const row=await database.prepare('INSERT INTO hsc_rate_limits (id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(id,time+windowMs).first<{count:number}>();
        return {allowed:!!row&&row.count<=rule.max,retryAfter:row&&row.count<=rule.max?null:Math.ceil((windowMs-time%windowMs)/1000)};
      }},
    },
    plugins:[username({minUsernameLength:3,maxUsernameLength:30,immutableUsername:true}),bearer({requireSignature:true})],
  });
  return {...auth,handler:async(request:Request)=>{
    if(request.method==='POST'&&(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site'))return Response.json({message:'Invalid request origin.'},{status:403});
    if(request.method==='POST'&&!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({message:'Use application/json.'},{status:415});
    return auth.handler(request);
  }};
}
