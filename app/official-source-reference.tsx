'use client';
import {text,useLanguage} from '../lib/i18n';
import {activeMemberRole} from '../lib/member-client';
import type {ClubEvent as LiveEvent,SyncStatus} from '../lib/club-types';
import OfficialSourceStatus from './official-source-status';
import EntryImportStatus from './entry-import-status';

export default function OfficialSourceReference({member,sync,event}:{member:{role?:string|null;status:string}|null;sync:SyncStatus;event?:LiveEvent}){
  const locale=useLanguage();
  if(!activeMemberRole(member,'admin'))return null;
  const format=(value?:string)=>value?new Intl.DateTimeFormat(locale==='en'?'en-CA':'zh-CN',{timeZone:'America/Toronto',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):text('Not yet recorded','尚无记录');
  return <details className="club-reference"><summary>{text('Administrator reference · source diagnostics','管理员参考资料 · 来源诊断')}</summary><OfficialSourceStatus sync={sync}/>{event&&<><section className="club-panel club-source-status"><h2>{text('Event source diagnostics','比赛来源诊断')}</h2>
    <dl className="club-sync-facts">
      <div><dt>{text('Official links last checked','官方链接最近读取成功')}</dt><dd>{format(event.linksCheckedAt)}</dd></div>
      <div><dt>{text('Official links last attempted','官方链接最近检查尝试')}</dt><dd>{format(event.linksAttemptedAt)}</dd></div>
      <div><dt>{text('Document import last attempted','文件导入最近尝试')}</dt><dd>{format(event.detailCheckedAt)}</dd></div>
      <div><dt>{text('Document import last fully succeeded','文件导入最近全部成功')}</dt><dd>{format(event.detailSuccessAt)}</dd></div>
    </dl>
    <p>{text('Saved official links: ','已保存官方链接：')}{event.documents.filter(document=>document.kind==='schedule').length} {text('schedule(s), ','份赛程，')}{event.documents.filter(document=>document.kind==='entries').length} {text('entry list(s).','份名单。')}</p>
    <p>{text('A saved schedule link can be opened before its PDF is imported. Interim entries without final groups do not confirm a personal schedule. A new attempt or a successful calendar check alone does not prove a full import.','赛程 PDF 尚未导入时，也可打开已保存链接。只有 Interim 名单且没有最终分组时，不能确认个人赛程。出现新尝试时间或日历读取成功，均不代表文件已全部导入。')}</p>
    <p>{event.entryStatus}</p><p>{event.scheduleStatus}</p><p>{event.startingOrderStatus}</p>{event.linksError&&<p style={{overflowWrap:'anywhere'}}>{event.linksError}</p>}{event.detailError&&<p style={{overflowWrap:'anywhere'}}>{event.detailError}</p>}</section><EntryImportStatus documents={event.documents}/></>}</details>;
}
