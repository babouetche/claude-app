'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const native=require('../docs/js/null_ai/native_helpers.js');
const ai=require('../docs/js/null_ai/switch.js'),post=require('../docs/js/null_ai/post_ko.js');
const cases=require('./fixtures/observed-native-thresholds.json');
const attack=(damage,extra={})=>({name:'Tackle',category:'Physical',bp:80,damage:Array.isArray(damage)?damage:[damage],...extra});
const state=()=>({player:{name:'Player',hp:100,maxHP:100,speed:100,moves:[attack(20)]},
 opponent:{name:'Active',hp:100,maxHP:100,speed:80,moves:[attack(20)]},field:{gameType:'Singles'},context:{},party:{complete:true,candidates:[]}});
const reserve=(extra={})=>({name:'Reserve',hp:100,maxHP:100,speed:50,moves:[attack(50)],incomingDamage:[40],...extra});

test('ROM hit-count helper rounds up exact and adjacent KO thresholds; zero damage is UINT32_MAX',()=>{
 for(let hp=1;hp<=300;hp++)for(let dmg=1;dmg<=300;dmg++)assert.equal(native.hitsToKO(dmg,hp,false),Math.ceil(hp/dmg));
 assert.equal(native.hitsToKO(0,100,false),0xffffffff);
 assert.deepEqual([99,100,101].map(h=>native.hitsToKO(50,h,false)),[2,2,3]);
});
test('ROM full-HP protection changes a one-hit count to two, leaving other counts intact',()=>{
 assert.equal(native.hitsToKO(120,100,true),2);assert.equal(native.hitsToKO(49,100,true),3);
 for(const p of [{item:'Focus Sash'},{ability:'Sturdy'}])assert.equal(native.sashSturdy({hp:100,maxHP:100,...p},{}),true);
 assert.equal(native.sashSturdy({hp:99,maxHP:100,item:'Focus Sash'},{}),false);
 assert.equal(native.sashSturdy({hp:100,maxHP:100,item:'Focus Sash'},{magicRoom:true}),false);
 assert.equal(native.sashSturdy({hp:100,maxHP:100,item:'Focus Sash',ability:'Klutz'},{}),false);
});
test('snapshot HP synchronization recomputes Sash/Sturdy using its memorized field rather than its stale flag',()=>{
 const c={hp:100,maxHP:100,item:'Focus Sash',nativeSashSturdyProtected:true},field={magicRoom:false};
 c.hp=50;c.nativeSashSturdyProtected=native.recomputeSashSturdy(c,field);assert.equal(native.sashSturdy(c,field),false);
 c.hp=100;c.nativeSashSturdyProtected=native.recomputeSashSturdy(c,field);assert.equal(native.sashSturdy(c,field),true);
 assert.equal(native.recomputeSashSturdy(c,{magicRoom:true}),false);
 assert.equal(native.recomputeSashSturdy({...c,ability:'Klutz'},field),false);
 assert.equal(native.recomputeSashSturdy({...c,item:'',ability:'Sturdy'},{magicRoom:true}),true);
});
test('reserve move comparison maximizes damage without variance, not the average roll',()=>{
 const mon={moves:[attack([0,100],{name:'High maximum'}),attack([90,90],{name:'High mean'})]};
 assert.equal(ai.bestDamage(mon,true).name,'High maximum');
 assert.equal(ai.bestDamage(mon).name,'High mean','other existing mean-based checks keep their separate scope');
});
test('reserve counts use pre-hazard HP while the early slow-OHKO rejection uses post-hazard HP',()=>{
 const s=state();
 assert.equal(ai.scoreCandidate(reserve({entryHazardDamage:30}),s,false).score,2);
 assert.equal(ai.scoreCandidate(reserve({entryHazardDamage:30}),s,true).score,2);
 assert.equal(ai.scoreCandidate(reserve({entryHazardDamage:65}),s,false).score,-1);
 assert.equal(ai.scoreCandidate(reserve({entryHazardDamage:100}),s,false).score,-Infinity);
});
test('native Sash/Sturdy count is used for immediate-entry penalties, including the ROM multihit quirk',()=>{
 const s=state();s.player.ability='Mold Breaker';
 const r=reserve({item:'Focus Sash',speed:150,moves:[attack(30)],incomingMoves:[attack(120,{hits:2})]});
 const scored=ai.scoreCandidate(r,s,true);
 assert.equal(scored.score,1);assert.equal(scored.scoreDamage.hitsToBeKOed,2);
 assert.equal(ai.scoreCandidate({...r,item:''},s,true).score,-2);
});
for(const fixture of cases.battles)test('observed battle: '+fixture.id+' chooses '+fixture.observedEntrant,()=>{
 const before=JSON.stringify(fixture.state),r=post.predict(fixture.state);
 assert.deepEqual(r.switch.candidates.map(c=>c.score),fixture.expectedScores);
 assert.equal(r.switch.candidates.find(c=>c.probability===1).name,fixture.observedEntrant);
 assert.ok(r.switch.candidates.every(c=>c.damageBasis==='rom-no-variance'));
 assert.equal(JSON.stringify(fixture.state),before);
});
test('Joey changes ranking exactly across the 112/113 HP two-hit threshold',()=>{
 const fixture=cases.battles.find(c=>c.id==='joey-chesnaught'),s=structuredClone(fixture.state);
 s.player.hp=112;assert.equal(post.predict(s).switch.candidates.find(c=>c.probability===1).name,'Comfey');
 s.player.hp=113;assert.equal(post.predict(s).switch.candidates.find(c=>c.probability===1).name,'Heliolisk');
});
test('strict post-KO mode accepts the verified deterministic threshold but still hides estimated damage',()=>{
 const s=structuredClone(cases.battles[0].state);s.context.calculationMode='strict';
 assert.equal(post.predict(s).switch.candidates.find(c=>c.name==='Heliolisk').probability,1);
 s.party.candidates.find(c=>c.name==='Heliolisk').moves.find(m=>m.name==='Swift').damageEstimated=true;
 assert.ok(post.predict(s).switch.candidates.every(c=>c.probability===null));
});
test('an estimated competing move keeps direct post-KO and preview equally uncertain in strict mode',()=>{
 const s=state();s.context={calculationMode:'strict',switchScenario:'post-ko'};
 s.party.candidates=[reserve({speed:150,moves:[attack(120),attack(20,{name:'Triple Axel',damageEstimated:true})]})];
 assert.equal(ai.getSwitchProbabilities(s).candidates[0].probability,null);
 assert.equal(post.predict(s).switch.candidates[0].probability,null);
});
