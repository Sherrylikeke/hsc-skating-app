'use client';
import {apiFetch as fetch} from '../lib/client-platform';
import {useEffect,useState} from 'react';
import EmailVerificationPanel from './email-verification-panel';
import PasswordResetPanel from './password-reset-panel';
import {translate,text,useLanguage} from '../lib/i18n';
import type {Role} from '../lib/member-access';
export default function PasswordPanel({role,onComplete,allowAdminLink=false}:{role:Role;onComplete:()=>Promise<void>;allowAdminLink?:boolean}) {
  useLanguage();
  const [register,setRegister]=useState(false),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[email,setEmail]=useState(''),[skaterName,setSkaterName]=useState(''),[requestedRole,setRequestedRole]=useState<Role>(role==='admin'?'parent':role),[link,setLink]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pendingEmail,setPendingEmail]=useState('');
  const adminLink=allowAdminLink&&link;
  const [pilotRole,setPilotRole]=useState<'parent'|'coach'|'skater'|null>(null);
  const [pilotToken,setPilotToken]=useState('');
  const [deliveryConfigured,setDeliveryConfigured]=useState(false);
  useEffect(()=>{
    void fetch('/api/auth/config',{cache:'no-store'}).then(async response=>{if(response.ok)setDeliveryConfigured((await response.json() as {registrationConfigured?:boolean}).registrationConfigured===true);}).catch(()=>{});
    const fragment=new URLSearchParams(location.hash.slice(1)),token=fragment.get('invite');if(!token)return;
    fragment.delete('invite');history.replaceState(null,'',location.pathname+location.search+(fragment.size?'#'+fragment.toString():''));
    void fetch('/api/auth/pilot-invitation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}).then(async response=>{
      const config=await response.json() as {message?:string;pilotRegistrationAllowed?:boolean;pilotRole?:'parent'|'coach'|'skater';email?:string};
      if(!response.ok)throw new Error(config.message||'This invitation is invalid or expired.');
      if(config.pilotRegistrationAllowed&&config.pilotRole&&config.email){setPilotToken(token);setPilotRole(config.pilotRole);setRequestedRole(config.pilotRole);setEmail(config.email);setRegister(true);}
    }).catch(failure=>setError(failure.message));
  },[]);
  const invitationRequired=register&&!allowAdminLink&&!pilotRole&&!deliveryConfigured;
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy)return;setBusy(true);setError('');
    try {
      if(register&&password!==confirm)throw new Error(text('The passwords do not match.','两次密码不一致。'));
      const identifier=username.trim(),emailLogin=!register&&identifier.includes('@');
      const endpoint=register?'sign-up/email':emailLogin?'sign-in/email':'sign-in/username';
      const body=register?{name:identifier,email,username:identifier,password,role:requestedRole,skaterName,linkExisting:adminLink,...(pilotToken?{pilotInvitation:pilotToken}:{})}:emailLogin?{email:identifier,password}:{username:identifier,password};
      const response=await fetch('/api/auth/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json() as {message?:string;token?:string|null;user?:{email:string};error?:{message?:string}};
      setPassword('');setConfirm('');
      if(!response.ok){if(!register&&response.status===403&&result.message==='Verify your email before signing in.')setPendingEmail(emailLogin?identifier:'');throw new Error(result.message||result.error?.message||text('Unable to sign in. Please try again.','无法登录，请重试。'));}
      if(register&&result.user&&!result.token){
        const config=await fetch('/api/auth/config').then(response=>response.json()) as {deliveryConfigured:boolean};
        if((!adminLink&&response.headers.get('X-HSC-Registration-Mode')!=='pilot')||config.deliveryConfigured){setPendingEmail(email);return;}
        const signed=await fetch('/api/auth/sign-in/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:body.password})});
        if(!signed.ok)throw new Error(text('Sign in to complete account linking.','请登录后完成账号关联。'));
      }
      if(adminLink) {
        const linked=await fetch('/api/link-password',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
        const value=await linked.json() as {error?:string};if(!linked.ok)throw new Error(value.error||'Account linking failed.');
      }
      const session=await fetch('/api/member?action=session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:register?requestedRole:role})});
      const value=await session.json() as {error?:string};if(!session.ok)throw new Error(value.error||'Membership session failed.');
      await onComplete();
    }catch(failure){setError((failure as Error).message);}finally{setBusy(false);}
  }
  return <section className="member-panel password-panel" id="hsc-login" aria-label="HSC email sign in">
    <div className="member-actions"><button type="button" className={!register?'selected':''} onClick={()=>{setRegister(false);setError('');}}>{text('Sign in','登录')}</button><button type="button" className={register?'selected':''} onClick={()=>{setRegister(true);setError('');}}>{text('Create an account','创建账号')}</button></div>
    <h2>{register?text('Create your HSC account','创建 HSC 账号'):text('Sign in to HSC','登录 HSC')}</h2>
    <p className="member-muted">{pilotRole?text('Your personal invitation is ready. Choose a username and password. No ChatGPT login or HSC email verification is needed.','专属邀请已确认，请自行设置用户名和密码。无需 ChatGPT 登录或 HSC 邮箱验证。'):text('Use your own email and password. No ChatGPT account is required.','使用自己的邮箱和密码，不需要 ChatGPT 账号。')}</p>
    {pendingEmail&&<EmailVerificationPanel initialEmail={pendingEmail}/>}
    {invitationRequired&&<p className="member-muted">{text('Registration is by invitation during this club test. Open the personal registration link shared with you.','本次测试采用邀请制，请打开俱乐部单独发给你的专属注册链接。')}</p>}
    {!invitationRequired&&<form onSubmit={event=>void submit(event)}>
      <label>{register?text('Username','用户名'):text('Email or username','邮箱或用户名')}<input required value={username} onChange={event=>setUsername(event.target.value)} autoComplete="username" minLength={register?3:1} maxLength={register?30:254} pattern={register?'[a-zA-Z0-9_.]+':undefined} spellCheck={false} autoCapitalize="none"/></label>
      {register&&<small>{text('3–30 letters, numbers, underscores or periods.','3–30 位英文字母、数字、下划线或句点。')}</small>}
      <label>{text('Password','密码')}<input required type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete={register?'new-password':'current-password'} minLength={register?12:1} maxLength={128}/></label>
      {register&&<>
        <label>{text('Confirm password','确认密码')}<input required type="password" value={confirm} onChange={event=>setConfirm(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128}/></label>
        <label>{text('Your email','你的邮箱')}<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} readOnly={!!pilotRole} autoComplete="email" maxLength={254}/></label>
        {!adminLink&&<><label>{text('Role','身份')}<select required value={requestedRole} onChange={event=>setRequestedRole(event.target.value as Role)}>{(!pilotRole||pilotRole==='skater')&&<option value="skater">{text('Skater','选手')}</option>}{(!pilotRole||pilotRole==='parent')&&<option value="parent">{text('Parent','家长')}</option>}{(!pilotRole||pilotRole==='coach')&&<option value="coach">{text('Coach','教练')}</option>}</select></label>
        <label>{text("Skater's name on the club list","俱乐部名单中的选手姓名")}<input required value={skaterName} onChange={event=>setSkaterName(event.target.value)} maxLength={120} autoComplete="off"/></label>
        <p className="member-muted">{text('Skater: your own name. Parent: your child. Coach: a club skater. Registration only checks whether this name is on the list.','选手填写本人、家长填写孩子、教练填写俱乐部选手。注册资格只检查姓名是否在名单中。')}</p></>}
      </>}
      {allowAdminLink&&<div className="member-check-row"><label><input type="checkbox" checked={link} onChange={event=>setLink(event.target.checked)}/>{text('Link these credentials to my current administrator account','将这些登录凭据关联到我当前的管理员账号')}</label><small>{text('Only for the signed-in administrator using the same email. Email alone never grants administrator rights.','仅限已登录管理员使用同一邮箱；仅凭邮箱相同不会授予管理员权限。')}</small></div>}
      <button className="primary" disabled={busy}>{busy?text('Please wait…','请稍候…'):register?text('Check name and create account','核对姓名并创建账号'):text('Sign in','登录')}</button>
      {error&&<p role="alert" className="password-error">{translate(error)}</p>}
    </form>}
    {invitationRequired&&error&&<p role="alert" className="password-error">{translate(error)}</p>}
    {!pilotRole&&<details><summary>{text('Need to verify your email?','需要验证邮箱？')}</summary><EmailVerificationPanel/></details>}
    {!register&&<details><summary>{text('Forgot your password?','忘记密码？')}</summary><PasswordResetPanel/></details>}
    <p className="member-muted">{pilotRole?text('Pilot accounts can view shared official schedules. Private relationships and coach editing still require administrator approval.','内测账号可查看共享官方赛程。私人关系和教练编辑权限仍需管理员批准。'):text('New accounts require a listed skater name and email verification. When mail service setup is pending, existing accounts can still sign in. Homepage choices do not grant private coach, message or administration permissions.','新账号须填写名单内选手姓名并验证邮箱。邮件服务配置期间，现有账号仍可登录；主页选择不会授予教练、私人消息或管理员权限。')}</p>
  </section>;
}
