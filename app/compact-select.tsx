'use client';
import {Children, isValidElement, useId, useLayoutEffect, useRef, useState} from 'react';
import type {KeyboardEvent, SelectHTMLAttributes, OptionHTMLAttributes} from 'react';
import {text, useLanguage} from '../lib/i18n';

const phonePicker = '(max-width:720px), (pointer:coarse) and (hover:none) and (max-height:540px)';

export default function CompactSelect(props:SelectHTMLAttributes<HTMLSelectElement>) {
  useLanguage();
  const id = useId();
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open,setOpen] = useState(false);
  const [query,setQuery] = useState('');
  const [activeValue,setActiveValue] = useState('');
  const [localValue,setLocalValue] = useState(props.defaultValue);
  const options = Children.toArray(props.children)
    .filter(isValidElement<OptionHTMLAttributes<HTMLOptionElement>>)
    .map(({props:option}) => {
      const label = option.label ?? Children.toArray(option.children).join('');
      return {value:String(option.value ?? label),label,disabled:option.disabled};
    });
  const current = String(props.value ?? localValue ?? options[0]?.value ?? '');
  const selected = options.find(option=>option.value===current);
  const shown = options.filter(option=>option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const firstAvailable = shown.find(option=>!option.disabled);
  const active = shown.find(option=>option.value===activeValue && !option.disabled) ?? firstAvailable;

  function show() {
    if (props.disabled) return;
    setQuery('');
    setActiveValue(current);
    setOpen(true);
  }
  function dismiss() {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus({preventScroll:true});
  }
  function choose(value:string) {
    const select = native.current;
    if (!select || props.disabled) return;
    select.value = value;
    setLocalValue(value);
    select.dispatchEvent(new Event('change',{bubbles:true}));
    dismiss();
  }
  useLayoutEffect(()=>{
    if (!open) return;
    const sheet = dialog.current!;
    const viewport = window.visualViewport;
    const media = window.matchMedia(phonePicker);
    const resize = () => {
      if (!viewport) return;
      sheet.style.setProperty('--picker-visible-height',viewport.height+'px');
      sheet.style.setProperty('--picker-bottom',Math.max(0,innerHeight-viewport.offsetTop-viewport.height)+'px');
    };
    const switchToDesktop = () => {
      if (media.matches) return;
      sheet.close();
      setOpen(false);
      native.current?.focus({preventScroll:true});
    };
    resize();
    sheet.showModal();
    // Focus a choice, never the text field. Only an explicit search tap opens the keyboard.
    list.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
    media.addEventListener('change',switchToDesktop);
    viewport?.addEventListener('resize',resize);
    viewport?.addEventListener('scroll',resize);
    return () => {
      media.removeEventListener('change',switchToDesktop);
      viewport?.removeEventListener('resize',resize);
      viewport?.removeEventListener('scroll',resize);
      sheet.close();
    };
  },[open]);

  function moveFocus(event:KeyboardEvent<HTMLDivElement>) {
    const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (!buttons.length || index<0) return;
    let next;
    switch (event.key) {
      case 'ArrowDown': next = Math.min(index+1,buttons.length-1); break;
      case 'ArrowUp': next = Math.max(index-1,0); break;
      case 'Home': next = 0; break;
      case 'End': next = buttons.length-1; break;
      default: return;
    }
    event.preventDefault();
    buttons[next].focus();
  }
  const namedBy = props['aria-labelledby'];
  const title = props['aria-label'] || (open && namedBy && namedBy.split(/\s+/).map(key=>document.getElementById(key)?.textContent).join(' ').trim()) || text('Choose an option','选择一项');
  return <span className="club-compact-select">
    <select {...props} ref={native} className={(props.className||'')+' club-native-select'}
      onChange={event=>{setLocalValue(event.target.value);props.onChange?.(event);}}/>
    <span className="club-phone-select">
      <button ref={trigger} type="button" role="combobox" aria-label={props['aria-label']} aria-labelledby={namedBy}
        aria-expanded={open} aria-controls={open?id:undefined} aria-haspopup="dialog" disabled={props.disabled}
        onClick={show} onKeyDown={event=>{if (event.key==='ArrowDown'||event.key==='ArrowUp') {event.preventDefault();show();}}}>
        <span>{selected?.label ?? text('Choose…','请选择…')}</span><span aria-hidden="true">⌄</span>
      </button>
      {open&&<dialog id={id} ref={dialog} className="club-picker-sheet" aria-labelledby={id+'-heading'}
        onCancel={event=>{event.preventDefault();dismiss();}}
        onKeyDown={event=>{
          if (event.key==='Escape' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode!==229) {
            event.preventDefault();
            event.stopPropagation();
            dismiss();
          }
        }}
        onClick={event=>{
          if (event.target!==event.currentTarget) return;
          const r=event.currentTarget.getBoundingClientRect();
          if (event.clientX<r.left||event.clientX>=r.right||event.clientY<r.top||event.clientY>=r.bottom) dismiss();
        }}>
        <header className="club-picker-heading">
          <strong id={id+'-heading'}>{title}</strong>
          <button type="button" onClick={dismiss}>{text('Close','关闭')}</button>
        </header>
        {options.length>8&&<input type="search" aria-label={text('Search options','搜索选项')} placeholder={text('Search…','搜索…')}
          value={query} autoComplete="off" enterKeyHint="search" onChange={event=>setQuery(event.target.value)}
          onKeyDown={event=>{
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode===229 || !firstAvailable) return;
            if (event.key==='ArrowDown') {
              event.preventDefault();
              list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
            } else if (event.key==='Enter') {
              event.preventDefault();
              const matches = list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
              if (matches?.length===1) choose(firstAvailable.value);
              else matches?.[0]?.focus();
            }
          }}/>}
        <div ref={list} role="listbox" aria-labelledby={id+'-heading'} className="club-picker-options" onKeyDown={moveFocus}>
          {shown.map(option=><button key={option.value} type="button" role="option" aria-selected={option.value===current}
            disabled={option.disabled} tabIndex={option===active?0:-1} onFocus={()=>setActiveValue(option.value)}
            onClick={()=>choose(option.value)}>
            <span>{option.label}</span>{option.value===current&&<span aria-hidden="true">✓</span>}
          </button>)}
        </div>
        {!shown.length&&<p role="status">{text('No matches','没有匹配项')}</p>}
      </dialog>}
    </span>
  </span>;
}
