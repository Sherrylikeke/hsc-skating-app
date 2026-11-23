'use client';
import {useEffect,useRef,useState} from 'react';
import {Bell,X} from 'lucide-react';
import {apiFetch} from '../lib/client-platform';
import {text,useLanguage} from '../lib/i18n';
import type {OfficialNotice} from '../lib/official-updates';
import './official-notifications.css';

export default function OfficialNotifications(){
  const locale=useLanguage(),[notices,setNotices]=useState<OfficialNotice[]>([]),[open,setOpen]=useState(false),[error,setError]=useState(false),[busy,setBusy]=useState('');
  const known=useRef(new Set<string>()),requestId=useRef(0),mounted=useRef(true),panel=useRef<HTMLDivElement>(null);
  async function load(){
    const id=++requestId.current;
    try{
      const response=await apiFetch('/api/official-notifications',{cache:'no-store'});
      if(!mounted.current||id!==requestId.current)return;
      if(response.status===401||response.status===403){known.current.clear();setNotices([]);setError(false);return;}
      if(!response.ok)throw Error('unavailable');
      const data=await response.json() as {notifications:OfficialNotice[]};
      if(!mounted.current||id!==requestId.current)return;
      const unread=data.notifications.filter(notice=>!notice.read_at);
      setNotices(unread);
      setError(false);
      const hasNewUpdate=unread.some(notice=>!known.current.has(notice.id));
      known.current=new Set(unread.map(notice=>notice.id));
      if(hasNewUpdate)window.dispatchEvent(new Event('hsc-official-updated'));
    }catch{if(mounted.current&&id===requestId.current)setError(true);}
  }
  useEffect(()=>{mounted.current=true;void load();const refresh=()=>{if(document.visibilityState==='visible')void load();},timer=window.setInterval(refresh,60000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{mounted.current=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[]);
  useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);},outside=(event:PointerEvent)=>{if(panel.current&&!panel.current.contains(event.target as Node))setOpen(false);};document.addEventListener('keydown',close);document.addEventListener('pointerdown',outside);return()=>{document.removeEventListener('keydown',close);document.removeEventListener('pointerdown',outside);};},[open]);
  const unread=notices.length;
  async function read(notice:OfficialNotice){
    setBusy(notice.id);
    try{
      const response=await apiFetch('/api/official-notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:notice.id}),keepalive:true});
      if(!response.ok&&response.status!==404)throw Error('unavailable');
      setNotices(rows=>rows.filter(row=>row.id!==notice.id));
      setError(false);
      void load();
    }catch{setError(true);}finally{setBusy('');}
  }
  const time=(value:string)=>new Intl.DateTimeFormat(locale==='en'?'en-CA':'zh-CN',{timeZone:'America/Toronto',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  return <div className="official-notifications" ref={panel}>
    <button className="official-bell" type="button" aria-label={text('Official updates','官网更新通知')+(unread?' · '+unread:'')} aria-expanded={open}
      aria-controls="official-update-panel" onClick={()=>{setOpen(value=>!value);void load();}}>
      <Bell size={19}/>{unread>0&&<span className="official-badge" aria-live="polite">{unread>99?'99+':unread}</span>}
    </button>
    {open&&<section id="official-update-panel" className="official-update-panel" aria-label={text('Updates for My Skaters','我的选手更新')}>
      <header><h2>{text('My skater updates','我的选手更新')}</h2><button type="button" aria-label={text('Close notifications','关闭通知')} onClick={()=>setOpen(false)}><X size={18}/></button></header>
      <p>{text('Official entries, schedules and results. Times are Eastern (ET).','官方报名、赛程和成绩。时间为东部时间（ET）。')}</p>
      {error&&<p role="status">{text('Could not refresh notifications. Try again.','暂时无法更新通知，请重试。')}</p>}
      {!notices.length&&!error&&<p>{text('No updates for My Skaters yet.','我的选手暂时没有更新。')}</p>}
      <div className="official-update-list">{notices.map(notice=>{
        const {result,removed,scheduleChanged,entryChanged,categories,sessions,skaterName,eventName,eventId,source}=notice.payload;
        const title=result?(result.revised?text('Official result updated','官方成绩已更新'):text('Official result published','官方成绩已发布'))
          :removed?text('Entry removed or changed; check the official source.','官方报名已移除或更改，请核对。')
          :scheduleChanged?text('Official schedule updated','官方赛程已更新')
          :entryChanged?text('Official entry or group updated','官方报名或分组已更新')
          :text('Official event information updated','官方赛事资料已更新');
        return <article key={notice.id} className="unread">
          <small>{time(notice.created_at)} · {text('Unread','未读')}</small>
          <h3>{skaterName} · {eventName}</h3>
          <p>{title}</p>
          {categories.map(category=><div key={category}>{category}</div>)}
          {result?.withdrawn&&<p>{text('Withdrawn','退赛')}</p>}
          {result&&!result.withdrawn&&<p>
            {result.rank!=null&&<span>{text('Place ','名次 ')}{result.rank}</span>}
            {result.rank!=null&&result.totalScore!=null&&' · '}
            {result.totalScore!=null&&<span>{text('Score ','总分 ')}{result.totalScore}</span>}
          </p>}
          {sessions.map((session,index)=><p key={index}>{session.date} · <strong>{session.start}–{session.end} ET</strong><br/>{session.rink} · {session.category}</p>)}
          {!result&&!removed&&!sessions.length&&<p>{text('Your group time is not confirmed yet.','本人的组别时段仍待确认。')}</p>}
          <footer>
            {result?<a href={source} target="_blank" rel="noreferrer" onClick={()=>void read(notice)}>{text('View official results','查看官方成绩')}</a>
              :<a href={'/workspace?view=events&event='+encodeURIComponent(eventId)} onClick={()=>void read(notice)}>{text('View competition','查看比赛')}</a>}
            <button type="button" disabled={!!busy} onClick={()=>void read(notice)}>{text('Mark read','标记已读')}</button>
          </footer>
        </article>;
      })}</div>
    </section>}
  </div>;
}
