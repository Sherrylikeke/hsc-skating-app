import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

registerHooks({
  resolve(specifier,context,next){
    try{return next(specifier,context);}catch(error){
      if(specifier.startsWith('.')&&context.parentURL)for(const extension of ['.ts','.tsx']){
        const candidate=new URL(specifier+extension,context.parentURL);
        if(fs.existsSync(candidate))return {url:candidate.href,shortCircuit:true};
      }
      throw error;
    }
  },
  load(url,context,next){
    if(url.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};
    if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8'),shortCircuit:true};
    if(url.startsWith('file:')&&/\.tsx?$/.test(url))return {format:'module',source:ts.transpileModule(fs.readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const {clubEventResponse,clubSyncResponse}=await import('../lib/club-response.ts');
const {default:SourceFreshness}=await import('../app/source-freshness.tsx');
const success='2026-11-14T14:00:00Z',attempt='2026-11-16T14:00:00Z';
const base={id:'fixture',name:'Fixture',documents:[],participants:[],blocks:[],detailCheckedAt:success};
const healthy=clubEventResponse(base,false);
assert.equal(healthy.sourceStatus.lastSuccess,success);
const failed=clubEventResponse({...base,detailSuccessAt:success,detailCheckedAt:attempt,detailError:'private-raw.pdf: parser failure',scheduleRetained:true},false);
assert.equal(failed.sourceStatus.lastSuccess,success);assert.equal(failed.sourceStatus.lastAttempt,attempt);
assert.equal(failed.sourceStatus.needsReview,true);assert.equal(failed.sourceStatus.retainedSchedule,true);
assert.ok(!JSON.stringify(failed).includes('private-raw.pdf'));
assert.equal(clubEventResponse({...base,detailCheckedAt:attempt,detailError:'failure'},false).sourceStatus.lastSuccess,undefined,'A failed attempt is not a successful check');
const partial=clubEventResponse({...base,documents:[{kind:'entries',entryFiles:[{kind:'entries',checkedAt:success},{kind:'entries'}]}]},false);
assert.equal(partial.sourceStatus.needsReview,true);assert.equal(partial.sourceStatus.lastSuccess,undefined);
const pendingOrder=clubEventResponse({...base,documents:[{kind:'start-order',url:'https://example.test/start'}]},false);
assert.equal(pendingOrder.sourceStatus.needsReview,true);
assert.equal(clubEventResponse({...base,documents:[{kind:'start-order',checkedAt:attempt,parserVersion:'starting-draw-2'}]},false).sourceStatus.needsReview,true,'An older parser result remains pending until rechecked');
const sync=clubSyncResponse({lastCalendarSuccess:success,lastSuccess:attempt,lastAttempt:attempt,error:'private error'},false);
assert.equal(sync.sourceStatus.lastSuccess,success,'Calendar success must not be replaced by an unrelated detail check');
const html=renderToStaticMarkup(createElement(SourceFreshness,{status:failed.sourceStatus}));
assert.match(html,/last valid schedule/);assert.match(html,/Some information still needs checking/);assert.match(html,/2026-11-14T14:00:00Z/);assert.doesNotMatch(html,/private-raw|parser failure|Invalid Date/);
console.log(JSON.stringify({passed:5,checks:['success and attempt timestamps are distinct','ordinary projections contain no raw diagnostics','unfinished imports remain pending','calendar success stays scoped to the calendar','retained schedule is visible without private diagnostics'],fixtureOnly:true},null,2));
