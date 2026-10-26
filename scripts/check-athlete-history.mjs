import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterAthleteHistory,scoreSeries,scoreTrend,emptyHistoryFilters,historyCategory,historyCategories,historyCategoryResolver,historyRecordCategories} from '../lib/athlete-history.ts';
import {registerHooks} from 'node:module';
import ts from 'typescript';
const rows=JSON.parse(fs.readFileSync('data/history-records.json','utf8'));
const breken=rows.filter(r=>r.skater_ids.includes('HSC-204DE99B86'));
const series=scoreSeries(breken);assert.ok(series.length);
assert.ok(series.every(s=>s.records.every(r=>r.status==='result'&&r.total_score!==null&&r.entity_type!=='team')));
for(const s of series){assert.equal(new Set(s.records.map(r=>historyCategory(r.category)+'|'+r.result_level)).size,1);assert.deepEqual(s.records.map(r=>r.start_date),s.records.map(r=>r.start_date).sort());}
const withdrawn=filterAthleteHistory(breken,{...emptyHistoryFilters,status:'withdrawn'});assert.ok(withdrawn.length);assert.equal(scoreSeries(withdrawn).length,0);
const category=breken.find(r=>r.status==='result').category;const selected=filterAthleteHistory(breken,{...emptyHistoryFilters,category});assert.ok(selected.length);assert.ok(selected.every(r=>historyCategory(r.category)===historyCategory(category)));
const entry=filterAthleteHistory(breken,{...emptyHistoryFilters,status:'entry_list_only'});assert.equal(scoreSeries(entry).length,0);
const trend=scoreTrend(breken);
assert.equal(trend.active.label,series[0].label);assert.deepEqual(trend.points,series[0].records);
assert.deepEqual(trend.points.map(record=>record.start_date),trend.points.map(record=>record.start_date).sort());
assert.equal(new Set(trend.points.map(record=>historyCategory(record.category)+'|'+record.result_level)).size,1);
const single=scoreTrend(breken,series.at(-1).label);assert.equal(single.active.label,series.at(-1).label);assert.deepEqual(single.points,single.active.records);
assert.deepEqual(scoreTrend(selected).points,scoreSeries(selected)[0].records);
assert.equal(scoreTrend(selected,'no longer available').active.label,scoreSeries(selected)[0].label);
assert.equal(scoreTrend(withdrawn).points.length,0);assert.equal(scoreTrend([]).points.length,0);
const sample=trend.points[0];
const invalid=[null,'',' ',undefined,'not a score',Infinity].map((score,index)=>({...sample,record_id:'invalid-'+index,total_score:score}));
assert.equal(scoreTrend(invalid).points.length,0);assert.equal(scoreTrend([{...sample,total_score:0}]).points.length,1);
assert.equal(scoreTrend([{...sample,entity_type:'team'}]).points.length,0);
const fiora=rows.filter(record=>record.skater_ids.includes('HSC-84710E9259'));
assert.ok(scoreTrend(fiora).series.length>1);assert.equal(new Set(scoreTrend(fiora).points.map(record=>historyCategory(record.category)+'|'+record.result_level)).size,1);
const originalFiora=structuredClone(fiora),fioraGroups=scoreSeries(fiora);
assert.equal(fioraGroups.length,3);
assert.equal(fioraGroups.find(group=>group.label==='Pre-Juvenile U11 · 类别总分').records.length,3);
assert.equal(fioraGroups.find(group=>group.label==='STAR 5 U10 · 类别总分').records.length,9);
assert.equal(fioraGroups.find(group=>group.label==='STAR 7 U12 · 类别总分').records.length,5);
assert.equal(fioraGroups.flatMap(group=>group.records).length,17);
assert.equal(new Set(fioraGroups.flatMap(group=>group.records.map(record=>record.record_id))).size,17);
assert.deepEqual(fiora,originalFiora);
const broadFilter=historyCategories(fiora.map(record=>record.category));assert.equal(broadFilter.length,6);assert.ok(broadFilter.every(item=>!/\b(?:GROUP|GRP|NQ)\b|NON-QUALIFYING/i.test(item.label)));
const star5=broadFilter.find(item=>item.label==='STAR 5 U10');assert.equal(filterAthleteHistory(fiora,{...emptyHistoryFilters,category:star5.value}).length,9);
const resolvedFilter=historyRecordCategories(fiora);assert.equal(resolvedFilter.length,5);assert.ok(!resolvedFilter.some(item=>item.label==='Pre-Juvenile'));
const preJuFilter=resolvedFilter.find(item=>item.label==='Pre-Juvenile U11');assert.equal(filterAthleteHistory(fiora,{...emptyHistoryFilters,category:preJuFilter.value}).length,3);
const unlabeled=fiora.filter(record=>historyCategory(record.category)==='PREJUVENILE');assert.equal(unlabeled.length,2);
assert.equal(scoreTrend(unlabeled,'',fiora).active.label,'Pre-Juvenile U11 · 类别总分');
assert.equal(scoreTrend(unlabeled,'',fiora).points.length,2);
const eventOnly=filterAthleteHistory(fiora,{...emptyHistoryFilters,category:preJuFilter.value,event:unlabeled[0].event_key});assert.equal(eventOnly.length,1);
assert.equal(scoreTrend(eventOnly,'',fiora).active.label,'Pre-Juvenile U11 · 类别总分');
const cohortRows=[
  {...sample,record_id:'pre-2025',category:'Pre-Juvenile / Singles',start_date:'2025-12-20',skater_ids:['fixture-athlete']},
  {...sample,record_id:'pre-2026',category:'Pre-Juvenile / Singles',start_date:'2026-01-10',skater_ids:['fixture-athlete']},
  {...sample,record_id:'pre-2026-u11',category:'Pre-Juvenile Women U11',start_date:'2026-10-10',skater_ids:['fixture-athlete']},
  {...sample,record_id:'pre-2027',category:'Pre-Juvenile / Singles',start_date:'2027-01-10',skater_ids:['fixture-athlete']},
  {...sample,record_id:'pre-2027-u13',category:'Pre-Juvenile Women U13',start_date:'2027-10-10',skater_ids:['fixture-athlete']},
  {...sample,record_id:'pre-other',category:'Pre-Juvenile / Singles',start_date:'2026-01-10',skater_ids:['different-athlete']},
];
const resolveCohort=historyCategoryResolver(cohortRows);
assert.equal(resolveCohort(cohortRows[0]),'PREJUVENILE');assert.equal(resolveCohort(cohortRows[1]),'PREJUVENILE WOMEN U11');assert.equal(resolveCohort(cohortRows[3]),'PREJUVENILE WOMEN U13');assert.equal(resolveCohort(cohortRows[5]),'PREJUVENILE');
const ambiguous=[cohortRows[1],cohortRows[2],{...cohortRows[2],record_id:'pre-conflict',category:'Pre-Juvenile Women U13'}];
assert.equal(historyCategoryResolver(ambiguous)(cohortRows[1]),'PREJUVENILE');
const separateProgram={...cohortRows[1],record_id:'pre-free',category:'Pre-Juvenile Women Free'};assert.equal(historyCategoryResolver([...cohortRows,separateProgram])(separateProgram),'PREJUVENILE WOMEN FREE');
const multiIdentity={...cohortRows[1],record_id:'pre-multi',skater_ids:['fixture-athlete','different-athlete']};assert.equal(historyCategoryResolver([...cohortRows,multiIdentity])(multiIdentity),'PREJUVENILE');
assert.equal(historyCategory('STAR 5 Women (U10 - Group 1)'),historyCategory('star5 girls (u10 - Grp 2)'));
assert.equal(historyCategory('STAR 5 Women (U10 - Non-Qualifying)'),historyCategory('STAR 5 Women (U10 NQ)'));
assert.deepEqual(historyCategories(['Category: STAR 2 STAR 2 (Group 8)']).map(item=>item.label),['STAR 2']);
const separate=['STAR 5 Women U10','STAR 7 Women U12','STAR 5 Women U13','STAR 5 Women O13','Senior Women Short','Senior Women Free','STAR 5 Women U10 Artistic','STAR 5 Men U10','Gold Women Class I','Gold Women Class II','Pre-Juvenile Women U11','Pre-Juvenile / Singles'];
assert.equal(new Set(separate.map(historyCategory)).size,separate.length);
assert.equal(new Set(historyCategories(separate).map(item=>item.label)).size,separate.length);
const scoreTypes=scoreSeries([{...sample,category:'STAR 5 Women U10',result_level:'category'},{...sample,record_id:'segment-fixture',category:'STAR 5 Women U10',result_level:'segment'}]);assert.equal(scoreTypes.length,2);
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
assert.ok(!rendered.includes('All categories · overall trend'));assert.ok(!rendered.includes('全部类别 · 总趋势'));
assert.equal((rendered.match(/class="chart-point"/g)||[]).length,scoreTrend(fiora).points.length);
assert.equal((rendered.match(/class="chart-series"/g)||[]).length,scoreTrend(fiora).points.length>1?1:0);
assert.ok(!rendered.includes('club-chart-legend'));
assert.ok(rendered.includes('STAR 5 U10'));assert.ok(rendered.includes('STAR 7 U12'));
const optionLabels=[...rendered.matchAll(/<option\b[^>]*>(.*?)<\/option>/g)].map(match=>match[1]);
assert.ok(optionLabels.every(label=>!/\b(?:GROUP|GRP|NQ)\b|NON-QUALIFYING/i.test(label)));assert.ok(rendered.includes('Grp 2'));
assert.ok(optionLabels.includes('Pre-Juvenile U11'));assert.ok(!optionLabels.includes('Pre-Juvenile'));
const emptyRendered=renderToStaticMarkup(createElement(AthleteHistory,{records:withdrawn,onRecord(){},renderTable(){return null;}}));
assert.equal((emptyRendered.match(/class="chart-point"/g)||[]).length,0);assert.ok(emptyRendered.includes('disabled=""'));
const app=fs.readFileSync('app/club-app.tsx','utf8');
const reference=app.indexOf('<OfficialSourceReference');
assert.ok(reference>app.indexOf('<AthleteHistory'));assert.ok(reference<app.indexOf('<footer className="club-footer"'));
assert.ok(app.slice(reference,app.indexOf('/>',reference)).includes('member={data.member} sync={data.sync}'));
const {default:OfficialSourceReference}=await import('../app/official-source-reference.tsx');
const referenceMarkup=renderToStaticMarkup(createElement(OfficialSourceReference,{member:{role:'admin',status:'active'},sync:{}}));
assert.match(referenceMarkup,/<details class="club-reference">/);assert.doesNotMatch(referenceMarkup,/<details[^>]*\bopen\b/);
assert.equal(renderToStaticMarkup(createElement(OfficialSourceReference,{member:{role:'parent',status:'active'},sync:{}})),'');
console.log(JSON.stringify({records:breken.length,comparableSeries:series.length,withdrawn:withdrawn.length,categoryFilter:category,excludesMissingScores:true,mixedCategoryTrendRemoved:true,singleCategoryDefaultAndSwitching:true,fioraPlottedScores:scoreTrend(fiora).points.length,fioraAvailableSeries:scoreTrend(fiora).series.length,fioraPreJuU11:3,fioraStar5:9,fioraStar7:5,sameAthleteCalendarYearOnly:true,ambiguousAgeNotInferred:true,filteredContextStable:true,original17ScoresPreserved:true,groupAndNQAliasesMerged:true,agesProgramsGendersAndScoreTypesSeparated:true,emptyStateVerified:true,serverRenderedChartVerified:true,referenceCollapsedAtPageEnd:true}));
