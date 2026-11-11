import {betterAuth} from 'better-auth/minimal';
import {APIError} from 'better-auth/api';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {bearer, username} from 'better-auth/plugins';
import {drizzle} from 'drizzle-orm/d1';
import {authUser, authSession, authAccount, authVerification} from '../db/schema';
import {AccessError,nowISO,rateLimit} from './member-access';
import type {Role} from './member-access';
import {recordRegistration,registrationEligibility,registrationSuggestions} from './registration';
import type {VerificationDelivery} from './verification-mail';
import type {PilotRegistration} from './pilot-registration';
import {isRegisteredPilot,pilotUsedKey} from './pilot-registration';

export const productionOrigin = 'https://hsc-coach-roster.sherrylikeke.chatgpt.site';
export function createPasswordAuth(database: D1Database, secret: string, origin = productionOrigin, existingMembership?: (request:Request,email:string)=>Promise<Role|null>, delivery:VerificationDelivery={enabled:false}, pilotRegistration?: (request:Request,email:string,token:string)=>Promise<PilotRegistration|null>, verificationGrace?: (userId:string)=>boolean) {
  const local = origin === 'http://127.0.0.1:5173' || origin === 'http://localhost:5173';
  if (!secret || secret.length < 32) throw new Error('Password authentication is not configured');
  const schema = {user:authUser, session:authSession, account:authAccount, verification:authVerification};
  const auth = betterAuth({
    appName:'HSC Skating', baseURL:origin, basePath:'/api/auth', secret,
    database:drizzleAdapter(drizzle(database,{schema}),{provider:'sqlite',schema,transaction:false}),
    emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128,autoSignIn:false,resetPasswordTokenExpiresIn:3600,revokeSessionsOnPasswordReset:true,
      ...(delivery.enabled&&delivery.sendReset?{async sendResetPassword({user,url}:{user:{email:string};url:string}){await delivery.sendReset!(user.email,url);}}:{}),
    },
    // Request the initial email explicitly once membership is saved. Better Auth's
    // automatic sign-up notification catches transport failures before returning.
    emailVerification:{sendOnSignUp:false,sendOnSignIn:false,expiresIn:3600,autoSignInAfterVerification:false,
      ...(delivery.enabled?{async sendVerificationEmail({user,url}:{user:{email:string};url:string}){if(!delivery.send)throw new Error('Email delivery is unavailable.');await delivery.send(user.email,url);}}:{}),
    },
    databaseHooks:{session:{create:{before:async session=>{
      if(!delivery.enabled)return;
      const user=await database.prepare('SELECT email_verified FROM hsc_auth_user WHERE id=?').bind(session.userId).first<{email_verified:number}>();
      if(user?.email_verified)return;
      if(await isRegisteredPilot(database,session.userId))return;
      if(verificationGrace?.(session.userId))return;
      const legacyAdmin=await database.prepare("SELECT m.id FROM hsc_members m JOIN hsc_auth_links l ON l.member_id=m.id WHERE l.auth_user_id=? AND m.role='admin' AND m.status='active'").bind(session.userId).first();
      if(!legacyAdmin)throw new APIError('FORBIDDEN',{code:'EMAIL_NOT_VERIFIED',message:'Verify your email before signing in.'});
    }}}},
    session:{expiresIn:28800,updateAge:3600,cookieCache:{enabled:false}},
    account:{accountLinking:{enabled:false}},
    disabledPaths:['/is-username-available','/delete-user'],
    trustedOrigins:[origin,'hscskating://'],
    advanced:{useSecureCookies:!local,ipAddress:{ipAddressHeaders:['cf-connecting-ip']}},
    rateLimit:{
      enabled:true,window:60,max:60,
      customRules:{'/sign-in/username':{window:60,max:8},'/sign-in/email':{window:60,max:8},'/sign-up/email':{window:3600,max:5},'/send-verification-email':{window:60,max:1},'/request-password-reset':{window:60,max:1},'/reset-password':{window:60,max:5}},
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
    if(request.method==='GET'&&pathname==='/api/auth/config'){
      return Response.json({emailVerificationRequired:true,deliveryConfigured:delivery.enabled,registrationConfigured:delivery.enabled&&delivery.registrationEnabled===true,pilotRegistrationAllowed:false},{headers:{'Cache-Control':'no-store'}});
    }
    if(request.method==='POST'&&(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site'))return Response.json({message:'Invalid request origin.'},{status:403});
    if(request.method==='POST'&&!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({message:'Use application/json.'},{status:415});
    if(request.method==='POST'&&pathname==='/api/auth/registration-skaters'){
      try{
        const raw=await request.text();if(new TextEncoder().encode(raw).length>1024)return Response.json({message:'Request is too large.'},{status:413});
        const body=JSON.parse(raw) as {query?:unknown;pilotInvitation?:unknown};
        if(!body||typeof body.query!=='string'||body.query.length>120)return Response.json({message:'Enter a skater name to search.'},{status:400});
        const pilot=!delivery.enabled&&pilotRegistration&&typeof body.pilotInvitation==='string'?await pilotRegistration(request,'',body.pilotInvitation):null;
        if(!(delivery.enabled&&delivery.registrationEnabled===true)&&!pilot)return Response.json({message:'Registration is not open.'},{status:503});
        if(pilot&&await database.prepare('SELECT value FROM app_meta WHERE key=?').bind(pilotUsedKey(pilot)).first())return Response.json({message:'This invitation has already been used.'},{status:403});
        await rateLimit(database,'registration-suggestions:'+(request.headers.get('cf-connecting-ip')||'unknown'),60,60000);
        return Response.json(await registrationSuggestions(database,body.query),{headers:{'Cache-Control':'private, no-store'}});
      }catch(error){return Response.json({message:error instanceof AccessError?error.message:error instanceof SyntaxError?'Invalid request.':'Names could not be loaded. Please retry.'},{status:error instanceof AccessError?error.status:error instanceof SyntaxError?400:503,headers:{'Cache-Control':'private, no-store',...(error instanceof AccessError&&error.retryAfter?{'Retry-After':String(error.retryAfter)}:{})}});}
    }
    if(request.method==='POST'&&['/api/auth/request-password-reset','/api/auth/reset-password','/api/auth/send-verification-email'].includes(pathname)){
      if(!delivery.enabled&&pathname!=='/api/auth/reset-password')return Response.json({code:'MAIL_DISABLED',message:'Email service setup is pending. Existing accounts can still sign in.'},{status:503});
      try{
        const raw=await request.clone().text();
        if(new TextEncoder().encode(raw).length>8192)return Response.json({message:'Request is too large.'},{status:413});
        const body=JSON.parse(raw);
        if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({message:'Invalid request.'},{status:400});
        if(pathname==='/api/auth/request-password-reset'&&body.redirectTo!==origin+'/reset-password')return Response.json({message:'Invalid password reset return URL.'},{status:400});
        if(pathname==='/api/auth/send-verification-email'&&body.callbackURL!==origin+'/verify-email?verified=1')return Response.json({message:'Invalid verification return URL.'},{status:400});
      }catch{return Response.json({message:'Invalid request.'},{status:400});}
    }
    if(request.method==='POST'&&pathname==='/api/auth/pilot-invitation'){
      try{
        await rateLimit(database,'pilot-invitation:'+(request.headers.get('cf-connecting-ip')||'unknown'),20);
        if(Number(request.headers.get('content-length')||0)>512)throw new AccessError(413,'Request is too large.');
        const raw=await request.text();if(new TextEncoder().encode(raw).length>512)throw new AccessError(413,'Request is too large.');
        const body=JSON.parse(raw) as {token?:unknown};
        const pilot=!delivery.enabled&&pilotRegistration&&typeof body?.token==='string'?await pilotRegistration(request,'',body.token):null;
        if(!pilot)throw new AccessError(403,'This invitation is invalid or expired.');
        if(await database.prepare('SELECT value FROM app_meta WHERE key=?').bind(pilotUsedKey(pilot)).first()||await database.prepare('SELECT id FROM hsc_auth_user WHERE lower(email)=?').bind(pilot.email).first())throw new AccessError(409,'This invitation has already been used. Sign in with your account.');
        return Response.json({pilotRegistrationAllowed:true,emailVerificationRequired:false,pilotRole:pilot.role,email:pilot.email,expiresAt:pilot.expiresAt},{headers:{'Cache-Control':'private, no-store'}});
      }catch(error){return Response.json({message:error instanceof AccessError?error.message:error instanceof SyntaxError?'Invalid request.':'Invitation could not be checked. Please retry.'},{status:error instanceof AccessError?error.status:error instanceof SyntaxError?400:503,headers:{'Cache-Control':'private, no-store'}});}
    }
    if(request.method==='POST'&&pathname==='/api/auth/send-verification-email'){
      const response=await auth.handler(request);
      if(response.status>=500)return Response.json({code:'MAIL_UNAVAILABLE',message:'We could not send the verification email. Please try again later.'},{status:503});
      return response;
    }
    if(request.method==='POST'&&pathname==='/api/auth/sign-up/email') {
      try {
        if(Number(request.headers.get('content-length')||0)>8192)return Response.json({message:'Registration request is too large.'},{status:413});
        const raw=await request.clone().text();
        if(new TextEncoder().encode(raw).length>8192)return Response.json({message:'Registration request is too large.'},{status:413});
        const body=JSON.parse(raw) as Record<string,unknown>;
        if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({message:'Invalid registration request.'},{status:400});
        const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
        const invitationToken=typeof body.pilotInvitation==='string'?body.pilotInvitation:'';
        const pilot=!delivery.enabled&&pilotRegistration?await pilotRegistration(request,email,invitationToken):null;
        if(invitationToken&&!pilot)return Response.json({message:'This invitation is invalid or expired.'},{status:403});
        if(pilot&&await database.prepare('SELECT value FROM app_meta WHERE key=?').bind(pilotUsedKey(pilot)).first())return Response.json({message:'This invitation has already been used. Sign in with your account.'},{status:409});
        const existingRole=body.linkExisting===true&&existingMembership?await existingMembership(request,email):null;
        if(delivery.enabled&&delivery.registrationEnabled!==true&&existingRole!=='admin')return Response.json({message:'Public registration is not open yet. Existing accounts can still sign in.'},{status:503});
        if(!delivery.enabled&&!pilot&&existingRole!=='admin')return Response.json({message:'New accounts require email verification. Mail service setup is pending; please try again after setup. Existing accounts can still sign in.'},{status:503});
        const registration=existingRole==='admin'?null:await registrationEligibility(database,body,request.headers.get('cf-connecting-ip')||'unknown');
        if(pilot&&registration?.role!==pilot.role)return Response.json({message:'Use the role assigned to your pilot invitation.'},{status:403});
        if(existingRole&&existingRole!=='admin'&&existingRole!==registration?.role)return Response.json({message:'The selected role must match your verified membership.'},{status:403});
        if(!existingRole&&await database.prepare('SELECT id FROM hsc_members WHERE lower(email)=?').bind(email).first())return Response.json({code:'ACCOUNT_ALREADY_EXISTS',message:'An account already uses this email. Sign in or contact the club administrator. Accounts are never merged by email alone.'},{status:409});
        if(body.callbackURL&&body.callbackURL!==origin+'/verify-email?verified=1')return Response.json({message:'Invalid verification return URL.'},{status:400});
        const previousUser=await database.prepare('SELECT id FROM hsc_auth_user WHERE lower(email)=?').bind(email).first();
        if(pilot&&previousUser)return Response.json({message:'This invitation has already been used. Sign in with your account.'},{status:409});
        const {pilotInvitation:_invitation,...authBody}=body;
        // Framework Request wrappers are not native Worker Request instances.
        const authHeaders=new Headers(request.headers);authHeaders.delete('content-length');
        const response=await auth.handler(new Request(request.url,{method:request.method,headers:authHeaders,body:JSON.stringify({...authBody,callbackURL:origin+'/verify-email?verified=1'})}));
        if(registration&&!existingRole&&!previousUser) {
          const createdUser=await database.prepare('SELECT id,email,name FROM hsc_auth_user WHERE lower(email)=?').bind(email).first<{id:string;email:string;name:string}>();
          if(createdUser){
            await recordRegistration(database,createdUser,registration);
            if(pilot)await database.prepare('INSERT INTO app_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').bind(pilotUsedKey(pilot),JSON.stringify({userId:createdUser.id,usedAt:nowISO()})).run();
          }
        }
        if(!response.ok)return response;
        const headers=new Headers(response.headers);
        headers.delete('Content-Length');
        const result=await response.json() as {user?:{id:string};token?:string|null};
        if(!result.user||result.token)return Response.json(result,{status:response.status,headers});
        const registrationMode=pilot?'pilot':delivery.enabled?'verification':'linked';
        if(pilot)headers.set('X-HSC-Registration-Mode','pilot');
        let verificationDelivery:'requested'|'retry-needed'|undefined;
        if(registrationMode==='verification'&&!previousUser){
          try {
            await auth.api.sendVerificationEmail({body:{email,callbackURL:origin+'/verify-email?verified=1'}});
            verificationDelivery='requested';
          }catch{
            verificationDelivery='retry-needed';
          }
        }
        return Response.json({...result,registrationMode,verificationDelivery},{status:response.status,headers});
      }catch(error){return Response.json({message:error instanceof AccessError?error.message:error instanceof SyntaxError?'Invalid registration request.':'Registration could not be completed. Please contact the club.',...(error instanceof AccessError&&error.code?{code:error.code}:{}),...(error instanceof AccessError&&error.retryAfter?{retryAfter:error.retryAfter}:{})},{status:error instanceof AccessError?error.status:error instanceof SyntaxError?400:503,headers:{'Cache-Control':'private, no-store',...(error instanceof AccessError&&error.retryAfter?{'Retry-After':String(error.retryAfter)}:{})}});}
    }
    return auth.handler(request);
  }};
}
