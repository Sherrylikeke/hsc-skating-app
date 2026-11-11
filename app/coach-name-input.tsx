'use client';
import {useId,useState} from 'react';
import type {ComponentProps,Ref} from 'react';
import {coachSuggestions} from '../lib/coach-name-search';
import {coachKey} from '../lib/coach-identity';
import {splitCoaches} from '../lib/club-types';
import {text} from '../lib/i18n';
import './coach-name-input.css';
type Props=Omit<ComponentProps<'input'>,'value'|'onChange'|'ref'>&{value:string;onChange:(value:string)=>void;names:string[];inputRef?:Ref<HTMLInputElement>};
export default function CoachNameInput({value,onChange,names,inputRef,onKeyDown,...props}:Props){
  const id=useId(),[query,setQuery]=useState(''),selected=splitCoaches(value),available=[...new Set(names.flatMap(splitCoaches))].filter(name=>!selected.some(coach=>coachKey(coach)===coachKey(name)));
  const options=query.trim().length>=2?coachSuggestions(query,available):available.filter(name=>name.toLowerCase().includes(query.trim().toLowerCase()));
  function add(name:string){if(!available.includes(name))return;onChange([...selected,name].join('/'));setQuery('');}
  return <span className="coach-name-input"><span className="coach-selected-names">{selected.map(name=><span key={name}>{name}<button type="button" disabled={props.disabled} aria-label={text('Remove coach: ','移除教练：')+name} onClick={()=>onChange(selected.filter(coach=>coach!==name).join('/'))}>×</button></span>)}</span>
    <input {...props} id={props.id??id} ref={inputRef} value={query} placeholder={text('First name to find a coach','输入 first name 查找教练')} autoComplete="off" onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&options.length===1){event.preventDefault();add(options[0]);}else onKeyDown?.(event);}}/>
    <select aria-label={text('Select a coach to add','下拉选择要添加的教练')} value="" disabled={props.disabled||!options.length} onChange={event=>add(event.target.value)}><option value="">{options.length?text('Select a coach…','下拉选择教练…'):text('No matching coach','没有匹配教练')}</option>{options.map(name=><option key={name}>{name}</option>)}</select>
  </span>;
}
