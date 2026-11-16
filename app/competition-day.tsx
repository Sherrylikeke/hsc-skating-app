'use client';
import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {CalendarDays,Printer} from 'lucide-react';
import type {ClubEvent,ClubSkater,CoachPlan,ScheduleRow} from '../lib/club-types';
import {todayToronto} from '../lib/club-types';
import {competitionChecklistItemKey,competitionChecklistItems,competitionChecklistKey,competitionDayArrival,competitionDayPlan,competitionDayRows,readCompetitionChecklist} from '../lib/competition-day';
import {confirmedGroupInterval} from '../lib/event-watch';
import {text,useLanguage} from '../lib/i18n';
import CompactSelect from './compact-select';
import SessionTiming from './session-timing';
import SourceFreshness from './source-freshness';
import './competition-day.css';

type Props={memberId:string;rows:ScheduleRow[];events:ClubEvent[];skaters:ClubSkater[];ownIds:string[];plans:CoachPlan[]};
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const labels=()=>({skates:text('Skates & guards','冰鞋与刀套'),outfit:text('Competition outfit','比赛服装'),music:text('Music backup','音乐备份'),water:text('Water & snack','饮水与点心'),'check-in':text('Check-in complete','完成报到')});
const subscribeReady=()=>()=>{};

function DayChecklist({storageKey,skaters}:{storageKey:string;skaters:Array<Pick<ClubSkater,'id'|'name'>>}) {
  const [checked,setChecked]=useState(()=>readCompetitionChecklist(storageKey)),[saveError,setSaveError]=useState(false);
  // Keep server markup stable; reveal browser storage once hydration has finished.
  const ready=useSyncExternalStore(subscribeReady,()=>true,()=>false);
  function toggle(id:string,done:boolean) {
    const next=done?[...checked.filter(value=>value!==id),id]:checked.filter(value=>value!==id);
    setChecked(next);
    try {localStorage.setItem(storageKey,JSON.stringify(next));setSaveError(false);}catch{setSaveError(true);}
  }
  const names=labels();
  return <section className="day-checklist" aria-label={text('Preparation checklist','准备清单')}>
    <header><h3>{text('Preparation checklist','准备清单')}</h3><p>{text('Saved in this browser, separately for each account and date.','仅保存在本浏览器，按账号与日期分开。')}</p></header>
    <div className="day-checklist-grid">{skaters.map(skater=><fieldset key={skater.id}>
      <legend>{skater.name}</legend>
      {competitionChecklistItems.map(item=>{
        const id=competitionChecklistItemKey(skater.id,item);
        return <label key={item}><input type="checkbox" disabled={!ready} checked={ready&&checked.includes(id)} onChange={event=>toggle(id,event.target.checked)}/><span>{names[item]}</span></label>;
      })}
    </fieldset>)}</div>
    {saveError&&<p className="day-save-error" role="status">{text('Checklist changes could not be saved in this browser.','本浏览器暂时无法保存清单勾选。')}</p>}
  </section>;
}

export default function CompetitionDay({memberId,rows,events,skaters,ownIds,plans}:Props) {
  const language=useLanguage();
  const [today,setToday]=useState(todayToronto),[chosenDate,setChosenDate]=useState(''),[chosenSkater,setChosenSkater]=useState('');
  useEffect(()=>{
    const update=()=>setToday(todayToronto());
    const timer=window.setInterval(update,60_000);
    document.addEventListener('visibilitychange',update);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',update);};
  },[]);
  const date=chosenDate||today,selected=ownIds.includes(chosenSkater)?chosenSkater:'';
  const ownSkaters=skaters.filter(skater=>ownIds.includes(skater.id)&&(!selected||skater.id===selected));
  const dates=useMemo(()=>[...new Set([date,today,...rows.filter(row=>ownIds.includes(row.skaterId)).map(row=>row.date).filter(validDate)])].sort(),[rows,ownIds,date,today]);
  const visible=useMemo(()=>competitionDayRows(rows,ownIds,date,selected),[rows,ownIds,date,selected]);
  const dateLabel=(value:string)=>new Intl.DateTimeFormat(language==='zh'?'zh-CN':'en-CA',{year:'numeric',month:'short',day:'numeric',weekday:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
  return <section className="competition-day" aria-label={text('Competition day','比赛日模式')}>
    <header className="day-heading"><div><h1><CalendarDays size={20}/>{text('Competition day','比赛日模式')}</h1><p>{dateLabel(date)} · {selected?ownSkaters[0]?.name:text('All my skaters','我的全部')}</p></div>
      <button type="button" className="day-print" aria-label={text('Print / Save PDF','打印 / 保存 PDF')} onClick={()=>window.print()}><Printer size={16}/><span>{text('Print / Save PDF','打印 / 保存 PDF')}</span></button>
    </header>
    <div className="day-controls">
      <label>{text('Date','日期')}<CompactSelect aria-label={text('Competition day date','比赛日日期')} value={date} onChange={event=>setChosenDate(event.target.value===today?'':event.target.value)}>
        {dates.map(day=><option key={day} value={day}>{day}{day===today?' · '+text('Today','今天'):''}</option>)}
      </CompactSelect></label>
      <button type="button" onClick={()=>setChosenDate('')}>{text('Today','今天')}</button>
      <label>{text('Skater','选手')}<CompactSelect aria-label={text('Skaters on competition day','比赛日选手')} value={selected} onChange={event=>setChosenSkater(event.target.value)}>
        <option value="">{text('All my skaters','我的全部')}</option>
        {skaters.filter(skater=>ownIds.includes(skater.id)).map(skater=><option key={skater.id} value={skater.id}>{skater.name}</option>)}
      </CompactSelect></label>
    </div>
    <p className="day-time-note">{text('Today follows Toronto time. Session and meeting times use the competition’s time zone. Estimates may change; check the official source.','“今天”以多伦多日期为准；赛程与集合使用比赛当地时区。预计时间可能变化，请核对官方来源。')}</p>
    {!ownIds.length?<p className="day-empty">{text('Add a skater to My Skaters to see their competition day.','先在“我的选手”添加选手，即可查看比赛日安排。')}</p>:!visible.length?<p className="day-empty">{text('No official sessions for this selection on this date. Choose another competition date above.','当前选手在此日期暂无官方安排，可在上方选择其他比赛日期。')}</p>:<ol className="day-sessions">{visible.map(row=>{
      const event=events.find(event=>event.id===row.eventId);
      // The parent supplies plans already filtered by server authorization. Home preferences only select shared schedule rows.
      const plan=competitionDayPlan(row,plans),arrival=competitionDayArrival(row,plan?.meetingTime),confirmed=!!confirmedGroupInterval(row);
      const order=row.startingOrder;
      return <li key={row.id} className="day-session">
        <header><h3>{row.skaterName}<span>{row.category}</span></h3><p>{row.eventName}{row.activity==='practice'?' · '+text('Official practice','官方练习'):''}</p></header>
        <div className="day-time-grid">
          <div className="day-arrival"><small>{text('Arrive by','最晚到场')}</small><strong>{arrival?.time??text('To be confirmed','待确认')}</strong><span>{arrival?.meeting?text('Earlier coach meeting','按更早的教练集合时间'):text('At least 60 minutes before the confirmed group start','已确认组别开始前至少60分钟')}</span></div>
          <div><small>{text('Official group time','官方组别时段')}</small><strong>{confirmed?row.start+'–'+row.end:text('To be confirmed','待确认')}</strong><span>{row.timezone||text('Time zone pending','时区待确认')}</span></div>
        </div>
        <div className="day-individual"><SessionTiming row={row} event={event}/></div>
        <dl className="day-location"><div><dt>{text('Rink','冰场')}</dt><dd>{[event?.venue,row.rink].filter(Boolean).join(' · ')||text('To be confirmed','待确认')}</dd></div>
          <div><dt>{text('Coach','教练')}</dt><dd>{row.coach||text('To be confirmed','待确认')}</dd></div></dl>
        {plan&&(plan.meetingTime||plan.note)&&<div className="day-meeting">{plan.meetingTime&&<p><b>{text('Coach meeting','教练集合')}</b> · {plan.meetingTime.slice(0,10)} {plan.meetingTime.slice(11,16)} · {row.timezone}</p>}{plan.note&&<p className="day-plan-note">{plan.note}</p>}</div>}
        <footer><a href={row.sourceUrl+(row.page?'#page='+row.page:'')} target="_blank" rel="noreferrer">{text('Official group schedule ↗','官方组别赛程 ↗')}</a>
          {order&&<a href={order.sourceUrl+(order.page?'#page='+order.page:'')} target="_blank" rel="noreferrer">{text('Starting order #','官方出场顺序 #')}{order.startNumber}{order.warmupGroup!=null&&' · '+text('Warm-up group ','热身组 ')+order.warmupGroup} ↗</a>}</footer>
      </li>;
    })}</ol>}
    {events.filter(event=>visible.some(row=>row.eventId===event.id)).map(event=><div className="day-source" key={event.id}><strong>{event.name}</strong><SourceFreshness status={event.sourceStatus}/></div>)}
    {ownSkaters.length>0&&<DayChecklist key={competitionChecklistKey(memberId,date)} storageKey={competitionChecklistKey(memberId,date)} skaters={ownSkaters}/>}
    <p className="day-print-hint">{text('Use your browser’s print dialog to print or save a PDF. It contains the currently selected date and skaters.','在浏览器打印窗口中打印或保存 PDF，内容为当前日期与选手筛选结果。')}</p>
  </section>;
}
