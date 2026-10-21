import {betterAuth} from 'better-auth/minimal';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {bearer, username} from 'better-auth/plugins';
import {drizzle} from 'drizzle-orm/d1';
import {authUser, authSession, authAccount, authVerification} from '../db/schema';
import {AccessError} from './member-access';
import type {Role} from './member-access';
import {recordRegistration,registrationEligibility} from './registration';

export const productionOrigin = 'https://hsc-coach-roster.sherrylikeke.chatgpt.site';
export function createPasswordAuth(database: D1Database, secret: string, origin = productionOrigin, existingMembership?: (request:Request,email:string)=>Promise<Role|null>) {
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
    if(request.method==='POST'&&new URL(request.url).pathname.replace(/\/$/,'')==='/api/auth/sign-up/email') {
      try {
        if(Number(request.headers.get('content-length')||0)>8192)return Response.json({message:'Registration request is too large.'},{status:413});
        const raw=await request.clone().text();
        if(new TextEncoder().encode(raw).length>8192)return Response.json({message:'Registration request is too large.'},{status:413});
        const body=JSON.parse(raw) as Record<string,unknown>;
        if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({message:'Invalid registration request.'},{status:400});
        const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
        const existingRole=body.linkExisting===true&&existingMembership?await existingMembership(request,email):null;
        const registration=existingRole==='admin'?null:await registrationEligibility(database,body,request.headers.get('cf-connecting-ip')||'unknown');
        if(existingRole&&existingRole!=='admin'&&existingRole!==registration?.role)return Response.json({message:'The selected role must match your verified membership.'},{status:403});
        if(!existingRole&&await database.prepare('SELECT id FROM hsc_members WHERE lower(email)=?').bind(email).first())return Response.json({message:'An account already uses this email. Sign in with ChatGPT and explicitly link your password account first.'},{status:409});
        const response=await auth.handler(request);
        if(response.ok&&registration&&!existingRole) {
          const value=await response.clone().json() as {user?:{id:string;email:string;name:string}};
          if(value.user)await recordRegistration(database,value.user,registration);
        }
        return response;
      }catch(error){return Response.json({message:error instanceof AccessError?error.message:error instanceof SyntaxError?'Invalid registration request.':'Registration could not be completed. Please contact the club.'},{status:error instanceof AccessError?error.status:error instanceof SyntaxError?400:503});}
    }
    return auth.handler(request);
  }};
}
