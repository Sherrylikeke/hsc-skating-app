import {StrictMode,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import MemberApp from '../../app/member-app';
import ClubApp from '../../app/club-app';
import CoachEditor from '../../app/coach-editor';
import VerifyEmailPage from '../../app/verify-email/page';
import ResetPasswordPage from '../../app/reset-password/page';
import {bootstrap} from './native';
import '../../app/globals.css';
import '../../app/club.css';
import '../../app/member.css';
import '../../app/i18n.css';
import './native.css';

function Router(){
  const [path,setPath]=useState(location.pathname);
  const [query,setQuery]=useState(location.search);
  useEffect(()=>{const changed=()=>{setPath(location.pathname);setQuery(location.search);};window.addEventListener('popstate',changed);return()=>window.removeEventListener('popstate',changed);},[]);
  return path==='/workspace'?<ClubApp/>:path==='/coaches'?<CoachEditor/>:path==='/verify-email'?<VerifyEmailPage key={query}/>:path==='/reset-password'?<ResetPasswordPage key={query}/>:<MemberApp/>;
}
const root=createRoot(document.getElementById('root')!);
bootstrap().then(()=>root.render(<StrictMode><Router/></StrictMode>)).catch(()=>root.render(<main><h1>HSC Skating</h1><p>Secure device storage could not be opened. Please unlock your phone and restart the app. / 请解锁手机后重新打开应用。</p></main>));
