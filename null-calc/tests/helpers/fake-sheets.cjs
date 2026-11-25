'use strict';
// Fausse API Google Sheets / Apps Script en mémoire, pour tester google-sheets/Code.gs.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

// Objet qui accepte n'importe quel appel de mise en forme (setBackground, merge…) et se renvoie lui-même.
function chain(extra) {
  const target = Object.assign({}, extra || {});
  const proxy = new Proxy(target, { get: (t, k) => (k in t ? t[k] : (k === 'then' ? undefined : () => proxy)) });
  return proxy;
}

function fakeSpreadsheet(sources) {
  const sheets = {}, order = [];
  function makeSheet(name) {
    const cells = {};
    let sheetName = name;
    function rangeObj(a, b, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      const range = chain({
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (cells[(a + i) + ',' + (b + j)] || { v: '' }).v)),
        getValue: () => (cells[a + ',' + b] || { v: '' }).v,
        setValues: vals => {
          assert.equal(vals.length, nr, 'hauteur ' + sheetName);
          vals.forEach((row, i) => { assert.equal(row.length, nc, 'largeur ' + sheetName); row.forEach((v, j) => {
            assert.ok(v !== undefined && v !== null, 'valeur vide en ' + sheetName + ' ' + (a + i) + ',' + (b + j)); cells[(a + i) + ',' + (b + j)] = { v }; }); });
          return range;
        },
        setValue: v => { cells[a + ',' + b] = { v }; return range; },
        clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) delete cells[(a + i) + ',' + (b + j)]; return range; },
        setFormula: () => { throw new Error('Aucune formule ne doit être écrite (langue de la feuille).'); },
        setFormulas: () => { throw new Error('Aucune formule ne doit être écrite (langue de la feuille).'); }
      });
      return range;
    }
    const sheet = chain({
      cells,
      getName: () => sheetName,
      setName: n => { delete sheets[sheetName]; sheetName = n; sheets[n] = sheet; return sheet; },
      getRange: (a, b, nr, nc) => (typeof a === 'string' ? chain() : rangeObj(a, b, nr, nc)),
      getLastRow: () => Math.max(0, ...Object.keys(cells).filter(k => cells[k].v !== '').map(k => Number(k.split(',')[0]))),
      getMaxRows: () => 1000, getMaxColumns: () => 40,
      clear: () => { Object.keys(cells).forEach(k => delete cells[k]); return sheet; },
      getDataRange: () => chain({ getValues: () => (sources && sources[sheetName]) || [] })
    });
    return sheet;
  }
  const ss = chain({
    sheets,
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => { sheets[n] = makeSheet(n); order.push(n); return sheets[n]; },
    getSheets: () => Object.values(sheets),
    getSpreadsheetTimeZone: () => 'Europe/Paris'
  });
  return ss;
}

function load(sourcesById, extra) {
  const props = { doc: {}, script: {} };
  const store = k => ({ getProperty: n => props[k][n] || null, setProperty: (n, v) => { props[k][n] = v; } });
  const ctx = {
    module: { exports: {} },
    SpreadsheetApp: chain({
      newConditionalFormatRule: () => chain({ build: () => ({}) }), newDataValidation: () => chain({ build: () => ({}) }),
      BorderStyle: {}, InterpolationType: {},
      newCellImage: () => { const img = { url: '' }; const b = { setSourceUrl: u => { img.url = u; return b; }, setAltTextTitle: () => b, build: () => ({ sprite: img.url }) }; return b; },
      openById: id => { const src = sourcesById && sourcesById[id]; if (!src) throw new Error('source inconnue ' + id); return makeSource(src); }
    }),
    PropertiesService: { getDocumentProperties: () => store('doc'), getScriptProperties: () => store('script') },
    Utilities: { formatDate: d => d.toISOString() }
  };
  Object.assign(ctx, extra || {});
  function makeSource(src) {
    const ss = fakeSpreadsheet(src);
    Object.keys(src).forEach(n => ss.insertSheet(n));
    return ss;
  }
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../google-sheets/Code.gs'), 'utf8'), ctx);
  // Les objets créés dans le contexte vm ont d'autres prototypes : on les convertit pour deepStrictEqual.
  const G = Object.assign({}, ctx.module.exports);
  ['parseEncounterGrid', 'parseSpecialEncounters', 'parseTrainerSheet', 'parseItemSheet', 'trainerRows', 'trainersFromRows', 'nextTrainer'].forEach(n => {
    const fn = G[n]; G[n] = (...a) => { const r = fn(...a); return r == null ? r : JSON.parse(JSON.stringify(r)); };
  });
  return { G, props, ctx };
}


module.exports = { chain, fakeSpreadsheet, load };
