'use client';
import {useEffect,useState} from 'react';
import {LanguageSwitch,text,useLanguage} from '../../lib/i18n';
import EmailVerificationPanel from '../email-verification-panel';
import '../member.css';
export default function VerifyEmailPage(){
  useLanguage();
  const [status,setStatus]=useState('');
  useEffect(()=>{const params=new URLSearchParams(location.search);setStatus(params.get('error')?'error':params.get('verified')==='1'?'verified':'pending');},[]);
  return <main className="member-app"><LanguageSwitch/><section className="member-panel"><h1>{status==='verified'?text('Email verification complete','邮箱验证已完成'):status==='error'?text('This link is invalid or has expired','链接无效或已过期'):text('Email verification','邮箱验证')}</h1><p>{status==='verified'?text('Sign in to continue to your skater homepage. Email verification does not grant private roles or relationships.','请登录进入你的选手主页。邮箱验证不会授予私人角色或选手关系。'):text('Request a new verification link below.','请在下方申请新的验证链接。')}</p>{status==='verified'&&<p><a href="hscskating://verify-email?verified=1">{text('Open HSC app','打开 HSC 应用')}</a></p>}<a href="/">{text('Sign in','登录')}</a></section>{status!=='verified'&&<EmailVerificationPanel/>}</main>;
}
