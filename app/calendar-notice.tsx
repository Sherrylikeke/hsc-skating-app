'use client';
import {useState} from 'react';
import {text} from '../lib/i18n';

export default function CalendarNotice(){
  const [notice,setNotice]=useState(''),[failed,setFailed]=useState(false),[loading,setLoading]=useState(false);
  async function load(){
    if(notice||loading)return;
    setLoading(true);setFailed(false);
    try{
      const response=await fetch('/third-party/fullcalendar.txt');
      if(!response.ok)throw new Error('Notice unavailable');
      const value=await response.text();
      if(!value.includes('Permission is hereby granted'))throw new Error('Invalid notice');
      setNotice(value);
    }catch{setFailed(true);}finally{setLoading(false);}
  }
  return <details className="cal-license" onToggle={event=>{if(event.currentTarget.open)void load();}}>
    <summary>{text('Calendar open-source notices','日历开源许可声明')}</summary>
    {notice?<pre>{notice}</pre>:<p role="status">{failed?text('Unable to load. Close and reopen to retry.','加载失败，请收起后重新打开。'):text('Loading…','正在读取…')}</p>}
  </details>;
}
