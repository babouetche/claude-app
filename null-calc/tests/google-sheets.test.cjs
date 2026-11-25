'use strict';
// Teste google-sheets/Code.gs avec une fausse API Google Sheets (en mémoire).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

function fakeSpreadsheet() {
  const sheets = {};
  function makeSheet(name) {
    const cells = {}; // "r,c" -> {v, f}
    const sheet = {
      name, cells,
      getRange(a, b, nr, nc) {
        if (typeof a === 'string') return { setDataValidation() {} };
        nr = nr || 1; nc = nc || 1;
        const range = {
          getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (cells[(a + i) + ',' + (b + j)] || { v: '' }).v)),
          getValue: () => (cells[a + ',' + b] || { v: '' }).v,
          setValues: vals => { assert.equal(vals.length, nr); vals.forEach((row, i) => { assert.equal(row.length, nc, 'largeur'); row.forEach((v, j) => { assert.ok(v !== undefined && v !== null, 'valeur vide en ' + (a + i) + ',' + (b + j)); cells[(a + i) + ',' + (b + j)] = { v }; }); }); return range; },
          setValue: v => { cells[a + ',' + b] = { v }; return range; },
          setFormula: f => { cells[a + ',' + b] = { v: '', f }; return range; },
          setFormulas: fs2 => { fs2.forEach((row, i) => row.forEach((f, j) => { cells[(a + i) + ',' + (b + j)] = { v: '', f }; })); return range; },
          setFontWeight: () => range, setBackground: () => range, setFontColor: () => range, setFontSize: () => range, setDataValidation: () => range
        };
        return range;
      },
      getLastRow: () => Math.max(0, ...Object.keys(cells).filter(k => cells[k].v !== '' || cells[k].f).map(k => Number(k.split(',')[0]))),
      setFrozenRows() {}, setFrozenColumns() {}, hideColumns() {}, setColumnWidth() {}
    };
    return sheet;
  }
  return {
    sheets,
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => (sheets[n] = makeSheet(n)),
    getSpreadsheetTimeZone: () => 'Europe/Paris',
    setActiveSheet() {}, moveActiveSheet() {}
  };
}

const ctx = { module: { exports: {} }, SpreadsheetApp: { newDataValidation: () => { throw new Error('pas de validation en test'); } },
  Utilities: { formatDate: d => d.toISOString() } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../google-sheets/Code.gs'), 'utf8'), ctx);
const G = ctx.module.exports;
const fixtureText = fs.readFileSync(path.join(__dirname, 'fixtures/run-data-sample.js'), 'utf8');
const sample = JSON.parse(fixtureText.slice(fixtureText.indexOf('(') + 1, fixtureText.trimEnd().lastIndexOf(')')));
function payload(mutate) { const d = JSON.parse(JSON.stringify(sample.data)); if (mutate) mutate(d); return { kind: 'null-run', version: 1, data: d, bosses: { cap: 19, next: 'Root Academy Trainer 2', beaten: ['Root Academy Trainer 1'] } }; }
const C = G.COL;
function row(sheet, r) { return Array.from({ length: C.sync }, (_, i) => (sheet.cells[r + ',' + (i + 1)] || { v: '' }).v); }

test('colonnes : 20 automatiques, « Mort contre » en U, frags en V, splits puis synchro', () => {
  const h = G.headers_();
  assert.equal(h[C.deathCause - 1], 'Mort contre');
  assert.equal(h[C.frags - 1], 'Frags');
  assert.equal(h[C.splits - 1], 'Roxanne');
  assert.equal(h[C.sync - 1], 'Dernière synchro');
  assert.equal(G.colLetter(C.deathCause), 'U');
  assert.equal(G.colLetter(C.frags), 'V');
  assert.equal(G.colLetter(C.sync), 'AI');
});

test('première synchro : une ligne par Pokémon, statut, IV et formules', () => {
  const ss = fakeSpreadsheet();
  G.applyPayload(ss, payload(), new Date('2026-11-25T10:00:00Z'));
  const pk = ss.sheets['Pokémon'];
  const r2 = row(pk, 2), r3 = row(pk, 3), r4 = row(pk, 4), r5 = row(pk, 5);
  assert.deepEqual([r2[0], r2[1], r2[3], r2[4], r2[6]], ['12345678-cafebabe', 1, 'Torchic', 'Pyro', 'Équipe']);
  assert.deepEqual(r2.slice(9, 16), [31, 30, 29, 27, 26, 28, 28.5]);
  assert.equal(r3[6], 'K.O. (équipe)');
  assert.equal(r4[6], 'Boîte');
  assert.ok(r4[18].includes('Hidden Power Fighting'));
  assert.equal(r5[6], 'Mort');
  assert.equal(pk.cells['2,' + C.frags].v, 0, 'aucun combat : 0 frag');
  const run = ss.sheets['Run'];
  assert.equal(run.cells['7,2'].v, 1, 'Morts');
  assert.equal(run.cells['9,2'].v, 19, 'Level cap');
  assert.equal(run.cells['5,5'].v, 'Pyro');
});

test('synchro suivante : mise à jour sur place, colonnes manuelles intactes, mort et absent', () => {
  const ss = fakeSpreadsheet();
  G.applyPayload(ss, payload(), new Date());
  const pk = ss.sheets['Pokémon'];
  pk.cells['3,' + C.deathCause] = { v: 'Youngster Ren' };            // saisi à la main
  G.applyPayload(ss, payload(d => {
    d.party[0].level = 15; d.party[0].species = 'Combusken';
    const z = d.party.splice(1, 1)[0]; z.box = 12; z.boxSlot = 2; d.dead.push(z);  // Zig meurt
    d.box = [];                                                                    // Boxy relâché
  }), new Date());
  assert.equal(pk.getLastRow(), 5, 'aucune ligne en double');
  assert.deepEqual([row(pk, 2)[3], row(pk, 2)[5], row(pk, 2)[1]], ['Combusken', 15, 1]);
  assert.equal(row(pk, 3)[6], 'Mort');
  assert.equal(pk.cells['3,' + C.deathCause].v, 'Youngster Ren', 'la saisie manuelle est conservée');
  assert.equal(row(pk, 4)[6], 'Absent');
});

test('frags, leads et combats calculés depuis l\'onglet Combats', () => {
  const ss = fakeSpreadsheet();
  G.applyPayload(ss, payload(), new Date());
  const f = ss.sheets['Combats'];
  const rows = [
    ['Youngster Ren', 'Roxanne', 'Pyro', 2, 'Zig', 1],
    ['Lass Videl', 'Roxanne', 'Zig', '', 'Pyro', 3],
    ['Leader Brawly', 'Brawly', 'Pyro', 1],
    ['Youngster Levi', 'Roxanne', '', '', '', '', 'Pyro', 'x'],   // frag en texte = 0
    ['Rival', '', 'Pyro', '2,5']                                   // split vide : compte dans le total seulement
  ];
  rows.forEach((r, i) => r.forEach((v, j) => { f.cells[(i + 2) + ',' + (j + 1)] = { v }; }));
  G.refreshStats(ss);
  const pk = ss.sheets['Pokémon'], C2 = C;
  const v = (r, c) => pk.cells[r + ',' + c].v;
  assert.deepEqual([v(2, C2.frags), v(2, C2.leads), v(2, C2.fights), v(2, C2.splits), v(2, C2.splits + 1)], [8.5, 3, 5, 5, 1]);
  assert.deepEqual([v(3, C2.frags), v(3, C2.leads), v(3, C2.fights), v(3, C2.splits)], [1, 1, 2, 1]);
  assert.equal(v(4, C2.frags), 0);
  const run = ss.sheets['Run'];
  assert.deepEqual([run.cells['17,1'].v, run.cells['17,3'].v, run.cells['18,1'].v], ['Pyro', 8.5, 'Zig']);
  assert.equal(run.cells['17,8'].v, 'Rip', 'cimetière');
  assert.deepEqual([run.cells['17,14'].v, run.cells['17,15'].v, run.cells['18,15'].v], ['Roxanne', 6, 1]);
});

test('données invalides refusées', () => {
  assert.ok(G.validatePayload({}));
  assert.ok(G.validatePayload({ kind: 'null-run', data: { party: Array(7).fill({}), box: [], dead: [] } }));
  assert.equal(G.validatePayload(payload()), '');
});
