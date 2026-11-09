'use client';
import {useEffect,useRef,useState} from 'react';
import {apiFetch,verificationReturnURL} from '../lib/client-platform';
import {text,useLanguage} from '../lib/i18n';
import {authFeedback,authProblem,type AuthProblem} from './auth-feedback';
import {MailAvailability,type AuthAvailability} from './auth-availability';

export default function PasswordResetPanel({complete=false,availability}:{complete?:boolean;availability:AuthAvailability}){
  useLanguage();
  const initialized=useRef(false);
  const [token,setToken]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[sent,setSent]=useState(false),[done,setDone]=useState(false),[expired,setExpired]=useState(false);
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    if(!complete||initialized.current)return;
    initialized.current=true;
    const params=new URLSearchParams(location.search);
    const value=params.get('error')?'':params.get('token')||'';
    setToken(value);setExpired(!value);
    history.replaceState(history.state,'',location.pathname);
  },[complete]);

  async function submit(event:React.FormEvent){
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');setSent(false);
    try{
      if(token&&password!==confirm){setError('PASSWORD_MISMATCH');return;}
      const response=await apiFetch('/api/auth/'+(token?'reset-password':'request-password-reset'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(token?{token,newPassword:password}:{email:email.trim(),redirectTo:new URL('/reset-password',verificationReturnURL()).href})});
      if(!response.ok){
        const result=await response.json() as AuthProblem;
        if(token&&(result.code==='INVALID_TOKEN'||result.message?.toLowerCase()==='invalid token')){
          setToken('');setExpired(true);setPassword('');setConfirm('');
        }else setError(authProblem(response.status,result));
        return;
      }
      if(token){setToken('');setPassword('');setConfirm('');setDone(true);}
      else setSent(true);
    }catch{setError('UNAVAILABLE');}finally{setBusy(false);}
  }
  const form=<form onSubmit={submit}>
      {token?<><label>{text('New password','新密码')}<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)}/></label>
        <small>{text('Use 12–128 characters.','请输入 12–128 个字符。')}</small>
        <label>{text('Confirm password','确认密码')}<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirm} onChange={event=>setConfirm(event.target.value)}/></label></>:
        <label>{text('Registered email','注册邮箱')}<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label>}
      <button disabled={busy}>{busy?text('Please wait…','请稍候…'):token?text('Save new password','保存新密码'):text('Request reset link','申请重设链接')}</button>
    </form>;
  return <section className="member-panel"><h2>{text('Reset your password','重设密码')}</h2>
    {expired&&<p role="alert">{text('This link is invalid or has expired.','链接无效或已过期。')}</p>}
    {!done&&(!complete||token!==null)&&(token?form:<MailAvailability availability={availability}>{form}</MailAvailability>)}
    {sent&&<p role="status">{text('If this email has an account, a reset link has been requested. Check your inbox and spam folder. Links expire after one hour.','如果此邮箱有账号，已请求重设链接。请检查收件箱和垃圾邮件，链接一小时后过期。')}</p>}
    {done&&<p role="status">{text('Password updated. Sign in again on your devices.','密码已更新，请在各设备重新登录。')}</p>}
    {error&&<p role="alert">{authFeedback(error)}</p>}
    <a href="/">{text('Return to sign in','返回登录')}</a>
  </section>;
}
