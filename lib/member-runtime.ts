import {getChatGPTUser} from '../app/chatgpt-auth';
import {db} from './club-store';
import {AccessError, actor, requireRole} from './member-access';
import type {Member, Role} from './member-access';

export const ownerEmail = 'sherrylikeke@gmail.com';
export async function requestMember(request: Request, roles?: Role[]): Promise<Member> {
  const member = await actor(db(), await getChatGPTUser(), request);
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
