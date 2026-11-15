import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const roots=process.argv.slice(2);
assert.ok(roots.length,'Pass the actual build output directories to verify');
for(const root of roots){
  const notice=fs.readFileSync(path.join(root,'third-party/fullcalendar.txt'),'utf8');
  for(const name of ['@fullcalendar/react','@fullcalendar/core','@full-ui/headless-calendar','temporal-polyfill']){
    const pkg=JSON.parse(fs.readFileSync('node_modules/'+name+'/package.json','utf8'));
    assert.ok(notice.includes(name+' '+pkg.version));
    const license=fs.readFileSync('node_modules/'+name+'/'+(name==='temporal-polyfill'?'LICENSE':'LICENSE.md'),'utf8');
    assert.ok(notice.includes(license),'Full installed license retained: '+name);
  }
  console.log('Calendar MIT notices verified: '+root);
}
