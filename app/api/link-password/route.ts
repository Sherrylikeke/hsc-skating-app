import {getChatGPTUser} from '../../chatgpt-auth';
import {db} from '../../../lib/club-store';
import {passwordAuth} from '../../../lib/member-runtime';
import {AccessError, actor, audit, bodyJSON, failure, json, nowISO} from '../../../lib/member-access';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    await bodyJSON(request);
    const identity = await getChatGPTUser();
    const member = await actor(db(),identity,request,false);
    const session = await passwordAuth(request)?.api.getSession({headers:request.headers});
    if (!session || session.user.email.toLowerCase() !== member.email.toLowerCase()) throw new AccessError(403,'Sign in to both accounts using the same email before linking.');
    if (Date.now()-new Date(session.session.createdAt).getTime()>600000) throw new AccessError(403,'Sign in with your password again before linking.');
    const existing = await db().prepare('SELECT member_id FROM hsc_auth_links WHERE auth_user_id=?').bind(session.user.id).first<{member_id:string}>();
    if (existing && existing.member_id !== member.id) throw new AccessError(409,'This password account is already linked.');
    await db().batch([
      db().prepare('INSERT INTO hsc_auth_links (auth_user_id,member_id,created_at) VALUES (?,?,?) ON CONFLICT(auth_user_id) DO NOTHING').bind(session.user.id,member.id,nowISO()),
      db().prepare('UPDATE hsc_auth_user SET email_verified=1 WHERE id=?').bind(session.user.id),
      audit(db(),member.id,'password-account-link',member.id,{}),
    ]);
    return json({ok:true});
  } catch (error) {return failure(error);}
}
