'use client';
import {text} from '../lib/i18n';

export default function MembershipReviewNotice({status,className}:{status?:string|null;className:string}) {
  if (status !== 'pending' && status !== 'rejected') return null;
  return <section className={className}>
    <h2>{status === 'pending'
      ? text('Membership application under review','会员申请正在审核')
      : text('Membership application declined','会员申请未获批准')}</h2>
    <p>{status === 'pending'
      ? text('You can view shared schedules while the club reviews your application. After approval, sign in again to access your approved member features.','审核期间可以查看共享赛程。俱乐部批准申请后，请重新登录以使用获批的会员功能。')
      : text('You can still view shared schedules. Contact the club administrator to review your application details.','你仍可查看共享赛程。如需核对申请资料，请联系俱乐部管理员。')}</p>
  </section>;
}
