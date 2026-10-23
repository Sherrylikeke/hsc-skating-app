'use client';
import {text,useLanguage} from '../lib/i18n';
import type {SyncStatus} from '../lib/club-types';

export default function OfficialSourceStatus({sync}:{sync:SyncStatus}){
  const locale=useLanguage();
  const format=(value?:string)=>value?new Intl.DateTimeFormat(locale==='en'?'en-CA':'zh-CN',{timeZone:'America/Toronto',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):text('Not yet recorded','尚无记录');
  return <section className="club-panel club-source-status" aria-label={text('Official data updates','官网数据更新')}>
    <h2>{text('How official updates reach this page','官网更新如何进入此页面')}</h2>
    <p>{text('Official sources → server checks and parsing → saved database records → this page. Reload saved data to see the latest stored version; only an administrator can start a new official source check.','官方来源 → 服务器检查与解析 → 数据库存档 → 此页面。重新读取资料会显示最新存档；只有管理员可以发起新的官网检查。')}</p>
    <dl className="club-sync-facts"><div><dt>{text('Last successful calendar check','最近日历读取成功')}</dt><dd>{format(sync.lastCalendarSuccess)}</dd></div><div><dt>{text('Last source check attempt','最近来源检查尝试')}</dt><dd>{format(sync.lastAttempt)}</dd></div></dl>
    {sync.error&&<p role="status">{text('Some source checks need review. Previous valid records are retained: ','部分来源检查待核对，继续保留上次有效资料：')}{sync.error}</p>}
    <details><summary>{text('Scope and update limits','同步范围与更新限制')}</summary><p>{text('The existing hourly task checks Skate Ontario. Calendar coverage is about six months; detailed checks prioritize the next three events within 45 days. Entries, schedules and starting orders are imported only when their format is recognized.','既有每小时任务检查 Skate Ontario。日历范围约六个月；详细资料优先检查未来 45 天内最近三场比赛。名单、赛程和出场顺序只在格式可识别时导入。')}</p><p>{text('Updates are not instantaneous. A successful calendar check does not mean every document was imported. Unrecognized formats keep their official links; coach notes and meeting arrangements are stored separately. Times above use America/Toronto.','更新不是实时的。日历读取成功不等于每份文件均已导入；未识别格式保留官方链接，教练备注与集合安排独立保存。以上时间使用 America/Toronto。')}</p></details>
  </section>;
}
