import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterAthleteHistory,scoreSeries,scoreTrend,emptyHistoryFilters} from '../lib/athlete-history.ts';
import {registerHooks} from 'node:module';
import ts from 'typescript';
const rows=JSON.parse(fs.readFileSync('data/history-records.json','utf8'));
const breken=rows.filter(r=>r.skater_ids.includes('HSC-204DE99B86'));
const series=scoreSeries(breken);assert.ok(series.length);
assert.ok(series.every(s=>s.records.every(r=>r.status==='result'&&r.total_score!==null&&r.entity_type!=='team')));
for(const s of series){assert.equal(new Set(s.records.map(r=>r.category+'|'+r.result_level)).size,1);assert.deepEqual(s.records.map(r=>r.start_date),s.records.map(r=>r.start_date).sort());}
const withdrawn=filterAthleteHistory(breken,{...emptyHistoryFilters,status:'withdrawn'});assert.ok(withdrawn.length);assert.equal(scoreSeries(withdrawn).length,0);
const category=breken.find(r=>r.status==='result').category;const selected=filterAthleteHistory(breken,{...emptyHistoryFilters,category});assert.ok(selected.length);assert.ok(selected.every(r=>r.category===category));
const entry=filterAthleteHistory(breken,{...emptyHistoryFilters,status:'entry_list_only'});assert.equal(scoreSeries(entry).length,0);
const trend=scoreTrend(breken);
assert.equal(trend.active,undefined);assert.equal(trend.plotted.length,series.length);
assert.equal(trend.points.length,series.reduce((count,group)=>count+group.records.length,0));
assert.deepEqual(trend.points.map(record=>record.start_date),trend.points.map(record=>record.start_date).sort());
assert.deepEqual(new Set(trend.points.map(record=>record.category)),new Set(series.flatMap(group=>group.records.map(record=>record.category))));
const single=scoreTrend(breken,series[0].label);assert.equal(single.plotted.length,1);assert.deepEqual(single.points,single.active.records);
assert.equal(scoreTrend(selected).plotted.length,scoreSeries(selected).length);
assert.equal(scoreTrend(selected,'no longer available').active,undefined);
assert.equal(scoreTrend(withdrawn).points.length,0);assert.equal(scoreTrend([]).points.length,0);
const sample=trend.points[0];
const invalid=[null,'',' ',undefined,'not a score',Infinity].map((score,index)=>({...sample,record_id:'invalid-'+index,total_score:score}));
assert.equal(scoreTrend(invalid).points.length,0);assert.equal(scoreTrend([{...sample,total_score:0}]).points.length,1);
assert.equal(scoreTrend([{...sample,entity_type:'team'}]).points.length,0);
const fiora=rows.filter(record=>record.skater_ids.includes('HSC-84710E9259'));
assert.ok(scoreTrend(fiora).plotted.length>1);
registerHooks({
  resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&context.parentURL)for(const extension of ['.ts','.tsx']){const candidate=new URL(specifier+extension,context.parentURL);if(fs.existsSync(candidate))return {url:candidate.href,shortCircuit:true};}throw error;}},
  load(url,context,next){
    if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8'),shortCircuit:true};
    if(url.startsWith('file:')&&/\.tsx?$/.test(url))return {format:'module',source:ts.transpileModule(fs.readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
const {default:AthleteHistory}=await import('../app/athlete-history.tsx');
const rendered=renderToStaticMarkup(createElement(AthleteHistory,{records:fiora,onRecord(){},renderTable(){return null;}}));
assert.ok(rendered.includes('All categories · overall trend'));
assert.equal((rendered.match(/class="chart-point"/g)||[]).length,scoreTrend(fiora).points.length);
assert.equal((rendered.match(/class="chart-series"/g)||[]).length,scoreTrend(fiora).plotted.filter(group=>group.records.length>1).length);
assert.ok(rendered.includes('club-chart-legend'));assert.ok(rendered.includes('Scores across categories are not added'));
const app=fs.readFileSync('app/club-app.tsx','utf8');
const reference=app.indexOf('<details className="club-reference"');
assert.ok(reference>app.indexOf('<AthleteHistory'));assert.ok(reference<app.indexOf('<footer className="club-footer"'));
assert.ok(app.indexOf('<OfficialSourceStatus')>reference);assert.ok(app.indexOf('<EntryImportStatus')>reference);
assert.ok(!app.slice(reference,app.indexOf('>',reference)).includes(' open'));
console.log(JSON.stringify({records:breken.length,comparableSeries:series.length,withdrawn:withdrawn.length,categoryFilter:category,excludesMissingScores:true,allCategoriesDefault:true,singleCategoryPreserved:true,fioraPlottedScores:scoreTrend(fiora).points.length,fioraSeries:scoreTrend(fiora).plotted.length,serverRenderedChartVerified:true,referenceCollapsedAtPageEnd:true}));
