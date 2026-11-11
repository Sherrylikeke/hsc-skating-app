import type {Participant} from './club-types.ts';
import type {PdfItem} from './official-parser.ts';
import {categoryKey,normalizeName} from './official-parser.ts';

// Verified spreadsheet export: centered category headings and aligned first / last / club columns.
// Unlike the final DSTools format, this official interim list has no total or column headers.
export function parseInterimEntryPdf(pages:PdfItem[][],sourceUrl:string,roster:Array<{id:string;name:string;identityPending?:boolean}>):Participant[]{
  if(!pages[0]?.some(item=>/^Interim Entry Lists?(?: by Category)?$/i.test(item.str.trim())))throw Error('临时名单缺少官方标题');
  const categoryColumn=pages[0].some(item=>/^Interim Entry Lists? by Category$/i.test(item.str.trim()));
  const validCategory=(text:string)=>/^(?:STAR\s*(?:10|[1-9])(?:\s*\/\s*[1-9])?(?:\s+(?:(?:Girls|Boys)\s+[UO]\d+|(?:Team\s+)?Elements|Solo Dance))?|(?:Creative Improv|(?:Group|Individual) Showcase)\s*\d+)$/i.test(text);
  const names=new Map<string,string[]>();
  for(const skater of roster)if(!skater.identityPending){const key=normalizeName(skater.name);names.set(key,[...(names.get(key)||[]),skater.id]);}
  const rows:Participant[]=[];let category='',columns:number[]|undefined,categoryX:number|undefined;
  for(const [page,items] of pages.entries()){
    const lines:Array<{y:number;items:PdfItem[]}>=[];
    for(const item of [...items].filter(item=>item.str.trim()).sort((a,b)=>b.y-a.y||a.x-b.x)){
      let line=lines.find(line=>Math.abs(line.y-item.y)<2.5);if(!line){line={y:item.y,items:[]};lines.push(line);}line.items.push(item);
    }
    for(const line of lines){
      let cells=line.items.sort((a,b)=>a.x-b.x);const text=cells.map(item=>item.str).join(' ').trim();
      if(categoryColumn){
        if(!category&&page===0&&!(cells.length===4&&validCategory(cells[0].str)))continue;
        if(cells.length===4&&validCategory(cells[0].str)&&(!columns||cells[0].x<columns[0]-20)){
          if(categoryX!==undefined&&Math.abs(categoryX-cells[0].x)>4)throw Error('临时名单类别列位置待核对');
          categoryX=cells[0].x;category=cells[0].str;cells=cells.slice(1);
        }
      }
      if(!categoryColumn&&cells.length===1&&validCategory(text)&&categoryKey(text)){category=text;continue;}
      if(!category&&page===0)continue;
      if(!category)throw Error('临时名单缺少类别');
      if(!columns){
        if(cells.length!==3||!/(?:\b[FS]SC\b|\bSC\b|Skating|Academy|Club|School)/i.test(cells[2].str)||cells[1].x-cells[0].x<40||cells[2].x-cells[1].x<40)throw Error('临时名单分列格式待核对');
        columns=cells.map(item=>item.x);
      }
      const values=columns.map(x=>cells.filter(item=>Math.abs(item.x-x)<4).map(item=>item.str).join(' ').trim());
      if(cells.some(item=>!columns!.some(x=>Math.abs(item.x-x)<4))||values.some(value=>!value)||values.length!==3)throw Error(`临时名单第 ${page+1} 页存在无法可靠分列的报名行`);
      const name=values[0]+' '+values[1],matches=names.get(normalizeName(name))||[],skaterIds=matches.length===1?matches:[];
      const id=category+'|'+normalizeName(name)+'|'+values[2];if(rows.some(row=>row.id===id))throw Error('临时名单存在重复报名行，待核对');
      rows.push({id,name,category,club:values[2],section:'',skaterIds,matchStatus:skaterIds.length?'官方临时名单同名匹配，身份待核对':'其他参赛者',sourceUrl});
    }
  }
  if(!rows.length)throw Error('临时名单没有可确认的报名行');
  return rows;
}
