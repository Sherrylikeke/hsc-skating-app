'use client';
import {useEffect,useState} from 'react';
import type {ClubEvent,ClubSkater} from '../lib/club-types';
import {todayToronto} from '../lib/club-types';
import {futureRegistrationEvents,registrationBoardCards,registrationStatuses} from '../lib/registration-board';
import type {RegistrationPlan,RegistrationStatus} from '../lib/registration-board';
import {registrationLink,validRegistrationTime} from '../lib/event-registration';
import {apiFetch} from '../lib/client-platform';
import {readMemberResponse} from '../lib/member-client';
import {text,useLanguage} from '../lib/i18n';
import CompactSelect from './compact-select';
import SourceFreshness from './source-freshness';
import './registration-board.css';

type Props={events:ClubEvent[];skaters:ClubSkater[];ownIds:string[];memberId:string;onNavigate:(url:string,replace:boolean)=>void};
const statusLabel=(status:RegistrationStatus)=>({
  considering:text('Considering','考虑报名'),submitted:text('Submitted','已提交'),
  waitlisted:text('Waitlisted','候补中'),'not-attending':text('Not attending','不参加'),
})[status];
const phaseDate=(date:string|undefined,time:string|undefined)=>date?date+(validRegistrationTime(time)?' '+time+' ET':''):text('Not published','未公布');

export default function RegistrationBoard(props:Props) {
  return <Board key={props.memberId} {...props}/>;
}
function Board({events,skaters,ownIds,onNavigate}:Props) {
  useLanguage();
  const [plans,setPlans]=useState<RegistrationPlan[]>([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
  const [retry,setRetry]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[saveError,setSaveError]=useState('');
  const [selectedSkater,setSelectedSkater]=useState(''),[selectedEvent,setSelectedEvent]=useState(''),[scope,setScope]=useState('all');
  const ownKey=JSON.stringify(ownIds);
  useEffect(()=>{
    let active=true;
    setLoading(true);setLoadError('');
    void apiFetch('/api/registrations',{cache:'no-store'})
      .then(response=>readMemberResponse<{plans:RegistrationPlan[]}>(response,text('Could not load your plans. Please retry.','个人报名计划读取失败，请重试。')))
      .then(value=>{if(active)setPlans(value.plans);})
      .catch(error=>{if(active)setLoadError(error instanceof Error?error.message:text('Could not load your plans.','个人报名计划读取失败。'));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[ownKey,retry]);
  const today=todayToronto(),future=futureRegistrationEvents(events,today),mine=skaters.filter(skater=>ownIds.includes(skater.id));
  const skaterId=mine.some(skater=>skater.id===selectedSkater)?selectedSkater:mine[0]?.id??'';
  const availableEvents=future.filter(event=>!plans.some(plan=>plan.skaterId===skaterId&&plan.eventId===event.id));
  const eventId=availableEvents.some(event=>event.id===selectedEvent)?selectedEvent:'';
  const selectedScope=ownIds.includes(scope)?scope:'all';
  const cards=registrationBoardCards(events,skaters,ownIds,plans,today,Date.now())
    .map(card=>({...card,rows:card.rows.filter(row=>selectedScope==='all'||row.skater.id===selectedScope)})).filter(card=>card.rows.length);
  const disabled=busy||loading||!!loadError;
  async function save(skaterId:string,eventId:string,status:RegistrationStatus|null) {
    setBusy(true);setMessage('');setSaveError('');
    try {
      const response=await apiFetch('/api/registrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({skaterId,eventId,status})});
      const {plan}=await readMemberResponse<{plan:RegistrationPlan|null}>(response,text('Could not save. Please retry.','保存失败，请重试。'));
      setPlans(previous=>[...previous.filter(row=>row.skaterId!==skaterId||row.eventId!==eventId),...(plan?[plan]:[])]);
      setMessage(text('Your plan was saved. Official registration is unchanged.','个人计划已保存，官方报名状态不变。'));
      if(status==='considering')setSelectedEvent('');
    }catch(error){setSaveError(error instanceof Error?error.message:text('Could not save. Please retry.','保存失败，请重试。'));}
    finally{setBusy(false);}
  }
  return <section className="registration-board" aria-label={text('My registrations','个人报名看板')}>
    <header className="reg-heading"><h2>{text('My registrations','个人报名看板')}</h2>
      <p>{text('Keep a separate plan for each of My Skaters. These notes are private to your account; submitting here does not register anyone with the organizer.','为 My Skaters 中每位选手分别记录计划，仅本账号可见；在此记录“已提交”不会向主办方报名。')}</p>
    </header>
    {mine.length===0?<div className="reg-empty"><p>{text('Add a skater to My Skaters to start planning.','请先在 My Skaters 添加选手，再记录报名计划。')}</p><button type="button" onClick={()=>onNavigate('/workspace?view=personal',false)}>{text('Go to My Skaters','前往 My Skaters')}</button></div>:<>
      <form className="reg-add" onSubmit={event=>{event.preventDefault();if(skaterId&&eventId)void save(skaterId,eventId,'considering');}}>
        <h3>{text('Plan another event','手动添加赛事计划')}</h3>
        <label>{text('Skater','选手')}<CompactSelect aria-label={text('Skater for this plan','本计划的选手')} value={skaterId} disabled={disabled} onChange={event=>setSelectedSkater(event.target.value)}>{mine.map(skater=><option key={skater.id} value={skater.id}>{skater.name}</option>)}</CompactSelect></label>
        <label className="reg-event-picker">{text('Current or upcoming event','当前或未来赛事')}<CompactSelect aria-label={text('Event for this plan','本计划的赛事')} value={eventId} disabled={disabled} onChange={event=>setSelectedEvent(event.target.value)}><option value="">{text('Choose an event…','选择赛事…')}</option>{availableEvents.map(event=><option key={event.id} value={event.id}>{event.start} · {event.name}</option>)}</CompactSelect></label>
        <button type="submit" disabled={disabled||!skaterId||!eventId}>{text('Add as considering','添加为考虑报名')}</button>
        <p>{text('All current and upcoming events are available here. Check the organizer’s eligibility and registration rules.','可选择全部当前或未来赛事，请自行核对主办方报名资格与规则。')}</p>
      </form>
      {mine.length>1&&<label className="reg-scope">{text('Show','查看')}<CompactSelect aria-label={text('Skaters on registration board','报名看板中的选手')} value={selectedScope} onChange={event=>setScope(event.target.value)}><option value="all">{text('All my skaters','我的全部选手')}</option>{mine.map(skater=><option key={skater.id} value={skater.id}>{skater.name}</option>)}</CompactSelect></label>}
      {loading&&<p role="status">{text('Loading your plans…','正在读取个人计划…')}</p>}
      {loadError&&<div className="reg-error" role="alert"><p>{loadError}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>{text('Retry','重试')}</button></div>}
      {saveError&&<p className="reg-error" role="alert">{saveError}</p>}<p className="reg-message" role="status">{message}</p>
      {!loading&&!loadError&&!cards.length&&<p className="reg-empty">{text('No recommendations or recorded plans for this selection. You can add any upcoming event above.','当前选择暂无推荐或已记录计划，可在上方手动添加未来赛事。')}</p>}
      {cards.map(({event,rows})=><article className="reg-event" key={event.id}>
        <header><h3>{event.name}</h3><p>{event.start}{event.end!==event.start&&' – '+event.end}{event.city&&' · '+event.city}</p>
          <div className="reg-links"><a href={event.url} target="_blank" rel="noreferrer">{text('Official event ↗','官方赛事 ↗')}</a><button type="button" onClick={()=>onNavigate('/workspace?'+new URLSearchParams({view:'events',event:event.id}),false)}>{text('View event schedule','查看赛事赛程')}</button></div>
          <SourceFreshness status={event.sourceStatus}/>
        </header>
        {!!event.registrations?.length&&<div className="reg-windows">{event.registrations.map(window=><p key={window.kind}><strong>{window.kind==='assigned'?text('Assigned registration','Assigned 报名'):text('Public registration','公开报名')}</strong><span>{phaseDate(window.opens,window.opensTime)} – {phaseDate(window.closes,window.closesTime)}</span>{registrationLink(window.url)&&<a href={registrationLink(window.url)!} target="_blank" rel="noreferrer">{text('Registration portal ↗','报名入口 ↗')}</a>}</p>)}{event.registrations.some(window=>window.kind==='assigned')&&<small>{text('Assigned registration is for allocated or invited skaters. A recommendation does not confirm an allocation.','Assigned 仅供分配或受邀选手使用；推荐不代表本人已获名额。')}</small>}</div>}
        <div className="reg-skaters">{rows.map(({skater,plan,entries,suggested})=><section className="reg-skater" key={skater.id}>
          <div className="reg-skater-heading"><h4>{skater.name}</h4>{suggested&&<span className="reg-suggested">{text('Recommended','报名推荐')}</span>}</div>
          <div className={'reg-official'+(entries.length?' reg-listed':'')}><strong>{text('Official / Interim list','官方 / Interim 名单')}</strong><span>{entries.length?text('Listed','已列入名单'):text('Not found in the current imported list','当前已导入名单中未找到')}</span>{entries.length>0&&<small>{[...new Set(entries.map(entry=>entry.category))].join(' · ')}</small>}{entries[0]&&<a href={entries[0].sourceUrl} target="_blank" rel="noreferrer">{text('Official list ↗','官方名单 ↗')}</a>}</div>
          <label className="reg-personal">{text('My plan','我的个人计划')}<CompactSelect aria-label={text('Personal plan for ','个人计划：')+skater.name+' · '+event.name} value={plan?.status??''} disabled={disabled} onChange={change=>void save(skater.id,event.id,change.target.value?change.target.value as RegistrationStatus:null)}><option value="">{text('No plan recorded','未记录计划')}</option>{registrationStatuses.map(status=><option key={status} value={status}>{statusLabel(status)}</option>)}</CompactSelect></label>
        </section>)}</div>
        {event.needsReview&&!event.sourceStatus?.needsReview&&<p className="reg-review">{text('Some official details need confirmation. Check the official source for updates.','部分官方资料待核对，请查看官方来源更新。')}</p>}
      </article>)}
    </>}
  </section>;
}
