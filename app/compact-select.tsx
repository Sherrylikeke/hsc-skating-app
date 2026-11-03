'use client';
import {Children,isValidElement,useId,useRef,useState} from 'react';
import type {ChangeEvent,ReactElement,SelectHTMLAttributes} from 'react';
import {text,useLanguage} from '../lib/i18n';
// Keep the native desktop control; on phones use a bounded, in-page list instead of the OS full-screen picker.
export default function CompactSelect(props:SelectHTMLAttributes<HTMLSelectElement>){
  useLanguage();const id=useId(),native=useRef<HTMLSelectElement>(null),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
  const options=Children.toArray(props.children).filter(isValidElement).map(child=>{const p=(child as ReactElement<{value?:string;children?:React.ReactNode;disabled?:boolean}>).props;const label=Children.toArray(p.children).join('');return {value:String(p.value??label),label,disabled:p.disabled};});
  const selected=options.find(option=>option.value===String(props.value??''));const shown=options.filter(o=>!query||o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const choose=(value:string)=>{if(native.current){native.current.value=value;props.onChange?.({target:native.current,currentTarget:native.current} as ChangeEvent<HTMLSelectElement>);}setOpen(false);setQuery('');};
  return <span className="club-compact-select" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)){setOpen(false);setQuery('');}}}>
    <select {...props} ref={native} className={(props.className||'')+' club-native-select'}/>
    <span className="club-phone-select"><button type="button" role="combobox" aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-expanded={open} aria-controls={id} aria-haspopup="listbox" aria-activedescendant={open&&shown.length?id+'-'+active:undefined} disabled={props.disabled} onClick={()=>{setOpen(!open);setQuery('');setActive(0);}} onKeyDown={event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setOpen(true);setActive(n=>Math.max(0,Math.min(shown.length-1,n+(event.key==='ArrowDown'?1:-1))));}else if(event.key==='Escape'){event.stopPropagation();setOpen(false);}else if(event.key==='Enter'&&open){event.preventDefault();if(shown[active]&&!shown[active].disabled)choose(shown[active].value);}}}><span>{selected?.label||text('Choose…','请选择…')}</span><span aria-hidden="true">⌄</span></button>
    {open&&<span className="club-select-menu">{options.length>8&&<input aria-label={text('Search options','搜索选项')} placeholder={text('Search…','搜索…')} value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}}/>}<span id={id} role="listbox" aria-label={props['aria-label']}>{shown.map((option,index)=><button id={id+'-'+index} key={option.value} type="button" role="option" tabIndex={-1} aria-selected={option.value===selected?.value} disabled={option.disabled} onClick={()=>choose(option.value)}>{option.label}{option.value===selected?.value?' ✓':''}</button>)}{!shown.length&&<span>{text('No matches','没有匹配项')}</span>}</span></span>}
    </span>
  </span>;
}
