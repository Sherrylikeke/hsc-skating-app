'use client';
import {text,useLanguage} from '../lib/i18n';
import type {SourceFreshness as Freshness} from '../lib/club-types';
import './source-freshness.css';

export default function SourceFreshness({status,calendar=false}:{status?:Freshness;calendar?:boolean}){
  const locale=useLanguage();
  const formatted=(value?:string)=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat(locale==='en'?'en-CA':'zh-CN',{timeZone:'America/Toronto',dateStyle:'medium',timeStyle:'short'}).format(new Date(value))+' ET':text('Not recorded yet','尚无记录');
  return <div className="source-freshness">
    <span>{calendar?text('Event calendar last checked successfully: ','赛事日历最近成功检查：'):text('Event details last checked successfully: ','赛事资料最近成功检查：')}<time dateTime={status?.lastSuccess}>{formatted(status?.lastSuccess)}</time></span>
    {status?.needsReview&&<span className="source-freshness-pending">{text('Some information still needs checking. Please use the official source to confirm.','部分资料待核对，请打开官方来源确认。')}</span>}
    {status?.retainedSchedule&&<span>{text('Showing the last valid schedule; the latest schedule could not be confirmed.','当前保留上次有效赛程，最新赛程尚未确认。')}</span>}
    {status?.needsReview&&status.lastAttempt&&<small>{text('Last attempt: ','最近尝试：')}{formatted(status.lastAttempt)}</small>}
  </div>;
}
