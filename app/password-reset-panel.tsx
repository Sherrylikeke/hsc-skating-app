'use client';
import {useEffect,useState} from 'react';
import {apiFetch as fetch} from '../lib/client-platform';
import {text,useLanguage} from '../lib/i18n';
export default function PasswordResetPanel({complete=false}:{complete?:boolean}){
  useLanguage();
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(false);
  useEffect(()=>{
    if(!complete)return;
    const params=new URLSearchParams(location.search);
    setToken(params.get('token')||'');
    if(params.get('error')||!params.get('token'))setError(text('This link is invalid or has expired. Request a new link.','链接无效或已过期，请重新申请。'));
    history.replaceState(null,'',location.pathname);
  },[complete]);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
    try{
      if(complete&&password!==confirm)throw new Error(text('The passwords do not match.','两次密码不一致。'));
      const response=await fetch('/api/auth/'+(complete?'reset-password':'request-password-reset'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(complete?{token,newPassword:password}:{email,redirectTo:location.origin+'/reset-password'})});
      const result=await response.json() as {message?:string};
      if(!response.ok)throw new Error(result.message||text('Unable to complete this request. Please try again.','操作未完成，请重试。'));
      setPassword('');setConfirm('');
      if(complete){setToken('');setDone(true);}
      setMessage(complete?text('Password updated. Sign in again on your devices.','密码已更新，请在各设备重新登录。'):text('If this email has an account, a reset link has been requested. Check your inbox and spam folder. Links expire after one hour.','如果此邮箱有账号，已请求重设链接。请检查收件箱和垃圾邮件，链接一小时后过期。'));
    }catch(failure){setError((failure as Error).message);}finally{setBusy(false);}
  }
  return <section className="member-panel"><h2>{text('Reset your password','重设密码')}</h2>{!done&&<form onSubmit={event=>void submit(event)}>{complete?<><label>{text('New password','新密码')}<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)}/></label><label>{text('Confirm password','确认密码')}<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirm} onChange={event=>setConfirm(event.target.value)}/></label></>:<label>{text('Email','邮箱')}<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label>}<button disabled={busy||(complete&&!token)}>{busy?text('Please wait…','请稍候…'):complete?text('Save new password','保存新密码'):text('Request reset link','申请重设链接')}</button></form>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}{complete&&!token&&!done&&<PasswordResetPanel/>}<a href="/">{text('Return to sign in','返回登录')}</a></section>;
}
