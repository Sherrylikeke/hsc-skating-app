'use client';
import {LanguageSwitch} from '../../lib/i18n';
import PasswordResetPanel from '../password-reset-panel';
import '../member.css';
export default function ResetPasswordPage(){
  return <main className="member-app"><LanguageSwitch/><PasswordResetPanel complete/></main>;
}
