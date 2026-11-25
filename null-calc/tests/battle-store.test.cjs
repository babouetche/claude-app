'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const store=require('../docs/js/null_ai/battle_store');
const stock=Object.assign({},require('../docs/calc'),require('../docs/calc/mechanics/util'));
const root=path.resolve(__dirname,'..');
function fixture(){
 const api=store.create({limit:256}),calc={...stock};let computations=0;
 calc.calculate=function(){computations++;return stock.calculate.apply(stock,arguments);};
 const mon=(name,moves,opts={})=>new calc.Pokemon(9,name,{level:35,moves:moves.map(n=>new calc.Move(9,n)),...opts});
 const data={player:mon('Pikachu',['Thunderbolt','Tackle','Protect','Quick Attack']),opponent:mon('Blastoise',['Surf','Tackle','Protect','Rest']),field:new calc.Field(),marked:new Set(),controls:{},
  sets:{Blastoise:{Trainer:{index:0,level:35,ability:'Torrent',moves:['Surf','Tackle','Protect','Rest']}},Watchog:{Trainer:{index:1,level:35,ability:'Analytic',moves:['Retaliate','Tackle','Hypnosis','Low Kick']}},Houndstone:{Trainer:{index:2,level:35,ability:'Sand Rush',moves:['Last Respects','Tackle','Protect','Rest']}}}};
 const ctx={calc,gen:9,pokedex:calc.SPECIES[9],SETDEX_SV:data.sets,NullBattleStore:api,NullFaintContext:require('../docs/js/null_ai/faint_context'),
  LEGACY_STATS:Array.from({length:10},()=>['hp','at','df','sa','sd','sp']),legacyStatToStat:s=>({hp:'hp',at:'atk',df:'def',sa:'spa',sd:'spd',sp:'spe'})[s],
  getTrainerNameFromSet:()=> 'Trainer',opposingMarkedSetIds:data.marked,checkStatBoost:()=>{},
  $:selector=>({selector,val:()=>selector==='#p2 .set-selector'?'Blastoise (Trainer)':selector==='#p1 .current-hp'?data.player.curHP():selector==='#p2 .current-hp'?data.opponent.curHP():'',prop:()=>false}),
  createPokemon:target=>(target.selector==='#p1'?data.player:data.opponent).clone(),createField:()=>data.field.clone()};
 ctx.window=ctx;vm.createContext(ctx);
 ['metadata','state'].forEach(name=>vm.runInContext(fs.readFileSync(path.join(root,'docs/js/null_ai/'+name+'.js'),'utf8'),ctx,{filename:name+'.js'}));
 const read=()=>ctx.NullMoveAIState.readBattleState(null,data.controls);
 return {data,ctx,api,read,computations:()=>computations,mon};
}
test('battle clone preserves Infinity, undefined, graph aliases, methods and doubles .ally properties',()=>{
 const shared={hp:30},pairs=[{player:shared}];pairs.ally={player:shared,turns:Infinity};const input={pairs,other:shared,notKnown:undefined};input.self=input;
 const result=store.clone(input);assert.notEqual(result,input);assert.equal(result.self,result);assert.equal(result.pairs.ally.turns,Infinity);
 assert.equal(result.pairs[0].player,result.pairs.ally.player);assert.equal(result.other,result.pairs[0].player);assert.ok(Object.hasOwn(result,'notKnown'));
 result.other.hp=0;assert.equal(shared.hp,30);
});
test('bounded engine memo isolates both first and repeated callers while retaining result methods',()=>{
 const api=store.create({limit:2}),a=new stock.Pokemon(9,'Pikachu'),d=new stock.Pokemon(9,'Mew'),m=new stock.Move(9,'Thunderbolt'),f=new stock.Field();let calls=0;
 const input={a,d,m,f},run=()=>api.memo('damage',input,()=>{calls++;return stock.calculate(9,a,d,m,f);});
 const first=run(),expected=first.range();first.damage[0]=999;first.attacker.stats.spe=999;first.attacker.moves.push('bad');
 const second=run();assert.deepEqual(second.range(),expected);assert.notEqual(second.attacker.stats.spe,999);assert.deepEqual(second.attacker.moves,[]);second.damage[0]=888;
 assert.deepEqual(run().range(),expected);assert.equal(calls,1);
 for(let i=0;i<3;i++)api.memo('damage',{i},()=>i);assert.equal(api.stats().size,2);assert.ok(api.stats().evictions>=2);
 api.invalidate();run();assert.equal(calls,2);assert.equal(api.stats().epoch,1);
});
test('complete deterministic keys distinguish every mechanic input and preserve special numeric values',()=>{
 const api=store.create(),input={hp:100,moves:[{name:'Tackle',pp:20}],item:'',ability:'',field:{trickRoom:false},alliesFainted:0,slots:[0,1]};
 const base=api.key(input);for(const mutate of [v=>v.hp--,v=>v.moves[0].pp--,v=>v.moves[0].name='Surf',v=>v.item='Choice Band',v=>v.ability='Analytic',v=>v.field.trickRoom=true,v=>v.alliesFainted++,v=>v.slots.reverse()]){const copy=store.clone(input);mutate(copy);assert.notEqual(api.key(copy),base);}
 assert.notEqual(api.key([Infinity]),api.key([null]));assert.notEqual(api.key([undefined]),api.key([null]));const a=[];a.ally={hp:10};assert.notEqual(api.key(a),api.key([]));
 assert.equal(api.key({b:1,a:2}),api.key({a:2,b:1}));
});
test('single and double reference channels share lifecycle without sharing or losing their snapshot graphs',()=>{
 const api=store.create(),initial={player:{name:'Pikachu',hp:50},matchups:[]};initial.matchups.ally={turns:Infinity};
 api.reference('single','Trainer|slot0','0',initial,false);api.reference('double','Trainer|slots01','0',initial,false);
 const changed=store.clone(initial);changed.player.name='Mew';changed.player.hp=1;
 let ref=api.reference('single','Trainer|slot0','0',changed,true);assert.equal(ref.state.player.name,'Pikachu');assert.equal(ref.frozen,true);ref.state.player.hp=0;
 assert.equal(api.reference('single','Trainer|slot0','0',changed,true).state.player.hp,50);
 assert.equal(api.reference('double','Trainer|slots01','0',changed,true).state.matchups.ally.turns,Infinity);
 ref=api.reference('single','Trainer|slot0','1',changed,true);assert.equal(ref.reason,'history');assert.equal(ref.frozen,false);assert.equal(ref.state.player.name,'Mew');
 assert.equal(api.reference('double','OtherTrainer','1',changed,true).frozen,false);
 api.resetReference('single');assert.equal(api.stats().references,1);api.resetReference();assert.equal(api.stats().references,0);
});
test('input/change scheduling coalesces a same-turn burst and explicit synchronous refresh can cancel it',async()=>{
 const api=store.create();let count=0;api.schedule('ui',()=>count++);api.schedule('ui',()=>count+=2);await Promise.resolve();assert.equal(count,2);assert.equal(api.stats().coalesced,1);
 api.schedule('ui',()=>count++);api.cancel('ui');count+=3;await Promise.resolve();assert.equal(count,5);
});
test('real-engine adapter repeat reuses all unchanged confrontations and matches uncached output exactly',()=>{
 const f=fixture(),first=f.read(),calls=f.computations(),second=f.read();assert.ok(calls>0);assert.equal(f.computations(),calls);assert.equal(JSON.stringify(second),JSON.stringify(first));
 f.ctx.NullBattleStore=null;const uncached=f.read();assert.equal(JSON.stringify(uncached),JSON.stringify(first));
 assert.equal(f.api.stats().hits,1);assert.equal(f.api.stats().engineCalls,calls);assert.equal(f.api.stats().size<=256,true);
});
test('HP, stats, moves, item, ability and field changes invalidate the appropriate real-engine cache entries',()=>{
 const f=fixture();f.read();
 const changes=[()=>f.data.player.originalCurHP--,()=>f.data.player.ivs.spa--,()=>f.data.player.moves[0]=new stock.Move(9,'Discharge'),()=>f.data.player.item='Choice Specs',()=>f.data.player.ability='Normalize',()=>f.data.field.weather='Rain',()=>f.data.field.attackerSide.isTailwind=true,()=>f.data.field.defenderSide.isReflect=true,()=>f.data.field.gameType='Doubles'];
 for(const change of changes){const before=f.computations();change();f.read();assert.ok(f.computations()>before,'changed mechanic input should calculate fresh profiles');}
 const before=f.computations();f.read();assert.equal(f.computations(),before);
});
test('KO marks, reserve HP, faint totals and move PP remain fresh while unchanged damage is safely reused',()=>{
 const f=fixture();let s=f.read(),hound=()=>s.party.candidates.find(c=>c.name==='Houndstone');assert.equal(hound().postKOMoves[0].effectiveBasePower,100);
 f.data.marked.add('Watchog (Trainer)');s=f.read();assert.equal(hound().postKOMoves[0].effectiveBasePower,150);assert.equal(s.party.candidates.find(c=>c.name==='Watchog').alive,false);
 f.data.controls={context:{opponentFaintCount:4},party:{'Houndstone (Trainer)':{hpPercent:25,moves:[{pp:0,usable:false}]}}};s=f.read();assert.equal(hound().postKOMoves[0].effectiveBasePower,300);assert.equal(hound().postKOMoves[0].pp,0);assert.equal(hound().postKOMoves[0].usable,false);assert.equal(hound().hp,Math.floor(hound().maxHP/4));
 f.data.marked.clear();f.data.controls={};s=f.read();assert.equal(hound().postKOMoves[0].effectiveBasePower,100);
});
test('installed damage hooks and ROM revision changes invalidate identical input profiles',()=>{
 const f=fixture();f.read();let before=f.computations();const original=f.ctx.calc.calculate;
 f.ctx.calc.calculate=function(){return original.apply(this,arguments);};f.read();assert.ok(f.computations()>before);
 before=f.computations();f.ctx.calc.nullVerifiedROM='new-ROM-revision';f.read();assert.ok(f.computations()>before);
 before=f.computations();f.ctx.calculateBasePowerSMSSSV=function(){};f.read();assert.ok(f.computations()>before);
});
test('cached whole states isolate caller mutations and detect edited trainer rows without data mutation tokens',()=>{
 const f=fixture(),first=f.read(),expected=JSON.stringify(first);first.player.hp=0;first.party.candidates[1].moves[0].damage[0]=9999;
 assert.equal(JSON.stringify(f.read()),expected);
 f.data.sets.Watchog.Trainer.level=45;const changed=f.read();assert.notEqual(changed.party.candidates[1].maxHP,JSON.parse(expected).party.candidates[1].maxHP);
 assert.equal(f.data.sets.Watchog.Trainer.level,45);
});
test('complete doubles cache preserves ally arrays and invalidates HP, move, faint and slot inputs',()=>{
 const f=fixture();f.data.field.gameType='Doubles';
 function partner(id,name,moves){const p=f.mon(name,moves);return {setID:id,level:35,hp:p.maxHP(),nature:'Serious',ability:p.ability,item:'',ivs:{},evs:{},boosts:{},moves:moves.map(name=>({name})),firstTurn:true};}
 const settings={playerPartner:partner('Pikachu (Blank Set)','Pikachu',['Thunderbolt','Tackle','Protect','Rest']),opponentPartner:partner('Watchog (Trainer)','Watchog',['Retaliate','Tackle','Hypnosis','Low Kick']),playerSlot:0,opponentSlot:0};
 const read=()=>f.ctx.NullMoveAIState.readDoubleBattleState(null,f.data.controls,settings);
 let s=read(),calls=f.computations();assert.equal(s.complete,true);const again=read();assert.equal(f.computations(),calls);assert.equal(JSON.stringify(again.matchups[0].ally),JSON.stringify(s.matchups[0].ally));
 s.matchups[0].ally.player.hp=0;assert.notEqual(read().matchups[0].ally.player.hp,0);
 settings.opponentSlot=1;s=read();assert.equal(s.selectedOpponent,1);assert.ok(f.computations()>calls);calls=f.computations();
 settings.opponentPartner.hp=0;s=read();assert.equal(s.opponents[0].hp,0);assert.ok(f.computations()>calls);calls=f.computations();
 settings.playerPartner.moves[0].name='Surf';read();assert.ok(f.computations()>calls);calls=f.computations();
 f.data.controls={context:{opponentFaintCount:4}};s=read();assert.equal(s.party.candidates.find(c=>c.name==='Houndstone').alliesFainted,4);assert.ok(f.computations()>calls);
 const memo=f.ctx.NullBattleStore;f.ctx.NullBattleStore=null;const uncached=read();f.ctx.NullBattleStore=memo;
 assert.equal(JSON.stringify(s),JSON.stringify(uncached));assert.equal(JSON.stringify(s.matchups.map(p=>p.ally)),JSON.stringify(uncached.matchups.map(p=>p.ally)));
});
test('native reserve damage profiles use raw party HP before hazards and expose the native Sash/Sturdy flag',()=>{
 const f=fixture();f.data.sets.Blastoise.Trainer.moves[0]='Water Spout';f.data.sets.Blastoise.Trainer.item='Focus Sash';
 let s=f.read(),c=s.party.candidates[0],baseline=Array.from(c.moves[0].damage);assert.equal(c.nativeSashSturdyProtected,true);
 f.data.field.defenderSide.isSR=true;s=f.read();c=s.party.candidates[0];assert.ok(c.entryHazardDamage>0);assert.deepEqual(Array.from(c.moves[0].damage),baseline);assert.equal(c.nativeSashSturdyProtected,true);
 f.data.opponent.originalCurHP--;s=f.read();assert.equal(s.party.candidates[0].nativeSashSturdyProtected,false);
 f.data.opponent.originalCurHP++;f.data.field.isMagicRoom=true;s=f.read();assert.equal(s.party.candidates[0].nativeSashSturdyProtected,false);
 f.data.sets.Blastoise.Trainer.item='';f.data.sets.Blastoise.Trainer.ability='Sturdy';f.data.player.ability='Mold Breaker';s=f.read();assert.equal(s.party.candidates[0].nativeSashSturdyProtected,true,'the native scoring flag does not check ability bypass or number of hits');
});
test('frozen singles rebuild HP-dependent reserve damage against captured Pokémon and field with isolated cached outputs',()=>{
 const f=fixture();f.data.sets.Watchog.Trainer.moves=['Water Spout','Eruption','Flail','Reversal'];f.data.sets.Watchog.Trainer.item='Focus Sash';
 const original=f.read(),builder=original.rebuildFrozenParty,initial=original.party.candidates.find(c=>c.name==='Watchog'),expected=[];
 assert.equal(initial.maxHP%2,1,'odd maximum HP exercises floor rather than round at 50%');
 for(const hpPercent of [50,100]){f.data.controls={party:{'Watchog (Trainer)':{hpPercent,alive:true}}};expected.push(f.read().party.candidates.find(c=>c.name==='Watchog'));}
 f.data.player=f.mon('Golem',['Earthquake','Tackle','Protect','Rest']);f.data.field.weather='Sun';f.data.field.isMagicRoom=true;
 original.player.hp=1;original.player.name='Changed returned state';initial.moves[0].damage[0]=9999;
 for(const [i,hpPercent]of [50,100].entries()){
  const controls={party:{'Watchog (Trainer)':{hpPercent,alive:true}}},party=builder(controls),c=party.candidates.find(c=>c.name==='Watchog');
  assert.deepEqual(c.moves.map(m=>Array.from(m.damage)),expected[i].moves.map(m=>Array.from(m.damage)));assert.equal(c.nativeSashSturdyProtected,hpPercent===100);assert.equal(c.hp,Math.floor(c.maxHP*hpPercent/100));
  c.moves[0].damage[0]=9999;assert.notEqual(builder(controls).candidates.find(c=>c.name==='Watchog').moves[0].damage[0],9999);
 }
 assert.equal(builder({}),null,'unchanged reserve inputs retain the original frozen party');
 const unavailable=builder({party:{'Watchog (Trainer)':{hpPercent:100,alive:false}}});assert.equal(unavailable.candidates.find(c=>c.name==='Watchog').alive,false);
});
test('frozen doubles rebuild conditional reserve power using captured spread targets, slot correspondence and field',()=>{
 const f=fixture();f.data.field.gameType='Doubles';f.data.sets.Houndstone.Trainer.moves=['Water Spout','Eruption','Flail','Reversal'];f.data.sets.Houndstone.Trainer.item='Focus Sash';
 function partner(id,name,moves){const p=f.mon(name,moves);return {setID:id,level:35,hp:p.maxHP(),nature:'Serious',ability:p.ability,item:'',ivs:{},evs:{},boosts:{},moves:moves.map(name=>({name})),firstTurn:true};}
 const settings={playerPartner:partner('Pikachu (Blank Set)','Pikachu',['Thunderbolt','Tackle','Protect','Rest']),opponentPartner:partner('Watchog (Trainer)','Watchog',['Retaliate','Tackle','Hypnosis','Low Kick']),playerSlot:0,opponentSlot:0};
 const read=()=>f.ctx.NullMoveAIState.readDoubleBattleState(null,f.data.controls,settings),original=read(),builder=original.rebuildFrozenParty,expected=[];
 for(const hpPercent of [50,100]){f.data.controls={party:{'Houndstone (Trainer)':{hpPercent,alive:true}}};expected.push(read().party.candidates.find(c=>c.name==='Houndstone'));}
 f.data.player=f.mon('Golem',['Earthquake','Tackle','Protect','Rest']);f.data.field.weather='Sun';f.data.field.isMagicRoom=true;settings.playerPartner.hp=0;settings.opponentSlot=1;
 for(const [i,hpPercent]of [50,100].entries()){
  const party=builder({party:{'Houndstone (Trainer)':{hpPercent,alive:true}}}),c=party.candidates.find(c=>c.name==='Houndstone');
  assert.deepEqual(c.moves.map(m=>Array.from(m.damage)),expected[i].moves.map(m=>Array.from(m.damage)));assert.equal(c.nativeSashSturdyProtected,hpPercent===100);assert.equal(c.hp,Math.floor(c.maxHP*hpPercent/100));
  assert.equal(party.candidates.filter(c=>c.active).length,2);assert.equal(party.candidates.find(c=>c.name==='Watchog').partnerActive,true);
 }
 f.data.controls={};settings.opponentPartner.setID='Watchog (Blank Set)';
 const foreign=read();assert.equal(foreign.party.complete,false);
 assert.equal(foreign.rebuildFrozenParty({party:{'Houndstone (Trainer)':{hpPercent:50,alive:true}}}).complete,false,'HP edits cannot certify a partner outside the trainer party');
});
