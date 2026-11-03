'use client';
import {Fragment,useId,useState} from 'react';
import type {ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
import type {ScheduleRow} from '../lib/club-types';
import {groupCoachSchedule,hasCoachGroupTime} from '../lib/coach-schedule';
import {currentLocale,text,useLanguage} from '../lib/i18n';

type Props={rows:ScheduleRow[];conflicts:ReadonlySet<string>;onSkater:(id:string)=>void;renderDetails:(row:ScheduleRow)=>ReactNode};
function dayTitle(date:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return text('Date to be confirmed','日期待确认');
  const weekday=new Intl.DateTimeFormat(currentLocale()==='en'?'en-CA':'zh-CN',{weekday:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  return date.replaceAll('-','.')+' · '+weekday;
}
export default function CoachDailySchedule({rows,conflicts,onSkater,renderDetails}:Props){
  useLanguage();
  const prefix=useId(),[expanded,setExpanded]=useState<string|null>(null);
  const days=groupCoachSchedule(rows);
  if(!days.length)return <div className="club-empty"><h3>{text('No matching official sessions','暂无符合条件的官方安排')}</h3><p>{text('Try another competition, coach or date.','可调整比赛、教练或日期筛选。')}</p></div>;
  return <div className="coach-daily-schedule">
    <p className="coach-daily-legend">{text('Group times, by local date. Counts include candidate sessions. TBC = unconfirmed; expand a row for details.','按比赛当地日期及组别时间排列，人数含待确认候选安排。待确认项目排在后面，可展开一行核对详情。')}</p>
    {days.map((day,index)=><section className="coach-day" key={day.date} aria-labelledby={prefix+'-day-'+index}>
      <header className="coach-day-header"><h3 id={prefix+'-day-'+index}>{dayTitle(day.date)}</h3><div className="coach-day-counts"><span><strong>{day.skaterCount}</strong> {text('skaters','位选手')}</span><span><strong>{day.sessionCount}</strong> {text('sessions','项赛程')}</span>{day.unconfirmedCount>0&&<span className="coach-day-pending">{day.unconfirmedCount} {text('pending','项待确认')}</span>}</div></header>
      {day.zones.map(zone=>{
        const events=[...new Map(zone.rows.map(row=>[row.eventId,row.eventName])).values()];
        return <div className="coach-day-zone" key={zone.timezone}>
          <p className="coach-day-context">{zone.timezone||text('Time zone not published','时区待公布')}{events.length===1&&<span> · {events[0]}</span>}</p>
          <table className="coach-day-table" aria-label={dayTitle(day.date)+' · '+(zone.timezone||text('Local time','当地时间'))}>
            <thead><tr><th scope="col" className="coach-day-time">{text('Group time','组别时间')}</th><th scope="col">{text('Skater / Category','选手 / 项目')}</th><th scope="col" className="coach-day-rink">{text('Rink','冰场')}</th><th scope="col" className="coach-day-action"><span className="sr-only">{text('Details','详情')}</span></th></tr></thead>
            <tbody>{zone.rows.map(row=>{
              const opened=expanded===row.id,detailId=prefix+'-row-'+encodeURIComponent(row.id);
              return <Fragment key={row.id}>
                <tr className={opened?'coach-day-row is-expanded':'coach-day-row'}>
                  <td className="coach-day-time">{hasCoachGroupTime(row)?<><strong>{row.start}</strong>{row.end&&<span className="coach-day-end">–{row.end}</span>}</>:<strong className="coach-day-tbc" title={text('Time to be confirmed','时间待确认')}>{text('TBC','待确认')}</strong>}{row.uncertain&&<small>{text('Candidate','候选安排')}</small>}{row.startingOrder?.individualTime&&<small className="coach-day-individual">{text('Individual','个人')} {row.startingOrder.individualTime}</small>}{conflicts.has(row.id)&&<small className="coach-day-overlap">{text('Possible overlap','可能重叠')}</small>}</td>
                  <td className="coach-day-skater"><button type="button" onClick={()=>onSkater(row.skaterId)}>{row.skaterName}</button><span className="coach-day-category" title={(row.activity==='practice'?text('Practice · ','练习 · '):'')+row.category}>{row.activity==='practice'&&text('Practice · ','练习 · ')}{row.category}</span><span className="coach-day-order-wrap">{row.startingOrder&&<a className="coach-day-order" href={row.startingOrder.sourceUrl+(row.startingOrder.page?'#page='+row.startingOrder.page:'')} target="_blank" rel="noreferrer">{text('Start #','出场 #')}{row.startingOrder.startNumber}{row.startingOrder.warmupGroup!==null&&<> · {text('Warm-up ','热身组 ')}{row.startingOrder.warmupGroup}</>}</a>}</span><small className="coach-day-coach" title={row.coach}>{row.coach||text('Coach unassigned','教练待分配')}</small>{events.length>1&&<small className="coach-day-event" title={row.eventName}>{row.eventName}</small>}</td>
                  <td className="coach-day-rink">{row.rink||text('TBC','待确认')}</td>
                  <td className="coach-day-action"><button type="button" aria-expanded={opened} aria-controls={detailId} aria-label={text('Details for '+row.skaterName,row.skaterName+'的赛程详情')} onClick={()=>setExpanded(opened?null:row.id)}><ChevronDown size={17}/></button></td>
                </tr>
                <tr className="coach-day-details" hidden={!opened}><td colSpan={4}><div id={detailId}>{opened&&renderDetails(row)}</div></td></tr>
              </Fragment>;
            })}</tbody>
          </table>
        </div>;
      })}
    </section>)}
  </div>;
}
