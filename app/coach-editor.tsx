'use client';
import {apiFetch as fetch,saveTextFile} from '../lib/client-platform';
import {translate,text,useLanguage,LanguageSwitch} from '../lib/i18n';

import { useEffect, useRef, useState } from 'react';
import { planPaste } from './paste';
import CoachNameInput from './coach-name-input';
import {useRevalidateRestoredPage} from './workspace-navigation';

type Row={id:string;name:string;coach:string;training:boolean;identityPending?:boolean;revision:number};
type Change={id:string;coach:string};
const DRAFT='hsc-coach-drafts-v1';

export default function CoachEditor(){
  useLanguage();
  useRevalidateRestoredPage();
  const [rows,setRows]=useState<Row[]>([]);
  const [coachNames,setCoachNames]=useState<string[]>([]);
  const [query,setQuery]=useState('');
  const [onlyEmpty,setOnlyEmpty]=useState(false);
  const [phase,setPhase]=useState<'loading'|'ready'|'saving'|'error'|'login'>('loading');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [modal,setModal]=useState(false);
  const [bulk,setBulk]=useState('');
  const [pasteError,setPasteError]=useState('');
  const [active,setActive]=useState('');
  const [undo,setUndo]=useState<Change[]|null>(null);
  const current=useRef<Row[]>([]);
  const versions=useRef(new Map<string,number>());
  const pending=useRef(new Map<string,string>());
  const inFlight=useRef(new Map<string,string>());
  const busy=useRef(false);
  const blocked=useRef(false);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const inputs=useRef(new Map<string,HTMLInputElement>());
  const flushRef=useRef<()=>Promise<void>>(async()=>{});
  const persistDraft=()=>{try{localStorage.setItem(DRAFT,JSON.stringify(Object.fromEntries([...inFlight.current,...pending.current])));}catch{/* Cloud persistence still works without browser storage. */}};
  const schedule=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>void flushRef.current(),550);};

  async function load(){
    setPhase('loading');setError('');
    try{
      const response=await fetch('/api/coaches',{cache:'no-store'});
      if(response.status===401||response.status===403){current.current=[];setRows([]);setPhase('login');return;}
      if(!response.ok)throw new Error(translate("读取失败，请重试"));
      const data=await response.json() as {rows:Row[];coachNames?:string[]};setCoachNames(data.coachNames??[]);
      let loaded:Row[]=data.rows;
      versions.current=new Map(loaded.map(row=>[row.id,row.revision]));
      let draft:Record<string,string>={};
      try{draft=JSON.parse(localStorage.getItem(DRAFT)||'{}');}catch{/* Ignore malformed drafts. */}
      loaded=loaded.map(row=>{
        if(typeof draft[row.id]==='string' && draft[row.id]!==row.coach){pending.current.set(row.id,draft[row.id]);return {...row,coach:draft[row.id]};}
        return row;
      });
      current.current=loaded;setRows(loaded);setActive(loaded[0]?.id||'');setPhase('ready');
      if(pending.current.size){setNotice(translate("已恢复上次未保存的修改"));schedule();}
      else{try{localStorage.removeItem(DRAFT);}catch{}}
    }catch(e){setError((e as Error).message);setPhase('error');}
  }

  async function flush(){
    if(busy.current || blocked.current || !pending.current.size)return;
    busy.current=true;setPhase('saving');
    const batch=Array.from(pending.current,([id,coach])=>({id,coach,revision:versions.current.get(id)??0}));
    batch.forEach(row=>pending.current.delete(row.id));
    inFlight.current=new Map(batch.map(row=>[row.id,row.coach]));
    // Keep in-flight changes in the recoverable draft until acknowledged.
    try{localStorage.setItem(DRAFT,JSON.stringify(Object.fromEntries([...batch.map(row=>[row.id,row.coach]),...pending.current])));}catch{}
    try{
      const response=await fetch('/api/coaches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({changes:batch})});
      if(!response.ok)throw new Error(response.status===401?translate("登录已过期，请重新登录"):translate("保存失败，请检查网络后重试"));
      const data=await response.json() as {saved:{id:string;coach:string;revision:number}[];conflicts:string[]};
      for(const row of data.saved)versions.current.set(row.id,row.revision);
      for(const id of data.conflicts){
        const old=batch.find(row=>row.id===id)!;
        if(!pending.current.has(id))pending.current.set(id,old.coach);
      }
      if(data.conflicts.length)throw new Error(translate("其他页面更新过相同选手。点击重试，将保存本页的修改。"));
      setError('');setPhase(pending.current.size?'saving':'ready');
    }catch(e){
      for(const row of batch){
        if(!pending.current.has(row.id) && versions.current.get(row.id)===row.revision)pending.current.set(row.id,row.coach);
      }
      blocked.current=true;setError((e as Error).message);setPhase('error');
    }finally{
      busy.current=false;inFlight.current.clear();persistDraft();
      if(pending.current.size && !blocked.current)schedule();
    }
  }
  flushRef.current=flush;

  async function retry(){
    if(!rows.length){void load();return;}
    try{
      const response=await fetch('/api/coaches',{cache:'no-store'});
      if(response.status===401||response.status===403){current.current=[];setRows([]);setPhase('login');return;}
      if(!response.ok)throw new Error(translate("仍然无法连接，请稍后重试"));
      const data=await response.json() as {rows:Row[]};
      versions.current=new Map(data.rows.map((row:Row)=>[row.id,row.revision]));
      // Preserve the pending local edits while incorporating other saved rows.
      current.current=(data.rows as Row[]).map(row=>pending.current.has(row.id)?{...row,coach:pending.current.get(row.id)!}:row);
      setRows(current.current);blocked.current=false;setError('');setPhase('ready');void flushRef.current();
    }catch(e){setError((e as Error).message);}
  }

  useEffect(()=>{
    void load();
    const before=(e:BeforeUnloadEvent)=>{if(pending.current.size || busy.current){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',before);
    return()=>{window.removeEventListener('beforeunload',before);clearTimeout(timer.current);};
  },[]);

  useEffect(()=>{
    if(!modal)return;
    const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setModal(false);};
    window.addEventListener('keydown',close);
    return()=>window.removeEventListener('keydown',close);
  },[modal]);

  const filled=rows.filter(row=>row.coach.trim()).length;
  const visible=rows.filter(row=>(!onlyEmpty || !row.coach.trim() || row.id===active) && (row.id===active || `${row.name} ${row.coach}`.toLowerCase().includes(query.trim().toLowerCase())));
  const selected=visible.find(row=>row.id===active)??visible[0];

  function apply(changes:Change[],remember=false){
    const different=changes.filter(change=>current.current.find(row=>row.id===change.id)?.coach!==change.coach);
    if(!different.length)return;
    if(!remember)setUndo(null);
    if(remember)setUndo(different.map(change=>({id:change.id,coach:current.current.find(row=>row.id===change.id)!.coach})));
    const values=new Map(different.map(change=>[change.id,change.coach]));
    current.current=current.current.map(row=>values.has(row.id)?{...row,coach:values.get(row.id)!}:row);
    setRows(current.current);
    different.forEach(row=>pending.current.set(row.id,row.coach));
    persistDraft();if(!blocked.current)setPhase('saving');schedule();
  }

  function paste(text:string,startId:string){
    try{
      const changes=planPaste(text,visible,current.current,startId);
      apply(changes,true);setNotice(translate("已粘贴 {0} 位选手的教练信息",[changes.length]));setPasteError('');
      return true;
    }catch(e){setPasteError((e as Error).message);return false;}
  }

  function exportCsv(){
    const cell=(value:string)=>'"'+(/^[=+@-]/.test(value)?"'"+value:value).replaceAll('"','""')+'"';
    const text='\uFEFF'+[[translate("选手姓名"),translate("负责教练")],...current.current.map(row=>[row.name,row.coach])].map(row=>row.map(cell).join(',')).join('\r\n');
    void saveTextFile(translate("HSC_教练名单.csv"),text).catch(failure=>window.alert((failure as Error).message));
  }

  return <div className="shell">
    <LanguageSwitch/><header className="topbar"><a href="/" className="brand"><span className="monogram">HSC</span><span>HAMILTON<br/><b>SKATING CLUB</b></span></a><span className="private-label"><span/>{translate("私人工作表")}</span></header>
    <main>
      <nav className="coach-return-links" aria-label={text('Return navigation','返回导航')}><a href="/workspace?view=coach">← {text('Back to coach schedule','返回教练总表')}</a><a href="/">{text('Back to my homepage','返回我的主页')}</a><a href="/?tab=account">{text('Account','账户')}</a><span>{text('Administrators only','仅管理员可维护')}</span></nav>
      <div className="page-heading"><div><p className="eyebrow">{translate("CLUB ROSTER / 教练资料")}</p><h1>{translate("选手与教练")}<span className="title-dot">.</span></h1><p className="subtitle">{text('Search a first name, then select a coach from the dropdown. Bulk paste is also available.','输入 first name 联想，再从下拉列表选择教练；也可批量粘贴。')}</p></div><div className="save-state" role="status" aria-live="polite"><i className={phase}/>{phase==='ready'?translate("全部已保存"):phase==='saving'?translate("正在保存…"):phase==='error'?translate("尚未保存"):phase==='login'?translate("请先登录"):translate("正在读取…")}</div></div>
      {phase==='login'?<section className="empty-state"><h2>{translate("登录后即可编辑")}</h2><p>{text('This maintenance page requires an active administrator account. Return to the member homepage to sign in.','此维护页仅限有效管理员账号。请返回会员主页登录。')}</p><a className="primary button" href="/">{text('Return to member homepage','返回会员主页')}</a></section>:<>
        <section className="workspace" aria-label={translate("教练信息编辑表")}>
          <div className="workspace-head"><div><strong>{translate("选手名单")}</strong><span className="count">{rows.length || '—'} {translate(" 位")}</span></div><span className="completion"><b>{filled}</b> / {rows.length || '—'} {translate(" 已填教练")}</span></div>
          <div className="toolbar"><label className="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input aria-label={translate("搜索选手或教练")} placeholder={translate("搜索选手或教练…")} value={query} onChange={e=>{setActive('');setQuery(e.target.value);}}/>{query && <button aria-label={translate("清除搜索")} onClick={()=>setQuery('')}>×</button>}</label><div className="actions"><button className={onlyEmpty?'filter selected':'filter'} onClick={()=>{setActive('');setOnlyEmpty(!onlyEmpty);}}>{translate("只看未填写")}</button><button onClick={()=>{setBulk('');setPasteError('');setModal(true);}} disabled={!visible.length} className="primary">{translate("批量粘贴")}</button><button className="export" onClick={exportCsv} disabled={!rows.length}>{translate("导出 CSV ↗")}</button></div></div>
          <div className="paste-help"><span className="help-icon">↳</span><span>{translate("从 Excel 复制一列教练，点击起始格后按 ")}<kbd>Ctrl</kbd> + <kbd>V</kbd>{translate("，即可向下填入。多位教练用 ")}<b>/</b> {translate(" 分隔。")}</span>{undo && <button onClick={()=>{apply(undo);setUndo(null);setNotice(translate("已撤销上次粘贴"));}}>{translate("撤销粘贴")}</button>}</div>
          {error && <div className="error" role="alert">{error}<button onClick={()=>void retry()}>{translate("重试保存")}</button></div>}
          {pasteError && !modal && <div className="error" role="alert">{pasteError}<button onClick={()=>setPasteError('')}>{translate("关闭")}</button></div>}
          <div className="table-wrap"><table><colgroup><col className="number-col"/><col className="name-col"/><col/></colgroup><thead><tr><th>#</th><th>{translate("选手姓名 ")}<span>SKATER</span></th><th>{translate("负责教练 ")}<span>{translate("COACH · 可直接编辑")}</span></th></tr></thead><tbody>
            {visible.map((row,index)=><tr key={row.id} className={active===row.id?'active-row':''}><td className="row-number">{String(index+1).padStart(2,'0')}</td><td><div className="skater-name">{row.name}</div>{row.training && <span className="training">{translate("在 Hamilton 训练")}</span>}{row.identityPending && <span className="training">{translate("全名待确认")}</span>}</td><td className="coach-cell"><CoachNameInput inputRef={el=>{if(el)inputs.current.set(row.id,el);else inputs.current.delete(row.id);}} aria-label={translate("{0} 的负责教练",[row.name])} value={row.coach} maxLength={500} placeholder={translate("输入或粘贴教练姓名")} onFocus={()=>setActive(row.id)} onChange={coach=>apply([{id:row.id,coach}])} names={[...coachNames,...rows.map(item=>item.coach)]} onPaste={e=>{const text=e.clipboardData.getData('text/plain');if(/[\n\r\t]/.test(text)){e.preventDefault();paste(text,row.id);}}} onKeyDown={e=>{if(e.key==='Enter' || e.key==='ArrowDown' || e.key==='ArrowUp'){e.preventDefault();const next=visible[index+(e.key==='ArrowUp'?-1:1)];if(next)inputs.current.get(next.id)?.focus();}}}/><span className={row.coach?'cell-mark filled':'cell-mark'}>{row.coach?'✓':'＋'}</span></td></tr>)}
          </tbody></table>{!visible.length && <div className="table-empty">{phase==='loading'?translate("正在加载选手名单…"):rows.length?translate("没有符合条件的选手"):translate("暂时无法加载名单，请点击重试。")}</div>}</div>
          <div className="table-foot"><span>{translate("显示 ")}{visible.length} {translate(" 位选手")}</span><span><span className="legend-dot"/> {translate(" 修改后自动保存")}</span></div>
        </section>
        <p className="source-note">{translate("名单依据 2023-10-19 至 2026-10-19 公开比赛整理，待俱乐部确认；包含在 Hamilton 训练的 Breken Brezden。")}<br/>{translate("本页保存教练信息，可导出 CSV；原始比赛工作簿作为底稿保留。")}</p>
      </>}
    </main>
    {notice && <div className="toast" role="status">✓ {notice}<button aria-label={translate("关闭提示")} onClick={()=>setNotice('')}>×</button></div>}
    {modal && <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setModal(false);}}><section role="dialog" aria-modal="true" aria-labelledby="paste-title" className="modal"><button className="close-modal" aria-label={translate("关闭批量粘贴")} onClick={()=>setModal(false)}>×</button><p className="eyebrow">PASTE FROM EXCEL</p><h2 id="paste-title">{translate("一次填好，多位教练。")}</h2><p>{translate("粘贴一列教练，将从下方选手开始向下填入。")}<br/>{translate("也支持两列「选手姓名 + 教练」，自动匹配选手。")}</p><label className="start-label">{translate("起始选手")}<select value={selected?.id||''} onChange={e=>setActive(e.target.value)}>{visible.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><textarea autoFocus aria-label={translate("批量教练信息")} placeholder={translate("粘贴 Excel 内容到这里…\n\n例：\nJennifer Jackson/Bryce Davison\n另一位教练")} value={bulk} onChange={e=>{setBulk(e.target.value);setPasteError('');}}/>{pasteError && <p role="alert" className="modal-error">{pasteError}</p>}<div className="modal-footer"><span>{translate("空白行会清空对应教练格")}</span><button className="primary" disabled={!bulk} onClick={()=>{if(paste(bulk,selected?.id||''))setModal(false);}}>{translate("填入并自动保存")}</button></div></section></div>}
  </div>;
}
