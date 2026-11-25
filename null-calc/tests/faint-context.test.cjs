'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../docs/js/null_ai/faint_context'),post=require('../docs/js/null_ai/post_ko'),sw=require('../docs/js/null_ai/switch');
const move=(name,damage)=>({name,bp:70,basePower:70,category:'Physical',damage:[damage]});
function state(){return {player:{name:'Player',hp:100,maxHP:100,speed:100},opponent:{hp:100},field:{gameType:'Singles'},context:{},party:{complete:true,candidates:[
 {id:'Wall',name:'Wall',partyIndex:0,hp:100,maxHP:100,speed:50,alive:true,isSupport:false,moves:[move('Tackle',40)],incomingDamage:[20]},
 {id:'Revenge',name:'Revenge',partyIndex:1,hp:100,maxHP:100,speed:50,alive:true,isSupport:false,moves:[move('Retaliate',60)],postKOMoves:[move('Retaliate',110)],incomingDamage:[55]}
]}};}
test('KO counts add the displayed faint exactly once and never mutate marks or HP',()=>{
 const rows=[{active:true,alive:true,hp:100},{alive:false,hp:100},{alive:true,hp:0},{alive:true,hp:100}];
 const before=JSON.stringify(rows);assert.deepEqual(api.counts(rows),{known:2,afterKO:3});assert.equal(JSON.stringify(rows),before);
 rows[0].alive=false;assert.deepEqual(api.counts(rows),{known:3,afterKO:3});
});
test('doubles counts exclude the living active partner from the simulated KO',()=>{
 const rows=[{active:true,hp:100},{active:true,partnerActive:true,hp:100},{hp:100}];
 assert.deepEqual(api.counts(rows),{known:0,afterKO:1});rows[1].hp=0;assert.deepEqual(api.counts(rows),{known:1,afterKO:2});
});
test('revival totals are explicit cumulative counts, at least the number of known faints',()=>{
 const rows=[{active:true,hp:100},{hp:0},{hp:100}];
 assert.deepEqual(api.counts(rows,4),{known:4,afterKO:5});assert.deepEqual(api.counts(rows,0),{known:1,afterKO:2});
 for(const x of [-1,1.5,101,NaN,'3'])assert.throws(()=>api.counts(rows,x),/integer/);
});
test('Retaliate, Last Respects and unrelated history counters are distinct conditions',()=>{
 assert.equal(api.basePower({name:'Retaliate',bp:70},4,false),70);assert.equal(api.basePower({name:'Retaliate',bp:70},0,true),140);
 assert.equal(api.basePower({name:'Last Respects',bp:50},3,false),200);assert.equal(api.basePower({name:'Rage Fist',bp:50},3,true),50);
 assert.equal(api.basePower({name:'Stomping Tantrum',bp:75},3,true),75);
});
test('post-KO selects recalculated move profiles idempotently without scaling final rolls',()=>{
 const s=state(),before=JSON.stringify(s),p=api.afterKO(s);
 assert.equal(p.party.candidates[1].moves[0].damage[0],110);assert.deepEqual(api.afterKO(p),p);assert.equal(JSON.stringify(s),before);
 assert.equal(p.party.candidates[1].moves[0].basePower,70,'native power stays available for Support classification');
});
test('ordinary switching keeps Retaliate unboosted while both post-KO entry points use the boosted profile',()=>{
 const s=state(),before=JSON.stringify(s);s.context.switchScenario='guaranteed';
 assert.deepEqual(sw.getSwitchProbabilities(s).candidates.map(c=>c.score),[2,0]);
 const p=post.predict(s);assert.deepEqual(p.switch.candidates.map(c=>c.score),[2,4]);assert.equal(p.switch.candidates[1].probability,1);
 s.context.switchScenario='post-ko';assert.deepEqual(sw.getSwitchProbabilities(s).candidates.map(c=>c.score),[2,4]);
 s.context={};assert.equal(JSON.stringify(s),before);
});
test('post-KO profiles still respect PP, known KO exclusions and incomplete doubles guards',()=>{
 const s=state();s.party.candidates[1].postKOMoves[0].pp=0;assert.equal(post.predict(s).switch.candidates[0].probability,1);
 s.party.candidates[1].alive=false;assert.equal(post.predict(s).candidates[1].eligibility,'fainted');
 s.field.gameType='Doubles';assert.equal(post.predict(s).reason,'doubles');
});
