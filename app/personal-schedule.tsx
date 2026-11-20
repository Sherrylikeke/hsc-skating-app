'use client';
import {useEffect, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import {todayToronto,type ClubEvent,type ClubSkater,type ScheduleRow} from '../lib/club-types';
import {upcomingCompetitionCards,type HomeScope} from '../lib/home-schedule';
import {text} from '../lib/i18n';
import CompactSelect from './compact-select';
import HomeSkaters from './home-skaters';
import './personal-schedule.css';

type Props = {
  events:ClubEvent[];
  onEvent:(id:string)=>void;
  limit?:number;editableIds?:string[];onCoachChange?:()=>void;
  onSkater:(id:string)=>void;
  onWatch:()=>void;
  onCalendar:()=>void;
  onDay?:()=>void;
  onRegistrations?:()=>void;
  rows:ScheduleRow[];
  skaters:ClubSkater[];
  ownIds:string[];
  scope:HomeScope;
  onScope:(scope:HomeScope)=>void;
  onChange:(ids:string[])=>void;
  renderRows:(rows:ScheduleRow[],showArrival?:boolean,showEvent?:boolean)=>ReactNode;
};

export default function PersonalSchedule({events,onEvent,rows,skaters,ownIds,scope,onScope,onChange,renderRows,onWatch,onCalendar,onDay,onRegistrations,onSkater,limit,editableIds,onCoachChange}:Props) {
  const [now,setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const {cards,past} = useMemo(()=>upcomingCompetitionCards(events,rows,skaters,ownIds,scope,now,todayToronto()),
    [events,rows,skaters,ownIds,scope,now]);
  const own = new Set(ownIds);
  const mine = text('All my skaters','我的全部');
  const team = text('Whole team','全队');
  const option = (skater:ClubSkater) => <option key={skater.id} value={'skater:'+skater.id}>{skater.name}</option>;
  return <>
    <section className="club-panel club-personal-picker family-controls">
      <div className="family-filter">
        <span id="family-filter-label">{text('Show schedule for','查看谁的赛程')}</span>
        <CompactSelect aria-labelledby="family-filter-label" value={scope} onChange={e=>onScope(e.target.value as HomeScope)}>
          <option value="mine">{mine}</option>
          {skaters.filter(skater=>own.has(skater.id)).map(option)}
          <option value="team">{team}</option>
          {skaters.filter(skater=>!own.has(skater.id)).map(option)}
        </CompactSelect>
      </div>
      <HomeSkaters limit={limit} editableIds={editableIds} onCoachChange={onCoachChange} onSkater={onSkater} skaters={skaters} ownIds={ownIds} onChange={onChange}/>
      {onDay&&<button type="button" className="cal-entry" onClick={onDay}>{text('Competition day','比赛日')}</button>}
      {onRegistrations&&<button type="button" className="cal-entry" onClick={onRegistrations}>{text('Registration board','报名看板')}</button>}
      <button type="button" className="cal-entry" onClick={onCalendar}>{text('Schedule calendar','赛程日历')}</button>
      <button type="button" className="watch-entry" onClick={onWatch}>{text('Cheer from now','从现在看 · 给朋友加油')}</button>
    </section>
    {!cards.length&&<p className="club-panel family-empty">{!ownIds.length && scope==='mine'
      ?text('Add a skater above to see their schedule.','在上方添加选手，即可查看赛程。')
      :text('No upcoming official sessions for this selection.','当前选择暂无接下来的官方安排。')}</p>}
    {cards.map(({event,sessions,waiting})=><section className="club-panel family-upcoming" key={event.id}>
      <div className="club-panel-heading family-event-heading">
        <h2><button className="club-text-button" type="button" onClick={()=>onEvent(event.id)}>{event.name}</button></h2>
        <p>{event.start}{event.end&&event.end!==event.start?' – '+event.end:''}</p>
      </div>
      {sessions.length>0&&renderRows(sessions,true,false)}
      {waiting.length>0&&<div className="family-empty">
        <p>{event.blocks.length||event.documents.some(document=>document.kind==='schedule')
          ?text('Schedule published · category time pending','赛程已公布 · 类别时段待确认')
          :text('Schedule to be published','赛程待公布')}</p>
        <ul>{waiting.map(skater=><li key={skater.id}>
          <button className="club-text-button" type="button" onClick={()=>onSkater(skater.id)}>{skater.name}</button>
        </li>)}</ul>
      </div>}
    </section>)}
    {past.length>0 && <details className="club-panel family-past">
      <summary>{text('Past sessions','已结束的安排')} ({past.length})</summary>
      {renderRows(past)}
    </details>}
  </>;
}
