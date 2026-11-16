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
import {defaultEventFriends,friendStorageKey,readFriends} from '../lib/event-watch';
import SessionTiming from './session-timing';
import {text,useLanguage} from '../lib/i18n';
import CompactSelect from './compact-select';
import CalendarNotice from './calendar-notice';
import {calendarExport} from '../lib/calendar-export';
import {saveTextFile} from '../lib/client-platform';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/monarch/theme.css';
import '@fullcalendar/react/themes/monarch/palettes/blue.css';
import './family-calendar.css';

type Props={onNavigate:(url:string,replace:boolean)=>void;events:ClubEvent[];skaters:ClubSkater[];ownIds:string[];memberId:string};
type Mode='month'|'day'|'list';
type Position={date:string;mode:Mode;rink:string;scope:string};
const plugins=[monarch,dayGrid,timeGrid], locales=[zhCN];
const empty:CalendarDay={sessions:[],registrations:[]};
const colors=['#216961','#374f87','#805520','#554a82','#266980'];
const friendColor='#864961';
const isoDay=(date:Date)=>date.toISOString().slice(0,10);
const utcDay=(date:string)=>new Date(date+'T12:00:00Z');
function position():Position {
  const params=new URLSearchParams(location.search), date=params.get('date')??'';
  const valid=/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(+utcDay(date))&&isoDay(utcDay(date))===date;
  return {date:valid?date:todayToronto(),mode:params.get('mode')==='day'?'day':params.get('mode')==='list'?'list':'month',rink:params.get('rink')??'',scope:params.get('scope')??'all'};
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

export default function FamilyCalendar({events,skaters,ownIds,memberId,onNavigate}:Props) {
  const lang=useLanguage(), locale=lang==='zh'?'zh-CN':'en-CA';
  const [where,setWhere]=useState(position),[details,setDetails]=useState('');
  const [now,setNow]=useState(Date.now);
  const [exportStatus,setExportStatus]=useState(''),[exporting,setExporting]=useState(false);
  useEffect(()=>{
    const tick=()=>setNow(Date.now());
    tick();
    const timer=window.setInterval(tick,30_000);
    document.addEventListener('visibilitychange',tick);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',tick);};
  },[]);
  useEffect(()=>{
    function restore(){setWhere(position());setDetails('');}
    window.addEventListener('popstate',restore);
    return ()=>window.removeEventListener('popstate',restore);
  },[]);
  function move(date:string,mode:Mode,rink='',replace=false,scope=where.scope) {
    const params=new URLSearchParams({view:'calendar',date});
    if(mode!=='month') params.set('mode',mode);
    if(scope!=='all') params.set('scope',scope);
    if(rink) params.set('rink',rink);
    const url='/workspace?'+params;
    onNavigate(url,replace);
    setWhere({date,mode,rink,scope});setDetails('');setExportStatus('');
  }
  const sourceCalendar=useMemo(()=>familyCalendar(events,skaters,ownIds,id=>{
    const event=events.find(event=>event.id===id);
    return readFriends(friendStorageKey(memberId,id),event?defaultEventFriends(event,skaters,ownIds):[]);
  }),[events,skaters,ownIds,memberId]);
  const {date,mode}=where,day=mode==='day',list=mode==='list';
  const scope=['all','own','friends',...ownIds].includes(where.scope)?where.scope:'all';
  const calendar=useMemo(()=>{
    const selected=(id:string)=>scope==='all'||(scope==='own'?ownIds.includes(id):scope==='friends'?!ownIds.includes(id):id===scope);
    return {days:new Map([...sourceCalendar.days].map(([date,data])=>[date,{sessions:data.sessions.filter(s=>selected(s.row.skaterId)),registrations:data.registrations.filter(r=>selected(r.skaterId))}])),undated:sourceCalendar.undated.filter(r=>selected(r.skaterId))};
  },[sourceCalendar,scope,ownIds]);
  const data=calendar.days.get(date)??empty;
  const lastDate=list?shift(date,6,true):day?date:shift(date.slice(0,7)+'-01',1,false);
  const week=Array.from({length:7},(_,i)=>{const key=shift(date,i,true);return {date:key,data:calendar.days.get(key)??empty};});
  const title=new Intl.DateTimeFormat(locale,(day||list)?{month:'long',day:'numeric',weekday:'short',timeZone:'UTC'}:{month:'long',year:'numeric',timeZone:'UTC'}).format(utcDay(date));
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
  const registrations=list?calendar.undated.filter(r=>r.event.start<=lastDate&&r.event.end>=date):day ? [...data.registrations,...monthsUndated.filter(r=>r.event.start<=date&&r.event.end>=date)] : monthsUndated;
  function showRow(row:ScheduleRow) {
    setDetails(row.id);
    requestAnimationFrame(()=>document.getElementById('calendar-session-detail')?.focus());
  }
  const periodSessions=list?week.flatMap(d=>d.data.sessions):day?visible:[...calendar.days].filter(([key])=>key.slice(0,7)===date.slice(0,7)).flatMap(([,d])=>d.sessions);
  const selectedRow=periodSessions.find(({row})=>row.id===details)?.row;
  const next=periodSessions.filter(s=>s.interval&&s.interval.end>now).sort((a,b)=>a.interval!.start-b.interval!.start)[0];
  const exportCount=periodSessions.filter(s=>s.interval).length;
  function jumpNext(){
    if(!next)return;
    setDetails(next.row.id);
    requestAnimationFrame(()=>{
      const el=document.getElementById('cal-session-'+next.row.id)||document.getElementById('calendar-session-detail');
      el?.scrollIntoView({block:'center'});el?.focus({preventScroll:true});
    });
  }
  async function exportPeriod(){
    setExporting(true);setExportStatus('');
    try{
      const file=calendarExport(periodSessions.map(s=>s.row));
      if(!file.count)return;
      await saveTextFile('HSC-'+date+'.ics',file.content,'text/calendar;charset=utf-8');
      setExportStatus(text('Calendar file prepared. Import it in your calendar app.','日历文件已准备好，请在日历应用中导入。'));
    }catch{setExportStatus(text('Could not export. Please try again.','导出未完成，请重试。'));}
    finally{setExporting(false);}
  }
  const detail=selectedRow&&<div className="cal-detail" tabIndex={-1} id="calendar-session-detail"><strong>{selectedRow.skaterName} · {selectedRow.category}</strong>
    <p>{selectedRow.eventName} · {selectedRow.rink} · {text('Official group time','官方组别时段')} {selectedRow.start}–{selectedRow.end} · {selectedRow.timezone}</p>
    <div className="cal-individual-time"><SessionTiming row={selectedRow} event={events.find(event=>event.id===selectedRow.eventId)}/></div>
    <a href={selectedRow.sourceUrl+(selectedRow.page?'#page='+selectedRow.page:'')} target="_blank" rel="noreferrer">{text('Official group schedule ↗','官方组别赛程 ↗')}</a>
    {selectedRow.startingOrder&&<a href={selectedRow.startingOrder.sourceUrl} target="_blank" rel="noreferrer">{text('Starting order #','官方出场顺序 #')}{selectedRow.startingOrder.startNumber} ↗</a>}</div>;
  const friendLink=({row}:{row:ScheduleRow})=><button key={row.id} onClick={()=>showRow(row)}>{row.skaterName} · {row.activity==='practice'?text('Practice','练习'):text('Group','组别')} {row.start}–{row.end}</button>;
  return <section className="family-calendar" aria-label={summaryTitle}>
    <div className="cal-card">
      <header className="cal-toolbar">
        <div className="cal-date-heading">
          {day&&<button className="cal-month-back" onClick={()=>move(date,'month')}><ChevronLeft size={16}/>{text('Month','月历')}</button>}
          <h2>{title}</h2>
        </div>
        <div className="cal-nav">
          <button aria-label={list?text('Previous 7 days','前7天'):day?text('Previous day','前一天'):text('Previous month','上个月')} onClick={()=>move(shift(date,list?-7:-1,day||list),mode)}><ChevronLeft size={17}/></button>
          <button onClick={()=>move(todayToronto(),mode)}>{text('Today','今天')}</button>
          <button aria-label={list?text('Next 7 days','后7天'):day?text('Next day','后一天'):text('Next month','下个月')} onClick={()=>move(shift(date,list?7:1,day||list),mode)}><ChevronRight size={17}/></button>
        </div>
      </header>
      <div className="cal-options">
        <div className="cal-views" aria-label={text('Calendar view','日历视图')}>
          {(['month','day','list'] as const).map(value=><button key={value} aria-pressed={mode===value} onClick={()=>move(date,value)}>{value==='month'?text('Month view','月视图'):value==='day'?text('Day view','日视图'):text('7-day list','7天列表')}</button>)}
        </div>
        <label className="cal-scope">{text('Show','查看')}<CompactSelect aria-label={text('Skaters in calendar','日历中的选手')} value={scope} onChange={e=>move(date,mode,'',true,e.target.value)}>
          <option value="all">{text('My skaters & friends','我的选手和朋友')}</option><option value="own">{text('My skaters only','仅我的选手')}</option>
          {ownIds.map(id=><option key={id} value={id}>{skaters.find(s=>s.id===id)?.name??id}</option>)}
          <option value="friends">{text('Friends only','仅朋友')}</option>
        </CompactSelect></label>
        <button onClick={jumpNext} disabled={!next}>{text('Next unfinished group','跳到下一未结束组')}</button>
      </div>
      {list ? <div className="cal-week">
        <p>{date} – {lastDate} · {text('Times are local to each rink.','以下时间为各比赛当地时间。')}</p>
        {week.map(({date:key,data})=><section key={key} className="cal-week-day">
          <h3><button onClick={()=>move(key,'day')}>{new Intl.DateTimeFormat(locale,{month:'short',day:'numeric',weekday:'short',timeZone:'UTC'}).format(utcDay(key))}</button></h3>
          {!data.sessions.length&&!data.registrations.length&&<p>{text('No scheduled groups','暂无已排组别')}</p>}
          {[...data.sessions].sort((a,b)=>(a.interval?.start??Infinity)-(b.interval?.start??Infinity)).map(({row,interval})=><button className="cal-list-session" id={'cal-session-'+row.id} key={row.id} onClick={()=>showRow(row)}>
            <strong>{row.skaterName} · {row.category}</strong><span>{row.eventName} · {row.rink}</span>
            <span>{interval?text('Official group time','官方组别时段')+' · '+row.start+'–'+row.end+' · '+row.timezone:text('Group time needs confirmation','组别时段待确认')}</span>
            <SessionTiming row={row} event={events.find(e=>e.id===row.eventId)}/>
          </button>)}
          {data.registrations.map(r=><p key={r.id}>{r.name} · {r.category} · {text('Time to be confirmed','时间待公布')}</p>)}
        </section>)}
      </div> : !day ? <>
        <div className="cal-month">
          <FullCalendar key={date.slice(0,7)} plugins={plugins} locales={locales} locale={locale} initialView="dayGridMonth" timeZone="UTC"
            initialDate={date} now={todayToronto()} headerToolbar={false} height="auto" fixedWeekCount={false}
            navLinks navLinkDayClick={target=>move(isoDay(target),'day')}
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
          <CompactSelect aria-label={text('Ice surface','比赛冰面')} value={rink} onChange={e=>move(date,'day',e.target.value,true)}>
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
              nowIndicator nowIndicatorLineClass="cal-now-line" timeZone={zone} headerToolbar={false} dayHeaders={false} allDaySlot={false} height="auto" slotEventOverlap={false} eventInteractive
              // Leave room for wrapped timing labels in narrow, side-by-side cards.
              // Scale the time grid uniformly so event heights still reflect duration.
              slotMinTime={hour(min)} slotMaxTime={hour(max)} slotDuration="00:15:00" slotHeaderInterval="00:30:00" slotMinHeight={60}
              slotHeaderFormat={{hour:'2-digit',minute:'2-digit',hour12:false}} displayEventTime={false}
              events={timed.map(({row,interval})=>({id:row.id,title:row.skaterName,start:interval!.start,end:interval!.end,
                color:colorFor(row.skaterId,ownIds),extendedProps:{row}}))}
              eventClick={info=>showRow(info.event.extendedProps.row)}
              eventContent={info=>{
                const row=info.event.extendedProps.row as ScheduleRow;
                return <div className="cal-slot" id={'cal-session-'+row.id} tabIndex={-1}>
                  <strong>{row.skaterName}</strong><span>{row.start}–{row.end} · {row.rink||text('Rink pending','冰面待公布')}</span>
                  {row.activity==='practice'&&<small>{text('Practice','官方练习')}</small>}
                  {!ownIds.includes(row.skaterId)&&<small>{text('Friend','本场朋友')}</small>}
                  <SessionTiming compact row={row} event={events.find(e=>e.id===row.eventId)}/>
                </div>;
              }}/>
          </div>;
        })}
        {visible.length===0&&<p className="cal-empty"><CalendarDays size={17}/>{text('No scheduled groups for this selection.','当前选择暂无已排组别。')}</p>}
      </>}
      {detail}
      <div className="cal-export">
        <button onClick={()=>void exportPeriod()} disabled={!exportCount||exporting}>{exporting?text('Preparing…','正在准备…'):text('Export this view (.ics)','导出当前视图 (.ics)')}</button>
        <p>{text('Confirmed group times only. One-time copy, not a subscription; later changes will not update automatically.','仅导出当前视图内已确认的官方组别时段。单次副本，非订阅；后续修改不会自动更新。')}</p>
        <p role="status">{exportStatus}</p>
      </div>
    </div>
    {(day&&pending.length>0||registrations.length>0)&&<section className="cal-pending">
      <h3>{text('Time to be confirmed','时间待公布')}</h3>
      {day&&pending.map(({row})=><p key={row.id}><strong>{row.skaterName}</strong> · {row.category} · {row.eventName}</p>)}
      {registrations.map(r=><p key={r.id}><strong>{r.name}</strong> · {r.category} · {r.event.name} · {text('Rink pending','冰面待公布')}
        {r.event.start!==r.event.end&&<small>{text('Competition dates · ','赛事日期 · ')}{r.event.start} – {r.event.end}</small>}</p>)}
    </section>}
    <CalendarNotice/>
  </section>;
}
