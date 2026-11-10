import type {ClubEvent,ScheduleRow} from '../lib/club-types';
import {coachTimingEstimate} from '../lib/coach-timing';
import {text} from '../lib/i18n';

export default function SessionTiming({row,event}:{row:ScheduleRow;event?:ClubEvent}){
  if(row.activity!=='competition')return null;
  const official=row.startingOrder?.individualTime;
  const estimate=event?coachTimingEstimate(row,event):null;
  if(!official&&!estimate){
    const order=row.startingOrder;
    const reason=!order?text('Starting order not yet available','出场顺序尚未读取或公布'):
      !order.warmupGroup?text('Warm-up group needs confirmation','热身分组待确认'):
      row.uncertain?text('Group time needs confirmation','组别时段待确认'):
      text('Individual estimate needs confirmation','个人预计时间待核对');
    return <small>{reason}</small>;
  }
  return <>
    {official&&<small>{text('Official individual time','官方个人时间')} · <b>{official}</b></small>}
    {estimate&&<small>{text('Estimated warm-up','预计上冰热身')} · <b>{estimate.warmup}</b></small>}
    {estimate&&!official&&<small>{text('Estimated skate start','预计开滑')} · <b>{estimate.start}</b></small>}
  </>;
}
