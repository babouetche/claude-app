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
  assert.deepEqual([rows[roxRow][10], rows[roxRow + 1][2]], [38, '']);
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
  assert.deepEqual([r2[0], r2[1], r2[4], r2[5], r2[7]], ['12345678-cafebabe', 1, 'Torchic', 'Pyro', 'Équipe']);
  assert.equal(r2[3], '=IMAGE("https://play.pokemonshowdown.com/sprites/gen5/torchic.png")', 'sprite à côté du nom');
  assert.deepEqual(r2.slice(10, 17), [31, 30, 29, 27, 26, 28, 28.5]);
  assert.equal(row(pk, 5)[7], 'Mort');
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
  assert.equal(v(run, R.tablesFirst, 8), 'Rip', 'morts');
  // Rencontres : Pyro (Route 101), Zig/Boxy (Route 102 → absente de l'extrait), Rip (Route 103)
  // Zones côte à côte (ligne 1 : nom, ligne 2 : capture) ; dans chaque zone, une table par méthode (ligne 3) : %, Niv., sprite, Pokémon
  const W = 2000, cell = (r, c) => v(enc, r, c);
  const cols = Array.from({ length: W }, (_, i) => i + 1);
  const zoneCol = z => cols.find(c => cell(1, c) === z);
  assert.equal(cell(2, zoneCol('Route 101')), '✔ Pyro (Torchic)');
  assert.equal(cell(2, zoneCol('Route 103')), '✝ Rip (Poochyena)');
  assert.equal(cell(2, zoneCol('Littleroot Town')), 'Pas encore de capture');
  const lt = zoneCol('Littleroot Town');
  assert.equal(cell(3, lt), 'Herbes');
  assert.ok(cols.some(c => c > lt && c < zoneCol('Littleroot Grove') && cell(3, c) === 'Pêche'), 'Pêche à côté des Herbes, même zone');
  assert.ok(zoneCol('Littleroot Grove') > lt, 'zones à la suite, à l\'horizontale');
  const gRow = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].find(r => cell(r, lt + 3) === 'Growlithe');
  assert.deepEqual([cell(gRow, lt), cell(gRow, lt + 1), cell(gRow, lt + 2)], ['5%', '5', '=IMAGE("https://play.pokemonshowdown.com/sprites/gen5/growlithe.png")']);
  // Données brutes conservées dans l'onglet caché
  const data = ss.sheets[S.encData];
  assert.deepEqual(row(data, 1, 6), ['Zone', 'Zone Nuzlocke', 'Méthode', 'Pokémon', 'Niveau', 'Taux']);
  // Dresseurs : blocs du doc (étiquette à gauche, un Pokémon par colonne)
  const trRows = Array.from({ length: tr.getLastRow() }, (_, i) => row(tr, i + 1, 8));
  const rival = trRows.findIndex(r => r[0] === 'Dresseur' && r[1] === 'Route 103 Rival');
  assert.ok(rival > 0, 'bloc du rival');
  assert.deepEqual(trRows[rival + 1].slice(0, 2), ['Pokémon', '=IMAGE("https://play.pokemonshowdown.com/sprites/gen5/oshawott.png")']);
  assert.deepEqual(trRows[rival + 2].slice(1, 4), ['Oshawott', 'Litten', 'Riolu']);
  assert.deepEqual(trRows[rival + 3].slice(0, 4), ['Niveau', 10, 10, 11]);
  assert.deepEqual(trRows[rival + 7].slice(0, 2), ['Attaques', 'Chilling Water']);
  assert.ok(trRows.some(r => r[0] === 'Route 103'), 'lieu en en-tête');
  // Objets avec cases « Récupéré »
  assert.equal(v(items, 3, 4), false);
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
  assert.deepEqual([row(pk, 2)[4], row(pk, 2)[6], row(pk, 2)[1]], ['Combusken', 15, 1]);
  assert.equal(row(pk, 2)[3], '=IMAGE("https://play.pokemonshowdown.com/sprites/gen5/combusken.png")', 'sprite mis à jour à l\'évolution');
  assert.equal(row(pk, 3)[7], 'Mort');
  assert.equal(v(pk, 3, C.deathCause), 'Youngster Ren', 'saisie manuelle conservée');
  assert.equal(row(pk, 4)[7], 'Absent');
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
  const battu = Array.from({ length: tr.getLastRow() }, (_, i) => row(tr, i + 1, 8)).filter(r => r[0] === 'Dresseur').map(r => [r[1], r[7] === '✔ Battu' ? '✔' : '']);
  assert.deepEqual(battu, [['Route 103 Rival', '✔'], ['Youngster Ren', '✔'], ['Youngster Levi', '✔'], ['Hiker Marcster', ''], ['Leader Roxanne', '✔']]);
  assert.equal(v(run, R.kpiValue, 11), 'Tous battus', 'rien après Roxanne dans l\'extrait');
  // Level cap déduit des combats : Ren et Levi battus → prochain boss Lass Videl, cap 25
  assert.deepEqual([v(run, R.kpiValue, 7), v(run, R.kpiValue, 9)], ['Niv. 25', 'Lass Videl']);
});

test('réimport : les cases « Récupéré » cochées sont conservées', () => {
  const { G: G2 } = load(SOURCES);
  const ss = fakeSpreadsheet();
  G2.applyPayload(ss, payload(), new Date());
  const items = ss.sheets[S.items];
  assert.equal(v(items, 2, 1), '▸ Objet tenu', 'titre de catégorie');
  items.cells['3,4'] = { v: true };
  const name = v(items, 3, 2);
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
  assert.deepEqual(JSON.parse(JSON.stringify(G.capFromFights([]))), { any: false, beaten: 0, cap: 13, next: 'Youngster Ren', last: '' });
  const c = G.capFromFights(['Youngster Ren', 'Youngster Levi', 'Lass Videl', 'Youngster Itachi', 'Leader Roxanne', 'Leader Brawly [Boss]', 'Ex Elite Four Glacia 1 [Boss]']);
  assert.deepEqual([c.cap, c.next, c.beaten], [59, 'Wattson', 7]);
  assert.equal(G.capFromFights(['Youngster Renato']).cap, 13, 'nom exact pour la Root Academy');
});

test('synchro où seuls les PV changent : les gros onglets ne sont pas réécrits', () => {
  const { G: G2 } = load(SOURCES);
  const ss = fakeSpreadsheet();
  G2.applyPayload(ss, payload(), new Date());
  const enc = ss.sheets[S.encounters];
  enc.cells['2,8'] = { v: 'MARQUEUR' };
  G2.applyPayload(ss, payload(d => { d.party[0].hp = 5; }), new Date());
  assert.equal(enc.cells['2,8'].v, 'MARQUEUR', 'Rencontres non réécrites');
  assert.equal(v(ss.sheets[S.run], R.teamFirst, 5), '5 / 40', 'équipe mise à jour');
  G2.applyPayload(ss, payload(d => { d.box[0].level = 13; d.box[0].nickname = 'Plume'; }), new Date());
  assert.notEqual(enc.cells['2,8'] && enc.cells['2,8'].v, 'MARQUEUR', 'captures modifiées → statuts recalculés');
});

test('nouvelle run : ancienne run archivée, feuille remise à zéro, tentative +1', () => {
  const { G: G2 } = load(SOURCES);
  const ss = fakeSpreadsheet();
  const p1 = payload(); p1.runId = 'cafebabe';
  G2.applyPayload(ss, p1, new Date());
  const pk = ss.sheets[S.pokemon], f = ss.sheets[S.fights], run = ss.sheets[S.run], arch = ss.sheets[S.archive];
  pk.cells['5,' + C.deathCause] = { v: 'Youngster Ren' };
  [['Youngster Ren', '', 'Pyro', 2], ['Leader Roxanne', '', 'Pyro', 3]].forEach((r, i) => r.forEach((val, j) => { f.cells[(i + 2) + ',' + (j + 1)] = { v: val }; }));
  G2.applyPayload(ss, p1, new Date());                       // même partie : rien d'archivé
  assert.equal(arch.getLastRow(), 1);
  const p2 = payload(d => {                                   // nouvelle sauvegarde : autre OT, autre starter
    d.party = [Object.assign({}, d.party[0], { uid: '11111111-0000beef', species: 'Mudkip', nickname: 'Mud', level: 5 })]; d.box = []; d.dead = [];
  });
  p2.runId = '0000beef';
  G2.applyPayload(ss, p2, new Date());
  // Archive : résumé + 4 Pokémon de l'ancienne run
  assert.equal(arch.getLastRow(), 6);
  assert.deepEqual([v(arch, 2, 1), v(arch, 2, 3), v(arch, 2, 4), v(arch, 2, 5), v(arch, 2, 8), v(arch, 2, 10)],
    [1, '▶ RÉSUMÉ', '4 captures · 1 morts', 'Dernier boss battu : Roxanne', 5, 2]);
  assert.deepEqual([v(arch, 3, 3), v(arch, 3, 8), v(arch, 3, 9)], ['Pyro', 5, 2]);
  assert.deepEqual([v(arch, 6, 3), v(arch, 6, 7), v(arch, 6, 11)], ['Rip', 'Mort', 'Youngster Ren']);
  // Nouvelle run propre
  assert.equal(v(run, R.info, 2), 2, 'tentative n°2');
  assert.equal(pk.getLastRow(), 2);
  assert.deepEqual([v(pk, 2, C.species), v(pk, 2, 2), v(pk, 2, C.deathCause)], ['Mudkip', 1, '']);
  assert.equal(f.getLastRow(), 1, 'combats vidés (en-tête seul)');
  assert.equal(v(run, R.kpiValue, 3), 1, 'captures de la nouvelle run');
  assert.equal(v(run, R.tablesFirst, 8), 'Aucun mort 🎉');
  assert.equal(v(run, R.kpiValue, 11), 'Route 103 Rival', 'prochain dresseur repart du début');
});

test('données invalides refusées', () => {
  assert.ok(G.validatePayload({}));
  assert.ok(G.validatePayload({ kind: 'null-run', data: { party: Array(7).fill({}), box: [], dead: [] } }));
  assert.equal(G.validatePayload(payload()), '');
});

test('combats détectés par le Lua : ajoutés une fois dans Combats, split rempli', () => {
  const { G: G2 } = load(SOURCES);
  const ss = fakeSpreadsheet();
  const p1 = payload(); p1.fights = [{ name: 'Root Academy Trainer #1', t: 1 }, { name: 'Route 103 Rival', t: 2 }];
  G2.applyPayload(ss, p1, new Date());
  const f = ss.sheets[S.fights];
  assert.deepEqual([v(f, 2, 1), v(f, 2, 2), v(f, 3, 1)], ['Root Academy Trainer #1', 'Roxanne', 'Route 103 Rival']);
  assert.equal(v(f, 2, 15), 'Détecté automatiquement');
  f.cells['3,3'] = { v: 'Pyro' };
  const p2 = payload(); p2.fights = p1.fights.concat([{ name: 'Leader Roxanne', t: 3 }]);
  G2.applyPayload(ss, p2, new Date());
  assert.equal(v(f, 3, 3), 'Pyro', 'saisie conservée');
  assert.equal(v(f, 4, 1), 'Leader Roxanne');
  assert.equal(f.getLastRow(), 4, 'pas de doublon');
});

test('dresseurs : conditions de combat (gauntlet, B2B, météo permanente, PV de départ)', () => {
  const blk = name => [['Name', name], ['Pokémon'], ['', 'Pikachu'], ['Level', '40'], ['Held Item', 'None'], ['Ability', 'Static'], ['Nature', 'Hardy'], ['Moves', 'Thunderbolt'], [], [], []];
  const values = [[], ['Route 119'], ['Start of Perma Rain + Grassy Terrain\nBug Maniac Taylor until Fisherman Noxie are optional']]
    .concat(blk('A'), [['B2B']], blk('B'), blk('C'), blk('D'), [['End of Rain + Grassy Terrain'], ['Start of Gauntlet'], ['Typhlosion-Hisui 61HP | Primarina 153HP']], blk('E'), [['End of Gauntlet'], ['Fortree Gym']], blk('F'));
  const t = G.parseTrainerSheet(values, 'Winona');
  const c = Object.fromEntries(t.map(x => [x.name, x.conditions]));
  assert.deepEqual(c.A, ['Perma Rain + Grassy Terrain — Bug Maniac Taylor until Fisherman Noxie are optional']);
  assert.deepEqual(c.B, ['Perma Rain + Grassy Terrain — Bug Maniac Taylor until Fisherman Noxie are optional', 'B2B']);
  assert.deepEqual(c.C.length, 2, 'B2B : 2 dresseurs');
  assert.deepEqual(c.D.length, 1);
  assert.deepEqual(c.E, ['Gauntlet', 'Typhlosion-Hisui 61HP | Primarina 153HP']);
  assert.deepEqual(c.F, []);
  assert.deepEqual(t.map(x => x.area), ['Route 119', 'Route 119', 'Route 119', 'Route 119', 'Route 119', 'Fortree Gym'], 'une condition n\'est pas un lieu');
  const rows = G.trainerRows(t, {});
  assert.equal(rows.find(r => r[2] === 'E')[11], 'Gauntlet · Typhlosion-Hisui 61HP | Primarina 153HP');
  assert.equal(G.trainersFromRows(rows).find(x => x.name === 'E').conditions, 'Gauntlet · Typhlosion-Hisui 61HP | Primarina 153HP');
});

test('sprites : noms de fichiers Showdown', () => {
  assert.equal(G.spriteId('Darmanitan-Galar-Zen'), 'darmanitan-galarzen');
  assert.equal(G.spriteId('Mr. Mime-Galar'), 'mrmime-galar');
  assert.equal(G.spriteId('Jangmo-o'), 'jangmoo');
  assert.equal(G.spriteId('Ho-Oh'), 'hooh');
  assert.equal(G.spriteId('Type: Null'), 'typenull');
  assert.equal(G.spriteId('Heracross-Mega'), 'heracross-mega');
  assert.equal(G.spriteId('Flabébé'), 'flabebe');
  assert.equal(G.spriteId('Farfetch’d-Galar'), 'farfetchd-galar');
  assert.equal(G.spriteId('Nidoran-F'), 'nidoranf');
  assert.equal(G.spriteId('Tauros-Paldea-Blaze'), 'tauros-paldeablaze');
});

test('objets : groupés par catégorie, ordre du doc conservé', () => {
  const sorted = G.sortItems([['Baie', 'Oran', ''], ['Objet tenu', 'Miracle Seed', ''], ['Baie', 'Pecha', ''], ['Objet tenu', 'Silver Powder', ''], ['CT / CS', 'TM01', '']]);
  assert.deepEqual(JSON.parse(JSON.stringify(sorted)).map(x => x[1]), ['Miracle Seed', 'Silver Powder', 'TM01', 'Oran', 'Pecha']);
});

test('combats détectés : lead et frags remplis automatiquement, stats calculées', () => {
  const { G: G2 } = load(SOURCES);
  const ss = fakeSpreadsheet();
  const p1 = payload(); p1.fights = [{ name: 'Youngster Calvin', t: 1 }];
  G2.applyPayload(ss, p1, new Date());
  const f = ss.sheets[S.fights], pk = ss.sheets[S.pokemon];
  assert.equal(v(f, 2, 3), '', 'pas encore de lead');
  // Synchro suivante avec lead/frags : la ligne existante est complétée
  const p2 = payload(); p2.fights = [{ name: 'Youngster Calvin', t: 1, lead: 'Pyro', frags: [{ name: 'Zig', n: 1 }, { name: 'Pyro', n: 2 }] },
    { name: 'Bug Catcher Beni', t: 2, lead: 'Zig', frags: [{ name: 'Pyro', n: 4 }] }];
  G2.applyPayload(ss, p2, new Date());
  assert.deepEqual([v(f, 2, 1), v(f, 2, 3), v(f, 2, 4), v(f, 2, 5), v(f, 2, 6), v(f, 2, 15)], ['Youngster Calvin', 'Pyro', 2, 'Zig', 1, 'Détecté automatiquement']);
  assert.deepEqual([v(f, 3, 1), v(f, 3, 3), v(f, 3, 4), v(f, 3, 5), v(f, 3, 6)], ['Bug Catcher Beni', 'Zig', 0, 'Pyro', 4]);
  assert.deepEqual([v(pk, 2, C.frags), v(pk, 2, C.leads), v(pk, 2, C.fights)], [6, 1, 2], 'Pyro : 6 frags, 1 lead, 2 combats');
  // Une saisie manuelle n'est jamais écrasée
  f.cells['2,4'] = { v: 3 };
  G2.applyPayload(ss, p2, new Date());
  assert.equal(v(f, 2, 4), 3);
});

test('dresseurs : couleurs du doc (règles + couleurs posées à la main) et image du dresseur', () => {
  const values = [['Route 116'], ['Name', 'Youngster Schmo'], ['Pokémon'], ['', 'Pidgeot', 'Linoone'], ['Level', '39', '40'], ['Held Item', 'Quick Claw', 'Iapapa Berry'],
    ['Ability', 'Keen Eye', 'Sniper'], ['Nature', 'Hasty', 'Adamant'], ['Moves', 'Mirror Move', 'Belly Drum'], ['', 'Air Slash', 'Extreme Speed'], ['', 'Heat Wave', 'Seed Bomb'], ['', 'Steel Wing', 'Light of Ruin']];
  const bgs = values.map(() => ['#666666', '#efefef', '#efefef', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff']);
  bgs[3][1] = '#ffe599';                                          // lead en double, posé à la main
  const fx = values.map(() => Array(8).fill(''));
  fx[2][7] = '=iferror(arrayformula(VLOOKUP("TRAINER_PIC_YOUNGSTER",Sprites!$A$1:$B,2,false)))';
  const t = G.trainersFromRows(G.trainerRows(G.parseTrainerSheet(values, 'Brawly', bgs, fx)))[0];
  assert.equal(t.pic, 'TRAINER_PIC_YOUNGSTER');
  assert.deepEqual(t.mons[0].colors, { s: '#ffe599' });
  assert.equal(G.highlight_(t.mons[0].item), '#f9cb9c', 'Quick Claw');
  assert.equal(G.highlight_(t.mons[1].ability), '#ea9999', 'Sniper');
  assert.equal(G.highlight_(t.mons[1].moves[0]), '#d5a6bd', 'Belly Drum');
  assert.equal(G.highlight_(t.mons[1].moves[3]), '#ea9999', 'se termine par « of Ruin »');
  assert.equal(G.highlight_('Tackle'), '');
});
