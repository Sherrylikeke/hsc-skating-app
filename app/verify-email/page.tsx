'use client';
import {useEffect,useState} from 'react';
import {LanguageSwitch,text,useLanguage} from '../../lib/i18n';
import EmailVerificationPanel from '../email-verification-panel';
import {useAuthAvailability} from '../auth-availability';
import '../member.css';

export default function VerifyEmailPage(){
  useLanguage();
  const availability=useAuthAvailability();
  const [status,setStatus]=useState<'loading'|'verified'|'error'|'pending'>('loading');
  useEffect(()=>{
    const params=new URLSearchParams(location.search);
    setStatus(params.get('error')?'error':params.get('verified')==='1'?'verified':'pending');
  },[]);
  return <main className="member-app"><LanguageSwitch/>
    {status==='loading'?<p role="status">{text('Loading…','正在读取…')}</p>:<>
      <section className="member-panel">
        <h1>{status==='verified'?text('Email verification complete','邮箱验证已完成'):status==='error'?text('This link is invalid or has expired','链接无效或已过期'):text('Email verification','邮箱验证')}</h1>
        {status==='verified'?<>
          <p>{text('Sign in to see your skaters’ schedules.','请登录查看你的选手赛程。')}</p>
          <a className="member-button" href="/">{text('Sign in','登录')}</a>
          <p><a href="hscskating://verify-email?verified=1">{text('Open the installed HSC app','打开已安装的 HSC 应用')}</a></p>
        </>:null}
      </section>
      {status!=='verified'&&<EmailVerificationPanel availability={availability}/>}
    </>}
  </main>;
}
