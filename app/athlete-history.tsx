'use client';
import {translate,text,useLanguage} from '../lib/i18n';
import {useMemo,useState} from 'react';
import type {HistoryRecord} from '../lib/club-types';
import {seasonOf,statusLabel} from '../lib/club-types';
import {emptyHistoryFilters,filterAthleteHistory,scoreTrend,historyCategories} from '../lib/athlete-history';
const seriesLabel=(value:string)=>value.replace(/ · (分项分数|类别总分|条目成绩)$/,(match,label)=>' · '+translate(label));
export default function AthleteHistory({records,onRecord,renderTable}:{records:HistoryRecord[];onRecord:(record:HistoryRecord)=>void;renderTable:(records:HistoryRecord[])=>React.ReactNode}){
  useLanguage();
  const [filters,setFilters]=useState({...emptyHistoryFilters}),[requestedSeries,setRequestedSeries]=useState('');
  const filtered=useMemo(()=>filterAthleteHistory(records,filters),[records,filters]);const {series,active,points}=useMemo(()=>scoreTrend(filtered,requestedSeries),[filtered,requestedSeries]);
  const categories=useMemo(()=>historyCategories(records.map(record=>record.category)),[records]);
  const title=active?seriesLabel(active.label):translate('暂无可绘制成绩');
  const scores=points.map(record=>Number(record.total_score));const min=scores.length?Math.min(...scores):0,max=scores.length?Math.max(...scores):0;const pad=Math.max((max-min)*.16,3),bottom=Math.max(0,min-pad),top=max+pad;
  const dates=points.map(r=>Date.parse(r.start_date+'T12:00:00Z'));const firstDate=dates.length?Math.min(...dates):0,lastDate=dates.length?Math.max(...dates):0;
  const chartX=(record:HistoryRecord)=>52+(lastDate>firstDate?(Date.parse(record.start_date+'T12:00:00Z')-firstDate)/(lastDate-firstDate):.5)*640;const chartY=(score:number)=>190-(score-bottom)/(top-bottom||1)*150;
  const events=[...new Map(records.map(r=>[r.event_key,r.event_name])).entries()];const statuses=['result','entry_list_only','start_order_only','withdrawn'];
  const set=(key:keyof typeof filters,value:string)=>setFilters(old=>({...old,[key]:value}));
  return <><div className="club-history-filters"><label>{translate("赛季")}<select aria-label={translate("档案赛季筛选")} value={filters.season} onChange={e=>set('season',e.target.value)}><option value="">{translate("所有赛季")}</option>{[...new Set(records.map(r=>seasonOf(r.start_date)))].sort().reverse().map(s=><option key={s}>{s}</option>)}</select></label><label>{translate("级别 / 项目")}<select aria-label={translate("档案项目筛选")} value={filters.category} onChange={e=>set('category',e.target.value)}><option value="">{translate("所有级别与项目")}</option>{categories.map(category=><option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label>{translate("成绩口径")}<select aria-label={translate("档案成绩口径筛选")} value={filters.level} onChange={e=>set('level',e.target.value)}><option value="">{translate("全部口径")}</option>{[...new Set(records.map(r=>r.result_level))].sort().map(s=><option key={s} value={s}>{{category:translate("类别总分"),segment:translate("分项成绩"),entry:translate("条目记录")}[s]||s}</option>)}</select></label><label>{translate("比赛")}<select aria-label={translate("档案比赛筛选")} value={filters.event} onChange={e=>set('event',e.target.value)}><option value="">{translate("所有比赛")}</option>{events.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>{translate("状态")}<select aria-label={translate("档案状态筛选")} value={filters.status} onChange={e=>set('status',e.target.value)}><option value="">{translate("全部状态")}</option>{statuses.map(s=><option key={s} value={s}>{translate(statusLabel(s))}</option>)}</select></label><label>{translate("搜索")}<input aria-label={translate("档案记录搜索")} value={filters.query} onChange={e=>set('query',e.target.value)} placeholder={translate("比赛、项目、代表俱乐部")}/></label><button onClick={()=>{setFilters({...emptyHistoryFilters});setRequestedSeries('');}}>{translate("重置筛选")}</button></div>
  <div className="club-history-summary" aria-live="polite"><strong>{filtered.length} {translate(" 条记录")}</strong><span>{new Set(filtered.map(r=>r.event_key)).size} {translate(" 场比赛")}</span><span>{filtered.filter(r=>r.status==='result').length} {translate(" 条已公布成绩")}</span><span>{filtered.filter(r=>r.status==='withdrawn').length} {translate(" 条退赛")}</span></div>
  <section className="club-history-chart">
    <div className="club-panel-heading"><h3>{translate("成绩趋势")}</h3><select aria-label={translate("成绩图表序列")} value={active?.label||''} onChange={event=>setRequestedSeries(event.target.value)} disabled={!series.length}>{series.length?series.map(group=><option key={group.label} value={group.label}>{seriesLabel(group.label)}</option>):<option value="">{translate("暂无可绘制成绩")}</option>}</select></div>
    <p>{text('Compare one broad category and score type at a time. Group numbers and NQ labels are combined; ages and programs remain separate. Original official category names are kept in the records below. Withdrawals and missing scores are not plotted as zero.','每次查看一个大类和成绩口径，合并 Group 分组与 NQ 写法；年龄、Short/Free 等项目仍分开。下方记录保留官网原始类别，退赛和缺失分数不画成 0。')}</p>
    {points.length?<>
      <svg viewBox="0 0 740 240" className="club-score-chart" role="img" aria-label={translate("{0}，{1}条成绩趋势",[title,points.length])}>
        <title>{`${title} ${translate(" 成绩趋势")}`}</title>
        {[0,.5,1].map(fraction=>{const score=bottom+(top-bottom)*fraction;return <g key={fraction}><line x1="52" x2="692" y1={chartY(score)} y2={chartY(score)} className="chart-grid"/><text x="44" y={chartY(score)+4} textAnchor="end">{score.toFixed(1)}</text></g>;})}
        {points.length>1&&<polyline fill="none" className="chart-series" points={points.map(record=>`${chartX(record)},${chartY(Number(record.total_score))}`).join(' ')}/>}
        {points.map(record=><a key={record.record_id} href="#record-details" onClick={event=>{event.preventDefault();onRecord(record);}} aria-label={`${record.start_date} · ${record.event_name} · ${title} · ${record.total_score} ${translate(" 分")}`}><circle cx={chartX(record)} cy={chartY(Number(record.total_score))} r="5" className="chart-point"/><title>{`${record.start_date} · ${record.event_name} · ${title} · ${record.total_score} ${translate(" 分")}`}</title></a>)}
        <text x={chartX(points[0])} y="220" textAnchor="middle">{points[0].start_date}</text>
        {lastDate>firstDate&&<text x={chartX(points[points.length-1])} y="220" textAnchor="middle">{points[points.length-1].start_date}</text>}
      </svg>
      <div className="club-history-summary"><span>{translate("图表 ")}{points.length} {translate(" 条")}</span><span>{translate("最佳 ")}{max.toFixed(2)}</span><span>{translate("最近 ")}{Number(points.at(-1)?.total_score).toFixed(2)}</span></div>
      <details><summary>{translate("查看图表数据与来源")}</summary><ul>{points.map(record=><li key={record.record_id}><button className="club-text-button" onClick={()=>onRecord(record)}>{record.start_date} · {record.event_name} · {record.category} · {record.total_score} {translate(" 分")}</button></li>)}</ul></details>
    </>:<div className="club-empty"><h3>{translate("当前筛选暂无可绘制成绩")}</h3><p>{translate("报名、出场名单与退赛仍可在下表查看。")}</p></div>}
  </section>
  <div className="club-history-status-bars" aria-label={translate("记录状态分布")}>{statuses.map(status=>{const n=filtered.filter(r=>r.status===status).length;return <div key={status}><span>{translate(statusLabel(status))}</span><progress value={n} max={Math.max(filtered.length,1)}/><b>{n}</b></div>;})}</div>{filtered.length?renderTable(filtered):<div className="club-empty"><h3>{translate("没有符合筛选条件的记录")}</h3><p>{translate("可以重置筛选，或更换赛季、比赛及项目。")}</p></div>}</>;
}
