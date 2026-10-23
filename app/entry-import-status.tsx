'use client';
import {text,useLanguage} from '../lib/i18n';
import type {OfficialDocument} from '../lib/club-types';
import {ENTRY_PDF_VERSION} from '../lib/club-types';

export default function EntryImportStatus({documents}:{documents:OfficialDocument[]}){
  useLanguage();const files=documents.flatMap(document=>(document.entryFiles||[]).map(file=>({...file,current:!!file.checkedAt&&!file.error&&file.parserVersion===ENTRY_PDF_VERSION&&file.matchingRosterHash===document.matchingRosterHash})));if(!files.length)return null;
  const checked=files.filter(file=>file.current).length;
  return <section className="club-panel club-source-status"><h2>{text('Entry PDF import progress','报名 PDF 导入进度')}</h2><p>{text('Verified files: ','已核对文件：')}{checked}/{files.length}{text('. Each source check processes at most four PDFs. Other files wait for a later batch; failed files keep their previous valid records.','. 每次来源检查最多处理四份 PDF；其他文件等待后续批次，失败文件保留上次有效资料。')}</p><details><summary>{text('View file sources and pending checks','查看文件来源和待核对项目')}</summary><ul style={{overflowWrap:'anywhere'}}>{files.map(file=><li key={file.url}><a href={file.url} target="_blank" rel="noreferrer">{new URL(file.url).pathname.split('/').pop()}</a>{' — '}{file.error||(!file.current?text('Waiting for a later batch','等待后续批次'):text('Verified','已核对'))}</li>)}</ul></details></section>;
}
