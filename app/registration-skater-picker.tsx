'use client';
import {useEffect,useId,useState} from 'react';
import {apiFetch} from '../lib/client-platform';
import {text} from '../lib/i18n';
import {authRetrySeconds} from './auth-feedback';
import './registration-skater-picker.css';

type Props={value:string;selected:boolean;onChange:(value:string)=>void;onChoose:(name:string)=>void;pilotInvitation?:string;disabled?:boolean};
export default function RegistrationSkaterPicker({value,selected,onChange,onChoose,pilotInvitation,disabled}:Props){
  const id=useId(),[open,setOpen]=useState(false),[names,setNames]=useState<string[]>([]),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[hasMore,setHasMore]=useState(false),[active,setActive]=useState(0),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let current=true;const controller=new AbortController();
    setNames([]);setError('');setActive(0);setHasMore(false);
    if(selected||value.trim().length<2){setBusy(false);return ()=>{current=false;controller.abort();};}
    setBusy(true);
    const timer=window.setTimeout(()=>{void (async()=>{
      try{
        const response=await apiFetch('/api/auth/registration-skaters',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({query:value.trim(),...(pilotInvitation?{pilotInvitation}:{})})});
        const result=await response.json() as {names?:unknown;hasMore?:boolean;retryAfter?:number};
        if(!current)return;
        if(!response.ok){setError(response.status===429?'rate:'+authRetrySeconds(response,result):'unavailable');return;}
        if(!Array.isArray(result.names)||result.names.length>8||result.names.some(name=>typeof name!=='string'||name.length>120))throw new Error();
        setNames(result.names as string[]);setHasMore(result.hasMore===true);
      }catch{if(current)setError('unavailable');}finally{if(current)setBusy(false);}
    })();},300);
    return ()=>{current=false;controller.abort();window.clearTimeout(timer);};
  },[value,selected,pilotInvitation,attempt]);
  function choose(name:string){onChoose(name);setOpen(false);setNames([]);}
  const expanded=open&&!selected&&names.length>0;
  const hint=selected?text('Selected: ','已选择：')+value:busy?text('Looking for skaters…','正在查找选手…'):
    error.startsWith('rate:')?text('Name search is busy. Retry in '+Math.ceil(Number(error.slice(5))/60)+' minute(s).','姓名查询暂时繁忙，请在 '+Math.ceil(Number(error.slice(5))/60)+' 分钟后重试。'):
    error?text('Names could not be loaded. Please retry.','暂时无法读取姓名，请重试。'):
    value.trim().length<2?text('Type a first name, then choose the skater below.','输入 first name，然后选择下方的选手。'):
    names.length?text('Choose the correct full name.','请选择正确的完整姓名。'):text('No matching skater. Try the first name or a different spelling.','未找到匹配选手，请试试 first name 或其他拼法。');
  return <div className="registration-skater-picker" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <label htmlFor={id}>{text("Skater's name on the club list","俱乐部名单中的选手姓名")}</label>
    <input id={id} type="text" role="combobox" required value={value} disabled={disabled} maxLength={120} autoComplete="off" spellCheck={false} autoCapitalize="words"
      placeholder={text('First name, e.g. Mike','输入 first name，例如 Mike')} aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded?id+'-choices':undefined} aria-activedescendant={expanded?id+'-choice-'+active:undefined} aria-describedby={id+'-hint'}
      onFocus={()=>{if(!selected)setOpen(true);}} onChange={event=>{setNames([]);setOpen(true);setActive(0);onChange(event.target.value);}}
      onKeyDown={event=>{
        if(event.key==='Escape'){setOpen(false);return;}
        if(names.length&&(event.key==='ArrowDown'||event.key==='ArrowUp')){event.preventDefault();setOpen(true);setActive(index=>(index+(event.key==='ArrowDown'?1:-1)+names.length)%names.length);}
        if(event.key==='Enter'&&expanded){event.preventDefault();choose(names[active]);}
      }}/>
    {expanded&&<ul id={id+'-choices'} role="listbox" aria-label={text('Matching skaters','匹配的选手')}>{names.map((name,index)=><li key={name} role="presentation">
      <button id={id+'-choice-'+index} type="button" role="option" aria-selected={index===active} tabIndex={-1} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(name)}>{name}</button>
    </li>)}</ul>}
    <p id={id+'-hint'} className={selected?'registration-name-selected':'member-muted'} role="status" aria-live="polite">{hint}</p>
    {hasMore&&!selected&&<small>{text('Type more letters to narrow the list.','输入更多字母可缩小范围。')}</small>}
    {error&&!selected&&<button type="button" onClick={()=>{setOpen(true);setAttempt(value=>value+1);}}>{text('Try name search again','重新查询姓名')}</button>}
  </div>;
}
