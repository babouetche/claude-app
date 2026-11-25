'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const T = require('../docs/js/run/trainers.js');
// Vraies données de dresseurs du calculateur (1.2.6)
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../docs/js/data/sets/gen9.js'), 'utf8') + ';this.SETDEX_SV=SETDEX_SV;this.window.SETDEX_SV=SETDEX_SV;', ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../docs/js/null_ai/version126-trainers.js'), 'utf8'), ctx);
const trainers = T.buildTrainers(ctx.SETDEX_SV);
const byName = n => trainers.find(t => t.name === n);
const team = n => byName(n).mons.map(m => ({ species: m.species, level: m.level }));

test('base des dresseurs : ordre du jeu, formes Méga regroupées, Root Academy groupé', () => {
  assert.equal(trainers[0].name, 'Root Academy Trainer #1');
  assert.equal(trainers[0].random, true);
  assert.equal(trainers[0].slotCount, 3);
  const rox = byName('Leader Roxanne');
  assert.deepEqual(rox.mons.map(m => m.species), ['Tyranitar', 'Solrock', 'Zygarde', 'Cradily', 'Omastar', 'Aerodactyl']);
  assert.equal(rox.mons[5].item, 'Aerodactylite');
  assert.ok(byName('Leader Brawly').order > rox.order);
});

test('reconnaissance : équipe exacte uniquement, pas de faux positif sauvage', () => {
  assert.equal(T.matchTeam(trainers, team('Leader Roxanne')).name, 'Leader Roxanne');
  assert.equal(T.matchTeam(trainers, team('Leader Roxanne').slice(0, 2)), null, 'équipe partielle ignorée');
  assert.equal(T.matchTeam(trainers, [{ species: 'Zigzagoon', level: 5 }]), null, 'sauvage ignoré');
  const pools = trainers[0].mons;
  const ra = [pools.find(m => m.species === 'Sunkern'), pools.find(m => m.species === 'Spewpa'), pools[pools.length - 1]];
  assert.equal(T.matchTeam(trainers, ra.map(m => ({ species: m.species, level: m.level }))).name, 'Root Academy Trainer #1');
});

test('progression : prochain dresseur et level cap automatiques', () => {
  let p = T.progress(trainers, []);
  assert.equal(p.next.name, 'Root Academy Trainer #1');
  assert.equal(p.cap, 13);
  const fights = ['Root Academy Trainer #1', 'Root Academy Trainer #2', 'Root Academy Trainer #3', 'Root Academy Trainer #4'].map((n, i) => {
    const t = byName(n), picks = []; const seen = {};
    // un Pokémon par emplacement (Slot 1, 2, 3)
    Object.keys(ctx.SETDEX_SV).forEach(sp => Object.keys(ctx.SETDEX_SV[sp]).forEach(key => {
      const m = /^Root Academy Trainer #(\d+) Slot (\d+)$/.exec(key);
      if (m && 'Root Academy Trainer #' + m[1] === n && !seen[m[2]]) { seen[m[2]] = 1; picks.push({ species: sp, level: ctx.SETDEX_SV[sp][key].level }); }
    }));
    return { t: i, team: picks };
  });
  p = T.progress(trainers, fights);
  assert.equal(p.cap, 38, 'après les 4 Root Academy : cap de Roxanne');
  assert.equal(p.nextBoss.label, 'Roxanne');
  p = T.progress(trainers, fights.concat([{ t: 9, team: team('Leader Roxanne') }]));
  assert.equal(p.cap, 45);
  assert.ok(p.next.order > byName('Leader Roxanne').order, 'prochain dresseur après Roxanne');
  // Chaîne complète : cap 100 après Wallace, boss résolus dans l'ordre (Maxie de la base Magma, Archie des Fonds Marins)
  const all = trainers.filter(t => !t.random).map((t, i) => ({ t: 100 + i, team: t.mons.map(m => ({ species: m.species, level: m.level })) }));
  p = T.progress(trainers, fights.concat(all));
  assert.equal(p.cap, 100);
  assert.equal(p.bossesBeaten, 17);
});

test('noms lus dans le jeu (Lua officiel) : toutes les espèces des dresseurs sont reconnues', () => {
  const luaPath = process.env.NULL_OFFICIAL_LUA_MONS;
  if (!luaPath || !fs.existsSync(luaPath)) return;
  const k = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const lua = new Set(JSON.parse(fs.readFileSync(luaPath, 'utf8')).map(k));
  const missing = [];
  trainers.forEach(t => t.mons.forEach(m => { if (m.species !== 'None' && ![m.species].concat(m.alts).some(a => T.keysOf(a).some(x => lua.has(x)))) missing.push(m.species); }));
  assert.deepEqual(missing, []);
});

test('Root Academy : reconnu même si le niveau tiré diffère, pas un sauvage seul', () => {
  const ra1 = trainers.find(t => t.name === 'Root Academy Trainer #1');
  const team = ['Sunkern', 'Ralts', 'Pidgey'].map(species => ({ species, level: 14 }));
  assert.equal(T.matchTeam(trainers, team).name, 'Root Academy Trainer #1');
  assert.equal(T.matchTeam(trainers, [{ species: 'Ralts', level: 14 }]), null);
  assert.equal(T.progress(trainers, [{ t: 1, team }]).next.order > ra1.order, true);
});

test('level cap : boss antérieurs au dernier combat détecté comptés comme battus', () => {
  const youngster = trainers.find(t => t.name === 'Youngster Calvin');
  const team = youngster.mons.map(m => ({ species: m.species, level: m.level }));
  assert.equal(T.progress(trainers, [{ t: 1, team }]).cap, 38);
});
