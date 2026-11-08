'use client';
import {useEffect, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import type {ClubSkater, ScheduleRow} from '../lib/club-types';
import {filterHomeSchedule, groupHomeSchedule, type HomeScope} from '../lib/home-schedule';
import {text} from '../lib/i18n';
import CompactSelect from './compact-select';
import HomeSkaters from './home-skaters';
import './personal-schedule.css';

type Props = {
  onSkater:(id:string)=>void;
  onWatch:()=>void;
  onCalendar:()=>void;
  rows:ScheduleRow[];
  skaters:ClubSkater[];
  ownIds:string[];
  scope:HomeScope;
  onScope:(scope:HomeScope)=>void;
  onChange:(ids:string[])=>void;
  renderRows:(rows:ScheduleRow[], showArrival?:boolean)=>ReactNode;
};

export default function PersonalSchedule({rows,skaters,ownIds,scope,onScope,onChange,renderRows,onWatch,onCalendar,onSkater}:Props) {
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
  const {upcoming,pending,past} = useMemo(
    () => groupHomeSchedule(filterHomeSchedule(rows,ownIds,scope),now), [rows,ownIds,scope,now]
  );
  const own = new Set(ownIds);
  const mine = text('All my skaters','我的全部');
  const team = text('Whole team','全队');
  const title = scope === 'mine' ? mine : scope === 'team' ? team : skaters.find(skater => 'skater:'+skater.id === scope)?.name;
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
      <HomeSkaters onSkater={onSkater} skaters={skaters} ownIds={ownIds} onChange={onChange}/>
      <button type="button" className="cal-entry" onClick={onCalendar}>{text('Schedule calendar','赛程日历')}</button>
      <button type="button" className="watch-entry" onClick={onWatch}>{text('Cheer from now','从现在看 · 给朋友加油')}</button>
    </section>
    <section className="club-panel family-upcoming">
      <div className="club-panel-heading"><h2>{title}</h2><span>{text('Current & upcoming','当前及接下来')} · {upcoming.length}</span></div>
      {upcoming.length ? renderRows(upcoming,true) :
        <p className="family-empty">{!ownIds.length && scope==='mine' ? text('Add a skater above to see their schedule.','在上方添加选手，即可查看赛程。') :
          pending.length ? text('Group times are still to be confirmed. See the possible sessions below.','组别时间待确认，可在下方查看候选安排。') :
          text('No upcoming official sessions for this selection.','当前选择暂无接下来的官方安排。')}</p>}
    </section>
    {pending.length>0 && <section className="club-panel family-pending">
      <div className="club-panel-heading"><h2>{text('Time to be confirmed','时段待确认')}</h2><span>{pending.length}</span></div>
      {renderRows(pending)}
    </section>}
    {past.length>0 && <details className="club-panel family-past">
      <summary>{text('Past sessions','已结束的安排')} ({past.length})</summary>
      {renderRows(past)}
    </details>}
  </>;
}
