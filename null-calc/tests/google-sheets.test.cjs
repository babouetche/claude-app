'use strict';
// Teste google-sheets/Code.gs avec une fausse API Google Sheets (en mémoire) et des extraits réels des feuilles officielles.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const OFFICIAL = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/official-samples.json'), 'utf8'));

const { fakeSpreadsheet, load } = require('./helpers/fake-sheets.cjs');

const { G } = load();
const C = G.COL, R = G.RUN, S = G.SHEETS;
const fixtureText = fs.readFileSync(path.join(__dirname, 'fixtures/run-data-sample.js'), 'utf8');
const sample = JSON.parse(fixtureText.slice(fixtureText.indexOf('(') + 1, fixtureText.trimEnd().lastIndexOf(')')));
function payload(mutate) { const d = JSON.parse(JSON.stringify(sample.data)); if (mutate) mutate(d); return { kind: 'null-run', version: 1, data: d, bosses: { cap: 19, next: 'Root Academy Trainer 2', beaten: ['Root Academy Trainer 1'] } }; }
function row(sheet, r, n) { return Array.from({ length: n || C.sync }, (_, i) => (sheet.cells[r + ',' + (i + 1)] || { v: '' }).v); }
const v = (sheet, r, c) => (sheet.cells[r + ',' + c] || { v: '' }).v;

// ------------------------------------------------------------- Parseurs (données officielles réelles)
test('rencontres : taux additionnés par zone, méthode et espèce', () => {
  const enc = G.parseEncounterGrid(OFFICIAL.encounterGrid);
  const find = (zone, method, species) => enc.find(e => e.zone === zone && e.method === method && e.species === species);
  assert.deepEqual(find('Littleroot Town', 'Herbes', 'Growlithe'), { zone: 'Littleroot Town', method: 'Herbes', species: 'Growlithe', level: '5', rate: 5 });
  assert.equal(find('Route 101', 'Herbes', 'Helioptile').rate, 10, '5 + 4 + 1');
  assert.equal(find('Littleroot Town', 'Pêche', 'Mudkip').rate, 20, 'deux créneaux de 10 %');
  assert.equal(find('Littleroot Town', 'Surf', 'Mudkip').rate, 20, 'méthodes séparées');
  assert.equal(find('Route 103', 'Surf', 'Sneasel').rate, 30);
  assert.equal(find('Route 103', 'Surf', 'Sneasel').level, '40');
  assert.equal(find('Verdanturf Tunnel', 'Éclate-Roc', 'Binacle').rate, 50);
  assert.equal(find('Verdanturf Tunnel', 'Herbes', 'Klawf').rate, 20);
  assert.deepEqual(find('Route 101', 'Spécial', 'Game Corner'), { zone: 'Route 101', method: 'Spécial', species: 'Game Corner', level: '5', rate: '' });
  // Chaque zone « Herbes » totalise 100 %
  ['Littleroot Town', 'Littleroot Grove', 'Route 101', 'Oldale Town', 'Oldale Grove', 'Route 103', 'Verdanturf Tunnel'].forEach(z => {
    const total = enc.filter(e => e.zone === z && e.method === 'Herbes').reduce((s, e) => s + e.rate, 0);
    assert.equal(Math.round(total), 100, z);
  });
  const safari = G.parseEncounterGrid(OFFICIAL.otherTables);
  assert.deepEqual(safari.map(e => [e.zone, e.species, e.rate]), [['Safari Zone South', 'Uxie', 20], ['Safari Zone North', 'Regieleki', 20], ['Safari Zone Southwest', 'Raikou', 20],
    ['Safari Zone South', 'Azelf', 10], ['Safari Zone North', 'Regidrago', 10], ['Safari Zone Southwest', 'Entei', 10]]);
});

test('rencontres spéciales : échanges, cadeaux, casino', () => {
  const sp = G.parseSpecialEncounters(OFFICIAL.specialEncounters);
  assert.deepEqual(sp[0], { zone: 'Rustboro City', method: 'Échange', species: 'Qwilfish-Hisui (contre Qwilfish)', level: '', rate: '' });
  assert.deepEqual(sp.find(e => e.species === 'Type: Null'), { zone: 'Battle Frontier', method: 'Cadeau / fixe', species: 'Type: Null', level: '', rate: '' });
  assert.equal(sp.find(e => e.method === 'Casino').zone, 'Game Corner — Pool 1');
});

test('zones Nuzlocke : correspondance avec les lieux de capture du jeu', () => {
  assert.equal(G.mapsecFor('Granite Cave B1F'), 'Granite Cave');
  assert.equal(G.mapsecFor('Meteor Falls B1F Room 2'), 'Meteor Falls');
  assert.equal(G.mapsecFor('Shoal Cave (Ice Room)'), 'Shoal Cave');
  assert.equal(G.mapsecFor('Cave Of Origin 1F'), 'Cave of Origin');
  assert.equal(G.mapsecFor('Route 126 Underwater'), 'Underwater (Route 126)');
  assert.equal(G.mapsecFor('Route 102 Grove'), 'Route 102 Grove');
  assert.equal(G.mapsecFor('Route 102'), 'Route 102');
  assert.equal(G.mapsecFor('Safari Zone North'), 'Safari Zone');
  assert.equal(G.mapsecFor('Verdanturf Tunnel B1F'), 'Verdanturf Tunnel');
});

test('dresseurs : blocs officiels lus avec équipe, niveaux, objets, talents, natures et 4 attaques', () => {
  const t = G.parseTrainerSheet(OFFICIAL.roxanneSplit, 'Roxanne');
  assert.deepEqual(t.map(x => [x.area, x.name, x.mons.length]), [['Route 103', 'Route 103 Rival', 3], ['Root Academy', 'Youngster Ren', 0],
    ['Root Academy', 'Youngster Levi', 0], ['Root Academy', 'Hiker Marcster', 5], ['Root Academy', 'Leader Roxanne', 6]]);
  const rival = t[0].mons[2];
  assert.deepEqual(rival, { species: 'Riolu', level: '11', item: 'Berry Juice', ability: 'Prankster', nature: 'Jolly', moves: ['Mach Punch', 'Metal Claw', 'Copycat'] });
  assert.deepEqual(t[0].mons[0].moves, ['Chilling Water', 'Razor Shell', 'Grass Knot', 'Encore']);
  const rox = t[4].mons;
  assert.deepEqual(rox.map(m => m.species), ['Tyranitar', 'Solrock', 'Zygarde', 'Cradily', 'Omastar', 'Aerodactyl-Mega']);
  assert.deepEqual(rox[5], { species: 'Aerodactyl-Mega', level: '38', item: 'Aerodactylite', ability: 'Tough Claws', nature: 'Timid', moves: ['Rock Tomb', 'Wing Attack', 'Earthquake', 'Ancient Power'] });
  const rows = G.trainerRows(t, { leaderroxanne: true });
  const roxRow = rows.findIndex(r => r[2] === 'Leader Roxanne');
  assert.deepEqual([rows[roxRow][10], rows[roxRow][11], rows[roxRow + 1][2]], ['✔', 38, '']);
  assert.equal(rows.find(r => r[2] === 'Youngster Ren')[4], 'Équipe aléatoire (voir doc officiel)');
  const relu = G.trainersFromRows(rows);
  assert.equal(relu.length, 5);
  assert.equal(G.nextTrainer(relu, { route103rival: true }).name, 'Youngster Ren');
  assert.equal(relu[4].maxLevel, 38);
});

test('dresseurs : onglet Ligue (6 Pokémon, doubles)', () => {
  const t = G.parseTrainerSheet(OFFICIAL.pokemonLeague, 'Ligue');
  assert.deepEqual(t.map(x => [x.area, x.name, x.mons.length]), [['Pokémon League', 'Elite Four Sidney Singles', 6], ['Pokémon League', 'Elite Four Sidney Doubles [Double]', 6]]);
  assert.deepEqual(t[0].mons[5], { species: 'Kingambit', level: '100', item: 'Chople Berry', ability: 'Supreme Overlord', nature: 'Brave', moves: ['Knock Off', 'Sucker Punch', 'Iron Head', 'Swords Dance'] });
});

test('objets : catégories et lieux depuis les onglets officiels', () => {
  const all = [['Held Items', 'heldItems'], ['Resources', 'resources'], ['TM/HMs and Move Tutors', 'tms'], ['Evolution Items', 'evolution'], ['Special', 'special'], ['Other', 'other']]
    .flatMap(([n, k]) => G.parseItemSheet(n, OFFICIAL[k]));
  const get = (cat, item) => all.filter(i => i[0] === cat && i[1] === item);
  assert.deepEqual(get('Objet tenu', 'Miracle Seed')[0], ['Objet tenu', 'Miracle Seed', 'Petalburg Woods (Cut required)']);
  assert.equal(get('Baie', 'Oran Berry')[0][2], 'Oldale Town (From Brendan/May), Route 102, Route 116 — quantité : 80, 50');
  assert.equal(get('Écaille Cœur', 'Heart Scale').length, 4);
  assert.equal(get('Menthe', 'Serious Mint').length, 2);
  assert.equal(get('Ressource', 'Ability Capsule').length, 1);
  assert.equal(get('CT / CS', 'TM06 Rock Tomb')[0][2], 'From Roxanne after the Gym battle');
  assert.equal(get('Tuteur', 'Brick Break')[0][2], 'Slateport City (Top of the market)');
  assert.equal(get('Objet d\'évolution', 'Moon Stone').length, 1);
  assert.equal(get('Méga-gemme / spécial', 'Ampharosite')[0][2], 'Verdanturf Tunnel B1F');
  assert.equal(get('Mémoire', 'Dark Memory').length, 1);
  assert.equal(get('Boutique de la Ligue', 'Choice Scarf')[0][2], '9 Écailles Cœur');
  assert.equal(get('Objet sauvage', 'Metal Powder')[0][2], 'Ditto — 100%');
  assert.ok(!all.some(i => /^(Item|Berry|Move|League Shop|Wild Held Items|Price)/.test(i[1])), 'aucun en-tête importé comme objet');
});

// ------------------------------------------------------------- Feuille complète
const SOURCES = {
  '1EdJf2JRe5dLPEX1vWmbeRFeCIh-7hgos-t52JQd1Xb8': { 'Encounter Tables': OFFICIAL.encounterGrid, 'Other Tables': OFFICIAL.otherTables, 'Special Encounters': OFFICIAL.specialEncounters },
  '1ForxCI9BczgfLYHEOTd-3Cg4tEa3Nn_VNk5nx-OLedo': { 'Held Items': OFFICIAL.heldItems, 'Resources': OFFICIAL.resources, 'TM/HMs and Move Tutors': OFFICIAL.tms,
    'Evolution Items': OFFICIAL.evolution, 'Special': OFFICIAL.special, 'Other': OFFICIAL.other },
  '1mwHPt0AMzOJ_hfmDrVZpKP-Hf4eTT0ROhY8Wa7bY7r8': { 'Roxanne Split': OFFICIAL.roxanneSplit }
};

test('première synchro : onglets créés, données officielles importées, statuts calculés', () => {
  const { G: G2 } = load(SOURCES);
  const ss = fakeSpreadsheet();
  G2.applyPayload(ss, payload(), new Date('2026-11-25T10:00:00Z'));
  assert.deepEqual(Object.keys(ss.sheets).sort(), Object.values(S).sort());
  const pk = ss.sheets[S.pokemon], run = ss.sheets[S.run], enc = ss.sheets[S.encounters], tr = ss.sheets[S.trainers], items = ss.sheets[S.items];
  const r2 = row(pk, 2);
  assert.deepEqual([r2[0], r2[1], r2[3], r2[4], r2[6]], ['12345678-cafebabe', 1, 'Torchic', 'Pyro', 'Équipe']);
  assert.deepEqual(r2.slice(9, 16), [31, 30, 29, 27, 26, 28, 28.5]);
  assert.equal(row(pk, 5)[6], 'Mort');
  // Tableau de bord
  assert.equal(v(run, R.kpiValue, 1), '2 / 6');
  assert.equal(v(run, R.kpiValue, 3), 4);
  assert.equal(v(run, R.kpiValue, 5), 1);
  assert.equal(v(run, R.kpiValue, 7), 'Niv. 19');
  assert.equal(v(run, R.kpiValue, 11), 'Route 103 Rival', 'prochain dresseur');
  assert.equal(v(run, R.teamFirst, 2), 'Pyro');
  assert.equal(v(run, R.teamFirst, 6), 0.83);
  assert.equal(v(run, R.teamFirst, 7), 'Brûlé');
  assert.equal(v(run, R.teamFirst + 1, 7), 'K.O.');
  assert.equal(v(run, R.tablesFirst, 8), 'Rip', 'cimetière');
  // Rencontres : Pyro (Route 101), Zig/Boxy (Route 102 → absente de l'extrait), Rip (Route 103)
  const encRows = Array.from({ length: enc.getLastRow() - 1 }, (_, i) => row(enc, i + 2, 8));
  assert.ok(encRows.length > 100);
  const r101 = encRows.find(r => r[0] === 'Route 101');
  assert.equal(r101[6], '✔ Pyro (Torchic)');
  assert.equal(encRows.find(r => r[0] === 'Route 103')[6], '✝ Rip (Poochyena)');
  assert.equal(encRows.find(r => r[0] === 'Littleroot Town')[6], '');
  assert.equal(encRows.find(r => r[3] === 'Shroomish')[7], '');
  // Dresseurs
  assert.equal(v(tr, 2, 3), 'Route 103 Rival');
  assert.equal(v(tr, 2, 10), 'Chilling Water, Razor Shell, Grass Knot, Encore');
  // Objets avec cases « Récupéré »
  assert.equal(v(items, 2, 4), false);
});

test('synchros suivantes : mise à jour sur place, colonnes manuelles intactes, combats → frags, dresseurs battus', () => {
  const { G: G2 } = load(SOURCES);
  const ss = fakeSpreadsheet();
  G2.applyPayload(ss, payload(), new Date());
  const pk = ss.sheets[S.pokemon], f = ss.sheets[S.fights], tr = ss.sheets[S.trainers], run = ss.sheets[S.run];
  pk.cells['3,' + C.deathCause] = { v: 'Youngster Ren' };
  const fights = [
    ['Route 103 Rival', '', 'Pyro', 2, 'Zig', 1],
    ['Youngster Ren', 'Roxanne', 'Zig', '', 'Pyro', 3],
    ['Leader Roxanne', '', 'Pyro', '2,5'],
    ['Youngster Levi', 'Roxanne', '', '', '', '', 'Pyro', 'x']
  ];
  fights.forEach((r, i) => r.forEach((val, j) => { f.cells[(i + 2) + ',' + (j + 1)] = { v: val }; }));
  G2.applyPayload(ss, payload(d => {
    d.party[0].level = 15; d.party[0].species = 'Combusken';
    const z = d.party.splice(1, 1)[0]; z.box = 12; z.boxSlot = 2; d.dead.push(z);
    d.box = [];
  }), new Date());
  assert.equal(pk.getLastRow(), 5, 'aucune ligne en double');
  assert.deepEqual([row(pk, 2)[3], row(pk, 2)[5], row(pk, 2)[1]], ['Combusken', 15, 1]);
  assert.equal(row(pk, 3)[6], 'Mort');
  assert.equal(v(pk, 3, C.deathCause), 'Youngster Ren', 'saisie manuelle conservée');
  assert.equal(row(pk, 4)[6], 'Absent');
  // Split rempli automatiquement depuis l'onglet Dresseurs
  assert.equal(v(f, 2, 2), 'Roxanne');
  assert.equal(v(f, 4, 2), 'Roxanne');
  // Frags : Pyro = 2 + 3 + 2,5 + 0 = 7,5 ; leads 2 ; combats 4
  assert.deepEqual([v(pk, 2, C.frags), v(pk, 2, C.leads), v(pk, 2, C.fights), v(pk, 2, C.splits)], [7.5, 2, 4, 7.5]);
  assert.deepEqual([v(pk, 3, C.frags), v(pk, 3, C.leads), v(pk, 3, C.fights)], [1, 1, 2]);
  assert.deepEqual([v(run, R.tablesFirst, 1), v(run, R.tablesFirst, 2), v(run, R.tablesFirst, 4)], ['🥇', 'Pyro', 7.5]);
  assert.deepEqual([v(run, R.tablesFirst, 14), v(run, R.tablesFirst, 15)], ['Roxanne', 8.5]);
  assert.ok(String(v(run, R.tablesFirst, 16)).startsWith('█'));
  // Dresseurs battus + prochain dresseur
  const battu = Array.from({ length: tr.getLastRow() - 1 }, (_, i) => [v(tr, i + 2, 3), v(tr, i + 2, 11)]).filter(x => x[0]);
  assert.deepEqual(battu, [['Route 103 Rival', '✔'], ['Youngster Ren', '✔'], ['Youngster Levi', '✔'], ['Hiker Marcster', ''], ['Leader Roxanne', '✔']]);
  assert.equal(v(run, R.kpiValue, 11), 'Hiker Marcster');
  // Level cap déduit des combats : Ren et Levi battus → prochain boss Lass Videl, cap 25
  assert.deepEqual([v(run, R.kpiValue, 7), v(run, R.kpiValue, 9)], ['Niv. 25', 'Lass Videl']);
  assert.equal(v(run, R.kpiSub, 11), 'Roxanne · Root Academy · Niv. max 37');
});

test('réimport : les cases « Récupéré » cochées sont conservées', () => {
  const { G: G2 } = load(SOURCES);
  const ss = fakeSpreadsheet();
  G2.applyPayload(ss, payload(), new Date());
  const items = ss.sheets[S.items];
  items.cells['2,4'] = { v: true };
  const name = v(items, 2, 2);
  G2.importReference(ss);
  const rowIdx = Array.from({ length: items.getLastRow() - 1 }, (_, i) => i + 2).find(r => v(items, r, 2) === name);
  assert.equal(v(items, rowIdx, 4), true);
});

test('anciens noms d’onglets (v1) renommés sans perte', () => {
  const { G: G2 } = load(SOURCES);
  const ss = fakeSpreadsheet();
  ss.insertSheet('Combats').cells['2,1'] = { v: 'Route 103 Rival' };
  G2.ensureStructure(ss);
  assert.equal(ss.sheets['Combats'], undefined);
  assert.equal(v(ss.sheets[S.fights], 2, 1), 'Route 103 Rival');
});

test('level cap déduit des combats (boss de « Mechanic Changes »)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(G.capFromFights([]))), { any: false, beaten: 0, cap: 13, next: 'Youngster Ren' });
  const c = G.capFromFights(['Youngster Ren', 'Youngster Levi', 'Lass Videl', 'Youngster Itachi', 'Leader Roxanne', 'Leader Brawly [Boss]', 'Ex Elite Four Glacia 1 [Boss]']);
  assert.deepEqual([c.cap, c.next, c.beaten], [59, 'Wattson', 7]);
  assert.equal(G.capFromFights(['Youngster Renato']).cap, 13, 'nom exact pour la Root Academy');
});

test('synchro où seuls les PV changent : les gros onglets ne sont pas réécrits', () => {
  const { G: G2 } = load(SOURCES);
  const ss = fakeSpreadsheet();
  G2.applyPayload(ss, payload(), new Date());
  const enc = ss.sheets[S.encounters];
  enc.cells['2,7'] = { v: 'MARQUEUR' };
  G2.applyPayload(ss, payload(d => { d.party[0].hp = 5; }), new Date());
  assert.equal(enc.cells['2,7'].v, 'MARQUEUR', 'Rencontres non réécrites');
  assert.equal(v(ss.sheets[S.run], R.teamFirst, 5), '5 / 40', 'équipe mise à jour');
  G2.applyPayload(ss, payload(d => { d.box[0].level = 13; d.box[0].nickname = 'Plume'; }), new Date());
  assert.notEqual(enc.cells['2,7'] && enc.cells['2,7'].v, 'MARQUEUR', 'captures modifiées → statuts recalculés');
});

test('données invalides refusées', () => {
  assert.ok(G.validatePayload({}));
  assert.ok(G.validatePayload({ kind: 'null-run', data: { party: Array(7).fill({}), box: [], dead: [] } }));
  assert.equal(G.validatePayload(payload()), '');
});
