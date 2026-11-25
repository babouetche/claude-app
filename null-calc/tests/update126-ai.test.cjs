'use strict';
// Version changes are grounded in the supplied 1.2.5/1.2.6 patch notes and
// the official AI documentation updated on 23 October. Nominal odds remain
// documentary rounded values, not a claim about the native joint RNG law.
const test = require('node:test'), assert = require('node:assert/strict');
const core = require('../docs/js/null_ai/core.js');
const move = (name, damage = 20, extra = {}) => ({name, category:'Physical', type:'Normal', effect:'HIT',
    target:'normal', priority:0, bp:80, basePower:80, damage:[damage], ...extra});
const status = (name, extra = {}) => move(name, 0, {category:'Status', basePower:0, bp:0, target:'self', ...extra});
function state(moves) {
    return {player:{name:'Player', hp:100, maxHP:100, speed:100, item:'', ability:'', status:'', types:['Normal'], boosts:{}, moves:[move('Tackle',20)]},
        opponent:{name:'AI', hp:100, maxHP:100, speed:90, item:'', ability:'', status:'', types:['Normal'], boosts:{}, moves},
        field:{gameType:'Singles', playerSpikes:0, playerToxicSpikes:0, playerStealthRock:false, playerStickyWeb:false},
        context:{calculationMode:'estimate', scoreOnly:true, opponentFirstTurn:false, opponentTurnsActive:2,
            opponentTeamSize:6, opponentAliveCount:6, opponentLastMon:false, playerLastMon:false}};
}
function prediction(s) {
    const result = core.getNullAIMoveProbabilities(s);
    assert.notEqual(result.status, 'unavailable', result.reasons.join('; '));
    return result;
}
function scores(s) {
    const result = core.getTargetScoreDistributions(s);
    assert.notEqual(result.status, 'unavailable', (result.reasons || []).join('; '));
    return result;
}
const close = (a,b) => assert.ok(Math.abs(a-b) < 1e-10, `${a} != ${b}`);

test('1.2.5 damaging hazard cap checks preserve the native HDM exception', () => {
    for (const name of ['Stone Axe','Ceaseless Edge']) {
        const s = state([move(name,20),move('Tackle',60)]);
        if (name === 'Stone Axe') s.field.playerStealthRock = true; else s.field.playerSpikes = 3;
        let r = prediction(s);
        assert.deepEqual(r.moves.map(m => m.probability), [0,1]);
        assert.ok(r.moves[0].rules.some(rule => rule.includes('maximum layers and not HDM')));
        s.opponent.moves[0].damage = [80];
        r = prediction(s); assert.deepEqual(r.moves.map(m => m.probability),[1,0]);
        assert.ok(r.moves[0].rules.every(rule => !rule.includes('maximum layers and not HDM')));
    }
});

test('1.2.5 damaging hazards cannot stack setup bonuses over an available fast KO', () => {
    for (const name of ['Stone Axe','Ceaseless Edge']) {
        const s = state([move(name,90),move('Tackle',120)]);
        s.opponent.speed = 120; s.context.opponentFirstTurn = true;
        const r = prediction(s);
        assert.deepEqual(r.moves.map(m => m.probability), [0,1]);
        assert.ok(r.moves[0].rules.every(rule => !rule.includes('fall-through')));
    }
});

test('1.2.5 Stone Axe has one hazard bonus and Ceaseless Edge follows its Spikes layer rule once', () => {
    const s = state([move('Stone Axe',10),move('Tackle',30)]);
    let r = scores(s), mean = d => d.reduce((n,o) => n + o.score * o.probability, 0);
    close(mean(r.distributions[0]), 6.75);
    assert.ok(r.rules[0].every(rule => !rule.includes('fall-through')));
    s.opponent.moves[0] = move('Ceaseless Edge',10); s.field.playerSpikes = 1;
    r = scores(s); close(mean(r.distributions[0]), 5.77);
});

test('1.2.5 Syrup Bomb reaches speed-drop checks without relying on a secondary-chance flag', () => {
    const s = state([move('Syrup Bomb',10),move('Tackle',30)]);
    assert.ok(prediction(s).moves[0].probability > 0);
    for (const configure of [s => s.player.item = 'Clear Amulet', s => s.player.ability = 'Clear Body',
        s => s.player.ability = 'White Smoke', s => s.player.boosts.spe = -6]) {
        const blocked = state([move('Syrup Bomb',10),move('Tackle',30)]); configure(blocked);
        const r = prediction(blocked); assert.equal(r.moves[0].probability,0);
        assert.ok(r.moves[0].rules.some(rule => rule.includes('blocked Speed reduction')));
        assert.deepEqual(scores(blocked).distributions[0],[{score:0,probability:1}]);
    }
});

test('1.2.5 Take Heart uses mixed setup and respects Unaware in either attacking-category branch', () => {
    for (const category of ['Physical','Special']) {
        const s = state([status('Take Heart'),move('Tackle',10)]);
        s.player.moves = [move('Tackle',20,{category})]; s.player.ability = 'Unaware';
        const r = prediction(s); assert.equal(r.moves[0].probability,0);
        assert.ok(r.moves[0].rules.some(rule => rule.includes('Unaware/reset -20')));
        assert.ok(!r.assumptions.some(rule => rule.includes('No further')));
    }
});

test('1.2.5 Stuff Cheeks and Memento retain their corrected Unaware and stat-immunity checks', () => {
    const setup = state([status('Stuff Cheeks'),move('Tackle',10)]); setup.opponent.item = 'Sitrus Berry'; setup.player.ability = 'Unaware';
    assert.equal(prediction(setup).moves[0].probability,0);
    for (const ability of ['Clear Body','White Smoke']) {
        const s = state([status('Memento',{target:'normal'}),move('Tackle',20)]); s.player.ability = ability;
        const r = prediction(s); assert.equal(r.moves[0].probability,0);
        assert.ok(r.moves[0].rules.some(rule => rule.includes('Memento cannot lower stats')));
    }
});

test('1.2.5 Sky Attack, Freeze Shock and Ice Burn use ordinary damage without the removed +9 bonus', () => {
    for (const name of ['Sky Attack','Freeze Shock','Ice Burn']) {
        const s = state([move(name,50),move('Tackle',50)]); s.opponent.item = 'Power Herb';
        const r = prediction(s); close(r.moves[0].probability,.5); close(r.moves[1].probability,.5);
        assert.ok(r.moves[0].rules.some(rule => rule.includes('HDM')));
        assert.ok(r.moves[0].rules.every(rule => !rule.includes('immediate execution +9')));
        s.opponent.item = ''; assert.equal(prediction(s).moves[0].probability,0);
        s.opponent.item = 'Power Herb'; s.field.magicRoom = true;
        assert.equal(prediction(s).moves[0].probability,0);
    }
});

test('1.2.6 Electro Shot is not HDM and still receives the immediate execution bonus in rain', () => {
    const s = state([move('Electro Shot',50),move('Tackle',20)]); s.field.weather = 'Rain';
    const r = prediction(s); assert.equal(r.moves[0].probability,1);
    assert.ok(r.moves[0].rules.every(rule => !rule.includes('HDM')));
    assert.ok(r.moves[0].rules.some(rule => rule.includes('immediate execution +9')));
});

test('1.2.5 Feint recognizes Protect with Wide Guard or Quick Guard alongside it', () => {
    for (const guard of ['Wide Guard','Quick Guard']) {
        const s = state([move('Feint',20,{priority:2}),move('Tackle',30)]);
        s.field.gameType = 'Doubles'; s.context.doublesComplete = true;
        s.player.moves = [status(guard),status('Protect'),move('Tackle',20)];
        let r = scores(s); close(r.distributions[0].find(o => o.score === 13)?.probability || 0,.1);
        s.player.moves = [status(guard),move('Tackle',20)];
        r = scores(s); assert.deepEqual(r.distributions[0],[{score:0,probability:1}]);
    }
});

test('1.2.6 Upper Hand keeps the documented nominal ten-percent bonus', () => {
    const s = state([move('Upper Hand',20,{priority:3}),move('Tackle',30)]);
    s.player.moves = [move('Quick Attack',20,{priority:1})];
    close(prediction(s).moves[0].probability,.1);
    assert.deepEqual(scores(s).distributions[0],[{score:-20,probability:.9},{score:13,probability:.1}]);
    s.player.moves = [move('Tackle',20)]; assert.equal(prediction(s).moves[0].probability,0);
    s.player.moves = [status('Baby-Doll Eyes',{priority:1,target:'normal'})];
    assert.deepEqual(scores(s).distributions[0],[{score:-20,probability:1}]);
});

test('1.2.5 only Blade receives King Shield form-change incentive; Shield retains the ordinary physical bonus', () => {
    const s = state([status("King's Shield"),move('Tackle',30)]); s.opponent.name = 'Aegislash-Shield';
    let r = scores(s); close(r.distributions[0].find(o => o.score === 7)?.probability || 0,.84375);
    s.player.moves=[move('Tackle',120)];r=scores(s);
    assert.ok(r.rules[0].every(rule=>!rule.includes('Aegislash-Blade +10')));
    s.opponent.name = 'Aegislash-Blade'; r = scores(s);
    assert.ok(r.rules[0].some(rule=>rule.includes('Aegislash-Blade +10')));
    close(r.distributions[0].filter(o=>o.score>=16).reduce((n,o)=>n+o.probability,0),.8);
});

test('1.2.5 Shell Smash discourages capped boosting stats, existing defense drops and a pre-setup KO', () => {
    const base = () => {const s=state([status('Shell Smash'),move('Tackle',20)]);s.context.playerKOsAfterSetup=false;return s;};
    for (const configure of [s=>s.opponent.boosts.atk=6,s=>s.opponent.boosts.spa=6,
        s=>s.opponent.boosts.def=-1,s=>s.opponent.boosts.spd=-1,
        s=>{s.opponent.ability='Contrary';s.opponent.boosts.def=6;},s=>{s.opponent.ability='Contrary';s.opponent.boosts.spd=6;},
        s=>s.player.moves=[move('Tackle',120)]]) {
        const s=base();configure(s);const r=prediction(s);assert.equal(r.moves[0].probability,0);
        assert.ok(r.moves[0].rules.some(rule=>rule.startsWith('Shell Smash:')&&rule.endsWith('-20')));
    }
    const protectedState=base();protectedState.player.moves=[move('Tackle',120)];protectedState.opponent.nativeSashSturdyProtected=true;
    assert.ok(!prediction(protectedState).moves[0].rules.some(rule=>rule.includes('KO before setup')));
});

test('1.2.5 semi-invulnerable penalty affects native foe targets but excludes self, field and ally targets', () => {
    const s=state([move('Tackle',20,{nativeTargetBits:0}),status('Take Heart',{nativeTargetBits:16})]);
    s.context.playerSemiInvulnerable=true;s.opponent.speed=120;s.context.playerKOsAfterSetup=false;
    let r=scores(s);assert.ok(r.rules[0].some(rule=>rule.startsWith('Semi-invulnerable target:')));
    assert.ok(r.rules[1].every(rule=>!rule.startsWith('Semi-invulnerable target:')));
    for(const targetBits of [4,16,64,128]) {
        s.opponent.moves[0]=status('Take Heart',{nativeTargetBits:targetBits});
        assert.ok(scores(s).rules[0].every(rule=>!rule.startsWith('Semi-invulnerable target:')));
    }
    for(const targetBits of [0,8,32]) {
        s.opponent.moves[0]=move('Tackle',20,{nativeTargetBits:targetBits});
        assert.ok(scores(s).rules[0].some(rule=>rule.startsWith('Semi-invulnerable target:')));
    }
});

test('1.2.6 Alluring Voice effect repair does not invent a new confusion AI routine', () => {
    for(const raised of [undefined,false,true]) {
        const s=state([move('Alluring Voice',10,{guaranteedEffect:true,secondaryChance:100,nativeEffect:75}),move('Tackle',30)]);
        if(raised!==undefined)s.context.playerStatsRaisedThisTurn=raised;
        const r=prediction(s);assert.equal(r.moves[0].probability,0);
        assert.ok(r.moves[0].rules.every(rule=>!rule.includes('guaranteed secondary base')));
        assert.ok(r.moves[0].rules.some(rule=>rule.includes('ordinary damage/KO scores only')));
    }
});

test('1.2.6 Anchor Shot and Spirit Shackle retain trapping AI with repaired guaranteed effects', () => {
    for(const name of ['Anchor Shot','Spirit Shackle']) {
        const s=state([move(name,10,{guaranteedEffect:true,secondaryChance:100}),move('Tackle',30)]);
        assert.ok(prediction(s).moves[0].probability>0);
        s.player.types=['Ghost'];assert.equal(prediction(s).moves[0].probability,0);
        s.player.types=['Normal'];s.context.playerTrapped=true;assert.equal(prediction(s).moves[0].probability,0);
    }
});

test('1.2.5 Feint failed protection gate falls through to a separate KO gate', () => {
    const s=state([move('Feint',120,{priority:2}),move('Tackle',30)]);s.field.gameType='Doubles';s.context.doublesComplete=true;s.player.moves=[status('Protect'),move('Tackle',20)];
    const distribution=scores(s).distributions[0];
    close(distribution.find(o=>o.score===19)?.probability||0,.1);
    close(distribution.find(o=>o.score===12)?.probability||0,.09);
    close(distribution.find(o=>o.score===6)?.probability||0,.81);
});
