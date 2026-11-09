'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {apiFetch} from '../lib/client-platform';
import {text} from '../lib/i18n';

type ConfigState='loading'|'failed'|'open'|'closed'|'invite-only';
export type AuthAvailability={state:ConfigState;retry:()=>void};

export function useAuthAvailability():AuthAvailability{
  const [state,setState]=useState<ConfigState>('loading'),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let current=true;
    void (async()=>{
      try{
        const response=await apiFetch('/api/auth/config',{cache:'no-store'});
        if(!response.ok)throw new Error();
        const data=await response.json() as {registrationConfigured?:boolean;deliveryConfigured?:boolean};
        if(typeof data.registrationConfigured!=='boolean'||typeof data.deliveryConfigured!=='boolean'||(data.registrationConfigured&&!data.deliveryConfigured))throw new Error();
        if(current)setState(data.deliveryConfigured?(data.registrationConfigured?'open':'closed'):'invite-only');
      }catch{if(current)setState('failed');}
    })();
    return ()=>{current=false;};
  },[attempt]);
  return {state,retry(){setState('loading');setAttempt(value=>value+1);}};
}

export function MailAvailability({availability,children}:{availability:AuthAvailability;children:ReactNode}){
  switch(availability.state){
    case 'loading':return <p role="status">{text('Checking email availability…','正在查询邮件服务状态…')}</p>;
    case 'failed':return <><p role="alert">{text('Email availability could not be loaded.','暂时无法读取邮件服务状态。')}</p><button type="button" onClick={availability.retry}>{text('Try again','重试')}</button></>;
    case 'invite-only':return <p>{text('Email delivery is not available yet. Please contact the club for help accessing your account.','邮件服务尚未开放。如需协助登录，请联系俱乐部。')}</p>;
    default:return <>{children}</>;
  }
}
