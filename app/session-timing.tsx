import type {ClubEvent,ScheduleRow} from '../lib/club-types';
import {coachTimingEstimate} from '../lib/coach-timing';
import {text} from '../lib/i18n';

export default function SessionTiming({row,event}:{row:ScheduleRow;event?:ClubEvent}){
  if(row.activity!=='competition')return null;
  const official=row.startingOrder?.individualTime;
  const estimate=event?coachTimingEstimate(row,event):null;
  if(!official&&!estimate)return <small>{text('Individual time pending','个人时间待公布')}</small>;
  return <>
    {official&&<small>{text('Official individual time','官方个人时间')} · <b>{official}</b></small>}
    {estimate&&<small>{text('Estimated warm-up','预计上冰热身')} · <b>{estimate.warmup}</b></small>}
    {estimate&&!official&&<small>{text('Estimated skate start','预计开滑')} · <b>{estimate.start}</b></small>}
  </>;
}
