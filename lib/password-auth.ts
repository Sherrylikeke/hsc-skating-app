import {betterAuth} from 'better-auth/minimal';
import {APIError} from 'better-auth/api';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {bearer, username} from 'better-auth/plugins';
import {drizzle} from 'drizzle-orm/d1';
import {authUser, authSession, authAccount, authVerification} from '../db/schema';
import {AccessError} from './member-access';
import type {Role} from './member-access';
import {recordRegistration,registrationEligibility} from './registration';
import type {VerificationDelivery} from './verification-mail';

export const productionOrigin = 'https://hsc-coach-roster.sherrylikeke.chatgpt.site';
export function createPasswordAuth(database: D1Database, secret: string, origin = productionOrigin, existingMembership?: (request:Request,email:string)=>Promise<Role|null>, delivery:VerificationDelivery={enabled:false}) {
  const local = origin === 'http://127.0.0.1:5173' || origin === 'http://localhost:5173';
  if (!secret || secret.length < 32) throw new Error('Password authentication is not configured');
  const schema = {user:authUser, session:authSession, account:authAccount, verification:authVerification};
  const auth = betterAuth({
    appName:'HSC Skating', baseURL:origin, basePath:'/api/auth', secret,
    database:drizzleAdapter(drizzle(database,{schema}),{provider:'sqlite',schema,transaction:false}),
    emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128,autoSignIn:false},
    emailVerification:{sendOnSignUp:delivery.enabled,sendOnSignIn:false,expiresIn:3600,autoSignInAfterVerification:false,
      ...(delivery.enabled?{async sendVerificationEmail({user,url}:{user:{email:string};url:string}){if(!delivery.send)throw new Error('Email delivery is unavailable.');await delivery.send(user.email,url);}}:{}),
    },
    databaseHooks:{session:{create:{before:async session=>{
      if(!delivery.enabled)return;
      const user=await database.prepare('SELECT email_verified FROM hsc_auth_user WHERE id=?').bind(session.userId).first<{email_verified:number}>();
      if(user?.email_verified)return;
      const legacyAdmin=await database.prepare("SELECT m.id FROM hsc_members m JOIN hsc_auth_links l ON l.member_id=m.id WHERE l.auth_user_id=? AND m.role='admin' AND m.status='active'").bind(session.userId).first();
      if(!legacyAdmin)throw new APIError('FORBIDDEN',{code:'EMAIL_NOT_VERIFIED',message:'Verify your email before signing in.'});
    }}}},
    session:{expiresIn:28800,updateAge:3600,cookieCache:{enabled:false}},
    account:{accountLinking:{enabled:false}},
    disabledPaths:['/is-username-available','/request-password-reset','/reset-password','/delete-user'],
    trustedOrigins:[origin,'hscskating://'],
    advanced:{useSecureCookies:!local,ipAddress:{ipAddressHeaders:['cf-connecting-ip']}},
    rateLimit:{
      enabled:true,window:60,max:60,
      customRules:{'/sign-in/username':{window:60,max:8},'/sign-in/email':{window:60,max:8},'/sign-up/email':{window:3600,max:5},'/send-verification-email':{window:60,max:1}},
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
    const pathname=new URL(request.url).pathname.replace(/\/$/,'');
    if(request.method==='GET'&&pathname==='/api/auth/config')return Response.json({emailVerificationRequired:true,deliveryConfigured:delivery.enabled},{headers:{'Cache-Control':'no-store'}});
    if(request.method==='POST'&&(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site'))return Response.json({message:'Invalid request origin.'},{status:403});
    if(request.method==='POST'&&!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({message:'Use application/json.'},{status:415});
    if(request.method==='POST'&&pathname==='/api/auth/send-verification-email'&&!delivery.enabled)return Response.json({message:'Email verification is awaiting mail service setup. Existing accounts can still sign in.'},{status:503});
    if(request.method==='POST'&&pathname==='/api/auth/sign-up/email') {
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
        if(!existingRole&&await database.prepare('SELECT id FROM hsc_members WHERE lower(email)=?').bind(email).first())return Response.json({message:'An account already uses this email. Sign in or contact the club administrator. Accounts are never merged by email alone.'},{status:409});
        if(!delivery.enabled&&existingRole!=='admin')return Response.json({message:'New accounts require email verification. Mail service setup is pending; please try again after setup. Existing accounts can still sign in.'},{status:503});
        if(body.callbackURL&&body.callbackURL!==origin+'/verify-email?verified=1')return Response.json({message:'Invalid verification return URL.'},{status:400});
        const previousUser=await database.prepare('SELECT id FROM hsc_auth_user WHERE lower(email)=?').bind(email).first();
        const response=await auth.handler(new Request(request,{body:JSON.stringify({...body,callbackURL:origin+'/verify-email?verified=1'})}));
        if(registration&&!existingRole&&!previousUser) {
          const createdUser=await database.prepare('SELECT id,email,name FROM hsc_auth_user WHERE lower(email)=?').bind(email).first<{id:string;email:string;name:string}>();
          if(createdUser)await recordRegistration(database,createdUser,registration);
        }
        return response;
      }catch(error){return Response.json({message:error instanceof AccessError?error.message:error instanceof SyntaxError?'Invalid registration request.':'Registration could not be completed. Please contact the club.'},{status:error instanceof AccessError?error.status:error instanceof SyntaxError?400:503});}
    }
    return auth.handler(request);
  }};
}
