'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../docs/js/run/run_model.js');

const calcData = {
    species: ['Torchic', 'Combusken', 'Pikachu', 'Gouging Fire', 'Zygarde-10%', "Oricorio-Pa'u"],
    moves: ['Ember', 'Scratch', 'Soft-Boiled', 'Hidden Power Fire', 'Explosion'],
    items: ['Leftovers', 'Life Orb'],
    abilities: ['Blaze', 'Beads of Ruin', "Dragon's Maw", 'Embody Aspect (Heartflame)', 'Soul-Heart']
};
const R = M.makeResolvers(calcData);
function mon(extra) {
    return Object.assign({ uid: 'a', species: 'Torchic', nickname: 'Pyro', level: 14, nature: 'Adamant', ability: 'Blaze', item: 'Leftovers',
        ivs: { hp: 31, atk: 30, def: 29, spa: 28, spd: 27, spe: 26 }, moves: [{ name: 'Ember', pp: 25 }], hiddenPower: 'Fire', metLocation: 'Route 101' }, extra);
}

test('les noms du Lua officiel sont résolus vers ceux du calculateur, sans ambiguïté', () => {
    assert.equal(R.species('Gouging-Fire'), 'Gouging Fire');
    assert.equal(R.species('Zygarde-10'), 'Zygarde-10%');
    assert.equal(R.species("Oricorio-Pa'u "), "Oricorio-Pa'u");
    assert.equal(R.species('Pikachu-Libre'), 'Pikachu');
    assert.equal(R.species('Floette-Eternal-Mega'), null);
    assert.equal(R.move('Soft Boiled'), 'Soft-Boiled');
    assert.equal(R.ability('Beads Of Ruin'), 'Beads of Ruin');
    assert.equal(R.ability('Dragons Maw'), "Dragon's Maw");
    assert.equal(R.ability('Soul Heart'), 'Soul-Heart');
    assert.equal(R.ability('Embody Aspect (Hearthflame)'), 'Embody Aspect (Heartflame)');
    const ambiguous = M.makeResolver(['Ab-c', 'Abc']);
    assert.equal(ambiguous('A B C'), null, 'une forme normalisée ambiguë ne doit jamais être devinée');
});

test('le set reprend exactement les données du jeu (IV, EV à 0, Hidden Power typé)', () => {
    const built = M.buildSet(mon({ moves: [{ name: 'Hidden Power', pp: 15 }, { name: 'Ember', pp: 25 }] }), R);
    assert.deepEqual(built.set.ivs, { hp: 31, at: 30, df: 29, sa: 28, sd: 27, sp: 26 });
    assert.deepEqual(built.set.evs, { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 });
    assert.deepEqual(built.set.moves, ['Hidden Power Fire', 'Ember']);
    assert.equal(built.set.item, 'Leftovers');
    assert.equal(built.set.ability, 'Blaze');
    assert.deepEqual(built.warnings, []);
});

test('une donnée inconnue est signalée, jamais remplacée en silence', () => {
    const built = M.buildSet(mon({ item: 'Peat Block', moves: [{ name: 'Mystery Move', pp: 5 }] }), R);
    assert.equal(built.set.item, '');
    assert.equal(built.warnings.length, 2);
    assert.equal(M.buildSet(mon({ species: 'Floette-Eternal-Mega' }), R).species, null);
});

test('planSync : noms stables, doublons numérotés, évolution et mort retirent l’ancien set', () => {
    const data = { party: [mon({ slot: 1 }), mon({ uid: 'b', slot: 2 })], box: [], dead: [] };
    const first = M.planSync(data, {}, R);
    assert.deepEqual(first.upserts.map(u => u.nameProp), ['Pyro [Run]', 'Pyro [Run 2]']);
    assert.ok(first.upserts.every(u => u.place === 'team' && u.changed));
    const again = M.planSync(data, first.index, R);
    assert.ok(again.upserts.every(u => !u.changed), 'rien ne change si le jeu ne change pas');
    assert.deepEqual(again.removals, []);
    const evolved = { party: [mon({ slot: 1, species: 'Combusken' })], box: [], dead: [mon({ uid: 'b', box: 12, boxSlot: 1 })] };
    const next = M.planSync(evolved, first.index, R);
    assert.deepEqual(next.upserts.map(u => [u.species, u.nameProp]), [['Combusken', 'Pyro [Run]']]);
    assert.deepEqual(next.removals.map(r => [r.species, r.nameProp, r.dead]).sort(), [['Torchic', 'Pyro [Run 2]', true], ['Torchic', 'Pyro [Run]', false]]);
});

test('level cap et captures par zone', () => {
    assert.equal(M.levelCap({}).cap, 13);
    assert.equal(M.levelCap({ 'Root Academy Trainer 1': true }).cap, 19);
    const all = {}; M.BOSSES.forEach(b => { all[b.name] = true; });
    assert.equal(M.levelCap(all).cap, 100);
    const zones = M.encounters({ party: [mon({ hp: 0 })], box: [], dead: [mon({ uid: 'c', metLocation: 'Route 102' })] });
    assert.deepEqual(zones.map(z => [z.zone, z.mons[0].state]), [['Route 101', 'ko'], ['Route 102', 'dead']]);
});
