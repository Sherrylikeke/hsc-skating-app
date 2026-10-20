'use client';
import {useState} from 'react';
import {translate,text,useLanguage} from '../lib/i18n';
import type {Role} from '../lib/member-access';
export default function PasswordPanel({role,onComplete}:{role:Role;onComplete:()=>Promise<void>}) {
  useLanguage();
  const [register,setRegister]=useState(false),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[email,setEmail]=useState(''),[name,setName]=useState(''),[link,setLink]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy)return;setBusy(true);setError('');
    try {
      if(register&&password!==confirm)throw new Error(text('The passwords do not match.','两次密码不一致。'));
      const response=await fetch('/api/auth/'+(register?'sign-up/email':'sign-in/username'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(register?{name,email,username,password}:{username,password})});
      const result=await response.json() as {message?:string;error?:{message?:string}};
      setPassword('');setConfirm('');
      if(!response.ok)throw new Error(result.message||result.error?.message||text('Unable to sign in. Please try again.','无法登录，请重试。'));
      if(link) {
        const linked=await fetch('/api/link-password',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
        const value=await linked.json() as {error?:string};if(!linked.ok)throw new Error(value.error||'Account linking failed.');
      }
      const session=await fetch('/api/member?action=session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})});
      const value=await session.json() as {error?:string};if(!session.ok)throw new Error(value.error||'Membership session failed.');
      await onComplete();
    }catch(failure){setError((failure as Error).message);}finally{setBusy(false);}
  }
  return <section className="member-panel password-panel"><div className="member-actions"><button type="button" className={!register?'selected':''} onClick={()=>{setRegister(false);setError('');}}>{text('Sign in','登录')}</button><button type="button" className={register?'selected':''} onClick={()=>{setRegister(true);setError('');}}>{text('Create an account','创建账号')}</button></div><h2>{register?text('Your own HSC account','创建自己的 HSC 账号'):text('Welcome back','欢迎回来')}</h2><form onSubmit={event=>void submit(event)}>{register&&<><label>{text('Full name','完整姓名')}<input required value={name} onChange={event=>setName(event.target.value)} autoComplete="name" maxLength={120}/></label><label>{text('Email','邮箱')}<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" maxLength={254}/></label></>}<label>{text('Username','用户名')}<input required value={username} onChange={event=>setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={30} pattern="[a-zA-Z0-9_.]+" spellCheck={false} autoCapitalize="none"/></label><small>{text('3–30 letters, numbers, underscores or periods.','3–30 位英文字母、数字、下划线或句点。')}</small><label>{text('Password','密码')}<input required type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete={register?'new-password':'current-password'} minLength={register?12:1} maxLength={128}/></label>{register&&<label>{text('Confirm password','确认密码')}<input required type="password" value={confirm} onChange={event=>setConfirm(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128}/></label>}<div className="member-check-row"><label><input type="checkbox" checked={link} onChange={event=>setLink(event.target.checked)}/>{text('Explicitly link to my existing ChatGPT-verified HSC membership','明确关联我现有的 ChatGPT 已验证 HSC 会员账号')}</label></div><p className="member-muted">{text('Linking requires a current HSC/ChatGPT session and the same email on both accounts. Matching an email alone never grants access.','关联需要有效的 HSC/ChatGPT 会话及相同邮箱；仅邮箱相同不会授予权限。')}</p><button className="primary" disabled={busy}>{busy?text('Please wait…','请稍候…'):register?text('Create account','创建账号'):text('Sign in','登录')}</button>{error&&<p role="alert" className="password-error">{translate(error)}</p>}</form><p className="member-muted">{text('Registration does not grant membership. An administrator must verify your identity and skater relationship. Passwords require at least 12 characters. Email verification and password-reset email delivery are not configured yet.','注册不会自动获得会员权限。管理员须核验身份与选手关系。密码至少 12 位。邮箱验证及密码重置邮件尚未配置。')}</p></section>;
}
