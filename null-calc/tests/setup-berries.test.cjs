'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../docs/js/null_ai/core');
const binary=require('./fixtures/rom-setup-berries.json');
const move=(name,damage,extra={})=>({name,category:'Physical',type:'Normal',effect:'HIT',priority:0,bp:75,basePower:75,damage:Array.isArray(damage)?damage:[damage],...extra});
function state(setup='Belly Drum'){
 return {player:{name:'Electivire',hp:69,maxHP:133,speed:98,status:'',ability:'Motor Drive',item:'',types:['Electric'],boosts:{},moves:[move('Low Kick',[78,80,80,82,82,84,84,86,86,86,88,88,90,90,92,92])]},
  opponent:{name:'Linoone',hp:124,maxHP:124,speed:97,status:'',ability:'Gluttony',item:'Iapapa Berry',types:['Normal'],boosts:{},moves:[move('Extreme Speed',[40,48],{priority:2}),move('Seed Bomb',[27,32]),move('Stomping Tantrum',[50,60]),move(setup,0,{category:'Status',bp:0,basePower:0,target:'self'})]},
  field:{gameType:'Singles'},context:{calculationMode:'estimate',playerIncapacitated:false,opponentLastMon:false}};
}
function probabilities(s,expected){const out=core.getNullAIMoveProbabilities(s);assert.notEqual(out.status,'unavailable',out.reasons.join(';'));assert.deepEqual(out.moves.map(m=>m.probability),expected);return out;}
test('Linoone screenshot: eligible Iapapa changes Belly Drum from 0 to 87.5%, not 100%',()=>{
 const s=state(),original=JSON.stringify(s),out=probabilities(s,[0,0,.125,.875]);
 assert.ok(out.moves[3].rules.includes('Risky setup: Iapapa Berry restores 62 HP (Gluttony: 50% HP trigger)'));
 assert.ok(out.moves[3].rules.includes('Risky setup: Estimated HP after Belly Drum: 124/124'));
 assert.equal(out.status,'estimated');assert.equal(JSON.stringify(s),original);
});
test('seven native berry parameters and item IDs are independently pinned',()=>{
 for(const [name,b]of Object.entries(binary.berries)){const raw=Buffer.from(b.recordBytes,'hex');assert.equal(raw.length,44);assert.equal(raw.readUInt16LE(20),b.id,name);assert.equal(raw[24],b.holdEffect,name);assert.equal(raw[25],b.holdEffectParam,name);assert.equal(parseInt(b.offset,16)-44*b.id,parseInt(binary.itemTableBase,16));}
 assert.equal(binary.berries['Iapapa Berry'].holdEffectParam,2);
});
test('all five native pinch berries heal half HP with Gluttony',()=>{
 for(const name of ['Figy Berry','Wiki Berry','Mago Berry','Aguav Berry','Iapapa Berry']){const s=state();s.opponent.item=name;const out=probabilities(s,[0,0,.125,.875]);assert.ok(out.moves[3].rules.some(r=>r.includes('restores 62 HP')));}
});
test('without Gluttony a full-HP Belly Drum does not activate a quarter-HP berry',()=>{const s=state();s.opponent.ability='Pickup';probabilities(s,[0,0,1,0]);});
test('removing the berry or holding an unrelated item gives no phantom healing',()=>{for(const item of ['','Leftovers','Salac Berry']){const s=state();s.opponent.item=item;probabilities(s,[0,0,1,0]);}});
test('Sitrus restores one quarter, Oran restores ten, following native parameters',()=>{
 const s=state();s.opponent.ability='Pickup';s.opponent.item='Sitrus Berry';
 let out=probabilities(s,[0,0,.125,.875]);assert.ok(out.moves[3].rules.some(r=>r.includes('restores 31 HP')));
 s.opponent.item='Oran Berry';out=probabilities(s,[0,0,1,0]);assert.ok(out.moves[3].rules.some(r=>r.includes('restores 10 HP')));
});
test('Magic Room, Klutz, Embargo, Heal Block and living opposing Unnerve suppress healing',()=>{
 for(const configure of [s=>s.field.magicRoom=true,s=>s.opponent.ability='Klutz',s=>s.context.opponentEmbargo=true,s=>s.context.opponentHealBlock=true,s=>s.player.ability='Unnerve',s=>s.player.ability='As One (Glastrier)',s=>s.players=[{hp:100,ability:'Unnerve'}]]){const s=state();configure(s);probabilities(s,[0,0,1,0]);}
 const s=state();s.players=[{hp:0,ability:'Unnerve'}];probabilities(s,[0,0,.125,.875]);
});
test('integer HP cost and trigger: odd maxHP does not prematurely activate Gluttony',()=>{
 const s=state();s.opponent.hp=s.opponent.maxHP=125;probabilities(s,[0,0,1,0]);
 s.opponent.hp=124;const out=probabilities(s,[0,0,.125,.875]);assert.ok(out.moves[3].rules.some(r=>r.includes('124/125')));
});
test('Belly Drum and Filet Away are discouraged at <=50% HP, positive Attack, or Contrary',()=>{
 for(const setup of ['Belly Drum','Filet Away'])for(const configure of [s=>s.opponent.hp=62,s=>s.opponent.boosts.atk=1,s=>s.opponent.ability='Contrary']){const s=state(setup);configure(s);const out=core.getNullAIMoveProbabilities(s);assert.equal(out.moves[3].probability,0);assert.ok(out.moves[3].rules.some(r=>r.includes('already raised Attack')));}
});
test('Filet Away uses the same half-HP cost and berry survival correction',()=>{probabilities(state('Filet Away'),[0,0,.125,.875]);});
test('canonical ROM/dataset name Fillet Away reaches the routine, unlike the documentary typo',()=>{probabilities(state('Fillet Away'),[0,0,.125,.875]);});
test('Clangorous Soul can activate a Sitrus Berry after its third-HP cost',()=>{
 const s=state('Clangorous Soul');s.opponent.hp=100;s.opponent.ability='Soundproof';s.opponent.item='Sitrus Berry';
 const out=probabilities(s,[0,0,.125,.875]);assert.ok(out.moves[3].rules.some(r=>r.includes('90/124')));
 s.opponent.item='';probabilities(s,[0,0,1,0]);
});
test('Clangorous Soul at its HP-cost threshold is discouraged, berries cannot revive it',()=>{
 const s=state('Clangorous Soul');s.opponent.hp=41;const out=core.getNullAIMoveProbabilities(s);assert.equal(out.moves[3].probability,0);assert.ok(out.moves[3].rules.some(r=>r.includes('insufficient HP')));assert.ok(!out.moves[3].rules.some(r=>r.includes('restores')));
});
test('Shell Smash has no HP cost and White Herb avoids the approximate defense-drop penalty',()=>{
 const s=state('Shell Smash');s.opponent.hp=s.opponent.maxHP=100;s.opponent.ability='Skill Link';s.opponent.item='';s.player.moves=[move('Low Kick',80)];
 probabilities(s,[0,0,1,0]);s.opponent.item='White Herb';const out=probabilities(s,[0,0,.125,.875]);assert.ok(out.moves[3].rules.some(r=>r.includes('100/100')));
 s.field.magicRoom=true;probabilities(s,[0,0,1,0]);
});
test('incapacitated branch falls through to survival on the remaining 10%',()=>{
 const s=state();s.player.status='slp';s.context.playerIncapacitated=true;s.opponent.item='';probabilities(s,[0,0,.1,.9]);
 s.opponent.item='Iapapa Berry';probabilities(s,[0,0,.0125,.9875]);
});
test('strict mode withholds missing-helper estimates; explicit KO fact remains usable',()=>{
 const s=state();s.context.calculationMode='strict';let out=core.getNullAIMoveProbabilities(s);assert.equal(out.status,'unavailable');assert.match(out.reasons[0],/missing native helper/);
 s.context.playerKOsAfterSetup=false;out=probabilities(s,[0,0,.125,.875]);assert.equal(out.status,'determined');
 s.context.playerKOsAfterSetup=true;probabilities(s,[0,0,1,0]);
});
test('reset moves and Unaware still discourage the four setup moves',()=>{
 for(const setup of ['Belly Drum','Filet Away','Clangorous Soul','Shell Smash']){const s=state(setup);s.player.ability='Unaware';assert.equal(core.getNullAIMoveProbabilities(s).moves[3].probability,0);}
});
test('doubles shares the berry correction and respects Unnerve in the other player slot',()=>{
 const doubles=require('../docs/js/null_ai/doubles');
 const s=state(),other={...s.player,name:'Other player',ability:'',moves:s.player.moves.map(m=>({...m}))};
 s.opponent.moves[3].target='self';
 const partner={...s.opponent,name:'AI partner',ability:'',item:'',moves:[move('Tackle',10),move('(No Move)',0,{category:'Status'}),move('(No Move)',0,{category:'Status'}),move('(No Move)',0,{category:'Status'})]};
 const f={gameType:'Doubles'},ctx={...s.context,doublesComplete:true,opponentFirstTurn:true,playerLastMon:false};
 const all={complete:true,players:[s.player,other],opponents:[s.opponent,partner],context:ctx,field:f,assumptions:[],matchups:[]};
 all.opponents.forEach((o,i)=>{all.matchups[i]=all.players.map(p=>({player:p,opponent:o,context:ctx,field:f}));all.matchups[i].ally={player:all.opponents[1-i],opponent:o,context:ctx,field:f};});
 let out=doubles.predict(all).slots[0];assert.ok(out.moves[3].probability>0,JSON.stringify(out));assert.equal(out.targets.find(t=>t.moveSlot===3).target,'self');
 other.ability='Unnerve';out=doubles.predict(all).slots[0];assert.equal(out.moves[3].probability,0);
});
