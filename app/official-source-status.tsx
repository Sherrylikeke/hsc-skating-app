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
    <details><summary>{text('Scope and update limits','同步范围与更新限制')}</summary><p>{text('The existing hourly task checks Skate Ontario. Calendar coverage is 183 days. Each calendar check also refreshes the official page links of up to three events, rotating by oldest attempt independently of PDF imports. Each calendar request completes up to three full event imports on the server. Published or revised files and unfinished batches take priority, while nearby events and an oldest-check rotation remain covered.','既有每小时任务检查 Skate Ontario，日历覆盖未来183天。每次日历检查也按最久未尝试顺序轮换读取最多三场赛事的官网链接，不依赖 PDF 导入。每次日历请求也由服务器完成最多三场文件导入：优先处理新发布、修订及未完成的资料，并保留近赛和最久未检查轮换。')}</p><p>{text('Each event is not checked every hour. Link coverage needs roughly the number of active events divided by three successful hourly rounds, rounded up; source failures can delay it. A successful calendar check does not mean every document was imported. Unrecognized formats keep their official links; coach notes and meeting arrangements are stored separately. Times above use America/Toronto.','并非每场每小时都被检查。链接完整轮换约需“当前赛事数÷3，向上取整”个成功小时轮次，官网失败会延后。日历读取成功不等于每份文件均已导入；未识别格式保留官方链接，教练备注与集合安排独立保存。以上时间使用 America/Toronto。')}</p></details>
  </section>;
}
