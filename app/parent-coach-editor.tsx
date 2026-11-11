'use client';
import {useEffect,useState} from 'react';
import {apiFetch} from '../lib/client-platform';
import {text} from '../lib/i18n';
import CoachNameInput from './coach-name-input';
type Profile={id:string;name:string;coach:string;revision:number};
export default function ParentCoachEditor({skaterId,onClose,onSaved}:{skaterId:string;onClose:()=>void;onSaved:()=>void}){
  const [profile,setProfile]=useState<Profile|null>(null),[coach,setCoach]=useState(''),[names,setNames]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function reload(){setBusy(true);setError('');try{const response=await apiFetch('/api/member?action=parent-coach&skaterId='+encodeURIComponent(skaterId),{cache:'no-store'});const data=await response.json() as {skater:Profile;names:string[];error?:string};if(!response.ok)throw new Error(data.error);setProfile(data.skater);setCoach(data.skater.coach);setNames(data.names);}catch(failure){setError((failure as Error).message);}finally{setBusy(false);}}
  useEffect(()=>{void reload();},[skaterId]);
  return <section className="parent-coach-editor" aria-label={text('Edit my skater’s coaches','编辑孩子的教练')}><h3>{profile?.name} · {text('Coaches','教练')}</h3><p>{text('Update the coaches for your administrator-approved child. This updates the club schedule’s coach label.','修改管理员已确认的孩子教练，同步更新俱乐部赛程中的教练名称。')}</p>
    <form onSubmit={event=>{event.preventDefault();if(!profile||busy)return;setBusy(true);setError('');void (async()=>{try{const response=await apiFetch('/api/member?action=parent-coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({skaterId,coach,revision:profile.revision})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error);onSaved();onClose();}catch(failure){setError((failure as Error).message);}finally{setBusy(false);}})();}}>
    <label>{text('Coach names','教练姓名')}<CoachNameInput value={coach} onChange={setCoach} names={names} disabled={busy||!profile} maxLength={500}/><small>{text('Type a first name to see suggestions. Separate coaches with /.','输入 first name 联想，多位教练用 / 分隔。')}</small></label><button type="submit" disabled={busy||!profile}>{busy?text('Saving…','保存中…'):text('Save coaches','保存教练')}</button><button type="button" disabled={busy} onClick={onClose}>{text('Cancel','取消')}</button></form>{error&&<p role="alert">{error} <button type="button" disabled={busy} onClick={()=>void reload()}>{text('Reload','重新读取')}</button></p>}
  </section>;
}
