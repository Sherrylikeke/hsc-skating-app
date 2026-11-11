'use client';
import {useEffect,useState} from 'react';
import type {ClubSkater} from '../lib/club-types';
import type {Member} from '../lib/member-access';
import {apiFetch} from '../lib/client-platform';
import {text} from '../lib/i18n';
import SkaterEditor from './skater-editor';
import './registered-parents.css';
import './skater-editor.css';

export type RegisteredParent=Member&{email_verified?:number|null;created_at?:string};
export type ParentHome={memberId:string;skaterIds:string[];revision:string|null};
type Props={members:RegisteredParent[];homes:ParentHome[];skaters:ClubSkater[];onRefresh:()=>Promise<unknown>};
export default function RegisteredParents({members,homes,skaters,onRefresh}:Props){
  const [query,setQuery]=useState(''),[memberId,setMemberId]=useState(''),[skaterQuery,setSkaterQuery]=useState('');
  const [ids,setIds]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  const [editing,setEditing]=useState<ClubSkater|null|undefined>(undefined);
  const parents=members.filter(member=>member.role==='parent'||!member.role&&member.requested_role==='parent');
  const target=parents.find(parent=>parent.id===memberId),home=homes.find(home=>home.memberId===memberId);
  useEffect(()=>{setIds(home?.skaterIds??[]);setError('');},[memberId,home?.revision]);
  useEffect(()=>{setSaved(false);},[memberId]);
  const visible=parents.filter(parent=>[parent.name,parent.email,...(homes.find(home=>home.memberId===parent.id)?.skaterIds??[]).map(id=>skaters.find(skater=>skater.id===id)?.name??'')].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const choices=skaters.filter(skater=>skater.name.toLowerCase().includes(skaterQuery.trim().toLowerCase())).sort((a,b)=>Number(ids.includes(b.id))-Number(ids.includes(a.id))||a.name.localeCompare(b.name));
  async function save(){
    if(!target||!home||busy)return;setBusy(true);setError('');setSaved(false);
    try{const response=await apiFetch('/api/member?action=parent-home-skaters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({memberId:target.id,skaterIds:ids,revision:home.revision})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||text('Save failed.','保存失败。'));await onRefresh();setSaved(true);}
    catch(failure){setError((failure as Error).message);}finally{setBusy(false);}
  }
  return <section className="member-panel registered-parents" id="registered-parents">
    <h2>{text('Registered parents','已注册家长')} · {parents.length}</h2>
    <p>{text('Parents can add or remove their homepage skaters themselves. You can help here and edit the skaters’ coach details.','家长可以自行添加、移除主页选手；你也可以在这里协助，并修改选手及教练资料。')}</p>
    <label>{text('Find a parent or skater','查找家长或选手')}<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={text('Name, email or skater','姓名、邮箱或选手')}/></label>
    <div className="parent-account-list">{visible.map(parent=><button key={parent.id} type="button" className={memberId===parent.id?'selected':''} aria-pressed={memberId===parent.id} onClick={()=>setMemberId(parent.id)}>
      <strong>{parent.name}</strong><span>{parent.email}</span><small>{parent.email_verified===1?text('Email verified','邮箱已验证'):parent.email_verified===0?text('Email not verified','邮箱待验证'):text('Linked account','关联账号')} · {parent.status==='active'?text('Approved','已批准'):parent.status==='disabled'?text('Disabled','已停用'):text('Shared schedules','共享赛程')}</small>
      <small>{(homes.find(home=>home.memberId===parent.id)?.skaterIds??[]).map(id=>skaters.find(skater=>skater.id===id)?.name??id).join(' / ')||text('No homepage skaters','尚未添加主页选手')}</small>
    </button>)}</div>
    {!visible.length&&<p>{text('No matching parent accounts.','没有匹配的家长账号。')}</p>}
    {target&&home&&<div className="parent-skater-settings">
      <h3>{target.name} · {text('Homepage skaters','主页选手')}</h3>
      <p>{text('These choices organize shared schedules. Approved private relationships remain separate.','这些选择用于整理共享赛程，已批准的私人关系单独管理。')}</p>
      <label>{text('Find a skater to add','查找要添加的选手')}<input type="search" value={skaterQuery} onChange={event=>setSkaterQuery(event.target.value)}/></label>
      <fieldset disabled={busy||target.status==='disabled'}><legend>{text('Choose or remove skaters','添加或移除选手')}</legend><div className="parent-skater-choices">{choices.map(skater=><label key={skater.id}><input type="checkbox" checked={ids.includes(skater.id)} onChange={event=>{setSaved(false);setIds(previous=>event.target.checked?[...previous,skater.id]:previous.filter(id=>id!==skater.id));}}/>{skater.name}</label>)}</div></fieldset>
      <div className="member-actions"><button type="button" className="primary" disabled={busy||target.status==='disabled'} onClick={()=>void save()}>{busy?text('Saving…','保存中…'):text('Save parent’s skaters','保存家长的主页选手')}</button><button type="button" disabled={busy} onClick={()=>{setIds(home.skaterIds);setError('');setSaved(false);void onRefresh().catch(failure=>setError((failure as Error).message));}}>{text('Reload saved skaters','重新读取已保存选手')}</button></div>
      {saved&&<p role="status">{text('Saved. The parent can still add or remove skaters themselves.','已保存，家长仍可自行添加或移除选手。')}</p>}
      {error&&<p role="alert">{error}</p>}
      <h3>{text('Skater profiles & coaches','选手资料与教练')}</h3>
      <p>{text('Coach details belong to the club skater profile and appear for all families. Editing them does not grant coach account permissions.','教练信息属于俱乐部选手资料，其他家庭也会看到更新；填写教练姓名不会授予教练账号权限。')}</p>
      {skaters.filter(skater=>ids.includes(skater.id)).map(skater=><div className="parent-skater-profile" key={skater.id}><span><strong>{skater.name}</strong><small>{skater.coach||text('Coach unassigned','尚未填写教练')}</small></span><button type="button" disabled={busy} onClick={()=>setEditing(skater)}>{text('Edit skater & coaches','编辑选手及教练')}</button></div>)}
      <button type="button" disabled={busy} onClick={()=>setEditing(null)}>{text('Add a new club skater','新增俱乐部选手')}</button>
    </div>}
    {editing!==undefined&&<SkaterEditor skater={editing} onClose={()=>setEditing(undefined)} onSaved={async skater=>{if(editing===null)setIds(previous=>[...new Set([...previous,skater.id])]);setEditing(undefined);await onRefresh();}}/>}
  </section>;
}
