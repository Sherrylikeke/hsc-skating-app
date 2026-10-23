'use client';
import {apiFetch as fetch} from '../lib/client-platform';
import {useState} from 'react';
import {text,useLanguage} from '../lib/i18n';
import {homeSkaterChoices} from '../lib/home-skater-choices';
import './home-skaters.css';
export default function HomeSkaters({skaters,ownIds,onChange}:{skaters:{id:string;name:string}[];ownIds:string[];onChange:(ids:string[])=>void}) {
  useLanguage();
  const [candidate,setCandidate]=useState(''),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const choices=homeSkaterChoices(skaters,ownIds,query);
  async function save(skaterId:string,pinned:boolean){
    if(busy)return;setBusy(true);setError('');
    try{
      const response=await fetch('/api/member?action=home-skater',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({skaterId,pinned})});
      const result=await response.json() as {preferredSkaterIds:string[];error?:string};
      if(!response.ok)throw new Error(result.error||text('Unable to save. Please retry.','保存失败，请重试。'));
      onChange(result.preferredSkaterIds);setCandidate('');
    }catch(failure){setError((failure as Error).message);}finally{setBusy(false);}
  }
  return <section className="member-panel home-skaters"><h2>{text('My skaters','我的选手')}</h2><p>{text('Add names from the club list to your homepage. These choices only organize official schedules; private access requires separate approval.','把名单内选手加入自己的主页。这些选择只整理官方赛程；私人资料须另行批准。')}</p>
    <ul>{ownIds.map(id=><li key={id}><a href={'/workspace?view=skaters&skater='+encodeURIComponent(id)}>{skaters.find(skater=>skater.id===id)?.name||id}</a>{' '}<button type="button" disabled={busy} onClick={()=>void save(id,false)} aria-label={text('Remove from my homepage: ','从我的主页移除：')+(skaters.find(skater=>skater.id===id)?.name||id)}>{text('Remove','移除')}</button></li>)}</ul>
    {!ownIds.length&&<p>{text('Add your first skater to see their schedules here.','添加第一位选手，即可在这里查看其赛程。')}</p>}
    <form onSubmit={event=>{event.preventDefault();if(candidate&&choices.some(skater=>skater.id===candidate))void save(candidate,true);}}><label>{text('Search by name or skater ID','按姓名或选手编号搜索')}<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setCandidate('');}} disabled={busy} autoComplete="off"/></label><label>{text('Add a listed skater','添加名单内选手')}<select value={candidate} onChange={event=>setCandidate(event.target.value)} disabled={busy||!choices.length}><option value="">{text('Choose a skater','选择选手')}</option>{choices.map(skater=><option key={skater.id} value={skater.id}>{skater.name} · {skater.id}</option>)}</select></label><button type="submit" disabled={busy||!candidate||!choices.some(skater=>skater.id===candidate)}>{text('Add to my homepage','加入我的主页')}</button></form>
    <p role="status">{!skaters.length?text('The skater list is not available yet. Try refreshing this page.','选手名单尚未读取，请尝试刷新页面。'):choices.length?text('Available matches: ','可添加的匹配选手：')+choices.length:query.trim()?text('No matching skaters. Clear the search or try another name or ID.','没有匹配选手，请清空搜索或换用其他姓名、编号。'):text('All available skaters are already on your homepage.','当前名单中的选手已全部加入你的主页。')}</p>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
