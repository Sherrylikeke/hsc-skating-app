import type {ClubEvent,ScheduleRow} from '../lib/club-types';
import {coachTimingEstimate} from '../lib/coach-timing';
import {text} from '../lib/i18n';

export default function SessionTiming({row,event,compact=false}:{row:ScheduleRow;event?:ClubEvent;compact?:boolean}){
  if(row.activity!=='competition')return null;
  const official=row.startingOrder?.individualTime;
  const estimate=event?coachTimingEstimate(row,event):null;
  if(!official&&!estimate){
    if(compact)return null;
    const order=row.startingOrder;
    const reason=!order?text('Starting order needs matching','出场顺序待匹配'):
      !order.warmupGroup?text('Warm-up group needs confirmation','热身分组待确认'):
      row.uncertain?text('Group time needs confirmation','组别时段待确认'):
      /\/\s*STAR\s*\d+\b/i.test(row.category)?text('Shared session, individual time needs confirmation','共用组别时段，个人时间待确认'):
      text('Individual estimate needs confirmation','个人预计时间待核对');
    return <small>{reason}</small>;
  }
  return <>
    {official&&<small>{compact?text('Official','官方个人'):text('Official individual time','官方个人时间')} · <b>{official}</b></small>}
    {estimate&&<small>{compact?text('Est. warm-up','预计热身'):text('Estimated warm-up','预计上冰热身')} · <b>{estimate.warmup}</b></small>}
    {estimate&&!official&&<small>{compact?text('Est. skate','预计开滑'):text('Estimated skate start','预计开滑')} · <b>{estimate.start}</b></small>}
  </>;
}
