import type {Participant} from './club-types';
import type {PdfItem} from './official-parser';
import {normalizeName} from './official-parser.ts';
import {parseInterimEntryPdf} from './interim-entry-pdf.ts';

export function parseEntryPdf(pages:PdfItem[][],sourceUrl:string,roster:Array<{id:string;name:string;identityPending?:boolean}>):Participant[]{
  if(pages[0]?.some(item=>/^Interim Entry Lists?(?: by Category)?$/i.test(item.str.trim()))&&!pages[0].some(item=>item.str.trim()==='Name'))return parseInterimEntryPdf(pages,sourceUrl,roster);
  const rows:Participant[]=[];const expected=new Set<number>();
  const names=new Map<string,string[]>();
  for(const skater of roster){if(skater.identityPending)continue;const name=normalizeName(skater.name);names.set(name,[...(names.get(name)||[]),skater.id]);}
  for(const [page,items] of pages.entries()){
    const header=items.find(item=>item.str.trim()==='Name');
    const club=items.find(item=>item.str.trim()==='Club'&&header&&Math.abs(item.y-header.y)<3);
    const section=items.find(item=>item.str.trim()==='Section'&&header&&Math.abs(item.y-header.y)<3);
    const category=items.filter(item=>header&&item.y>header.y&&/^Category\s*:/i.test(item.str.trim())).sort((first,second)=>first.y-second.y)[0]?.str.replace(/^Category\s*:\s*/i,'').trim();
    if(!header||!club||!section||!category||!(header.x<club.x&&club.x<section.x))throw new Error(`报名 PDF 第 ${page+1} 页缺少已验证的类别或姓名/俱乐部/地区表头`);
    const footer=items.filter(item=>/^Number Entries\s*:/i.test(item.str.trim())).sort((first,second)=>second.y-first.y)[0];
    const bottom=footer?.y??items.find(item=>/^Date:$/.test(item.str.trim()))?.y;
    if(bottom===undefined)throw new Error(`报名 PDF 第 ${page+1} 页缺少可确认的表格边界`);
    if(footer){const text=items.filter(item=>Math.abs(item.y-footer.y)<3).sort((first,second)=>first.x-second.x).map(item=>item.str).join(' ');const count=text.match(/Number Entries\s*:\s*(\d+)/i);if(!count)throw new Error('报名 PDF 总人数无法核对');expected.add(Number(count[1]));}
    const content=items.filter(item=>item.str.trim()&&item.y<header.y-3&&item.y>bottom+3).sort((first,second)=>second.y-first.y||first.x-second.x);
    const lines:Array<{y:number;items:PdfItem[]}>=[];
    for(const item of content){let line=lines.find(value=>Math.abs(value.y-item.y)<2.5);if(!line){line={y:item.y,items:[]};lines.push(line);}line.items.push(item);}
    for(const line of lines){
      const cell=(left:number,right:number)=>line.items.filter(item=>item.x>=left&&item.x<right).sort((first,second)=>first.x-second.x).map(item=>item.str).join(' ').replace(/\s+/g,' ').trim();
      const name=cell(header.x-6,club.x-8),clubName=cell(club.x-8,section.x-8),sectionName=cell(section.x-8,Infinity);
      if(!name||!clubName||!/^\p{L}{2,4}$/u.test(sectionName))throw new Error(`报名 PDF 第 ${page+1} 页存在无法可靠分列的报名行`);
      const skaterIds=name.split(/\s*\/\s*/).flatMap(part=>{const matches=names.get(normalizeName(part))||[];return matches.length===1?matches:[];});
      rows.push({id:`${category}|${name}`,name,category,club:clubName,section:sectionName,skaterIds:[...new Set(skaterIds)],matchStatus:skaterIds.length?'官方名单同名匹配，身份待核对':'其他参赛者',sourceUrl});
    }
  }
  if(expected.size!==1||![...expected].includes(rows.length))throw new Error('报名 PDF 行数与官方 Number Entries 不一致，保留上次有效名单');
  return rows;
}
