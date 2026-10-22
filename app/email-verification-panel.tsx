'use client';
import {apiFetch as fetch,verificationReturnURL} from '../lib/client-platform';
import {useState} from 'react';
import {text,useLanguage} from '../lib/i18n';
export default function EmailVerificationPanel({initialEmail=''}:{initialEmail?:string}) {
  useLanguage();
  const [email,setEmail]=useState(initialEmail),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[retryAt,setRetryAt]=useState(0);
  async function resend(event:React.FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
    try{
      if(Date.now()<retryAt)throw new Error(text('Please wait one minute before resending.','请等待一分钟后再重发。'));
      const response=await fetch('/api/auth/send-verification-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,callbackURL:verificationReturnURL()})});
      const result=await response.json() as {message?:string};
      if(!response.ok)throw new Error(result.message||text('Unable to send. Please retry later.','发送失败，请稍后重试。'));
      setRetryAt(Date.now()+60000);setMessage(text('If this address has an unverified account, a verification email has been requested. Check your inbox and spam folder.','如果此邮箱有待验证账号，已请求验证邮件。请检查收件箱和垃圾邮件。'));
    }catch(failure){setError((failure as Error).message);}finally{setBusy(false);}
  }
  return <section className="member-panel"><h2>{text('Verify your email','验证邮箱')}</h2><p>{text('Open the verification link in your email, then sign in. Links expire after one hour. You can request another link below.','打开邮件中的验证链接，再登录。链接一小时后过期，可在下方重新申请。')}</p><form onSubmit={event=>void resend(event)}><label>{text('Email','邮箱')}<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} maxLength={254} autoComplete="email"/></label><button disabled={busy}>{busy?text('Please wait…','请稍候…'):text('Resend verification email','重发验证邮件')}</button></form>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}<a href="/">{text('Return to sign in','返回登录')}</a></section>;
}
