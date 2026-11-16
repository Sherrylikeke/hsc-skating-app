'use client';
import {useEffect,useRef,useState} from 'react';
import {apiFetch} from '../lib/client-platform';
import {readMemberResponse} from '../lib/member-client';
import {text} from '../lib/i18n';
import './calendar-subscription.css';

type Props={memberId:string};
type SubscriptionResponse={active:boolean;url?:string};
export default function CalendarSubscription({memberId}:Props) {
  const [active,setActive]=useState(false),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false);
  const [url,setURL]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    let current=true;
    setLoaded(false);setActive(false);setURL('');setNotice('');setError('');
    async function read(){
      try{
        const response=await apiFetch('/api/calendar/subscription');
        const result=await readMemberResponse<SubscriptionResponse>(response,text('Unable to load subscription.','无法读取订阅。'));
        if(current){setActive(result.active===true);setLoaded(true);}
      }catch(error){if(current)setError(error instanceof Error?error.message:text('Unable to load subscription.','无法读取订阅。'));}
    }
    void read();
    return ()=>{current=false;};
  },[memberId]);
  async function update(action:'create'|'replace'|'revoke') {
    setBusy(true);setError('');setNotice('');
    try{
      const response=await apiFetch('/api/calendar/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
      const result=await readMemberResponse<SubscriptionResponse>(response,text('Unable to update subscription.','订阅更新失败。'));
      setActive(result.active===true);setURL(typeof result.url==='string'?result.url:'');
      setNotice(action==='revoke'?text('Subscription revoked. The old URL no longer works. Remove its saved events in your calendar app if needed.','订阅已撤销，旧网址已失效。日历应用中的已有副本请按需自行删除。'):action==='replace'?text('New URL created. The previous URL no longer works; update your calendar app.','已生成新网址，旧网址已失效；请在日历应用中更换。'):text('Subscription created. Save this URL now; it is shown only here.','订阅已创建，请现在保存网址；之后无法再次查看。'));
    }catch(error){setError(error instanceof Error?error.message:text('Unable to update subscription.','订阅更新失败。'));}
    finally{setBusy(false);}
  }
  async function copy() {
    try{await navigator.clipboard.writeText(url);setNotice(text('Subscription URL copied.','订阅网址已复制。'));}
    catch{input.current?.focus();input.current?.select();setNotice(text('Select and copy the URL above.','请选中并复制上方网址。'));}
  }
  return <section className="calendar-subscription" aria-label={text('Calendar subscription','日历订阅')}>
    <h3>{text('Subscribe to My Skaters','订阅我的选手日历')}</h3>
    <p>{text('Adds confirmed official group times for your current My Skaters. Updates follow changes to My Skaters and official schedules.','仅收录当前“我的选手”已确定的官方组别时段，并跟随选手列表及官方赛程更新。')}</p>
    <p>{text('Add the URL using “Subscribe / From URL” in your calendar app. The app controls refresh timing; check HSC before leaving.','在日历应用中选择“订阅／通过网址添加”。刷新时间由日历应用决定，出发前请在 HSC 核对。')}</p>
    <p>{text('Anyone with this URL can read these official entries. Keep it private; replace or revoke it at any time. Private notes and coach plans are excluded.','持有网址的人可读取这些官方日程，请妥善保管；可随时更换或撤销，不包含私人备注和教练安排。')}</p>
    {loaded?<div className="calendar-subscription-actions">
      {active?<><span>{text('Subscription active','订阅已启用')}</span><button type="button" disabled={busy} onClick={()=>void update('replace')}>{text('Replace URL','更换网址')}</button><button type="button" disabled={busy} onClick={()=>void update('revoke')}>{text('Revoke subscription','撤销订阅')}</button></>:<button type="button" disabled={busy} onClick={()=>void update('create')}>{text('Create subscription URL','创建订阅网址')}</button>}
    </div>:!error&&<p role="status">{text('Loading subscription…','正在读取订阅…')}</p>}
    {url&&<div className="calendar-subscription-url"><label htmlFor="calendar-subscription-url">{text('Save this private URL now; it cannot be retrieved later.','请现在保存此私人网址，之后无法再次读取。')}</label><div><input ref={input} id="calendar-subscription-url" type="text" readOnly value={url} spellCheck={false} onFocus={event=>event.currentTarget.select()}/><button type="button" onClick={()=>void copy()}>{text('Copy URL','复制网址')}</button></div></div>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}
