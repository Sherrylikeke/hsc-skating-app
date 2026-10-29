import {getChatGPTUser} from '../app/chatgpt-auth';
import {db} from './club-store';
import {AccessError, actor, requireRole} from './member-access';
import type {Member, Role} from './member-access';
import {env} from 'cloudflare:workers';
import {createPasswordAuth, productionOrigin} from './password-auth';
import {verificationDelivery} from './verification-mail';
import type {MailEnvironment} from './verification-mail';
import {pilotInvitationFor} from './pilot-registration';

export const ownerEmail = 'sherrylikeke@gmail.com';
export function passwordAuth(request: Request) {
  const runtime = env as unknown as MailEnvironment & {BETTER_AUTH_SECRET?:string;HSC_PILOT_REGISTRATIONS?:string};
  if (!runtime.BETTER_AUTH_SECRET) return null;
  const url = new URL(request.url);
  const origin = ['http://127.0.0.1:5173','http://localhost:5173'].includes(url.origin) ? url.origin : productionOrigin;
  return createPasswordAuth(db(),runtime.BETTER_AUTH_SECRET,origin,async(incoming,email)=>{
    const identity=await getChatGPTUser();
    if(!identity||identity.email.toLowerCase()!==email)return null;
    try {const member=await actor(db(),identity,incoming);return member.role;}catch{return null;}
  },verificationDelivery(runtime),async(_request,email,token)=>pilotInvitationFor(runtime.HSC_PILOT_REGISTRATIONS,token,email));
}
export async function requestIdentity(request: Request) {
  const auth = passwordAuth(request);
  const session = auth ? await auth.api.getSession({headers:request.headers}) : null;
  if (!session) return await getChatGPTUser();
  const link = await db().prepare('SELECT member_id FROM hsc_auth_links WHERE auth_user_id=?').bind(session.user.id).first<{member_id:string}>();
  return {userId:link?.member_id || 'password:'+session.user.id,email:session.user.email,displayName:session.user.name,provider:'password' as const,authToken:session.session.token,authVerified:session.user.emailVerified,emailVerificationRequired:verificationDelivery(env as unknown as MailEnvironment).enabled};
}
export async function requestMember(request: Request, roles?: Role[]): Promise<Member> {
  const member = await actor(db(), await requestIdentity(request), request);
  if (roles) requireRole(member, ...roles);
  return member;
}
export async function syncOperator() {
  const identity = await getChatGPTUser();
  if (!identity) throw new AccessError(401, '请先登录');
  const member = await db().prepare('SELECT * FROM hsc_members WHERE id=? AND email=?').bind(identity.userId, identity.email.toLowerCase()).first<Member>();
  if (member) {requireRole(member, 'admin'); return;}
  const initialized = await db().prepare("SELECT value FROM app_meta WHERE key='hsc-admin-bootstrap'").first();
  if (initialized || identity.email.toLowerCase() !== ownerEmail) throw new AccessError(403, '只有已批准的管理员可以同步官网');
}
