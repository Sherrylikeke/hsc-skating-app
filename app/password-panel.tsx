'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {apiFetch} from '../lib/client-platform';
import {text,useLanguage} from '../lib/i18n';
import type {Member,Role} from '../lib/member-access';
import {authFeedback,authProblem,authRetrySeconds,type AuthProblem} from './auth-feedback';
import RegistrationSkaterPicker from './registration-skater-picker';
import RegistrationCoachPicker from './registration-coach-picker';
import EmailVerificationPanel,{type VerificationReason} from './email-verification-panel';
import PasswordResetPanel from './password-reset-panel';
import {useAuthAvailability} from './auth-availability';

type PilotRole='parent'|'coach'|'skater';
type RegistrationResult=AuthProblem&{token?:string|null;user?:{email:string};registrationMode?:'verification'|'pilot'|'linked';verificationDelivery?:'requested'|'retry-needed'};

export default function PasswordPanel({role,onComplete,allowAdminLink=false}:{role:Role;onComplete:(member?:Member)=>Promise<void>;allowAdminLink?:boolean}) {
  useLanguage();
  const id=useId();
  const [register,setRegister]=useState(false),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[email,setEmail]=useState(''),[skaterName,setSkaterName]=useState('');
  const [selectedSkater,setSelectedSkater]=useState(''),[retryAt,setRetryAt]=useState(0),[now,setNow]=useState(Date.now);
  const [coachName,setCoachName]=useState('');
  const retrySeconds=Math.max(0,Math.ceil((retryAt-now)/1000));
  useEffect(()=>{if(!retryAt)return;const timer=window.setInterval(()=>{const current=Date.now();setNow(current);if(current>=retryAt)setRetryAt(0);},1000);return()=>window.clearInterval(timer);},[retryAt]);
  const [requestedRole,setRequestedRole]=useState<Role>(role==='admin'?'parent':role),[link,setLink]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [verification,setVerification]=useState<{email:string;reason:VerificationReason}|null>(null);
  const signInInput=useRef<HTMLInputElement>(null);
  const restoreSignInFocus=useRef(false);
  const availability=useAuthAvailability(),config=availability.state;
  const [inviteToken,setInviteToken]=useState(''),[inviteAttempt,setInviteAttempt]=useState(0),[checkingInvite,setCheckingInvite]=useState(false),[inviteFailed,setInviteFailed]=useState(false);
  const [pilot,setPilot]=useState<{token:string;role:PilotRole}|null>(null);
  const adminLink=allowAdminLink&&link;

  useEffect(()=>{
    function readInvite(){
      const fragment=new URLSearchParams(location.hash.slice(1)),token=fragment.get('invite');
      if(!token)return;
      fragment.delete('invite');
      history.replaceState(history.state,'',location.pathname+location.search+(fragment.size?'#'+fragment.toString():''));
      setInviteToken(token);setInviteAttempt(attempt=>attempt+1);setPilot(null);setCheckingInvite(true);setInviteFailed(false);
      setEmail('');setPassword('');setConfirm('');setSkaterName('');setSelectedSkater('');setError('');setVerification(null);setRegister(true);
    }
    readInvite();
    window.addEventListener('hashchange',readInvite);
    return ()=>window.removeEventListener('hashchange',readInvite);
  },[]);

  useEffect(()=>{
    if(!inviteToken)return;
    let current=true;
    setCheckingInvite(true);setInviteFailed(false);setError('');
    void (async()=>{
      try{
        const response=await apiFetch('/api/auth/pilot-invitation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:inviteToken})});
        const data=await response.json() as AuthProblem&{pilotRegistrationAllowed?:boolean;pilotRole?:PilotRole;email?:string};
        if(!current)return;
        if(!response.ok){
          setError(authProblem(response.status,data));setInviteFailed(response.status>=500);
          if(response.status<500){setInviteToken('');setRegister(false);}
          return;
        }
        if(!data.pilotRegistrationAllowed||!data.pilotRole||!['skater','parent','coach'].includes(data.pilotRole)||!data.email)throw new Error();
        setPilot({token:inviteToken,role:data.pilotRole});setRequestedRole(data.pilotRole);setEmail(data.email);setRegister(true);
      }catch{if(current){setInviteFailed(true);setError('UNAVAILABLE');}}finally{if(current)setCheckingInvite(false);}
    })();
    return ()=>{current=false;};
  },[inviteToken,inviteAttempt]);

  function chooseRegister(value:boolean){
    if(value!==register){setPassword('');setConfirm('');}
    setRegister(value);setError('');setRetryAt(0);
  }

  function returnToSignIn(){
    restoreSignInFocus.current=true;
    chooseRegister(false);
    setVerification(null);
  }
  useEffect(()=>{
    if(!verification&&restoreSignInFocus.current){
      restoreSignInFocus.current=false;
      signInInput.current?.focus();
    }
  },[verification]);

  async function submit(event:React.FormEvent) {
    event.preventDefault();
    if(busy||retrySeconds>0)return;
    if(register&&!adminLink&&(requestedRole==='coach'?!coachName:!selectedSkater||selectedSkater!==skaterName)){setError('SELECT_SKATER');return;}
    if(register&&password!==confirm){setError('PASSWORD_MISMATCH');return;}
    setBusy(true);setError('');
    try {
      const identifier=username.trim(),emailLogin=!register&&identifier.includes('@');
      const endpoint=register?'sign-up/email':emailLogin?'sign-in/email':'sign-in/username';
      const body=register?{name:identifier,email:email.trim(),username:identifier,password,role:requestedRole,skaterName:requestedRole==='coach'?'':skaterName,...(requestedRole==='coach'?{coachName}:{}),linkExisting:adminLink,...(pilot?{pilotInvitation:pilot.token}:{})}:emailLogin?{email:identifier,password}:{username:identifier,password};
      const response=await apiFetch('/api/auth/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result:RegistrationResult=await response.json();
      if(!response.ok){
        if(response.status===429){const current=Date.now();setNow(current);setRetryAt(current+authRetrySeconds(response,result)*1000);}
        if(!register&&response.status===403&&(result.code==='EMAIL_NOT_VERIFIED'||result.message==='Verify your email before signing in.')){
          setPassword('');setVerification({email:emailLogin?identifier:'',reason:'sign-in'});return;
        }
        setError(authProblem(response.status,result));
        return;
      }
      setPassword('');setConfirm('');
      if(register&&result.user&&!result.token){
        // Legacy Workers expose pilot mode only in a header. Native adapters can strip that header.
        const silentSignIn=result.registrationMode?result.registrationMode!=='verification':response.headers.get('X-HSC-Registration-Mode')==='pilot'||!!pilot||(adminLink&&config==='invite-only');
        if(!silentSignIn){
          setVerification({email:result.user.email,reason:result.verificationDelivery==='retry-needed'?'delivery-failed':'registered'});return;
        }
        const signed=await apiFetch('/api/auth/sign-in/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:body.password})});
        if(!signed.ok){setRegister(false);setError(authProblem(signed.status,await signed.json()));return;}
      }
      if(adminLink) {
        const linked=await apiFetch('/api/link-password',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
        const value=await linked.json() as {error?:string};if(!linked.ok){setError(value.error||'UNAVAILABLE');return;}
      }
      const session=await apiFetch('/api/member?action=session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:register?requestedRole:role})});
      const value=await session.json() as {error?:string;member?:Member};if(!session.ok){setError(value.error||'UNAVAILABLE');return;}
      await onComplete(value.member);
    }catch{setError('UNAVAILABLE');}finally{setBusy(false);}
  }

  if(verification)return <EmailVerificationPanel availability={availability} initialEmail={verification.email} reason={verification.reason} onReturnToSignIn={returnToSignIn}/>;
  const showForm=!register||(!checkingInvite&&!inviteFailed&&(allowAdminLink||!!pilot||config==='open'));
  return <section className="member-panel password-panel" id="hsc-login" aria-label={text('HSC account','HSC 账号')}>
    <div className="member-actions">
      <button type="button" disabled={busy||checkingInvite} aria-pressed={!register} className={!register?'selected':''} onClick={()=>chooseRegister(false)}>{text('Sign in','登录')}</button>
      <button type="button" disabled={busy||checkingInvite} aria-pressed={register} className={register?'selected':''} onClick={()=>chooseRegister(true)}>{text('Create an account','创建账号')}</button>
    </div>
    <h2>{register?text('Create your HSC account','创建 HSC 账号'):text('Sign in to HSC','登录 HSC')}</h2>
    {register&&!showForm&&<>
      {checkingInvite?<p role="status">{text('Checking your invitation…','正在核对你的邀请…')}</p>:
        inviteFailed?<button onClick={()=>setInviteAttempt(attempt=>attempt+1)}>{text('Check invitation again','重新核对邀请')}</button>:
        config==='loading'?<p role="status">{text('Checking registration availability…','正在查询注册状态…')}</p>:
        config==='failed'?<><p role="alert">{text('Registration availability could not be loaded.','暂时无法读取注册状态。')}</p><button onClick={availability.retry}>{text('Try again','重试')}</button></>:
        <p>{config==='closed'?text('Public registration is not open yet.','公开注册尚未开放。'):text('During this club test, open your personal invitation link to register.','俱乐部测试期间，请使用你的专属邀请链接注册。')}</p>}
    </>}
    {showForm&&<form onSubmit={submit}>
      {register&&pilot&&<p>{text('Your invitation is ready. Choose a username and password.','专属邀请已确认，请设置用户名和密码。')}</p>}
      <label>{register?text('Username','用户名'):text('Email or username','邮箱或用户名')}<input ref={signInInput} required value={username} onChange={event=>setUsername(event.target.value)} autoComplete="username" minLength={register?3:1} maxLength={register?30:254} pattern={register?'[a-zA-Z0-9_.]+':undefined} aria-describedby={register?id+'-username':undefined} spellCheck={false} autoCapitalize="none"/></label>
      {register&&<small id={id+'-username'}>{text('3–30 letters, numbers, underscores or periods.','3–30 位英文字母、数字、下划线或句点。')}</small>}
      <label>{text('Password','密码')}<input required type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete={register?'new-password':'current-password'} minLength={register?12:1} maxLength={128} aria-describedby={register?id+'-password':undefined}/></label>
      {register&&<>
        <small id={id+'-password'}>{text('Use 12–128 characters.','请输入 12–128 个字符。')}</small>
        <label>{text('Confirm password','确认密码')}<input required type="password" value={confirm} onChange={event=>setConfirm(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128}/></label>
        <label>{text('Your email','你的邮箱')}<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} readOnly={!!pilot} autoComplete="email" maxLength={254}/></label>
        {!adminLink&&<><label htmlFor={id+'-role'}>{text('Role','身份')}</label><select id={id+'-role'} required value={requestedRole} onChange={event=>setRequestedRole(event.target.value as Role)}>
          {(!pilot||pilot.role==='skater')&&<option value="skater">{text('Skater','选手')}</option>}{(!pilot||pilot.role==='parent')&&<option value="parent">{text('Parent','家长')}</option>}{(!pilot||pilot.role==='coach')&&<option value="coach">{text('Coach','教练')}</option>}
        </select>{requestedRole==='coach'?<RegistrationCoachPicker value={coachName} onChange={setCoachName} disabled={busy} pilotInvitation={pilot?.token}/>:<><RegistrationSkaterPicker value={skaterName} selected={!!selectedSkater&&selectedSkater===skaterName} disabled={busy} pilotInvitation={pilot?.token}
          onChange={value=>{setSkaterName(value);setSelectedSkater('');if(error==='SELECT_SKATER'||error==='SKATER_NOT_FOUND')setError('');}}
          onChoose={name=>{setSkaterName(name);setSelectedSkater(name);if(error==='SELECT_SKATER'||error==='SKATER_NOT_FOUND')setError('');}}/>
        <p id={id+'-skater'} className="member-muted">{text('Skaters choose their own name; parents choose their child.','选手选择本人姓名，家长选择孩子姓名。')}</p></>}</>}
      </>}
      {allowAdminLink&&<div className="member-check-row"><label><input type="checkbox" checked={link} onChange={event=>setLink(event.target.checked)}/>{text('Link these credentials to my current administrator account','将这些登录凭据关联到我当前的管理员账号')}</label><small>{text('Only for the signed-in administrator using the same email.','仅限已登录管理员使用同一邮箱。')}</small></div>}
      <button className="primary" disabled={busy||retrySeconds>0||(register&&!adminLink&&(requestedRole==='coach'?!coachName:!selectedSkater||selectedSkater!==skaterName))}>{busy?text('Please wait…','请稍候…'):register?text('Create account','创建账号'):text('Sign in','登录')}</button>
    </form>}
    {error&&<p role="alert" className="password-error">{authFeedback(error)}{error==='RATE_LIMITED'&&retrySeconds>0&&' '+(retrySeconds>=60?text('Try again in '+Math.ceil(retrySeconds/60)+' minute(s).','请在 '+Math.ceil(retrySeconds/60)+' 分钟后重试。'):text('Try again in '+retrySeconds+' seconds.','请在 '+retrySeconds+' 秒后重试。'))}</p>}
    {register&&error==='ACCOUNT_ALREADY_EXISTS'&&<div className="member-actions">
      <button onClick={()=>{setUsername(email.trim());chooseRegister(false);}}>{text('Sign in with this email','使用此邮箱登录')}</button>
      <button onClick={()=>{setPassword('');setConfirm('');setVerification({email:email.trim(),reason:'resend'});}}>{text('Request a verification link','申请验证链接')}</button>
    </div>}
    {!register&&<><details><summary>{text('Need to verify your email?','需要验证邮箱？')}</summary><EmailVerificationPanel availability={availability}/></details>
      <details><summary>{text('Forgot your password?','忘记密码？')}</summary><PasswordResetPanel availability={availability}/></details></>}
    {register&&showForm&&<p className="member-muted">{pilot?text('Your invitation gives access to shared schedules.','专属邀请可用于查看共享赛程。'):text('Verify your email after registering to view shared club schedules.','注册后请验证邮箱，即可查看俱乐部共享赛程。')} {text('Private access requires club approval.','私人资料访问权限由俱乐部另行审批。')}</p>}
  </section>;
}
