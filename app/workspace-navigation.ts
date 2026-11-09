'use client';
import {useLayoutEffect,useState} from 'react';
import type {MouseEvent} from 'react';
import type {HomeScope} from '../lib/home-schedule';
import {text} from '../lib/i18n';

const views=['home','skaters','events','personal','coach','watch','calendar'] as const;
type View=typeof views[number];
type Destination=View|'member'|'profile'|'competition';
const defaults={
  query:'', coachedOnly:false, level:'', eventMode:'upcoming' as 'upcoming'|'history', eventQuery:'',
  coachFiltersOpen:false, coachFilter:'', coachEventFilter:'', dateFilter:'', onlyAssigned:true,
  personal:'mine' as HomeScope, participantMode:'club' as 'club'|'all'|'blocks',
  rink:'',fromNow:true
};
type Filters=typeof defaults;
type Entry={memberId:string;from:Destination|null;filters:Filters;scrollY?:number};
export function followWorkspaceLink(event:MouseEvent<HTMLAnchorElement>,open:(()=>void)|undefined){
  if(!open || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
  event.preventDefault();
  open();
}
function readEntry(memberId:string|undefined):Entry {
  const saved=history.state?.hscWorkspace as Entry|undefined;
  if(memberId && saved?.memberId===memberId)return saved;
  let from:Destination|null=null;
  if(!saved && document.referrer && history.length>1){
    const referrer=new URL(document.referrer);
    if(referrer.origin===location.origin && referrer.pathname==='/')from='member';
  }
  return {memberId:memberId??'',from,filters:defaults};
}
function readRoute(){
  const params=new URLSearchParams(location.search), requested=params.get('view');
  const view=views.find(item=>item===requested)??'personal';
  return {view,skaterId:view==='skaters'?params.get('skater')??'':'',
    eventId:view==='events'||view==='watch'?params.get('event')??'':''};
}
function destinationLabel(destination:Destination){
  const labels:Record<Destination,[string,string]>={
    home:['Back to club overview','返回俱乐部概览'],skaters:['Back to all skaters','返回选手列表'],
    events:['Back to competitions','返回比赛中心'],personal:['Back to personal schedule','返回个人赛程'],
    coach:['Back to coach schedule','返回教练总赛程'],watch:['Back to event watch','返回比赛关注'],
    calendar:['Back to calendar','返回赛程日历'],member:['Back to member workspace','返回会员工作区'],
    profile:['Back to skater profile','返回选手档案'],competition:['Back to competition details','返回比赛详情']
  };
  return text(...labels[destination]);
}

export function useWorkspaceNavigation(memberId:string|undefined){
  const [route,setRoute]=useState({view:'personal' as View,skaterId:'',eventId:''});
  const [entry,setEntry]=useState<Entry>({memberId:'',from:null,filters:defaults});
  useLayoutEffect(()=>{
    let frame=0;
    function restore(){
      const current=readEntry(memberId);
      if(memberId && history.state?.hscWorkspace?.memberId!==memberId)
        history.replaceState({...history.state,hscWorkspace:current},'');
      setRoute(readRoute());setEntry(current);
      cancelAnimationFrame(frame);
      if(memberId && current.scrollY!==undefined){
        const top=current.scrollY;
        frame=requestAnimationFrame(()=>window.scrollTo({top,behavior:'instant'}));
      }
    }
    restore();
    window.addEventListener('popstate',restore);
    return ()=>{window.removeEventListener('popstate',restore);cancelAnimationFrame(frame);};
  },[memberId]);
  function updateFilters(changes:Partial<Filters>){
    const current=readEntry(memberId);
    const next={...current,filters:{...current.filters,...changes}};
    history.replaceState({...history.state,hscWorkspace:next},'');
    setEntry(next);
  }
  function visit(url:string,replace=false,filters=defaults){
    if(location.pathname+location.search===url)return;
    const current=readEntry(memberId);
    const from=route.skaterId?'profile':route.view==='events'&&route.eventId?'competition':route.view;
    let next:Entry;
    if(replace){
      next={...current,filters};
      history.replaceState({...history.state,hscWorkspace:next},'',url);
    }else{
      history.replaceState({...history.state,hscWorkspace:{...current,scrollY:window.scrollY}},'');
      next={memberId:memberId??'',from,filters};
      history.pushState({hscWorkspace:next},'',url);
    }
    setRoute(readRoute());setEntry(next);
    if(!replace)window.scrollTo({top:0,behavior:'instant'});
  }
  function navigate(view:View,id='',replace=false,changes:Partial<Filters>={}){
    const params=new URLSearchParams({view});
    if(id)params.set(view==='skaters'?'skater':'event',id);
    const url='/workspace?'+params;
    if(location.pathname+location.search===url){
      if(view==='personal')updateFilters({personal:'mine'});
      return;
    }
    visit(url,replace,{...defaults,...changes});
  }
  const fallback=route.view==='skaters'?'skaters':route.view==='events'?'events':'personal';
  function back(fallbackFilters:Partial<Filters>={}){
    if(entry.from){history.back();return;}
    navigate(fallback,'',true,fallbackFilters);
    window.scrollTo({top:0,behavior:'instant'});
  }
  return {...route,filters:entry.filters,updateFilters,navigate,visit,back,
    backLabel:destinationLabel(entry.from??fallback)};
}
