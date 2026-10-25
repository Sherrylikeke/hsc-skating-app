import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

registerHooks({
  resolve(specifier,context,next){
    try{return next(specifier,context);}catch(error){
      if(specifier.startsWith('.')&&context.parentURL){
        for(const extension of ['.ts','.tsx']){const candidate=new URL(specifier+extension,context.parentURL);if(fs.existsSync(candidate))return {url:candidate.href,shortCircuit:true};}
      }
      throw error;
    }
  },
  load(url,context,next){
    if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8'),shortCircuit:true};
    if(url.startsWith('file:')&&/\.tsx?$/.test(url))return {format:'module',source:ts.transpileModule(fs.readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const {default:OfficialSourceReference}=await import('../app/official-source-reference.tsx');
const marker='private-source.pdf: Invalid PDF structure.';
const props={sync:{error:marker,lastAttempt:'2026-10-24T22:00:00Z'},event:{entryStatus:'30/58 verified',scheduleStatus:'Partial schedule',startingOrderStatus:'Not found',detailCheckedAt:'2026-10-24T22:00:00Z',detailError:marker,documents:[]}};
const checks=[];
for(const member of [null,...['coach','parent','skater','viewer'].map(role=>({role,status:'active'})),...['disabled','pending','pending-verification'].map(status=>({role:'admin',status}))]){
  assert.equal(renderToStaticMarkup(createElement(OfficialSourceReference,{...props,member})), '');
}
checks.push('ordinary roles, inactive administrators and missing identities render no diagnostics');
const html=renderToStaticMarkup(createElement(OfficialSourceReference,{...props,member:{role:'admin',status:'active'}}));
assert.match(html,/Administrator reference/);assert.match(html,/30\/58 verified/);assert.ok(html.includes(marker));
assert.match(html,/<details class="club-reference">/);assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
checks.push('active administrators retain event errors and progress only inside closed reference details');
assert.ok(renderToStaticMarkup(createElement(OfficialSourceReference,{sync:props.sync,member:{role:'admin',status:'active'}})).includes(marker));
checks.push('non-event pages retain administrator-only global source status');
const club=fs.readFileSync('app/club-app.tsx','utf8');
for(const expression of ['{liveEvent.entryStatus}','{liveEvent.scheduleStatus}','{liveEvent.detailError}',"result.errors.join('；')"])assert.ok(!club.includes(expression),expression);
assert.ok(club.includes('Some event details are not yet confirmed. Please check the official documents.'));
assert.ok(club.includes('member={data.member} sync={data.sync}'));
assert.ok(club.includes('<SourceLink href={liveEvent.url}>'));
checks.push('primary content omits raw diagnostics while retaining uncertainty and official source links');
console.log(JSON.stringify({passed:checks.length,checks,fixtureOnly:true,productionWrites:0},null,2));
