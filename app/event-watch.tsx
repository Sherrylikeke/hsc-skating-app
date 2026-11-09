'use client';
import {useEffect,useMemo,useState} from 'react';
import type {ClubEvent,ClubSkater} from '../lib/club-types';
import {friendStorageKey,readFriends,watchChoices,watchedRows,watchTiming} from '../lib/event-watch';
import {text} from '../lib/i18n';
import CompactSelect from './compact-select';
import {followWorkspaceLink} from './workspace-navigation';

type WatchControls={rink:string;fromNow:boolean;onFilter:(changes:{rink?:string;fromNow?:boolean})=>void;onCalendar:()=>void};
type Props = WatchControls & {events:ClubEvent[]; eventId:string; memberId:string; ownIds:string[]; skaters:ClubSkater[]; onEvent:(id:string,replace?:boolean)=>void};
function readValue(key:string) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function localDate(now:number,timezone:string) {
  try { return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
  catch { return ''; }
}

export default function EventWatch({events,eventId,memberId,ownIds,skaters,onEvent,...controls}:Props) {
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{
    const tick=()=>setNow(Date.now());
    const timer=window.setInterval(tick,30_000);
    document.addEventListener('visibilitychange',tick);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',tick);};
  },[]);
  const lastKey='hsc-watch-event:'+memberId;
  const days=new Map<string,string>();
  const todayAt=(event:ClubEvent)=>{
    if(!days.has(event.timezone)) days.set(event.timezone,localDate(now,event.timezone));
    return days.get(event.timezone)!;
  };
  const available=events.filter(e=>e.end>=todayAt(e) || e.id===eventId)
    .sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name));
  const current=available.filter(e=>e.start<=todayAt(e) && e.end>=todayAt(e));
  const preferred=current.length?current:available;
  const event=eventId ? available.find(e=>e.id===eventId) : preferred.find(e=>e.id===readValue(lastKey))
    ?? preferred.find(e=>e.participants.some(p=>p.skaterIds.some(id=>ownIds.includes(id)))) ?? preferred[0];
  useEffect(()=>{
    if (event) try { sessionStorage.setItem(lastKey,event.id); } catch { /* Tab storage is optional. */ }
    if (event && !eventId) onEvent(event.id,true);
  },[lastKey,event?.id,eventId]);
  return <section className="club-panel watch-panel">
    {available.length>1 || !event ? <label className="watch-event-select">{text('Competition','比赛')}
      <CompactSelect aria-label={text('Competition to watch','关注的比赛')} value={event?.id??''} onChange={e=>onEvent(e.target.value)}>
        {!event&&<option value="">{text('Choose an event','选择比赛')}</option>}
        {available.map(e=><option value={e.id} key={e.id}>{e.name} · {e.start}</option>)}
      </CompactSelect></label> : <h2 className="watch-event-name">{event.name}</h2>}
    {event ? <EventTimeline {...controls} key={JSON.stringify([memberId,event.id])} event={event} ownIds={ownIds} skaters={skaters} now={now} refreshClock={()=>setNow(Date.now())}
      storageKey={friendStorageKey(memberId,event.id)}/> :
      <p>{text('No competition available here. Check the competition calendar.','当前没有可查看的比赛，可到比赛中心查看日历。')}</p>}
  </section>;
}

function EventTimeline({event,ownIds,skaters,now,refreshClock,storageKey,rink,fromNow,onFilter,onCalendar}:WatchControls & Pick<Props,'ownIds'|'skaters'>&{event:ClubEvent;now:number;refreshClock:()=>void;storageKey:string}) {
  const [friends,setFriends]=useState(()=>readFriends(storageKey));
  const [query,setQuery]=useState('');
  const [choosing,setChoosing]=useState(false);
  const [saveFailed,setSaveFailed]=useState(false);
  const choices=useMemo(()=>watchChoices(event,skaters),[event,skaters]);
  const own=new Set(ownIds);
  const selectedFriends=choices.filter(c=>!own.has(c.id)&&friends.includes(c.id));
  const search=query.trim().toLocaleLowerCase();
  const visibleChoices=choosing ? choices.filter(c=>!own.has(c.id)&&[c.name,...c.details].some(s=>s.toLocaleLowerCase().includes(search))) : [];
  const selected=useMemo(()=>new Set([...ownIds,...friends]),[ownIds,friends]);
  const watched=useMemo(()=>watchedRows(event,skaters,selected),[event,skaters,selected]);
  const today=localDate(now,event.timezone);
  const day=today<event.start?event.start:today;
  const rinks=[...new Set(event.blocks.map(b=>b.rink).filter(Boolean))].sort();
  const activeRink=rinks.includes(rink)?rink:'';
  const ranked=watched.filter(row=>(!fromNow || !day || row.date===day) && (!activeRink || row.rink===activeRink || row.candidates?.some(c=>c.rink===activeRink)))
    .map(row=>({row,status:watchTiming(row,now)}))
    .filter(({status})=>!fromNow || status!=='ended')
    .sort((a,b)=>a.row.date.localeCompare(b.row.date)||Number(a.status==='pending')-Number(b.status==='pending')||
      a.row.start.localeCompare(b.row.start)||a.row.skaterName.localeCompare(b.row.skaterName));
  const missing=choices.filter(c=>selected.has(c.id)&&!watched.some(row=>row.skaterId===c.id));
  function toggle(id:string) {
    const next=friends.includes(id)?friends.filter(friend=>friend!==id):[...friends,id];
    setFriends(next);
    try { sessionStorage.setItem(storageKey,JSON.stringify(next));setSaveFailed(false); } catch { setSaveFailed(true); }
  }
  return <>
    <details className="watch-friends" onToggle={e=>{setChoosing(e.currentTarget.open);if(!e.currentTarget.open)setQuery('');}}>
      <summary>{text('Follow friends at this event','关注本场朋友')} · {selectedFriends.length}</summary>
      <p>{text('Your home skaters are included. Friend selections stay in this tab for this event.','已包含主页选手。朋友只保存在当前标签页的这场比赛中。')}</p>
      <input type="search" aria-label={text('Search entries','搜索参赛名单')} placeholder={text('Name, club or category','姓名、俱乐部或项目')} value={query} onChange={e=>setQuery(e.target.value)}/>
      <div className="watch-choices">{visibleChoices.map(c=><label key={c.id}>
        <input type="checkbox" checked={friends.includes(c.id)} onChange={()=>toggle(c.id)}/>
        <span><strong>{c.name}</strong><small>{c.details.join(' / ')}</small></span></label>)}
        {!visibleChoices.length&&<p>{text('No matching entries.','暂无匹配的参赛者。')}</p>}</div>
    </details>
    {saveFailed&&<p role="status">{text('This selection is available until you leave this view.','当前选择可用至离开本页面。')}</p>}
    <div className="watch-toolbar">
      <div className="watch-mode"><button type="button" aria-pressed={fromNow} onClick={()=>{onFilter({fromNow:true});refreshClock();}}>{text('From now','从现在看')}</button>
        <button type="button" aria-pressed={!fromNow} onClick={()=>onFilter({fromNow:false})}>{text('Whole event','整场比赛')}</button></div>
      {rinks.length>0&&<CompactSelect aria-label={text('Ice surface','比赛冰面')} value={activeRink} onChange={e=>onFilter({rink:e.target.value})}>
        <option value="">{text('All rinks','所有冰面')}</option>{rinks.map(r=><option key={r}>{r}</option>)}
      </CompactSelect>}
    </div>
    <p className="watch-date">{fromNow ? day : event.start+(event.end===event.start?'':' – '+event.end)} · {event.timezone || text('Time zone pending','时区待公布')}</p>
    {ranked.length>0?<ol className="watch-timeline">{ranked.map(({row,status})=><li key={row.id}>
      <div className="watch-person"><strong>{row.skaterName}</strong><b>{row.uncertain&&row.rink&&text('Possible rink · ','候选冰面 · ')}{row.rink||text('Rink pending','冰面待公布')}</b></div>
      <div>{row.category}{row.activity==='practice'&&' · '+text('Practice','练习')}</div>
      <div className={'watch-time '+status}>{!fromNow&&row.date+' · '}{status==='pending'?text('Group time pending','组别时段待确认'):
        <>{status==='ongoing'?text('Group in progress','组别进行中'):status==='ended'?text('Group ended','组别已结束'):text('Group time','组别时间')} · {row.start}–{row.end}</>}</div>
      <small>{row.startingOrder && <>{text('Start #','出场 #')}{row.startingOrder.startNumber}
        {row.startingOrder.warmupGroup!=null&&' · '+text('Warm-up ','热身组 ')+row.startingOrder.warmupGroup} · </>}
        {row.startingOrder?.individualTime?text('Official individual time · ','官方个人时间 · ')+row.startingOrder.individualTime:text('Individual time pending','个人时间待公布')}</small>
    </li>)}</ol>:<p className="watch-empty">{fromNow?text('No remaining groups in this selection for this day.','所选名单和冰面在这一天暂无接下来的组别。'):text('No groups match this selection.','当前选择暂无对应组别。')}</p>}
    {missing.length>0&&<p>{text('Awaiting a matched group time: ','尚待匹配组别时段：')}{missing.map(c=>c.name).join('、')}</p>}
    {event.needsReview&&<p>{text('Some official details are awaiting confirmation.','部分官方资料待核对。')}</p>}
    <a className="club-source" href={event.url} target="_blank" rel="noreferrer">{text('Official event details ↗','赛事官网 ↗')}</a>
    <a className="cal-entry" href="/workspace?view=calendar" onClick={e=>followWorkspaceLink(e,onCalendar)}>{text('Schedule calendar','赛程日历')}</a>
  </>;
}
