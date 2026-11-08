'use client';
import {useEffect,useMemo,useState} from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGrid from '@fullcalendar/react/daygrid';
import timeGrid from '@fullcalendar/react/timegrid';
import monarch from '@fullcalendar/react/themes/monarch';
import zhCN from '@fullcalendar/react/locales/zh-cn';
import {ChevronLeft,ChevronRight,CalendarDays,Clock3} from 'lucide-react';
import type {ClubEvent,ClubSkater,ScheduleRow} from '../lib/club-types';
import {todayToronto} from '../lib/club-types';
import {familyCalendar,familyOverlaps,rinkGroups,type CalendarDay} from '../lib/family-calendar';
import {friendStorageKey,readFriends} from '../lib/event-watch';
import {text,useLanguage} from '../lib/i18n';
import CompactSelect from './compact-select';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/monarch/theme.css';
import '@fullcalendar/react/themes/monarch/palettes/blue.css';
import './family-calendar.css';

type Props={events:ClubEvent[];skaters:ClubSkater[];ownIds:string[];memberId:string};
type Position={date:string;day:boolean;rink:string};
const plugins=[monarch,dayGrid,timeGrid], locales=[zhCN];
const empty:CalendarDay={sessions:[],registrations:[]};
const colors=['#216961','#374f87','#805520','#554a82','#266980'];
const friendColor='#864961';
const isoDay=(date:Date)=>date.toISOString().slice(0,10);
const utcDay=(date:string)=>new Date(date+'T12:00:00Z');
function position():Position {
  const params=new URLSearchParams(location.search), date=params.get('date')??'';
  const valid=/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(+utcDay(date))&&isoDay(utcDay(date))===date;
  return {date:valid?date:todayToronto(),day:params.get('mode')==='day',rink:params.get('rink')??''};
}
function colorFor(id:string,ownIds:string[]) {
  const index=ownIds.indexOf(id);
  return index<0?friendColor:colors[index%colors.length];
}
function groupClock(value:number,zone:string) {
  return new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(value);
}
function shift(date:string,delta:number,byDay:boolean) {
  const d=utcDay(date);
  if(byDay) d.setUTCDate(d.getUTCDate()+delta);
  else {
    const originalDay=d.getUTCDate();
    d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+delta+1);d.setUTCDate(0);
    d.setUTCDate(Math.min(originalDay,d.getUTCDate()));
  }
  return isoDay(d);
}

export default function FamilyCalendar({events,skaters,ownIds,memberId}:Props) {
  const lang=useLanguage(), locale=lang==='zh'?'zh-CN':'en-CA';
  const [where,setWhere]=useState(position),[details,setDetails]=useState('');
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{
    if(!where.day || !where.rink) return;
    const tick=()=>setNow(Date.now());
    tick();
    const timer=window.setInterval(tick,30_000);
    document.addEventListener('visibilitychange',tick);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',tick);};
  },[where.day,where.rink]);
  useEffect(()=>{
    function restore(){setWhere(position());setDetails('');}
    window.addEventListener('popstate',restore);
    return ()=>window.removeEventListener('popstate',restore);
  },[]);
  function move(date:string,day:boolean,rink='',replace=false) {
    const params=new URLSearchParams({view:'calendar',date});
    if(day) params.set('mode','day');
    if(rink) params.set('rink',rink);
    const url='/workspace?'+params;
    if(location.pathname+location.search!==url) {
      if(replace) history.replaceState({},'',url);
      else history.pushState({},'',url);
    }
    setWhere({date,day,rink});setDetails('');
    if(!replace) window.scrollTo({top:0,behavior:'instant'});
  }
  const calendar=useMemo(()=>familyCalendar(events,skaters,ownIds,id=>readFriends(friendStorageKey(memberId,id))),[events,skaters,ownIds,memberId]);
  const {date,day}=where, data=calendar.days.get(date)??empty;
  const title=new Intl.DateTimeFormat(locale,day?{month:'long',day:'numeric',weekday:'short',timeZone:'UTC'}:{month:'long',year:'numeric',timeZone:'UTC'}).format(utcDay(date));
  const summaryTitle=text('Schedule calendar','赛程日历');
  const rinkOptions=useMemo(()=>rinkGroups(data.sessions,events),[data,events]);
  const rinks=[...rinkOptions].sort(([,a],[,b])=>a.ice.localeCompare(b.ice)||a.venue.localeCompare(b.venue));
  const rink=rinkOptions.has(where.rink)?where.rink:'';
  const visible=rinkOptions.get(rink)?.sessions??data.sessions;
  const pending=visible.filter(s=>!s.interval);
  const zones=[...new Set(visible.filter(s=>s.interval).map(s=>s.row.timezone))];
  const overlaps=familyOverlaps(data.sessions,ownIds);
  const cheering=visible.filter(s=>s.interval && s.interval.end>now && !ownIds.includes(s.row.skaterId))
    .sort((a,b)=>a.interval!.start-b.interval!.start);
  const monthsUndated=calendar.undated.filter(r=>r.event.start.slice(0,7)<=date.slice(0,7)&&r.event.end.slice(0,7)>=date.slice(0,7));
  const registrations=day ? [...data.registrations,...monthsUndated.filter(r=>r.event.start<=date&&r.event.end>=date)] : monthsUndated;
  function showRow(row:ScheduleRow) {
    setDetails(row.id);
    requestAnimationFrame(()=>document.getElementById('calendar-session-detail')?.focus());
  }
  const selectedRow=visible.find(({row})=>row.id===details)?.row;
  const friendLink=({row}:{row:ScheduleRow})=><button key={row.id} onClick={()=>showRow(row)}>{row.skaterName} · {row.activity==='practice'?text('Practice','练习'):text('Group','组别')} {row.start}–{row.end}</button>;
  return <section className="family-calendar" aria-label={summaryTitle}>
    <div className="cal-card">
      <header className="cal-toolbar">
        <div className="cal-date-heading">
          {day&&<button className="cal-month-back" onClick={()=>move(date,false)}><ChevronLeft size={16}/>{text('Month','月历')}</button>}
          <h2>{title}</h2>
        </div>
        <div className="cal-nav">
          <button aria-label={day?text('Previous day','前一天'):text('Previous month','上个月')} onClick={()=>move(shift(date,-1,day),day)}><ChevronLeft size={17}/></button>
          <button onClick={()=>move(todayToronto(),day)}>{text('Today','今天')}</button>
          <button aria-label={day?text('Next day','后一天'):text('Next month','下个月')} onClick={()=>move(shift(date,1,day),day)}><ChevronRight size={17}/></button>
        </div>
      </header>
      {!day ? <>
        <div className="cal-month">
          <FullCalendar key={date.slice(0,7)} plugins={plugins} locales={locales} locale={locale} initialView="dayGridMonth" timeZone="UTC"
            initialDate={date} now={todayToronto()} headerToolbar={false} height="auto" fixedWeekCount={false}
            navLinks navLinkDayClick={target=>move(isoDay(target),true)}
            navLinkHint={(_label,target)=>{
              const key=isoDay(target),d=calendar.days.get(key),count=(d?.sessions.length??0)+(d?.registrations.length??0);
              return key+(count?' · '+count+text(' entries',' 项安排'):'');
            }}
            dayHeaderFormat={{weekday:lang==='zh'?'narrow':'short'}} dayCellTopClass="cal-cell-top" dayCellTopInnerClass="cal-cell-inner"
            dayCellTopContent={info=>{
              const key=isoDay(info.date), d=calendar.days.get(key);
              const ids=[...new Set([...(d?.sessions??[]).map(s=>s.row.skaterId),...(d?.registrations??[]).map(r=>r.skaterId)])];
              const dots=ids.filter(id=>ownIds.includes(id)).slice(0,2).map(id=>colorFor(id,ownIds));
              if(ids.some(id=>!ownIds.includes(id))) dots.push(friendColor);
              const count=(d?.sessions.length??0)+(d?.registrations.length??0);
              return <span className={'cal-date'+(info.isOther?' cal-outside':'')+(key===date?' cal-selected':'')}>
                <span>{Number(key.slice(-2))}</span>{count>0&&<small><i aria-hidden="true">{dots.map((color,i)=><b key={i} style={{backgroundColor:color}}/>)}</i>{count}</small>}
              </span>;
            }}/>
        </div>
        <div className="cal-legend">{ownIds.map(id=><span key={id}><i style={{backgroundColor:colorFor(id,ownIds)}}/>{skaters.find(s=>s.id===id)?.name??id}</span>)}
          <span><i style={{backgroundColor:friendColor}}/>{text('Event friends','本场朋友')}</span><span>{text('Numbers show entries','数字为安排数')}</span></div>
      </> : <>
        {!rink&&overlaps.length>0&&<div className="cal-overlaps">{overlaps.map(({a,b,start,end})=><p key={JSON.stringify([a.id,b.id])}>
          <strong>{text('Group overlap · ','组别重叠 · ')}{(end-start)/60000}{text(' min',' 分钟')}</strong>
          <span>{a.skaterName} / {b.skaterName} · {groupClock(start,a.timezone)}–{groupClock(end,a.timezone)}{a.timezone!==b.timezone&&' · '+a.timezone}</span>
        </p>)}</div>}
        <div className="cal-filters"><span>{text('Ice surface','比赛冰面')}</span>
          <CompactSelect aria-label={text('Ice surface','比赛冰面')} value={rink} onChange={e=>move(date,true,e.target.value,true)}>
            <option value="">{text('All rinks','所有冰面')}</option>{rinks.map(([key,r])=><option key={key} value={key}>{rinks.some(([other,s])=>other!==key&&s.ice===r.ice)?r.ice+' · '+r.venue:r.ice}</option>)}
          </CompactSelect></div>
        {rink&&cheering.length>0&&<div className="cal-cheering"><strong>{text('Friends at this rink','这块冰面的朋友')}</strong>
          {cheering.slice(0,2).map(friendLink)}
          {cheering.length>2&&<details><summary>{text('More groups','更多组别')} ({cheering.length-2})</summary>{cheering.slice(2).map(friendLink)}</details>}</div>}
        {zones.map(zone=>{
          const timed=visible.filter(s=>s.interval&&s.row.timezone===zone);
          const hours=(clock:string)=>Number(clock.slice(0,2))+Number(clock.slice(3))/60;
          const min=Math.floor(Math.min(...timed.map(s=>hours(s.row.start))));
          const max=Math.min(24,Math.max(min+1,Math.ceil(Math.max(...timed.map(s=>hours(s.row.end))))));
          const hour=(n:number)=>String(n).padStart(2,'0')+':00:00';
          return <div className="cal-agenda" key={zone}>
            <h3><Clock3 size={15}/>{text('Official group times','官方组别时段')} · {zone}</h3>
            <FullCalendar key={date} plugins={plugins} locales={locales} locale={locale} initialView="timeGridDay" initialDate={date}
              timeZone={zone} headerToolbar={false} dayHeaders={false} allDaySlot={false} height="auto" slotEventOverlap={false} eventInteractive
              slotMinTime={hour(min)} slotMaxTime={hour(max)} slotDuration="00:15:00" slotHeaderInterval="00:30:00" slotMinHeight={36}
              slotHeaderFormat={{hour:'2-digit',minute:'2-digit',hour12:false}} displayEventTime={false}
              events={timed.map(({row,interval})=>({id:row.id,title:row.skaterName,start:interval!.start,end:interval!.end,
                color:colorFor(row.skaterId,ownIds),extendedProps:{row}}))}
              eventClick={info=>showRow(info.event.extendedProps.row)}
              eventContent={info=>{
                const row=info.event.extendedProps.row as ScheduleRow;
                return <div className="cal-slot">
                  <strong>{row.skaterName}</strong><span>{row.start}–{row.end} · {row.rink||text('Rink pending','冰面待公布')}</span>
                  {row.activity==='practice'&&<small>{text('Practice','官方练习')}</small>}
                  {!ownIds.includes(row.skaterId)&&<small>{text('Friend','本场朋友')}</small>}
                  {row.startingOrder?.individualTime&&<small>{text('Individual · ','个人 · ')}{row.startingOrder.individualTime}</small>}
                </div>;
              }}/>
          </div>;
        })}
        {visible.length===0&&<p className="cal-empty"><CalendarDays size={17}/>{text('No scheduled groups for this selection.','当前选择暂无已排组别。')}</p>}
        {selectedRow&&<div className="cal-detail" tabIndex={-1} id="calendar-session-detail"><strong>{selectedRow.skaterName} · {selectedRow.category}</strong>
          <p>{selectedRow.eventName} · {selectedRow.rink} · {selectedRow.activity==='practice'?text('Practice','官方练习'):text('Group time','组别时段')} {selectedRow.start}–{selectedRow.end}</p>
          <p>{selectedRow.startingOrder?.individualTime?text('Official individual time · ','官方个人时间 · ')+selectedRow.startingOrder.individualTime:text('Individual time pending','个人时间待公布')}</p>
          <a href={selectedRow.sourceUrl+(selectedRow.page?'#page='+selectedRow.page:'')} target="_blank" rel="noreferrer">{text('Official group schedule ↗','官方组别赛程 ↗')}</a>
          {selectedRow.startingOrder&&<a href={selectedRow.startingOrder.sourceUrl+(selectedRow.startingOrder.page?'#page='+selectedRow.startingOrder.page:'')} target="_blank" rel="noreferrer">{text('Starting order #','官方出场顺序 #')}{selectedRow.startingOrder.startNumber} ↗</a>}</div>}
      </>}
    </div>
    {(day&&pending.length>0||registrations.length>0)&&<section className="cal-pending">
      <h3>{text('Time to be confirmed','时间待公布')}</h3>
      {day&&pending.map(({row})=><p key={row.id}><strong>{row.skaterName}</strong> · {row.category} · {row.eventName}</p>)}
      {registrations.map(r=><p key={r.id}><strong>{r.name}</strong> · {r.category} · {r.event.name} · {text('Rink pending','冰面待公布')}
        {r.event.start!==r.event.end&&<small>{text('Competition dates · ','赛事日期 · ')}{r.event.start} – {r.event.end}</small>}</p>)}
    </section>}
  </section>;
}
