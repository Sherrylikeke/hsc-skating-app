import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {IncomingMessage,ServerResponse} from 'node:http';

// Shared by Web and Capacitor: emit the actual installed licenses with every build.
export function fullCalendarNotice() {
  const packages=['@fullcalendar/react','@fullcalendar/core','@full-ui/headless-calendar','temporal-polyfill'];
  const source='HSC third-party notices: FullCalendar Standard and its calendar dependencies\n\n'+packages.map(name=>{
    const root=new URL('../node_modules/'+name+'/',import.meta.url);
    const pkg=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
    const license=readFileSync(fileURLToPath(new URL(name==='temporal-polyfill'?'LICENSE':'LICENSE.md',root)),'utf8');
    if(pkg.license!=='MIT'||!license.includes('Permission is hereby granted'))throw new Error('Review calendar license: '+name);
    return name+' '+pkg.version+'\n'+license;
  }).join('\n\n');
  return {name:'hsc-fullcalendar-notice',configureServer(server:{middlewares:{use:(handler:(req:IncomingMessage,res:ServerResponse,next:()=>void)=>void)=>void}}){
    server.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]!=='/third-party/fullcalendar.txt')return next();
      res.setHeader('Content-Type','text/plain; charset=utf-8');res.end(source);
    });
  },generateBundle(this:{emitFile:(asset:{type:'asset';fileName:string;source:string})=>void}){
    this.emitFile({type:'asset',fileName:'third-party/fullcalendar.txt',source});
  }};
}
