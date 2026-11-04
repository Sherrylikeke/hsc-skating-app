import {extractTextItems,getDocumentProxy} from 'unpdf';
import type {PdfItem} from './official-parser';
export async function readOfficialPdfItems(bytes:Uint8Array):Promise<PdfItem[][]>{
  const pdf=await getDocumentProxy(bytes,{maxImageSize:1_000_000,disableFontFace:true});
    if(pdf.numPages>20)throw new Error('文件页数超出已验证范围，保留原始链接');
    const pages=(await extractTextItems(pdf)).items;
    return await Promise.all(pages.map(async(items,index)=>{
      const page=await pdf.getPage(index+1);if(!page.rotate)return items;
      const view=page.getViewport({scale:1});
      return items.map(item=>{const [x,y]=view.convertToViewportPoint(item.x,item.y);return {...item,x,y:view.height-y};});
    }));
}
