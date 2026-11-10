import assert from 'node:assert/strict';
import fs from 'node:fs';
import {categoryCompatible,categoryKey,scheduleRows} from '../lib/official-parser.ts';
import {orderFor} from '../lib/starting-order.ts';

const checks=[];
const skaters=['regular','nq','dual'].map(id=>({id,name:id,coach:'Original coach'}));
const participant=(id,category)=>({id:id+category,name:id,category,skaterIds:[id],matchStatus:'fixture',sourceUrl:'https://skateontario.org/entry.pdf'});
const block=(id,category)=>({id,category,categoryKey:categoryKey(category),group:category.match(/Group (\d+)/i)?Number(category.match(/Group (\d+)/i)[1]):null,range:null,activity:'competition',date:'2026-11-21',start:'13:15',end:'14:40',rink:'GREEN RINK',page:1,sourceUrl:'https://skateontario.org/schedule.pdf'});
const event={id:'fixture',name:'Fixture',url:'https://skateontario.org',timezone:'America/Toronto'};
const base='STAR 5 Women U10';
for(const qualifier of ['Non-Qualifying','Non Qualifying','Non\u2011Qualifying','Non\u2013Qualifying','NQ','N.Q.']){
  const categories=[base+' Group 1',base+' Group 2',base+' - '+qualifier];
  const rows=scheduleRows([{...event,participants:[participant('regular',base+' Group 2'),participant('nq',base+' '+qualifier)],blocks:categories.map((category,index)=>block(String(index),category))}],skaters);
  assert.deepEqual(rows.filter(row=>row.skaterId==='regular').map(row=>row.category),[categories[1]]);
  assert.deepEqual(rows.filter(row=>row.skaterId==='nq').map(row=>row.category),[categories[2]]);
  assert.ok(rows.every(row=>!row.uncertain&&row.coach==='Original coach'));
}
checks.push('ordinary and NQ entries match only their own category across official spelling variants');

for(const category of ['STAR 5 Women O13','STAR 5 Women U13','STAR 7 Women O12','STAR 5 Men U10']){
  const nq=category+' - Non-Qualifying';
  const rows=scheduleRows([{...event,participants:[participant('regular',category),participant('nq',nq)],blocks:[block('regular',category),block('nq',nq)]}],skaters);
  assert.equal(rows.length,2);
  assert.equal(rows.find(row=>row.skaterId==='regular').category,category);
  assert.equal(rows.find(row=>row.skaterId==='nq').category,nq);
}
checks.push('the same separation applies across STAR levels, age groups and men/women');

const shared='STAR 5 Men U10 / STAR 5 Men U10 Non-Qualifying';
const sharedRows=scheduleRows([{...event,participants:[participant('regular','STAR 5 Men U10'),participant('nq','STAR 5 Men U10 NQ')],blocks:[block('shared',shared)]}],skaters);
assert.equal(sharedRows.length,2);assert.ok(sharedRows.every(row=>!row.uncertain));
const abbreviated='STAR 5 Men U10 / STAR 5 U10 Non-Qualifying';
const abbreviatedRows=scheduleRows([{...event,participants:[participant('regular','STAR 5 Men U10'),participant('nq','STAR 5 Men U10 NQ')],blocks:[block('abbreviated',abbreviated)]}],skaters);
assert.equal(abbreviatedRows.length,2);assert.ok(abbreviatedRows.every(row=>!row.uncertain));
assert.equal(categoryCompatible('STAR 5 Women U10',abbreviated),false);
assert.equal(categoryCompatible('STAR 5 Men U13',abbreviated),false);
assert.equal(categoryCompatible('STAR 5 Men U10 NQ','STAR 5 Men U10 / STAR 6 U10 Non-Qualifying'),false);
assert.equal(categoryCompatible('STAR 5 Men U13 NQ','STAR 5 Men U10 / STAR 5 U13 Non-Qualifying'),false);
const sharedAgeRows=scheduleRows([{...event,participants:[participant('regular','STAR 7 Women U12'),participant('nq','STAR 7 Women O12 NQ')],blocks:[block('shared-age','STAR 7 Women U12/O12 Non Qualifying')]}],skaters);
assert.deepEqual(sharedAgeRows.map(row=>row.skaterId),['nq']);
checks.push('explicit regular/NQ shared sessions remain valid while shared ages keep the NQ qualifier');

const dual=scheduleRows([{...event,participants:[participant('dual',base+' Group 2'),participant('dual',base+' Non Qualifying')],blocks:[block('regular',base+' Group 2'),block('nq',base+' Non Qualifying')]}],skaters);
assert.equal(dual.length,2);
const unknownGroup=scheduleRows([{...event,participants:[participant('regular',base)],blocks:[block('g1',base+' Group 1'),block('g2',base+' Group 2'),block('nq',base+' NQ')]}],skaters);
assert.equal(unknownGroup.length,2);assert.ok(unknownGroup.every(row=>row.uncertain));
checks.push('actual dual entries survive and missing official group assignments remain uncertain');

const artisticRows=scheduleRows([{...event,participants:[participant('regular',base+' Group 2'),participant('nq','STAR 5 Women (& Men Artistic Group 2)')],blocks:[block('regular',base+' Group 2'),block('artistic','STAR 5 Women Artistic Group 2')]}],skaters);
assert.equal(artisticRows.length,2);
assert.equal(artisticRows.find(row=>row.skaterId==='regular').category,base+' Group 2');
assert.equal(artisticRows.find(row=>row.skaterId==='nq').category,'STAR 5 Women Artistic Group 2');
checks.push('artistic entries cannot create ordinary free-skating sessions when the schedule omits Free');

const order=(id,category)=>({id,category,program:'free',skaterIds:['regular'],startNumber:7,warmupGroup:null,individualTime:null});
const orders=[order('regular',base+' Free Group 2'),order('nq',base+' Free NQ')];
assert.equal(orderFor(orders,'regular',base+' Free Group 2').id,'regular');
assert.equal(orderFor(orders,'regular',base+' Free Non-Qualifying').id,'nq');
assert.equal(orderFor([orders[0]],'regular',base+' Free NQ'),undefined);
assert.equal(orderFor([orders[1]],'regular',base+' Free Group 2'),undefined);
assert.equal(orderFor([order('age','STAR 5 Women U13 Free')],'regular',base+' Free'),undefined);
checks.push('starting order and warmup details cannot be borrowed from the other qualification or age category');

const fixture=JSON.parse(fs.readFileSync('tests/fixtures/keswick-2026-category-matching.json','utf8'));
const officialRows=scheduleRows([fixture.event],fixture.skaters);
assert.equal(officialRows.length,15);
for(const name of ['Annie Dong','Shirley Dong']){
  const rows=officialRows.filter(row=>row.skaterName===name);assert.equal(rows.length,1);
  assert.equal(rows[0].category,'STAR 5 Women U10 - Group 2');assert.equal(rows[0].date,'2026-11-21');assert.equal(rows[0].start,'13:15');assert.equal(rows[0].end,'14:40');assert.equal(rows[0].rink,'GREEN RINK');assert.equal(rows[0].uncertain,false);
}
assert.ok(officialRows.filter(row=>row.skaterName==='Violet Bacon').every(row=>row.category.includes('Non-Qualifying')));
assert.ok(officialRows.filter(row=>row.skaterName==='Makayla Wang').every(row=>row.category.includes('Non-Qualifying')));
assert.equal(officialRows.filter(row=>row.skaterName==='Mairead McConville').length,1);
assert.equal(officialRows.find(row=>row.skaterName==='Mairead McConville').uncertain,false);
assert.ok(officialRows.some(row=>row.skaterName==='Max Wang'&&row.category.includes('/')));
checks.push('official Keswick snapshot keeps Annie/Shirley Group 2, genuine NQ entries and the shared men session');
console.log(JSON.stringify({passed:checks.length,checks,productionWrites:0,realEmailsSent:0},null,2));
