import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterAthleteHistory,scoreSeries,emptyHistoryFilters} from '../lib/athlete-history.ts';
const rows=JSON.parse(fs.readFileSync('data/history-records.json','utf8'));
const breken=rows.filter(r=>r.skater_ids.includes('HSC-204DE99B86'));
const series=scoreSeries(breken);assert.ok(series.length);
assert.ok(series.every(s=>s.records.every(r=>r.status==='result'&&r.total_score!==null&&r.entity_type!=='team')));
for(const s of series){assert.equal(new Set(s.records.map(r=>r.category+'|'+r.result_level)).size,1);assert.deepEqual(s.records.map(r=>r.start_date),s.records.map(r=>r.start_date).sort());}
const withdrawn=filterAthleteHistory(breken,{...emptyHistoryFilters,status:'withdrawn'});assert.ok(withdrawn.length);assert.equal(scoreSeries(withdrawn).length,0);
const category=breken.find(r=>r.status==='result').category;const selected=filterAthleteHistory(breken,{...emptyHistoryFilters,category});assert.ok(selected.length);assert.ok(selected.every(r=>r.category===category));
const entry=filterAthleteHistory(breken,{...emptyHistoryFilters,status:'entry_list_only'});assert.equal(scoreSeries(entry).length,0);
console.log(JSON.stringify({records:breken.length,comparableSeries:series.length,withdrawn:withdrawn.length,categoryFilter:category,excludesMissingScores:true}));
