'use client';
import {LanguageSwitch} from '../../lib/i18n';
import PasswordResetPanel from '../password-reset-panel';
import {useAuthAvailability} from '../auth-availability';
import '../member.css';
export default function ResetPasswordPage(){
  const availability=useAuthAvailability();
  return <main className="member-app"><LanguageSwitch/><PasswordResetPanel complete availability={availability}/></main>;
}
