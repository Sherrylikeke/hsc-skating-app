export type PasteRow = {id:string;name:string};
const normalize = (value:string) => value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ');

export function parseClipboard(text:string):string[][] {
  const rows:string[][]=[]; let row:string[]=[]; let cell=''; let quoted=false;
  text = text.replace(/\r\n?/g,'\n');
  for(let i=0;i<text.length;i++) {
    const char=text[i];
    if(char==='"' && (quoted || cell==='')) {
      if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
    } else if(!quoted && (char==='\t' || char==='\n')) {
      row.push(cell);cell='';
      if(char==='\n'){rows.push(row);row=[];}
    }else cell+=char;
  }
  if(quoted) throw new Error('粘贴内容的引号未闭合');
  if(cell!=='' || row.length || !text.endsWith('\n')){row.push(cell);rows.push(row);}
  return rows;
}

export function planPaste(text:string, visible:PasteRow[], all:PasteRow[], startId:string) {
  let rows=parseClipboard(text);
  if(rows[0]?.length===2 && /^(姓名|选手|选手姓名|name|skater)$/i.test(rows[0][0].trim())) rows=rows.slice(1);
  if(!rows.length) throw new Error('请先粘贴教练信息');
  const width=rows[0].length;
  if((width!==1 && width!==2) || rows.some(row=>row.length!==width)) throw new Error('请粘贴一列教练，或两列「选手姓名 + 教练」');
  const changes:{id:string;coach:string}[]=[];
  const seen=new Set<string>();
  const start=visible.findIndex(row=>row.id===startId);
  for(let i=0;i<rows.length;i++){
    let target:PasteRow;
    if(width===1){
      if(start<0 || start+rows.length>visible.length) throw new Error('粘贴行数超出当前名单，请检查起始选手或筛选条件');
      target=visible[start+i];
    }else{
      const matches=all.filter(row=>normalize(row.name)===normalize(rows[i][0]) || row.id===rows[i][0].trim());
      if(matches.length!==1) throw new Error(`第 ${i+1} 行无法唯一匹配选手：${rows[i][0]}`);
      target=matches[0];
    }
    const coach=rows[i][width-1].trim();
    if(/[\n\t\x00]/.test(coach) || coach.length>500) throw new Error(`第 ${i+1} 行教练信息格式无效`);
    if(seen.has(target.id)) throw new Error(`选手重复：${target.name}`);
    seen.add(target.id);changes.push({id:target.id,coach});
  }
  return changes;
}
