'use client';
import {useEffect,useState} from 'react';
import type {ClubEvent,ClubSkater} from '../lib/club-types';
import {todayToronto} from '../lib/club-types';
import {homeEventCards} from '../lib/event-registration';
import {text} from '../lib/i18n';
import './home-events.css';

export default function HomeEvents({events,skaters,ownIds,onEvent}:{events:ClubEvent[];skaters:ClubSkater[];ownIds:string[];onEvent?:(id:string)=>void}){
  const [today,setToday]=useState(todayToronto);
  useEffect(()=>{const refresh=()=>setToday(todayToronto());const timer=window.setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[]);
  const cards=homeEventCards(events,skaters,ownIds,today);
  return <section className="home-events" aria-labelledby="home-events-title">
    <div className="home-events-heading"><h2 id="home-events-title">{text('Upcoming for my skaters','我的选手 · 接下来的比赛')}</h2><p>{text('Competitions & registration dates','比赛及报名日期')}</p></div>
    {!cards.length&&<p className="home-events-empty">{ownIds.length?text('No upcoming entries or registration dates for your skaters have been published yet.','暂未发现与你的选手相关的比赛名单或近期报名日期。'):text('Add My Skaters to see their competitions and registration dates.','添加 My Skaters 后，可在这里查看相关比赛与报名日期。')}</p>}
    <div className="home-event-grid">{cards.map(({event,entered,matching,windows})=><article className="home-event" key={event.id}>
      <span className="home-event-kind">{entered.length?text('On the official / interim list','已列入官方／临时名单'):text('Registration reminder','报名提醒')}</span>
      <h3><a href={'/workspace?view=events&event='+encodeURIComponent(event.id)} onClick={onEvent?e=>{e.preventDefault();onEvent(event.id);}:undefined}>{event.name}</a></h3>
      <p className="home-event-date">{event.start}{event.end&&event.end!==event.start?' — '+event.end:''}</p>
      {(event.venue||event.city)&&<p>{[event.venue,event.city].filter(Boolean).join(' · ')}</p>}
      <p className="home-event-skaters">{(entered.length?entered:matching).map(skater=>skater.name).join(' · ')}</p>
      {entered.length>0&&!event.blocks.length&&<p>{text('Schedule to be published','赛程待公布')}</p>}
      {windows.map(window=><div className="home-registration" key={window.kind+window.opens}>
        <strong>{window.kind==='assigned'?text('Assigned athlete registration','指定选手提前报名'):text('Public registration','公开报名')}</strong>
        <span>{text('Opens: ','开放日期：')}{window.opens}{window.closes&&<>{text(' · Closes: ',' · 截止日期：')}{window.closes}</>}</span>
        <a className="home-register-link" href={window.url} target="_blank" rel="noreferrer">{text('Open SkateReg / Uplifter ↗','前往 SkateReg / Uplifter ↗')}</a>
      </div>)}
      <div className="home-event-links"><a href={'/workspace?view=events&event='+encodeURIComponent(event.id)} onClick={onEvent?e=>{e.preventDefault();onEvent(event.id);}:undefined}>{text('Entries & schedule','名单与赛程')}</a><a href={event.url} target="_blank" rel="noreferrer">{text('Skate Ontario event details ↗','Skate Ontario 赛事详情 ↗')}</a></div>
    </article>)}</div>
  </section>;
}
