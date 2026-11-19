// Import the inspected public snapshot, never member or financial exports.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('work/portal-inventory-2026-11-18/deep-review');
const source=JSON.parse(fs.readFileSync(path.join(root,'pages.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync('work/portal-v1/asset-manifest.json','utf8'));
const assets=Array.isArray(manifest)?manifest:manifest.assets;
const origin='https://hamiltonskating.uplifterinc.com';
const key=value=>{try{const u=new URL(value,origin);return u.origin+decodeURIComponent(u.pathname);}catch{return value;}};
const local=new Map(assets.flatMap(a=>[a.sourceUrl,...(a.sourceUrls||[])].map(u=>[key(u),a.localPath])));
const clean=text=>String(text||'').replace(/\r/g,'').replace(/\u00a0/g,' ').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
const link=value=>{try{const u=new URL(value,origin);if(local.has(key(value)))return local.get(key(value));return u.origin===origin?u.pathname+u.search+u.hash:u.href;}catch{return '';}};
const pages=source.map(p=>({path:new URL(p.url).pathname,title:clean(p.title).replace(/\s*::.*$/,'').trim(),body:clean(p.content),source:p.url,images:p.images.filter(i=>local.has(key(i.src))&&!/top_header|Screenshot%202026-05-28/.test(i.src)).map(i=>({src:local.get(key(i.src)),alt:clean(i.alt)})),links:[...new Map(p.links.filter(l=>l.text&&l.url&&!/^javascript:/.test(l.url)).map(l=>[l.url,{label:clean(l.text),href:link(l.url)}])).values()],videos:(p.frames||[]).map(f=>typeof f==='string'?f:f.src).filter(Boolean)}));
const titles={'/':'Home','/about-us/':'About Us','/our-programs/':'Our Programs','/our-coaches/':'Our Coaches','/club-resources/':'Club Resources','/registration/':'Program Registration','/schedule/':'Schedule','/news/':'News','/login/':'Login','/sitemap/':'Sitemap','/registration/products/':'Products','/registration/subscriptions/':'Annual Membership','/volunteering/search/':'Volunteering','/forgot-password.php':'Forgot Password'};
for(const p of pages){if(titles[p.path])p.title=titles[p.path];if(!p.title)p.title=p.path.split('/').filter(Boolean).at(-1)?.replaceAll('-',' ')||'Home';}
const productText=pages.find(p=>p.path==='/registration/products/').body;
const products=[];
for(const match of productText.matchAll(/([\s\S]*?)\nCost:\s*\n?\$([\d,.]+)([^\n]*)/g)){
 let body=match[1].trim().replace(/^Add Program\nPurchase Subscriptions\nAdd Volunteer Position\nItems for Purchase\n/,'');
 const lines=body.split('\n').map(s=>s.trim()).filter(Boolean);const name=lines.shift();
 products.push({id:'snapshot-product-'+(products.length+1),kind:'product',name,description:lines.join('\n\n'),priceCents:Math.round(Number(match[2].replaceAll(',',''))*100),soldOut:/Sold Out/i.test(match[3]),reviewRequired:true,category:'Products',source:origin+'/registration/products/'});
}
const coaches=JSON.parse(fs.readFileSync('work/portal-v1/coaches.json','utf8'));
const snapshot={observedAt:'2026-11-18',source:origin,pages,products,coaches,assets:assets.map(({sourceUrl,localPath,sha256,bytes})=>({sourceUrl,localPath,sha256,bytes}))};
fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/portal-snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({pages:pages.length,products:products.length,assets:assets.length}));
