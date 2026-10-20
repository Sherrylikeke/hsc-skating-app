'use client';
import {useEffect,useSyncExternalStore} from 'react';
import translations from './translations.json';
export type Locale='en'|'zh';
let locale:Locale='en';
const subscribers=new Set<()=>void>();
const subscribe=(listener:()=>void)=>{subscribers.add(listener);return()=>{subscribers.delete(listener);};};
const snapshot=()=>locale;
const dictionary=translations as Record<string,string>;
const reverse=new Map(Object.entries(dictionary).map(([source,english])=>[english,source]));
export const currentLocale=()=>locale;
export function translate(source:string,values:unknown[]=[]) {
  const chinese=reverse.get(source)||source;
  const result=locale==='en'?(dictionary[chinese]||source):chinese;
  return result.replace(/\{(\d+)\}/g,(match,index)=>String(values[Number(index)]??''));
}
export const text=(english:string,chinese:string)=>locale==='en'?english:chinese;
export function setLanguage(value:Locale) {
  locale=value;
  try {localStorage.setItem('hsc-language',value);} catch {}
  subscribers.forEach(listener=>listener());
}
export function useLanguage() {
  const selected=useSyncExternalStore(subscribe,snapshot,()=>'en' as Locale);
  useEffect(()=>{try {const saved=localStorage.getItem('hsc-language');if(saved==='en'||saved==='zh')setLanguage(saved);}catch{}},[]);
  useEffect(()=>{document.documentElement.lang=selected==='en'?'en-CA':'zh-CN';},[selected]);
  return selected;
}
export function LanguageSwitch() {
  const selected=useLanguage();
  return <label className="hsc-language"><span className="sr-only">Language / 语言</span><select aria-label="Language / 语言" value={selected} onChange={event=>setLanguage(event.target.value as Locale)}><option value="en">English</option><option value="zh">中文</option></select></label>;
}
