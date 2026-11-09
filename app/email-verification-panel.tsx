'use client';
import {useEffect,useRef,useState} from 'react';
import {apiFetch,verificationReturnURL} from '../lib/client-platform';
import {text,useLanguage} from '../lib/i18n';
import {authFeedback,authProblem} from './auth-feedback';
import {MailAvailability,type AuthAvailability} from './auth-availability';

export type VerificationReason='registered'|'delivery-failed'|'sign-in'|'resend';
type Props={initialEmail?:string;reason?:VerificationReason;availability:AuthAvailability;onReturnToSignIn?:()=>void};

export default function EmailVerificationPanel({initialEmail='',reason,availability,onReturnToSignIn}:Props) {
  useLanguage();
  const heading=useRef<HTMLHeadingElement>(null);
  const [email,setEmail]=useState(initialEmail),[busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false),[error,setError]=useState(''),[waitUntil,setWaitUntil]=useState(0),[now,setNow]=useState(0);
  const seconds=Math.max(0,Math.ceil((waitUntil-now)/1000));

  useEffect(()=>{
    if(reason){
      heading.current?.focus({preventScroll:true});
      heading.current?.scrollIntoView({block:'center'});
    }
  },[reason]);

  useEffect(()=>{
    if(!waitUntil)return;
    const timer=window.setInterval(()=>{
      const time=Date.now();
      setNow(time);
      if(time>=waitUntil)setWaitUntil(0);
    },1000);
    return ()=>clearInterval(timer);
  },[waitUntil]);

  function cooldown(response:Response){
    const retry=Number(response.headers.get('retry-after')||response.headers.get('x-retry-after'));
    const time=Date.now();
    setNow(time);
    setWaitUntil(time+1000*(retry>0&&Number.isFinite(retry)?retry:60));
  }

  async function resend(event:React.FormEvent){
    event.preventDefault();
    if(busy||seconds)return;
    setBusy(true);setError('');setSent(false);
    try{
      const response=await apiFetch('/api/auth/send-verification-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim(),callbackURL:verificationReturnURL()})});
      if(!response.ok){
        const problem=authProblem(response.status,await response.json());
        if(problem==='RATE_LIMITED'||problem==='MAIL_UNAVAILABLE')cooldown(response);
        setError(problem);
        return;
      }
      setSent(true);
      cooldown(response);
    }catch{setError('UNAVAILABLE');}finally{setBusy(false);}
  }

  return <section className="member-panel">
    <h2 ref={heading} tabIndex={reason?-1:undefined}>{text('Verify your email','验证邮箱')}</h2>
    <MailAvailability availability={availability}>
    {reason==='delivery-failed'&&!sent&&<p role="alert">{text('Your account was created, but we could not send the first verification email. Request a new link below.','账号已创建，但首封验证邮件未能发出。请在下方重新申请验证链接。')}</p>}
    {reason==='registered'&&<p>{text('Your account was created. Check your inbox and spam folder for the verification email.','账号已创建。请到收件箱和垃圾邮件中查找验证邮件。')}</p>}
    {reason==='sign-in'&&<p>{text('Verify your email before signing in. If you need a new link, enter your registered email below.','请先验证邮箱再登录。如需新链接，请在下方输入注册邮箱。')}</p>}
    <p>{text('Open the link in your email, then sign in. Verification links expire after one hour.','请打开邮件中的链接完成验证，再登录。验证链接一小时后过期。')}</p>
    <form onSubmit={resend}>
      <label>{text('Email','邮箱')}<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} maxLength={254} autoComplete="email"/></label>
      <button disabled={busy||seconds>0}>{busy?text('Please wait…','请稍候…'):seconds?text(`Resend in ${seconds}s`,`${seconds} 秒后可重发`):text('Resend verification email','重发验证邮件')}</button>
    </form>
    {sent&&<p role="status">{text('If this address has an unverified account, a verification email has been requested. Check your inbox and spam folder.','如果此邮箱有待验证账号，已请求验证邮件。请检查收件箱和垃圾邮件。')}</p>}
    {error&&<p role="alert">{authFeedback(error)}</p>}
    </MailAvailability>
    {onReturnToSignIn?<button type="button" onClick={onReturnToSignIn}>{text('Return to sign in','返回登录')}</button>:<a href="/">{text('Return to sign in','返回登录')}</a>}
  </section>;
}
