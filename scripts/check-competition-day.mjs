import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {todayToronto} from '../lib/club-types.ts';
import {competitionChecklistItemKey,competitionChecklistKey,competitionDayArrival,competitionDayPlan,competitionDayRows,readCompetitionChecklist} from '../lib/competition-day.ts';

const day=todayToronto(),source='https://example.test/cup';
const row=(id,start,extra={})=>({id,slotKey:id,eventId:'cup',eventName:'Fixture Cup',eventUrl:source,skaterId:'a',skaterName:'Ana Reed',coach:'Fixture Coach',category:'STAR 6 Women Group 1',date:day,start,end:'12:00',rink:'Blue',activity:'competition',uncertain:false,sourceUrl:source,page:1,timezone:'America/Toronto',matchStatus:'official',...extra});
const first=row('first','09:00');
const rows=[row('late','11:00'),row('pending','08:01',{uncertain:true}),row('other-child','10:00',{skaterId:'b',skaterName:'Ben Reed'}),row('other-date','10:00',{date:'2020-01-01'}),row('other-family','08:00',{skaterId:'outsider',skaterName:'Other Family'}),first];
const original=structuredClone(rows);
assert.deepEqual(competitionDayRows(rows,['a','b'],day).map(row=>row.id),['first','other-child','late','pending']);
assert.deepEqual(competitionDayRows(rows,['a','b'],day,'b').map(row=>row.id),['other-child']);
assert.deepEqual(competitionDayRows(rows,['a'],day,'outsider'),[]);
assert.deepEqual(competitionDayRows(rows,[],day),[]);
assert.deepEqual(rows,original,'filtering and sorting do not mutate the shared schedule');
const plans=[{id:'wrong-event',eventId:'another-cup',skaterId:'a',slotKey:'first',meetingTime:day+'T07:30',note:'WRONG-EVENT'},
  {id:'wrong-slot',eventId:'cup',skaterId:'a',slotKey:'late',meetingTime:day+'T07:30',note:'WRONG-SLOT'},
  {id:'wrong-child',eventId:'cup',skaterId:'b',slotKey:'first',meetingTime:day+'T07:30',note:'WRONG-CHILD'},
  {id:'right',eventId:'cup',skaterId:'a',slotKey:'first',meetingTime:day+'T07:30',note:'Approved meeting note'}];
assert.equal(competitionDayPlan(first,plans)?.id,'right','match authorized plans by event, skater and exact session');
assert.equal(competitionDayPlan(first,[]),undefined,'no private plan is derived from home preferences');
assert.deepEqual(competitionDayArrival(first),{time:'08:00',meeting:false});
assert.deepEqual(competitionDayArrival(first,day+'T08:15'),{time:'08:00',meeting:false},'a late coach meeting cannot shorten the arrival buffer');
assert.deepEqual(competitionDayArrival(first,day+'T07:30'),{time:'07:30',meeting:true});
assert.deepEqual(competitionDayArrival(first,day+'T08:00'),{time:'08:00',meeting:true});
assert.equal(competitionDayArrival({...first,uncertain:true},day+'T07:30'),null);
assert.deepEqual(competitionDayArrival({...first,date:'2026-11-16',start:'00:30'}),{time:'2026-11-15 23:30',meeting:false});
assert.equal(competitionDayArrival({...first,date:'2026-03-08',start:'02:30'}),null,'DST gap cannot create an arrival time');
assert.equal(competitionDayArrival({...first,date:'2026-11-01',start:'01:30'}),null,'ambiguous DST clock cannot create an arrival time');

const key=competitionChecklistKey('member-a',day),item=competitionChecklistItemKey('a','skates');
assert.notEqual(key,competitionChecklistKey('member-b',day));
assert.notEqual(key,competitionChecklistKey('member-a','2020-01-01'));
assert.notEqual(competitionChecklistKey('a:b','c'),competitionChecklistKey('a','b:c'),'scope keys have no delimiter collision');
assert.notEqual(item,competitionChecklistItemKey('b','skates'),'siblings have independent checkboxes');
const data=new Map([[key,JSON.stringify([item,item,false,null])]]);
const storage={getItem:key=>data.get(key)??null};
assert.deepEqual(readCompetitionChecklist(key,storage),[item]);
assert.deepEqual(readCompetitionChecklist(competitionChecklistKey('member-b',day),storage),[]);
assert.deepEqual(readCompetitionChecklist('missing',storage),[]);
assert.deepEqual(readCompetitionChecklist(key,{getItem:()=>'{broken'}),[]);
assert.deepEqual(readCompetitionChecklist(key,{getItem:()=>'{"skates":true}'}),[]);
assert.deepEqual(readCompetitionChecklist(key,{getItem:()=>{throw Error('disabled');}}),[]);

registerHooks({
  resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
    if(specifier.startsWith('.')&&context.parentURL){for(const extension of ['.ts','.tsx']){const file=new URL(specifier+extension,context.parentURL);if(fs.existsSync(file))return {url:file.href,shortCircuit:true};}}
    throw error;
  }},
  load(url,context,next){
    if(url.startsWith('file:')&&url.endsWith('.css'))return {format:'module',source:'export {};',shortCircuit:true};
    if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8'),shortCircuit:true};
    if(url.startsWith('file:')&&/\.tsx?$/.test(url))return {format:'module',source:ts.transpileModule(fs.readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const {default:CompetitionDay}=await import('../app/competition-day.tsx');
const {setLanguage}=await import('../lib/i18n.tsx');
const skaters=[{id:'a',name:'Ana Reed'},{id:'b',name:'Ben Reed'},{id:'outsider',name:'Other Family'}];
const timingOrders=['Ana Reed','Nora Lin'].map((name,i)=>({id:'draw'+i,name,category:first.category,program:'free',startNumber:i+1,warmupGroup:1,individualTime:null,sourceUrl:source+'/order',page:0,skaterIds:i===0?['a']:[]}));
const block={id:'first',category:first.category,group:1,range:null,activity:'competition',date:day,start:'09:00',end:'09:20',rink:'Blue'};
const event={id:'cup',name:'Fixture Cup',blocks:[block],startingOrders:timingOrders,participants:timingOrders.map(o=>({name:o.name,category:o.category})),venue:'Fixture Arena'};
const timed={...first,id:'cup|a|first',end:'09:20',startingOrder:timingOrders[0]};
const props={memberId:'member-a',rows:[timed,rows[1],rows[2],rows[4]],events:[event],skaters,ownIds:['a','b'],plans};
const html=renderToStaticMarkup(createElement(CompetitionDay,props));
assert.match(html,/Competition day/);assert.match(html,/Print \/ Save PDF/);assert.match(html,/Approved meeting note/);
assert.ok(!html.includes('WRONG-')&&!html.includes('Other Family'),'only exact authorized plans and home skaters render');
assert.ok(!html.includes('08:01'),'candidate clocks are not presented as confirmed group times');
assert.match(html,/07:30/);assert.match(html,/09:00–09:20/);assert.match(html,/Fixture Arena · Blue/);
assert.match(html,/Estimated warm-up/);assert.match(html,/Estimated skate start/);
assert.equal((html.match(/type="checkbox"/g)||[]).length,10,'each home child has a separate preparation list');
setLanguage('zh');
const chinese=renderToStaticMarkup(createElement(CompetitionDay,props));
assert.match(chinese,/比赛日模式/);assert.match(chinese,/准备清单/);assert.match(chinese,/打印 \/ 保存 PDF/);
setLanguage('en');
const empty=renderToStaticMarkup(createElement(CompetitionDay,{...props,ownIds:[],plans:[]}));
assert.match(empty,/Add a skater to My Skaters/);assert.ok(!empty.includes('Approved meeting note'));
console.log('Competition day: home/date filters, exact plan matching, 60-minute arrival, DST uncertainty, account/date/child checklist isolation and bilingual rendered timing passed.');
