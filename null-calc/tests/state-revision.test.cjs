const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const calc = Object.assign({}, require('../docs/calc'), require('../docs/calc/mechanics/util'));
const switchAI = require('../docs/js/null_ai/switch');

function mon(name, moves, options = {}) {
    return new calc.Pokemon(9, name, Object.assign({ level: 50, moves: moves.map(m => new calc.Move(9, m)) }, options));
}
function readState({ player, opponent, selected = 'Blastoise (Trainer)', sets, field = new calc.Field(), overrides = {}, marked = [], doubles, trainerAPI }) {
    const selectors = {
        '#p1 .current-hp': player.curHP(), '#p2 .current-hp': opponent.curHP(),
        '#p2 .set-selector': selected, '#p1 .status': '',
    };
    const ctx = {
        calc, gen: 9, pokedex: calc.SPECIES[9], SETDEX_SV: sets,
        NullVersion126Trainers:trainerAPI,
        LEGACY_STATS: Array.from({ length: 10 }, () => ['hp', 'at', 'df', 'sa', 'sd', 'sp']),
        legacyStatToStat: s => ({ hp: 'hp', at: 'atk', df: 'def', sa: 'spa', sd: 'spd', sp: 'spe' })[s],
        getTrainerNameFromSet: selected => selected.slice(selected.indexOf(' (') + 2, -1),
        trainerSetKeyMatchesTrainer: (key, trainer) => key === trainer || key === trainer + ' 2',
        opposingMarkedSetIds: new Set(marked),
        $: selector => ({ selector, val: () => selectors[selector] ?? '', prop: () => false }),
        createPokemon: target => (target.selector === '#p1' ? player : opponent).clone(),
        createField: () => field.clone(), checkStatBoost: () => {},
    };
    ctx.window = ctx;
    ctx.NullFaintContext = require('../docs/js/null_ai/faint_context');
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../docs/js/null_ai/metadata.js'), 'utf8'), ctx);
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../docs/js/null_ai/state.js'), 'utf8'), ctx);
    return doubles ? ctx.NullMoveAIState.readDoubleBattleState(null, overrides, doubles) : ctx.NullMoveAIState.readBattleState(null, overrides);
}
function set(index, ability, item = '') {
    return { index, level: 50, ability, item, moves: ['Tackle', 'Surf', '(No Move)', '(No Move)'] };
}
function baseFixture(extraSets = {}, options = {}) {
    return Object.assign({
        player: mon('Pikachu', ['Tackle', 'Thunderbolt', '(No Move)', '(No Move)']),
        opponent: mon('Blastoise', ['Tackle', 'Surf', '(No Move)', '(No Move)']),
        sets: Object.assign({ Blastoise: { Trainer: set(0, 'Torrent') } }, extraSets),
    }, options);
}

function doubleFixture(options={}) {
    function partner(id,name,moves) {var p=mon(name,moves,{level:50});return {setID:id,level:50,hp:p.maxHP(),nature:'Serious',ability:p.ability,item:'',ivs:{},evs:{},boosts:{},moves:moves.concat(Array.from({length:4-moves.length},()=>'(No Move)')).map(name=>({name})),firstTurn:true};}
    return baseFixture({Charizard:{Trainer:set(1,'Blaze')},Golem:{Trainer:set(2,'Sturdy')}},Object.assign({
        field:new calc.Field({gameType:'Doubles'}),
        doubles:{playerPartner:partner('Pikachu (Blank Set)','Pikachu',['Thunderbolt']),opponentPartner:partner('Charizard (Trainer)','Charizard',['Flamethrower']),playerSlot:0,opponentSlot:0}
    },options));
}
test('Retaliate reserves carry separate real-engine profiles for ordinary entry and the turn after a KO',()=>{
    const f=baseFixture({Watchog:{Trainer:{...set(1,'Analytic'),nature:'Adamant',moves:['Retaliate','Seed Bomb','Hypnosis','Low Kick']}}});
    const before=JSON.stringify(f.sets),s=readState(f),c=s.party.candidates.find(c=>c.name==='Watchog');
    const a=mon('Watchog',['Retaliate'],{ability:'Analytic',nature:'Adamant'}),m=new calc.Move(9,'Retaliate',{overrides:{basePower:140}});
    const expected=calc.calculate(9,a,f.player,m,new calc.Field());
    assert.deepEqual(Array.from(c.postKOMoves[0].damage),expected.damage);assert.equal(c.postKOMoves[0].effectiveBasePower,140);
    assert.equal(c.postKOMoves[0].basePower,70);assert.ok(Math.max(...c.postKOMoves[0].damage)>Math.max(...c.moves[0].damage));
    assert.equal(JSON.stringify(f.sets),before);assert.equal(JSON.stringify(readState(f).party),JSON.stringify(s.party));
});
test('Last Respects counts existing KO marks plus the simulated KO without double counting a marked active',()=>{
    const f=baseFixture({Houndstone:{Trainer:{...set(1,'Sand Rush'),moves:['Last Respects','Tackle','Protect','Rest']}},Charizard:{Trainer:set(2,'Blaze')}});
    const candidate=s=>s.party.candidates.find(c=>c.name==='Houndstone');
    let s=readState(f);assert.equal(candidate(s).postKOMoves[0].effectiveBasePower,100);
    f.marked=['Charizard (Trainer)'];s=readState(f);assert.equal(candidate(s).postKOMoves[0].effectiveBasePower,150);
    assert.ok(Math.max(...candidate(s).moves[0].damage)>Math.max(...candidate(readState({...f,marked:[]})).moves[0].damage));
    f.marked.push('Blastoise (Trainer)');s=readState(f);assert.equal(candidate(s).postKOMoves[0].effectiveBasePower,150);
    f.marked=[];assert.equal(candidate(readState(f)).postKOMoves[0].effectiveBasePower,100);
});
test('Supreme Overlord reserves receive known faints and the simulated one at the engine modifier stage',()=>{
    const f=baseFixture({Kingambit:{Trainer:{...set(1,'Supreme Overlord'),moves:['Iron Head','Tackle','Protect','Rest']}}});
    const s=readState(f),c=s.party.candidates.find(c=>c.name==='Kingambit');
    const a=mon('Kingambit',['Iron Head'],{ability:'Supreme Overlord',alliesFainted:1});
    const expected=calc.calculate(9,a,f.player,new calc.Move(9,'Iron Head'),new calc.Field());
    assert.equal(c.alliesFainted,0);assert.equal(c.alliesFaintedAfterKO,1);assert.deepEqual(Array.from(c.postKOMoves[0].damage),expected.damage);
    assert.ok(Math.max(...c.postKOMoves[0].damage)>Math.max(...c.moves[0].damage));
});
test('explicit revival counts apply to Last Respects and Supreme Overlord, whose bonus caps at five',()=>{
    const f=baseFixture({Houndstone:{Trainer:{...set(1,'Sand Rush'),moves:['Last Respects','Tackle','Protect','Rest']}},Kingambit:{Trainer:set(2,'Supreme Overlord')}});
    f.overrides={context:{opponentFaintCount:7}};const s=readState(f);
    assert.equal(s.party.candidates.find(c=>c.name==='Houndstone').postKOMoves[0].effectiveBasePower,450);
    const c=s.party.candidates.find(c=>c.name==='Kingambit');assert.deepEqual(Array.from(c.postKOMoves[0].damage),Array.from(c.moves[0].damage));
});
test('doubles reserve faint profiles count a partner at zero HP but simulate only the selected slot KO',()=>{
    const f=doubleFixture();f.sets.Golem.Trainer.moves=['Last Respects','Tackle','Protect','Rest'];
    let s=readState(f);assert.equal(s.party.candidates.find(c=>c.name==='Golem').postKOMoves[0].effectiveBasePower,100);
    f.doubles.opponentPartner.hp=0;s=readState(f);assert.equal(s.party.candidates.find(c=>c.name==='Golem').postKOMoves[0].effectiveBasePower,150);
    assert.deepEqual(JSON.parse(JSON.stringify(s.party.faintContext)),{known:1,afterKO:2});
});
test('post-KO recalculation preserves explicit reserve PP and move-availability overrides',()=>{
    const f=baseFixture({Watchog:{Trainer:{...set(1,'Analytic'),moves:['Retaliate','Tackle','Protect','Rest']}}});
    f.overrides={party:{'Watchog (Trainer)':{moves:[{pp:0,usable:false}]}}};
    const c=readState(f).party.candidates.find(c=>c.name==='Watchog');assert.equal(c.moves[0].pp,0);assert.equal(c.postKOMoves[0].pp,0);assert.equal(c.postKOMoves[0].usable,false);
});
test('four-battler adapter keeps self/ally/spread targets and source trainer data intact',()=>{
    const f=doubleFixture(),before=JSON.stringify(f.sets);f.opponent=mon('Blastoise',['Surf','Acupressure','Helping Hand','Protect']);
    const s=readState(f);assert.equal(s.complete,true);assert.deepEqual(Array.from(s.opponents[0].moves,m=>m.target),['allAdjacent','adjacentAllyOrSelf','adjacentAlly','self']);
    assert.equal(s.matchups[0].ally.opponent.moves.length,4);assert.equal(s.party.candidates.filter(c=>c.active).length,2);assert.equal(JSON.stringify(f.sets),before);
});
test('partner KO mark affects the active snapshot and a foreign partner invalidates only party predictions',()=>{
    const f=doubleFixture({marked:['Charizard (Trainer)']});let s=readState(f);assert.equal(s.opponents[1].hp,0);assert.equal(s.party.candidates.find(c=>c.name==='Charizard').alive,false);
    f.marked=[];f.doubles.opponentPartner.setID='Charizard (Blank Set)';s=readState(f);assert.equal(s.complete,true);assert.equal(s.party.complete,false);
});
test('opposing slot 2 uses player slot 2 for replacements and preserves partner-specific facts',()=>{
    const f=doubleFixture({overrides:{context:{playerConfused:true,opponentSubstitute:true,opponentTurnsActive:3}}});f.doubles.opponentSlot=1;
    const s=readState(f);assert.equal(s.opponents[1].name,'Blastoise');assert.equal(s.switchState.player.name,'Pikachu');
    assert.equal(s.opponents[0].context.opponentSubstitute,undefined);assert.equal(s.matchups[1][1].context.playerConfused,undefined);assert.equal(s.matchups[1][0].context.playerConfused,true);
});
test('spread damage is reduced for multiple living targets and restored when only one remains',()=>{
    const f=doubleFixture();f.opponent=mon('Blastoise',['Surf','(No Move)','(No Move)','(No Move)']);f.doubles.opponentPartner.setID='__empty__';f.doubles.playerPartner.hp=0;
    const one=readState(f);f.doubles.playerPartner.hp=mon('Pikachu',[]).maxHP();const two=readState(f);
    assert.ok(Math.max(...one.matchups[0][0].opponent.moves[0].damage)>Math.max(...two.matchups[0][0].opponent.moves[0].damage));
});
test('post-KO doubles scores follow each documented slot, including partner HP and moves',()=>{
    const f=doubleFixture();
    Object.assign(f.doubles.playerPartner,{setID:'Blissey (Blank Set)',hp:60,ability:'Natural Cure',moves:[{name:'Ice Beam',pp:0},{name:'Flamethrower',usable:false},{name:'(No Move)'},{name:'(No Move)'}]});
    let s=readState(f);assert.equal(s.switchState.player.name,'Pikachu');assert.equal(s.switchState.context.doublesOpponentSlot,0);
    f.doubles.opponentSlot=1;s=readState(f);
    assert.equal(s.switchState.player.name,'Blissey');assert.equal(s.switchState.player.hp,60);assert.equal(s.switchState.context.doublesOpponentSlot,1);
    assert.ok(s.switchState.party.candidates.filter(c=>!c.active).every(c=>c.incomingDamage.every(d=>d===0)));
    f.doubles.playerSlot=1;s=readState(f);assert.equal(s.switchState.player.name,'Pikachu');
    assert.equal(s.switchState.party.candidates.filter(c=>c.active).length,2);
});

test('trainer reserves use the opponent hazard side and preserve team order', () => {
    const fixture = baseFixture({ Golem: { Trainer: set(2, 'Sturdy') }, Charizard: { Trainer: set(1, 'Blaze') } }, {
        field: new calc.Field({ attackerSide: { isSR: false }, defenderSide: { isSR: true, spikes: 1 } }),
    });
    const s = readState(fixture);
    assert.equal(s.party.complete, true);
    assert.deepEqual(Array.from(s.party.candidates, c => c.name), ['Blastoise', 'Charizard', 'Golem']);
    const charizard = s.party.candidates.find(c => c.name === 'Charizard');
    assert.equal(charizard.entryHazardDamage, Math.floor(charizard.maxHP / 2));
    const golem = s.party.candidates.find(c => c.name === 'Golem');
    assert.equal(golem.entryHazardDamage, Math.floor(golem.maxHP / 16) + Math.floor(golem.maxHP / 8));
    assert.equal(s.field.opponentStealthRock, true);
    assert.equal(s.field.playerStealthRock, false);
});
test('numeric-string trainer IVs and EVs yield the same reserve stats and damage as numbers',()=>{
    const numeric=set(1,'Blaze');numeric.ivs={hp:31,at:31,df:31,sa:25,sd:31,sp:31};numeric.evs={hp:0,at:0,df:0,sa:0,sd:0,sp:0};
    const text=JSON.parse(JSON.stringify(numeric));['ivs','evs'].forEach(key=>Object.keys(text[key]).forEach(stat=>text[key][stat]=String(text[key][stat])));
    const fixture=baseFixture({Charizard:{Trainer:text}}),before=JSON.stringify(fixture.sets);
    const actual=readState(fixture).party.candidates[1],expected=readState(baseFixture({Charizard:{Trainer:numeric}})).party.candidates[1];
    assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(expected)));
    assert.equal(JSON.stringify(fixture.sets),before);assert.ok(actual.maxHP<300);assert.ok(actual.speed<300);
});
test('Ivan Seadra with string IVs cannot become a fabricated faster OHKO reserve',()=>{
    const data={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../docs/js/data/sets/gen9.js'),'utf8'),data);const sets=data.SETDEX_SV;
    const ivan=Object.fromEntries(['Pelipper','Castform','Qwilfish','Seadra'].map(n=>[n,{'Fisherman Ivan':sets[n]['Fisherman Ivan']}]));
    const player=mon('Electabuzz',['Discharge','Thunder Punch','Low Kick','Light Screen'],{level:38,nature:'Impish',ability:'Vital Spirit',ivs:{hp:25,atk:12,def:9,spa:7,spd:7,spe:18}});
    const s=readState({player,opponent:mon('Pelipper',sets.Pelipper['Fisherman Ivan'].moves,{level:36}),sets:ivan,selected:'Pelipper (Fisherman Ivan)',field:new calc.Field({weather:'Rain'})});
    const seadra=s.party.candidates.find(c=>c.name==='Seadra');assert.equal(seadra.maxHP,94);assert.equal(seadra.speed,75);
    assert.ok(seadra.moves.every(m=>Math.max(...m.damage)<player.maxHP()));
    const result=switchAI.getSwitchProbabilities({...s,context:{...s.context,switchScenario:'post-ko'}});
    assert.notEqual(result.candidates.find(c=>c.name==='Seadra').score,5);
});
test('numeric-string levels are normalized before HP computation',()=>{
    const numeric=set(1,'Blaze'),text={...numeric,level:'50'};
    const actual=readState(baseFixture({Charizard:{Trainer:text}})).party.candidates[1];
    const expected=readState(baseFixture({Charizard:{Trainer:numeric}})).party.candidates[1];
    assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(expected)));
});
test('malformed IVs, EVs and levels invalidate a partial team instead of producing statistics or a certain destination',()=>{
    const cases=[['ivs','hp','abc'],['ivs','hp',''],['ivs','hp',null],['ivs','hp',32],['ivs','hp',1.5],['ivs','hp',true],
        ['evs','sp',NaN],['evs','sp','Infinity'],['evs','sp',-1],['evs','sp',253],['evs','sp',{}],
        ['level',null,'oops'],['level',null,0],['level',null,101],['level',null,50.5]];
    for(const [group,key,value] of cases){
        const broken=set(1,'Blaze');if(key)broken[group]={[key]:value};else broken[group]=value;
        const s=readState(baseFixture({Charizard:{Trainer:broken},Golem:{Trainer:set(2,'Sturdy')}}));
        assert.equal(s.party.complete,false,group+' '+String(value));
        assert.ok(s.party.assumptions.some(a=>a.includes('Invalid trainer numeric data')));
        assert.ok(!s.party.candidates.some(c=>c.name==='Charizard'));
        assert.ok(s.party.candidates.every(c=>Object.values(c.stats).every(Number.isFinite)));
        const result=switchAI.getSwitchProbabilities({...s,context:{...s.context,switchScenario:'post-ko'}});
        assert.equal(result.candidates.length,0,'Cannot rank only the readable subset');
        assert.equal(require('../docs/js/null_ai/post_ko').predict(s).reason,'unknown-team');
    }
});
test('reserve Castform stays untransformed, except the documented Weather Ball STAB',()=>{
    const castSet={...set(1,'Forecast'),nature:'Serious',moves:['Weather Ball','Surf','Protect','(No Move)']};
    const fixture=baseFixture({Castform:{Trainer:castSet}},{field:new calc.Field({weather:'Rain'})});
    const s=readState(fixture),reserve=s.party.candidates.find(c=>c.name==='Castform');
    const cast=mon('Castform',castSet.moves,{ability:'(other)',nature:'Serious'}),water=cast.clone();water.types=['Water'];
    const expectedBall=calc.calculate(9,water,fixture.player.clone(),new calc.Move(9,'Weather Ball'),fixture.field.clone()).damage;
    const expectedSurf=calc.calculate(9,cast.clone(),fixture.player.clone(),new calc.Move(9,'Surf'),fixture.field.clone()).damage;
    const expectedIncoming=calc.calculate(9,fixture.player.clone(),cast.clone(),new calc.Move(9,'Thunderbolt'),fixture.field.clone()).damage;
    assert.deepEqual(Array.from(reserve.types),['Normal']);assert.equal(reserve.ability,'Forecast');
    assert.deepEqual(Array.from(reserve.moves[0].damage),expectedBall);assert.deepEqual(Array.from(reserve.moves[1].damage),expectedSurf);
    assert.deepEqual(Array.from(reserve.incomingDamage),expectedIncoming);
    fixture.player.ability='Cloud Nine';const suppressed=readState(fixture).party.candidates.find(c=>c.name==='Castform');
    const suppressedBall=calc.calculate(9,cast.clone(),fixture.player.clone(),new calc.Move(9,'Weather Ball'),fixture.field.clone()).damage;
    assert.deepEqual(Array.from(suppressed.moves[0].damage),suppressedBall);
});

test('marked KO and explicit reserve HP affect counts without changing source sets', () => {
    const fixture = baseFixture({ Charizard: { Trainer: set(1, 'Blaze') }, Golem: { Trainer: set(2, 'Sturdy') } }, {
        marked: ['Charizard (Trainer)'], overrides: { party: { 'Golem (Trainer)': { hpPercent: 50 } } },
    });
    const original = JSON.stringify(fixture.sets);
    const s = readState(fixture);
    assert.equal(s.context.opponentAliveCount, 2);
    assert.equal(s.context.opponentTeamSize, 3);
    assert.equal(s.party.candidates.find(c => c.name === 'Charizard').alive, false);
    const golem = s.party.candidates.find(c => c.name === 'Golem');
    assert.equal(golem.hp, Math.floor(golem.maxHP / 2));
    assert.equal(JSON.stringify(fixture.sets), original);
});

test('reserve Unburden is inactive before its item has been consumed', () => {
    const hawlucha = mon('Hawlucha', ['Tackle', 'Surf', '(No Move)', '(No Move)'], { ability: 'Unburden', item: 'Sitrus Berry' });
    const s = readState(baseFixture({ Hawlucha: { Trainer: set(1, 'Unburden', 'Sitrus Berry') } }));
    const reserve = s.party.candidates.find(c => c.name === 'Hawlucha');
    assert.equal(reserve.speed, hawlucha.rawStats.spe);
});

test('a similarly named different trainer is not added to the selected party', () => {
    const s = readState(baseFixture({ Blastoise: { Trainer: set(0, 'Torrent'), 'Trainer 2': set(1, 'Rain Dish') } }));
    assert.equal(s.party.candidates.filter(c => c.active).length, 1);
    assert.equal(s.party.candidates.length, 1);
});

test('only the selected trainer slot is active when a different form shares its base species', () => {
    const opponent = mon('Rotom', ['Tackle', 'Thunderbolt', '(No Move)', '(No Move)']);
    const s = readState(baseFixture({ Rotom: { Trainer: set(1, 'Levitate') }, 'Rotom-Wash': { Trainer: set(2, 'Levitate') } }, {
        selected: 'Rotom (Trainer)', opponent,
    }));
    assert.equal(s.party.candidates.filter(c => c.active).length, 1);
    assert.equal(s.party.candidates.length, 3);
});

test('opponent Tailwind affects its reserves but does not affect player speed', () => {
    const s = readState(baseFixture({ Charizard: { Trainer: set(1, 'Blaze') } }, {
        field: new calc.Field({ attackerSide: { isTailwind: false }, defenderSide: { isTailwind: true } }),
    }));
    const charizard = mon('Charizard', ['Tackle', 'Surf', '(No Move)', '(No Move)']);
    const reserve = s.party.candidates.find(c => c.name === 'Charizard');
    assert.equal(reserve.speed, charizard.rawStats.spe * 2);
    assert.equal(s.player.speed, baseFixture().player.rawStats.spe);
});

test('switch-in evaluation does not anticipate consuming a terrain seed', () => {
    const field = new calc.Field({ terrain: 'Electric' });
    const seeded = readState(baseFixture({ Golem: { Trainer: set(1, 'Sturdy', 'Electric Seed') } }, { field }));
    const ordinary = readState(baseFixture({ Golem: { Trainer: set(1, 'Sturdy', 'Sitrus Berry') } }, { field }));
    assert.deepEqual(Array.from(seeded.party.candidates.find(c => c.name === 'Golem').incomingDamage),
        Array.from(ordinary.party.candidates.find(c => c.name === 'Golem').incomingDamage));
    assert.equal(seeded.party.candidates.find(c => c.name === 'Golem').item, 'Electric Seed');
});

test('Corrosion keeps Toxic usable against Poison and Steel targets', () => {
    for (const target of ['Magnezone', 'Muk']) {
        const player = mon(target, ['Tackle', '(No Move)', '(No Move)', '(No Move)']);
        const opponent = mon('Salazzle', ['Toxic', 'Flamethrower', '(No Move)', '(No Move)'], { ability: 'Corrosion' });
        const s = readState(baseFixture({}, { player, opponent }));
        assert.equal(s.opponent.moves[0].statusBlocked, false, target);
    }
});

test('Minior meteor and core display forms count as one trainer party slot', () => {
    const s = readState(baseFixture({ Minior: { Trainer: set(1, 'Shields Down') }, 'Minior-Meteor': { Trainer: set(2, 'Shields Down') } }));
    assert.equal(s.party.candidates.length, 2);
    assert.equal(s.context.opponentTeamSize, 2);
    assert.equal(s.party.candidates[1].name, 'Minior', 'reserve AI uses the ROM core form, before Shields Down runs on entry');
});

test('Minior reserve profiles preserve the native speed distinction and the selected active Meteor form', () => {
    const rows={Minior:{Trainer:{...set(1,'Shields Down'),level:37,nature:'Hasty'}},'Minior-Meteor':{Trainer:{...set(2,'Shields Down'),level:37,nature:'Hasty'}}};
    const fixture=baseFixture(rows),before=JSON.stringify(fixture.sets);
    const reserve=readState(fixture).party.candidates[1];
    assert.equal(reserve.speed,115);assert.equal(reserve.name,'Minior');
    const meteor=mon('Minior-Meteor',['Tackle','Surf','(No Move)','(No Move)'],{level:37,nature:'Hasty',ability:'Shields Down'});
    const active=readState({...fixture,opponent:meteor,selected:'Minior-Meteor (Trainer)'}).party.candidates.find(c=>c.active);
    assert.equal(active.name,'Minior-Meteor');assert.equal(active.speed,66);
    assert.deepEqual(Array.from(active.aliases).sort(),['Minior (Trainer)','Minior-Meteor (Trainer)'].sort());
    assert.equal(JSON.stringify(fixture.sets),before);
});

test('either Minior form retains reserve HP, availability and PP when its canonical display identity changes', () => {
    const f=baseFixture({Minior:{Trainer:set(1,'Shields Down')},'Minior-Meteor':{Trainer:set(2,'Shields Down')}});
    f.overrides={party:{'Minior-Meteor (Trainer)':{hpPercent:50,moves:[{pp:0,usable:false}]}}};
    let c=readState(f).party.candidates[1];
    assert.equal(c.hp,Math.floor(c.maxHP/2));assert.equal(c.moves[0].pp,0);assert.equal(c.moves[0].usable,false);
    f.overrides.party['Minior-Meteor (Trainer)'].alive=false;
    assert.equal(readState(f).party.candidates[1].alive,false);
    f.overrides={};f.marked=['Minior-Meteor (Trainer)'];
    assert.equal(readState(f).party.candidates[1].alive,false);
});

test('reserve controls follow other battle-form aliases without merging separate regional species', () => {
    const f=baseFixture({Eiscue:{Trainer:set(1,'Ice Face')},'Eiscue-Noice':{Trainer:set(2,'Ice Face')},'Raichu-Alola':{Trainer:set(3,'Surge Surfer')},Raichu:{Trainer:set(4,'Static')}});
    f.overrides={party:{'Eiscue-Noice (Trainer)':{hpPercent:25}}};
    const s=readState(f),ice=s.party.candidates.find(c=>c.name==='Eiscue');
    assert.equal(ice.hp,Math.floor(ice.maxHP/4));
    assert.equal(s.party.candidates.filter(c=>['Raichu','Raichu-Alola'].includes(c.name)).length,2);
});

test('frozen Switch into party rebuilds retain Minior core profiles and controls entered under Meteor', () => {
    const f=baseFixture({Minior:{Trainer:set(1,'Shields Down')},'Minior-Meteor':{Trainer:set(2,'Shields Down')}});
    const s=readState(f),party=s.rebuildFrozenParty({party:{'Minior-Meteor (Trainer)':{hpPercent:40,moves:[{pp:0}]}}});
    const c=party.candidates.find(c=>c.name==='Minior');
    assert.equal(c.hp,Math.floor(c.maxHP*.4));assert.equal(c.moves[0].pp,0);
    assert.equal(s.party.candidates.find(c=>c.name==='Minior').hp,c.maxHP);
});

test('doubles keep an active Meteor partner distinct from the core used for reserve evaluation', () => {
    const f=doubleFixture();
    Object.assign(f.sets,{Minior:{Trainer:{...set(3,'Shields Down'),level:37,nature:'Hasty'}},'Minior-Meteor':{Trainer:{...set(4,'Shields Down'),level:37,nature:'Hasty'}}});
    Object.assign(f.doubles.opponentPartner,{setID:'Minior-Meteor (Trainer)',level:37,nature:'Hasty',ability:'Shields Down',hp:102});
    const s=readState(f),c=s.switchState.party.candidates.find(c=>c.aliases.includes('Minior-Meteor (Trainer)'));
    assert.equal(s.complete,true);assert.equal(s.opponents[1].name,'Minior-Meteor');assert.equal(s.opponents[1].speed,66);
    assert.equal(c.active,true);assert.equal(c.hp,102);
    const result=switchAI.getSwitchProbabilities({...s.switchState,context:{...s.switchState.context,switchScenario:'post-ko'}});
    assert.ok(result.candidates.every(c=>!['Minior','Minior-Meteor'].includes(c.name)));
});

test('Darm standalone Zen and Galar Zen trainer labels resolve native models and remain distinct party members', () => {
    const rows={Darmanitan:{Trainer:{...set(1,'Sheer Force'),moves:['Flare Blitz','Iron Head','Zen Headbutt','Bulk Up']}},
        'Darmanitan-Zen-Mode':{Trainer:{...set(2,'Sheer Force'),moves:['Fire Blast','Future Sight','Grass Knot','Yawn']}},
        'Darmanitan-Galar':{Trainer:{...set(3,'Gorilla Tactics'),moves:['Mountain Gale','Earthquake','Superpower','U-turn']}},
        'Darmanitan-Zen-Mode-Galar':{Trainer:{...set(4,'Inner Focus'),moves:['Icicle Crash','Blaze Kick','Earthquake','Power-Up Punch']}}};
    const f=baseFixture(rows),before=JSON.stringify(f.sets),s=readState(f);
    assert.equal(s.party.complete,true);assert.equal(s.party.candidates.length,5);
    const zen=s.party.candidates.find(c=>c.name==='Darmanitan-Zen-Mode');
    const galar=s.party.candidates.find(c=>c.name==='Darmanitan-Zen-Mode-Galar');
    assert.ok(zen.types.includes('Psychic'));assert.ok(galar.types.includes('Ice'));assert.ok(galar.types.includes('Fire'));
    assert.equal(zen.stats.spa,mon('Darmanitan-Zen',[],{level:50}).stats.spa);
    assert.equal(galar.stats.spe,mon('Darmanitan-Galar-Zen',[],{level:50}).stats.spe);
    assert.notEqual(zen.id,s.party.candidates.find(c=>c.name==='Darmanitan').id);
    assert.equal(JSON.stringify(f.sets),before);
});

function version126Fixture(selected) {
    const ctx={},api=require('../docs/js/null_ai/version126-trainers');
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../docs/js/data/sets/gen9.js'),'utf8'),ctx);
    const sets=api.apply(ctx.SETDEX_SV),boundary=selected.indexOf(' ('),name=selected.slice(0,boundary),key=selected.slice(boundary+2,-1),row=sets[name][key];
    return {player:mon('Pikachu',['Thunderbolt','Surf','Protect','Tackle']),opponent:mon(name,row.moves,{level:row.level,nature:row.nature,ability:row.ability,item:row.item}),
        selected,sets,trainerAPI:api};
}

test('native1.2.6 metadata keeps both Lanturn in one canonical trainer team without sharing KO marks',()=>{
    const trainer='Fisherman Elliot & Fisherman Ned',extra='Lanturn ('+trainer+' [Slot 2])';
    const f=version126Fixture('Lanturn ('+trainer+')');
    let s=readState(f),lan=s.party.candidates.filter(c=>c.name==='Lanturn');
    assert.equal(s.party.complete,true);assert.equal(lan.length,2);
    assert.notEqual(lan[0].id,lan[1].id);assert.equal(lan.filter(c=>c.active).length,1);
    f.marked=[extra];s=readState(f);lan=s.party.candidates.filter(c=>c.name==='Lanturn');
    assert.equal(lan.find(c=>c.id===extra).alive,false);assert.equal(lan.find(c=>c.active).alive,true);
    f.marked=[];f.selected=extra;f.opponent=mon('Lanturn',['Discharge','Parabolic Charge','Bubble Beam','Ice Beam'],{level:43,ability:'Water Absorb'});
    s=readState(f);assert.equal(s.party.trainerName,trainer);assert.equal(s.party.candidates.filter(c=>c.name==='Lanturn').length,2);
});

test('two Mega Raichu use independent native base profiles and native order; a KO or reservation excludes only its own slot',()=>{
    const trainer='Triathlete Benjamin & Triathlete Alyssa',x='Raichu-Mega-X ('+trainer+')',y='Raichu-Mega-Y ('+trainer+')';
    const f=version126Fixture('Eiscue ('+trainer+')'),s=readState(f);
    const rx=s.party.candidates.find(c=>c.aliases.includes(x)),ry=s.party.candidates.find(c=>c.aliases.includes(y));
    assert.equal(s.party.complete,true);assert.notEqual(rx.id,ry.id);
    assert.equal(rx.evaluationForm,'Raichu');assert.equal(ry.evaluationForm,'Raichu');
    assert.equal(rx.ability,'Static');assert.equal(ry.ability,'Static');
    assert.ok(rx.partyIndex<ry.partyIndex);
    f.marked=[x];const marked=readState(f);
    assert.equal(marked.party.candidates.find(c=>c.aliases.includes(x)).alive,false);
    assert.equal(marked.party.candidates.find(c=>c.aliases.includes(y)).alive,true);
    const result=switchAI.getSwitchProbabilities({...s,context:{...s.context,switchScenario:'post-ko',reservedPartyIds:[x]}});
    assert.ok(result.candidates.every(c=>c.id!==rx.id));assert.ok(result.candidates.some(c=>c.id===ry.id));
});

test('new Regenor reserves use native pre-Mega forms while explicitly selected Mega remains active',()=>{
    const trainer='Dragon Tamer Regenor',f=version126Fixture('Iron Bundle ('+trainer+')'),s=readState(f);
    const reserve=s.party.candidates.find(c=>c.name==='Raichu-Mega-X');
    assert.equal(s.party.candidates.length,6);assert.equal(reserve.evaluationForm,'Raichu');assert.equal(reserve.ability,'Static');
    f.selected='Raichu-Mega-X ('+trainer+')';f.opponent=mon('Raichu-Mega-X',['Zippy Zap','Play Rough','Ice Spinner','Upper Hand'],{level:100,ability:'Motor Drive'});
    const active=readState(f).party.candidates.find(c=>c.active);
    assert.equal(active.name,'Raichu-Mega-X');assert.equal(active.evaluationForm,'Raichu-Mega-X');assert.equal(active.ability,'Motor Drive');
});

test('the four actual native Mega species are preserved in reserve evaluation',()=>{
    for(const [selected,names] of [
        ['Tyranitar-Mega (Team Aqua Grunt Steve 3)',['Steelix-Mega','Garchomp-Mega']],
        ['Steelix-Mega (Team Aqua Grunt Steve 3)',['Tyranitar-Mega']],
        ['Gyarados (Lorekeeper Zinnia)',['Salamence-Mega']]
    ]){
        const f=version126Fixture(selected),s=readState(f);
        for(const name of names){const c=s.party.candidates.find(c=>c.name===name);assert.ok(c,name);assert.equal(c.evaluationForm,name);}
    }
});

test('confirmed two-trainer doubles keep replacement choices inside the selected native owner party',()=>{
    const api=require('../docs/js/null_ai/version126-trainers'),post=require('../docs/js/null_ai/post_ko');
    for(const selected of ['Lanturn (Fisherman Elliot & Fisherman Ned)','Lanturn (Fisherman Elliot & Fisherman Ned [Slot 2])',
        'Raichu-Mega-X (Triathlete Benjamin & Triathlete Alyssa)','Raichu-Mega-Y (Triathlete Benjamin & Triathlete Alyssa)']){
        const f=version126Fixture(selected);f.field=new calc.Field({gameType:'Doubles'});
        const s=readState(f),owner=api.ownerForSet(selected);s.context.doublesComplete=true;
        assert.equal(s.party.owner.name,owner.name);
        const result=post.predict(s),expected=s.party.candidates.filter(c=>!c.active&&c.partyIndex>=owner.partyFirstIndex&&c.partyIndex<owner.partyLastIndex);
        assert.deepEqual(result.switch.candidates.map(c=>c.id),expected.map(c=>c.id));
        assert.equal(result.reserveOwner,owner.name);
        for(const c of result.candidates.filter(c=>c.partyIndex<owner.partyFirstIndex||c.partyIndex>=owner.partyLastIndex))
            assert.equal(c.eligibility,'reserved');
        // Frozen Switch into updates must carry the same native owner bounds.
        const rebuilt=s.rebuildFrozenParty({party:{[expected[0].id]:{hpPercent:50}}});
        assert.equal(rebuilt.owner.name,owner.name);
    }
});

test('marking either Eiscue display form KO removes its logical trainer slot', () => {
    const s = readState(baseFixture({ Eiscue: { Trainer: set(1, 'Ice Face') }, 'Eiscue-Noice': { Trainer: set(2, 'Ice Face') } }, {
        marked: ['Eiscue-Noice (Trainer)'],
    }));
    assert.equal(s.party.candidates.length, 2);
    assert.equal(s.context.opponentAliveCount, 1);
});

test('Magic Room disables reserve Choice Scarf in switch-in speed prediction', () => {
    const s = readState(baseFixture({ Charizard: { Trainer: set(1, 'Blaze', 'Choice Scarf') } }, { field: new calc.Field({ isMagicRoom: true }) }));
    const reserve = s.party.candidates.find(c => c.name === 'Charizard');
    assert.equal(reserve.speed, mon('Charizard', ['Tackle']).rawStats.spe);
    assert.equal(reserve.item, 'Choice Scarf');
});

test('Lua ability spellings resolve to engine identities before reserve damage is calculated',()=>{
    const f=baseFixture({Regidrago:{Trainer:{...set(1,'Dragons Maw'),moves:['Dragon Pulse']}},
        Gholdengo:{Trainer:set(2,'Good As Gold')},Dachsbun:{Trainer:set(3,'Well Baked Body')}});
    const s=readState(f),dragon=s.party.candidates.find(c=>c.name==='Regidrago');
    assert.equal(dragon.ability,"Dragon's Maw");
    assert.equal(s.party.candidates.find(c=>c.name==='Gholdengo').ability,'Good as Gold');
    assert.equal(s.party.candidates.find(c=>c.name==='Dachsbun').ability,'Well-Baked Body');
    const attacker=mon('Regidrago',['Dragon Pulse'],{ability:"Dragon's Maw"});
    const expected=calc.calculate(9,attacker,f.player,new calc.Move(9,'Dragon Pulse'),new calc.Field());
    assert.deepEqual(Array.from(dragon.moves[0].damage),expected.damage);
});

test('Magic Room disables reserve Heavy-Duty Boots when evaluating entry hazards', () => {
    const s = readState(baseFixture({ Charizard: { Trainer: set(1, 'Blaze', 'Heavy-Duty Boots') } }, {
        field: new calc.Field({ isMagicRoom: true, defenderSide: { isSR: true } }),
    }));
    const reserve = s.party.candidates.find(c => c.name === 'Charizard');
    assert.equal(reserve.entryHazardDamage, Math.floor(reserve.maxHP / 2));
});

test('Magic Room seed suppression does not subtract a boost that cannot activate', () => {
    const field = new calc.Field({ terrain: 'Electric', isMagicRoom: true });
    const seeded = readState(baseFixture({ Golem: { Trainer: set(1, 'Sturdy', 'Electric Seed') } }, { field }));
    const ordinary = readState(baseFixture({ Golem: { Trainer: set(1, 'Sturdy', 'Sitrus Berry') } }, { field }));
    assert.deepEqual(Array.from(seeded.party.candidates.find(c => c.name === 'Golem').incomingDamage),
        Array.from(ordinary.party.candidates.find(c => c.name === 'Golem').incomingDamage));
});

test('Trick Room reverses faster and slower switch-in OHKO scores', () => {
    const candidate = { name: 'Blastoise', hp: 100, maxHP: 100, speed: 100, entryHazardDamage: 0,
        moves: [{ name: 'Surf', category: 'Special', basePower: 90, damage: [100] }], incomingDamage: [10] };
    const s = { player: { hp: 100, maxHP: 100, speed: 200 }, field: { trickRoom: true } };
    assert.equal(switchAI.scoreCandidate(candidate, s).score, 5);
});
