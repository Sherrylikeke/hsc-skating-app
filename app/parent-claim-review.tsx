'use client';
import {useState} from 'react';
import {text} from '../lib/i18n';
import type {Candidate} from '../lib/member-access';
import {parentClaimExistingSkater,type ParentClaimPayload} from '../lib/parent-claim-review';

export default function ParentClaimReview({id,payload,accountName,email,candidates,admissions,busy,onPrepare,onReview}:{id:string;payload:ParentClaimPayload;accountName:string;email?:string;candidates:Candidate[];admissions:{skater_id:string;admitted:number}[];busy:boolean;onPrepare:(id:string,name:string)=>void;onReview:(approve:boolean,ids:string[])=>void}){
 const [selected,setSelected]=useState(payload.skaterIds.length===1?payload.skaterIds[0]:'');
 const candidate=candidates.find(row=>row.id===selected);
 const existing=parentClaimExistingSkater(payload,candidate);
 const admitted=!!candidate&&admissions.some(row=>row.skater_id===selected&&row.admitted===1);
 const options=payload.registrationMatch!=='missing'&&payload.skaterIds.length?candidates.filter(row=>payload.skaterIds.includes(row.id)):candidates;
 return <article className="member-notice parent-claim-review" data-claim-id={id}>
  <h3>{accountName} · {text('Parent','家长')}</h3><p>{email}</p>
  <p>{text('Child name submitted: ','提交的孩子姓名：')}{payload.name}</p>
  <p>{payload.registrationMatch==='missing'||!payload.skaterIds.length?text('Skater admission required. Verify the child, then select or create the skater profile before approving the parent relationship.','需核验选手准入。确认孩子身份后，选择或新增选手档案，再批准亲子关系。'):text('HSC skater match found. Confirm the correct profile and approve the parent relationship; a separate admission step is not required for an identified existing skater.','已匹配 HSC 选手。核对正确档案后批准亲子关系；身份明确的库内选手无需单独重复准入。')}</p>
  {payload.skaterIds.length>1&&<p>{text('Several profiles share this name. Select the correct child; no relationship is created automatically.','此姓名对应多个档案，请选择正确的孩子；系统不会自动建立关系。')}</p>}
  <label>{text('Skater to link','要关联的选手')}<select value={selected} disabled={busy} onChange={event=>setSelected(event.target.value)}><option value="">{text('Select a skater','选择选手')}</option>{selected&&!candidate&&<option value={selected}>{payload.name} · {text('Awaiting admission','待准入')}</option>}{options.map(row=><option key={row.id} value={row.id}>{row.name} · {row.id}</option>)}</select></label>
  {!existing&&!admitted&&<button type="button" disabled={busy} onClick={()=>{const next=selected||'HSC-NEW-'+crypto.randomUUID();setSelected(next);onPrepare(next,candidate?.name||payload.name);}}>{text('Review skater admission','核验选手准入')}</button>}
  <div className="member-actions"><button disabled={busy||!candidate||!existing&&!admitted} onClick={()=>onReview(true,[selected])}>{text('Approve parent relationship','批准亲子关系')}</button><button disabled={busy} onClick={()=>onReview(false,[])}>{text('Reject application','拒绝申请')}</button></div>
 </article>;
}
