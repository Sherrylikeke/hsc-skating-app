'use client';
import {text,useLanguage} from '../lib/i18n';
import {activeMemberRole} from '../lib/member-client';
import type {ClubEvent as LiveEvent,SyncStatus} from '../lib/club-types';
import OfficialSourceStatus from './official-source-status';
import EntryImportStatus from './entry-import-status';

export default function OfficialSourceReference({member,sync,event}:{member:{role?:string|null;status:string}|null;sync:SyncStatus;event?:LiveEvent}){
  const locale=useLanguage();
  if(!activeMemberRole(member,'admin'))return null;
  const checked=event?.detailCheckedAt?new Intl.DateTimeFormat(locale==='en'?'en-CA':'zh-CN',{timeZone:'America/Toronto',dateStyle:'medium',timeStyle:'short'}).format(new Date(event.detailCheckedAt)):text('Not yet recorded','尚无记录');
  return <details className="club-reference"><summary>{text('Administrator reference · source diagnostics','管理员参考资料 · 来源诊断')}</summary><OfficialSourceStatus sync={sync}/>{event&&<><section className="club-panel club-source-status"><h2>{text('Event source diagnostics','比赛来源诊断')}</h2><p>{event.entryStatus}</p><p>{event.scheduleStatus}</p><p>{event.startingOrderStatus}</p><p>{text('Last checked: ','最近检查：')}{checked}</p>{event.detailError&&<p style={{overflowWrap:'anywhere'}}>{event.detailError}</p>}</section><EntryImportStatus documents={event.documents}/></>}</details>;
}
