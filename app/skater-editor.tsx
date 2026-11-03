'use client';
import {useEffect,useRef,useState} from 'react';
import {apiFetch as fetch} from '../lib/client-platform';
import {text,useLanguage} from '../lib/i18n';
import type {ClubSkater} from '../lib/club-types';
type Editable=ClubSkater&{profileRevision:string|null;coachRevision:number};
export default function SkaterEditor({skater,onClose,onSaved}:{skater:ClubSkater|null;onClose:()=>void;onSaved:(skater:ClubSkater)=>Promise<void>}){
  useLanguage();
  const [name,setName]=useState(skater?.name??''),[coach,setCoach]=useState(skater?.coach??'');
  const [training,setTraining]=useState(skater?.training??true),[pending,setPending]=useState(skater?.identityPending??false);
  const [version,setVersion]=useState<Editable|null>(null),[loading,setLoading]=useState(!!skater),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const dialog=useRef<HTMLElement>(null),first=useRef<HTMLInputElement>(null),busy=useRef(false);
  async function reload(){
    if(!skater)return;setLoading(true);setError('');
    try{const response=await fetch('/api/skaters?id='+encodeURIComponent(skater.id),{cache:'no-store'});const data=await response.json() as {skater:Editable;error?:string};if(!response.ok)throw new Error(data.error||text('Could not load the profile.','无法读取资料。'));setVersion(data.skater);setName(data.skater.name);setCoach(data.skater.coach);setTraining(data.skater.training);setPending(!!data.skater.identityPending);}
    catch(failure){setError((failure as Error).message);}finally{setLoading(false);}
  }
  useEffect(()=>{void reload();const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';first.current?.focus();return()=>{document.body.style.overflow=overflow;previous?.focus();};},[]);
  async function save(event:React.FormEvent){
    event.preventDefault();if(busy.current||loading||(skater&&!version))return;busy.current=true;setSaving(true);setError('');
    try{const response=await fetch('/api/skaters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...(skater?{id:skater.id}:{}),name:name.trim(),coach,training,identityPending:pending,profileRevision:version?.profileRevision??null,coachRevision:version?.coachRevision??0})});const data=await response.json() as {skater:Editable;error?:string};if(!response.ok)throw new Error(data.error||text('Save failed. Your edits are still here.','保存失败，修改仍保留。'));setVersion(data.skater);await onSaved(data.skater);}
    catch(failure){setError((failure as Error).message);}finally{busy.current=false;setSaving(false);}
  }
  return <div className="club-dialog-backdrop club-skater-editor-backdrop" onClick={event=>{if(event.target===event.currentTarget&&!saving)onClose();}}><section ref={dialog} className="club-dialog club-skater-editor" role="dialog" aria-modal="true" aria-labelledby="skater-editor-title" onKeyDown={event=>{
    if(event.key==='Escape'&&!saving){event.stopPropagation();onClose();}
    if(event.key==='Tab'){const items=[...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]')],first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }}>
    <button className="club-dialog-close" aria-label={text('Close skater editor','关闭选手编辑')} disabled={saving} onClick={onClose}>×</button>
    <p className="club-eyebrow">{text('ADMIN · CLUB ROSTER','管理员 · 选手名单')}</p><h2 id="skater-editor-title">{skater?text('Edit skater & coaches','编辑选手及教练'):text('Add skater','新增选手')}</h2>
    <p className="club-editor-help">{text('Save club profile and coach details here. Official competition results remain linked to their sources.','在这里保存俱乐部选手资料和教练信息。官方比赛成绩仍保留原始来源。')}</p>
    {loading&&<p role="status">{text('Loading latest profile…','正在读取最新资料…')}</p>}
    <form onSubmit={event=>void save(event)}>
      <fieldset disabled={loading||saving||!!skater&&!version}>
        <label className="club-field">{text('Skater full name','选手全名')}<input ref={first} name="skaterName" required maxLength={120} value={name} onChange={event=>setName(event.target.value)} autoComplete="off"/></label>
        <label className="club-field">{text('Coaches','负责教练')}<input name="coach" maxLength={500} value={coach} onChange={event=>setCoach(event.target.value)} placeholder="Jen Jackson/Bryce Davidson" autoComplete="off"/><small>{text('Separate multiple coaches with /. Leave empty to clear.','多位教练用 / 分隔；留空可清除。')}</small></label>
        <label className="club-checkbox"><input name="training" type="checkbox" checked={training} onChange={event=>setTraining(event.target.checked)}/>{text('Trains at Hamilton Skating Club','在 Hamilton Skating Club 训练')}</label>
        <label className="club-checkbox"><input name="identityPending" type="checkbox" checked={pending} onChange={event=>setPending(event.target.checked)}/>{text('Full name still needs confirmation','全名仍待确认')}</label>
      </fieldset>
      <p className="club-editor-help">{text('Adding a skater or listing a coach does not grant anyone private account access. Member permissions are approved separately.','新增选手或填写教练姓名不会授予私人账号权限，会员关系需另行审核。')}</p>
      {error&&<div className="club-error" role="alert">{error}{skater&&<button type="button" disabled={saving||loading} onClick={()=>void reload()}>{text('Reload profile','重新读取资料')}</button>}</div>}
      <div className="club-dialog-footer"><button type="button" disabled={saving} onClick={onClose}>{text('Cancel','取消')}</button><button className="primary" type="submit" disabled={loading||saving||!!skater&&!version}>{saving?text('Saving…','保存中…'):text('Save skater','保存选手')}</button></div>
    </form>
  </section></div>;
}
