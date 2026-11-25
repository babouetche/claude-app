'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../docs/js/null_ai/core.js'),switchAI=require('../docs/js/null_ai/switch.js');
const doubles=require('../docs/js/null_ai/doubles.js');
const move=(name,damage,extra={})=>({name,category:'Physical',bp:70,basePower:70,priority:0,effect:'HIT',damage:[damage],type:'Normal',target:'normal',...extra});
function state(){return {player:{name:'Chesnaught',hp:126,maxHP:126,speed:65,types:['Grass','Fighting'],ability:'Battle Armor',item:'',boosts:{},moves:[move('Brick Break',196)]},
 opponent:{name:'Raticate-Alola',hp:105,maxHP:105,speed:67,types:['Dark','Normal'],ability:'Hustle',item:'Dark Gem',boosts:{},
 moves:[move('Sucker Punch',19,{priority:1,type:'Dark'}),move('Last Resort',52,{bp:140,basePower:140}),move('(No Move)',0),move('(No Move)',0)]},
 field:{gameType:'Singles'},context:{calculationMode:'estimate',opponentFirstTurn:true,opponentTurnsActive:1,opponentLastMove:''}};}

test('confirmed first-turn screenshot chooses Sucker Punch, excluding locked Last Resort before HDM scoring',()=>{
 const s=state(),before=JSON.stringify(s),r=core.getNullAIMoveProbabilities(s);
 assert.deepEqual(r.moves.map(m=>m.probability),[1,0,0,0]);
 assert.match(r.moves[1].rules.join(' '),/Last Resort is locked/);assert.equal(JSON.stringify(s),before);
});
test('a failed Sucker Punch attempt unlocks Last Resort; success is not required',()=>{
 const s=state();s.context.opponentFirstTurn=false;s.context.opponentTurnsActive=2;
 s.opponent.moves[0].usedSinceEntry=true;s.context.opponentLastMove='Sucker Punch';
 assert.equal(core.lastResortReady(s.opponent,s.context),true);
 assert.deepEqual(core.getNullAIMoveProbabilities(s).moves.map(m=>m.probability),[0,1,0,0]);
});
test('every other known slot must be attempted, including zero-PP or currently unavailable moves',()=>{
 const s=state();s.opponent.moves[0].usedSinceEntry=true;
 s.opponent.moves[2]=move('Protect',0,{category:'Status',usedSinceEntry:false,pp:0,usable:false});
 assert.equal(core.lastResortReady(s.opponent,s.context),false);
 s.opponent.moves[2].usedSinceEntry=true;assert.equal(core.lastResortReady(s.opponent,s.context),true);
});
test('Last Resort as the only known move cannot unlock, while No Move slots are ignored',()=>{
 const s=state();s.opponent.moves[0]=move('(No Move)',0);
 assert.equal(core.lastResortReady(s.opponent,s.context),false);
 assert.equal(core.getNullAIMoveProbabilities(s).status,'no-legal-moves');
 s.opponent.moves[0]=move('Sucker Punch',19,{usedSinceEntry:true});assert.equal(core.lastResortReady(s.opponent,s.context),true);
});
test('missing mid-battle history stays unknown instead of certifying Last Resort at 100 percent',()=>{
 const s=state();s.context.opponentFirstTurn=false;delete s.context.opponentTurnsActive;
 assert.equal(core.lastResortReady(s.opponent,s.context),null);
 const r=core.getNullAIMoveProbabilities(s);assert.equal(r.status,'unavailable');assert.match(r.reasons.join(' '),/Last Resort history is unknown/);
});
test('strict mode accepts known first-entry history and PP still overrides an unlocked move',()=>{
 const s=state();s.context.calculationMode='strict';
 assert.deepEqual(core.getNullAIMoveProbabilities(s).moves.map(m=>m.probability),[1,0,0,0]);
 s.opponent.moves[0].usedSinceEntry=true;s.opponent.moves[1].pp=0;
 assert.deepEqual(core.getNullAIMoveProbabilities(s).moves.map(m=>m.probability),[1,0,0,0]);
});
test('returning reserves cannot use Last Resort to obtain a false fast OHKO score',()=>{
 const s=state(),c={name:'Reserve',hp:100,maxHP:100,speed:100,incomingDamage:[30],
 moves:[move('Tackle',10,{usedSinceEntry:true}),move('Last Resort',200,{bp:140,usedSinceEntry:true})]};
 assert.equal(switchAI.scoreCandidate(c,s,false).score,1,'entry resets the Last Resort counter even for a previously used reserve');
});
test('unlocked player Last Resort remains part of incoming damage against a reserve',()=>{
 const s=state(),c={name:'Reserve',hp:100,maxHP:100,speed:40,moves:[move('Tackle',10)],incomingMoves:[move('Tackle',1,{usedSinceEntry:true}),move('Last Resort',100)]};
 assert.equal(switchAI.scoreCandidate(c,s,false).score,-1);
});
test('invalid attempt flags cannot silently unlock Last Resort',()=>{
 const s=state();s.opponent.moves[0].usedSinceEntry='yes';
 const r=core.getNullAIMoveProbabilities(s);assert.equal(r.status,'unavailable');assert.match(r.reasons.join(' '),/true or false/);
});
function doubleState(){
 const s=state(),partner={...s.opponent,name:'Partner',moves:[move('Tackle',1)]};
 const context={...s.context,doublesComplete:true,playerLastMon:false,opponentLastMon:false,opponentTeamSize:3,opponentAliveCount:3,playerConfused:false,playerInfatuated:false,playerIncapacitated:false};
 const d={complete:true,players:[s.player,{...s.player,name:'Player 2'}],opponents:[{...s.opponent,context},partner],field:{gameType:'Doubles'},context,assumptions:[],matchups:[]};
 d.opponents.forEach((o,i)=>{d.matchups[i]=d.players.map(p=>({player:p,opponent:o,field:d.field,context}));d.matchups[i].ally={player:d.opponents[1-i],opponent:o,field:d.field,context};});
 return d;
}
test('the doubles scorer uses each active slot history and removes locked Last Resort targets',()=>{
 const d=doubleState();
 let r=doubles.predict(d).slots[0];assert.equal(r.moves[1].probability,0);assert.ok(r.targets.every(t=>t.move!=='Last Resort'));
 d.opponents[0].moves[0].usedSinceEntry=true;
 r=doubles.predict(d).slots[0];assert.equal(r.moves[1].probability,1);
});

test('unknown Last Resort history cannot use the doubles single-move shortcut to show 100 percent',()=>{
 const d=doubleState();d.opponents[0].moves[0].usable=false;
 d.opponents[0].context.opponentFirstTurn=false;delete d.opponents[0].context.opponentTurnsActive;
 const r=doubles.predict(d).slots[0];assert.equal(r.status,'unavailable');assert.equal(r.moves[1].probability,null);
 assert.match(r.reasons.join(' '),/Last Resort history is unknown/);
});
