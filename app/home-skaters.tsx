'use client';
import {apiFetch as fetch} from '../lib/client-platform';
import {useState} from 'react';
import {text,useLanguage} from '../lib/i18n';
import {homeSkaterChoices} from '../lib/home-skater-choices';
import {followWorkspaceLink} from './workspace-navigation';
import './home-skaters.css';
import ParentCoachEditor from './parent-coach-editor';
export default function HomeSkaters({skaters,ownIds,onChange,onSkater,limit,editableIds=[],onCoachChange}:{onSkater?:(id:string)=>void;skaters:{id:string;name:string}[];ownIds:string[];onChange:(ids:string[])=>void;limit?:number;editableIds?:string[];onCoachChange?:()=>void}) {
  useLanguage();
  const [initiallyOpen] = useState(ownIds.length === 0);
  const [candidate,setCandidate]=useState(''),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [saved,setSaved]=useState<{name:string;pinned:boolean}|null>(null);
  const [replacing,setReplacing]=useState(''),[editing,setEditing]=useState(''),[coachSaved,setCoachSaved]=useState(false);
  const choices=homeSkaterChoices(skaters,ownIds,query);
  async function save(skaterId:string,pinned:boolean){
    if(busy)return;setBusy(true);setError('');setSaved(null);
    try{
      const response=await fetch('/api/member?action=home-skater',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({skaterId,pinned,...(pinned&&replacing?{replaceSkaterId:replacing}:{})})});
      const result=await response.json() as {preferredSkaterIds:string[];error?:string};
      if(!response.ok)throw new Error(result.error||text('Unable to save. Please retry.','保存失败，请重试。'));
      onChange(result.preferredSkaterIds);setCandidate('');setReplacing('');
      if(pinned)setQuery('');
      setSaved({name:skaters.find(skater=>skater.id===skaterId)?.name||skaterId,pinned});
    }catch(failure){setError((failure as Error).message);}finally{setBusy(false);}
  }
  const confirmation=saved&&(saved.pinned
    ? text(`${saved.name} was added to your homepage.`,`已将 ${saved.name} 加入你的主页。`)
    : text(`${saved.name} was removed from your homepage.`,`已从你的主页移除 ${saved.name}。`));
  return <details className="member-panel home-skaters" open={initiallyOpen}>
    <summary>{text('Manage my skaters','管理我的选手')} ({ownIds.length}{limit?'/'+limit:''})</summary>
    <p>{text('Add names from the club list to your homepage. These choices only organize official schedules; private access requires separate approval.','把名单内选手加入自己的主页。这些选择只整理官方赛程；私人资料须另行批准。')}</p>
    {limit&&<p>{text('Up to 4 skaters. Use Change skater to replace a selection, including when all four places are used.','最多4位选手。可用“更换选手”直接替换，满4位时也可操作。')}</p>}
    <ul>{ownIds.map(id=><li key={id}><a onClick={event=>followWorkspaceLink(event,onSkater?()=>onSkater(id):undefined)} href={'/workspace?view=skaters&skater='+encodeURIComponent(id)}>{skaters.find(skater=>skater.id===id)?.name||id}</a><span className="home-skater-actions"><button type="button" disabled={busy} onClick={()=>{setReplacing(id);setCandidate('');setQuery('');setSaved(null);}}>{text('Change skater','更换选手')}</button>{editableIds.includes(id)&&<button type="button" disabled={busy} onClick={()=>{setEditing(id);setCoachSaved(false);}}>{text('Edit coaches','编辑教练')}</button>}<button type="button" disabled={busy} onClick={()=>void save(id,false)} aria-label={text('Remove from my homepage: ','从我的主页移除：')+(skaters.find(skater=>skater.id===id)?.name||id)}>{text('Remove','移除')}</button></span></li>)}</ul>
    {!ownIds.length&&<p>{text('Add your first skater to see their schedules here.','添加第一位选手，即可在这里查看其赛程。')}</p>}
    {replacing&&<p role="status">{text('Replacing: ','将替换：')}{skaters.find(skater=>skater.id===replacing)?.name} <button type="button" onClick={()=>setReplacing('')}>{text('Cancel replacement','取消更换')}</button></p>}
    <form onSubmit={event=>{event.preventDefault();if(candidate&&choices.some(skater=>skater.id===candidate))void save(candidate,true);}}><label>{text('Search by name or skater ID','按姓名或选手编号搜索')}<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setCandidate('');setSaved(null);}} disabled={busy} autoComplete="off"/></label><label>{text('Choose a listed skater','选择名单内选手')}<select value={candidate} onChange={event=>{setCandidate(event.target.value);setSaved(null);}} disabled={busy||!choices.length}><option value="">{text('Choose a skater','选择选手')}</option>{choices.map(skater=><option key={skater.id} value={skater.id}>{skater.name} · {skater.id}</option>)}</select></label><button type="submit" disabled={busy||!candidate||!choices.some(skater=>skater.id===candidate)||!!limit&&ownIds.length>=limit&&!replacing}>{replacing?text('Replace this skater','确认更换选手'):text('Add to my homepage','加入我的主页')}</button></form>
    {limit&&ownIds.length>=limit&&!replacing&&<p>{text('All 4 places are used. Change or remove a skater to choose someone else.','已添加4位，请先更换或移除选手。')}</p>}
    {editing&&<ParentCoachEditor key={editing} skaterId={editing} onClose={()=>setEditing('')} onSaved={()=>{setCoachSaved(true);onCoachChange?.();}}/>}
    {coachSaved&&<p role="status">{text('Coach details saved.','教练资料已保存。')}</p>}
    <p role="status">{confirmation||(!skaters.length?text('The skater list is not available yet. Try refreshing this page.','选手名单尚未读取，请尝试刷新页面。'):choices.length?text('Available matches: ','可添加的匹配选手：')+choices.length:query.trim()?text('No matching skaters. Clear the search or try another name or ID.','没有匹配选手，请清空搜索或换用其他姓名、编号。'):text('All available skaters are already on your homepage.','当前名单中的选手已全部加入你的主页。'))}</p>
    {error&&<p role="alert">{error}</p>}
  </details>;
}
