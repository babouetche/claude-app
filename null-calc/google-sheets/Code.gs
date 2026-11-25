/**
 * Pokémon Null — Suivi de run automatique (Google Sheets)
 * ------------------------------------------------------
 * Reçoit les données envoyées par le calculateur (onglet « Suivi de run »)
 * et met à jour cette feuille. Inspiré de l'« Advanced Frag Sheet » (Baat01).
 *
 * Installation : voir google-sheets/INSTALLATION.md
 *   Extensions > Apps Script > coller ce fichier > Déployer > Application Web
 *   (Exécuter en tant que : moi ; Accès : Tout le monde) > copier l'URL
 *   dans le calculateur (onglet Suivi de run > Google Sheets).
 *
 * Colonnes remplies automatiquement : infos du Pokémon (zone, espèce, niveau,
 * statut, talent, nature, IV, objet, attaques…).
 * Colonnes à remplir à la main : « Mort contre » et l'onglet « Combats »
 * (lead + frags par combat). Les frags, leads et combats joués sont recalculés
 * par ce script (à chaque synchro et à chaque modification de « Combats »),
 * sans formule : la feuille marche quelle que soit sa langue.
 */

var SPLITS = ['Roxanne', 'Brawly', 'Wattson', 'Norman', 'Flannery', 'Winona', 'Tate & Liza', 'Steven', 'Victory Road', 'Ligue'];
var SHEET_POKEMON = 'Pokémon', SHEET_RUN = 'Run', SHEET_FIGHTS = 'Combats';
var AUTO_HEADERS = ['UID', '#', 'Zone', 'Pokémon', 'Nom', 'Niveau', 'Statut', 'Talent', 'Nature',
  'IV PV', 'IV Atq', 'IV Déf', 'IV AtS', 'IV DéS', 'IV Vit', 'Moy. IV', 'Type PC', 'Objet', 'Attaques', 'Nv capture'];
var MANUAL_HEADERS = ['Mort contre'];
var STAT_HEADERS = ['Frags', 'Leads', 'Combats'];
var SYNC_HEADER = 'Dernière synchro';
var COL = { uid: 1, order: 2, name: 5, status: 7, deathCause: 21, frags: 22, leads: 23, fights: 24, splits: 25 };
COL.sync = COL.splits + SPLITS.length; // colonne après les splits
var FIGHT_ROWS = 1000;
var STATUS_FR = { slp: 'Endormi', psn: 'Empoisonné', tox: 'Gravement empoisonné', brn: 'Brûlé', par: 'Paralysé', frz: 'Gelé', frb: 'Gelure' };
var STATUS = { team: 'Équipe', ko: 'K.O. (équipe)', box: 'Boîte', dead: 'Mort', gone: 'Absent' };

function headers_() { return AUTO_HEADERS.concat(MANUAL_HEADERS, STAT_HEADERS, SPLITS, [SYNC_HEADER]); }

// ---------------------------------------------------------------- Web App
function doPost(e) {
  var payload;
  try { payload = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'JSON invalide' }); }
  var problem = validatePayload(payload);
  if (problem) return json_({ ok: false, error: problem });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var result = applyPayload(SpreadsheetApp.getActiveSpreadsheet(), payload, new Date());
    PropertiesService.getScriptProperties().setProperty('lastSync', JSON.stringify({ at: new Date().toISOString(), rows: result.rows }));
    return json_({ ok: true, rows: result.rows });
  } finally { lock.releaseLock(); }
}

// Vérification de connexion depuis le calculateur (JSONP).
function doGet(e) {
  var info = PropertiesService.getScriptProperties().getProperty('lastSync') || '{}';
  var cb = e && e.parameter && e.parameter.callback;
  var body = '{"ok":true,"lastSync":' + info + '}';
  if (cb && /^[A-Za-z_$][\w$.]{0,60}$/.test(cb))
    return ContentService.createTextOutput(cb + '(' + body + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Null Run').addItem('Créer / réparer la mise en page', 'setupSheets').addToUi();
}
function setupSheets() { ensureStructure(SpreadsheetApp.getActiveSpreadsheet()); }

// ------------------------------------------------------------ Logique pure
function validatePayload(p) {
  if (!p || p.kind !== 'null-run' || !p.data) return 'Données non reconnues';
  var d = p.data;
  if (!Array.isArray(d.party) || !Array.isArray(d.box) || !Array.isArray(d.dead)) return 'Équipe/boîtes manquantes';
  if (d.party.length > 6) return 'Équipe invalide';
  return '';
}

function displayName(mon) { return mon.nickname && String(mon.nickname).trim() ? String(mon.nickname).trim() : mon.species; }

function autoValues(mon, state) {
  var iv = mon.ivs || {};
  var list = [iv.hp, iv.atk, iv.def, iv.spa, iv.spd, iv.spe];
  var avg = list.every(function(v) { return typeof v === 'number'; }) ? Math.round(list.reduce(function(a, b) { return a + b; }, 0) / 6 * 10) / 10 : '';
  return [mon.uid, null, mon.metLocation || '', mon.species, displayName(mon), mon.level || '', STATUS[state],
    mon.ability || '', mon.nature || '', iv.hp, iv.atk, iv.def, iv.spa, iv.spd, iv.spe, avg, mon.hiddenPower || '',
    mon.item || '', (mon.moves || []).map(function(m) { return m.name === 'Hidden Power' && mon.hiddenPower ? 'Hidden Power ' + mon.hiddenPower : m.name; }).join(', '),
    mon.metLevel || ''].map(function(v) { return v === undefined || v === null ? '' : v; });
}

function colLetter(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

// Stats calculées à partir de l'onglet Combats (aucune formule : pas de souci de
// séparateur « , » / « ; » selon la langue de la feuille).
// rows : lignes de Combats sans l'en-tête [Dresseur, Split, Lead, Frags, P2, Frags, …].
function computeStats(rows) {
  var stats = {};
  function get(name) {
    if (!stats[name]) { stats[name] = { frags: 0, leads: 0, fights: 0, splits: {} }; SPLITS.forEach(function(sp) { stats[name].splits[sp] = 0; }); }
    return stats[name];
  }
  rows.forEach(function(r) {
    var split = String(r[1] || '').trim(), seen = {};
    for (var c = 2; c <= 12; c += 2) {
      var name = String(r[c] || '').trim();
      if (!name) continue;
      var st = get(name), n = Number(String(r[c + 1]).replace(',', '.'));
      if (!isFinite(n) || n < 0 || String(r[c + 1]).trim() === '') n = 0;
      if (!seen[name]) { st.fights += 1; seen[name] = true; }
      if (c === 2) st.leads += 1;
      st.frags += n;
      if (st.splits.hasOwnProperty(split)) st.splits[split] += n;
    }
  });
  return stats;
}

/**
 * Calcule les écritures à faire dans l'onglet Pokémon.
 * existing : lignes actuelles (sans l'en-tête), au moins jusqu'à la colonne UID.
 * Retour : { updates: [{row, values}], appends: [{row, values}] }
 * Seules les colonnes automatiques (UID → Nv capture) et « Dernière synchro »
 * sont écrites : les colonnes manuelles ne sont jamais touchées.
 */
function planPokemonRows(existing, payload, stamp) {
  var d = payload.data, byUid = {}, seen = {}, updates = [], appends = [], next = 0;
  existing.forEach(function(r, i) {
    if (r[0]) byUid[r[0]] = i;
    var order = Number(r[COL.order - 1]); if (order > next) next = order;
  });
  var mons = [];
  d.party.forEach(function(m) { mons.push([m, m.hp === 0 ? 'ko' : 'team']); });
  d.box.forEach(function(m) { mons.push([m, 'box']); });
  d.dead.forEach(function(m) { mons.push([m, 'dead']); });
  var lastRow = existing.length + 1;
  mons.forEach(function(pair) {
    var mon = pair[0], vals = autoValues(mon, pair[1]);
    if (!mon.uid || seen[mon.uid]) return;
    seen[mon.uid] = true;
    if (byUid.hasOwnProperty(mon.uid)) {
      var i = byUid[mon.uid];
      vals[COL.order - 1] = existing[i][COL.order - 1];
      if (vals.map(String).join('\u0001') === existing[i].slice(0, vals.length).map(String).join('\u0001')) return; // inchangé
      updates.push({ row: i + 2, values: vals, stamp: stamp });
    } else {
      next += 1; lastRow += 1;
      vals[COL.order - 1] = next;
      appends.push({ row: lastRow, values: vals, stamp: stamp });
    }
  });
  // Un Pokémon qui n'apparaît plus nulle part (relâché, échangé) reste listé, marqué « Absent ».
  existing.forEach(function(r, i) {
    if (r[0] && !seen[r[0]] && r[COL.status - 1] !== STATUS.gone && r[COL.status - 1] !== STATUS.dead) {
      var vals = r.slice(0, AUTO_HEADERS.length); vals[COL.status - 1] = STATUS.gone;
      updates.push({ row: i + 2, values: vals, stamp: stamp });
    }
  });
  return { updates: updates, appends: appends };
}

function runSummary(payload) {
  var d = payload.data, b = payload.bosses || {};
  return [
    ['Dernière synchro', ''],
    ['Pokémon en équipe', d.party.length],
    ['K.O. dans l\'équipe', d.party.filter(function(m) { return m.hp === 0; }).length],
    ['En boîte', d.box.length],
    ['Morts', d.dead.length],
    ['Niveau max (équipe)', d.party.reduce(function(m, p) { return Math.max(m, p.level || 0); }, 0)],
    ['Level cap', b.cap || ''],
    ['Prochain boss', b.next || 'Tous battus'],
    ['Boss battus', (b.beaten || []).length]
  ];
}

function teamRows(payload) {
  var rows = payload.data.party.map(function(m) {
    return [m.slot, displayName(m), m.species, m.level, m.hp + ' / ' + m.maxHP, m.hp === 0 ? 'K.O.' : (STATUS_FR[m.status] || 'OK'),
      m.item || '', m.ability || '', (m.moves || []).map(function(x) { return x.name; }).join(', ')];
  });
  while (rows.length < 6) rows.push(['', '', '', '', '', '', '', '', '']);
  return rows;
}

// ------------------------------------------------------------- Écriture
function sheet_(ss, name) { return ss.getSheetByName(name) || ss.insertSheet(name); }
function tryFormat_(fn) { try { fn(); } catch (e) {} }

function ensureStructure(ss) {
  var pk = sheet_(ss, SHEET_POKEMON), h = headers_();
  var current = pk.getRange(1, 1, 1, h.length).getValues()[0];
  if (current.join('|') !== h.join('|')) pk.getRange(1, 1, 1, h.length).setValues([h]);
  tryFormat_(function() {
    pk.setFrozenRows(1); pk.setFrozenColumns(COL.name);
    pk.getRange(1, 1, 1, h.length).setFontWeight('bold').setBackground('#232e51').setFontColor('#ffffff');
    pk.getRange(1, COL.deathCause, 1, 1).setBackground('#7a4b00');
    pk.hideColumns(COL.uid);
  });

  var fights = sheet_(ss, SHEET_FIGHTS);
  var fh = ['Dresseur', 'Split', 'Lead', 'Frags', 'Pokémon 2', 'Frags', 'Pokémon 3', 'Frags', 'Pokémon 4', 'Frags', 'Pokémon 5', 'Frags', 'Pokémon 6', 'Frags', 'Notes'];
  if (fights.getRange(1, 1, 1, fh.length).getValues()[0].join('|') !== fh.join('|')) fights.getRange(1, 1, 1, fh.length).setValues([fh]);
  tryFormat_(function() {
    fights.setFrozenRows(1);
    fights.getRange(1, 1, 1, fh.length).setFontWeight('bold').setBackground('#232e51').setFontColor('#ffffff');
    var splitRule = SpreadsheetApp.newDataValidation().requireValueInList(SPLITS, true).setAllowInvalid(false).build();
    fights.getRange(2, 2, FIGHT_ROWS, 1).setDataValidation(splitRule);
    var names = SpreadsheetApp.newDataValidation().requireValueInRange(pk.getRange(colLetter(COL.name) + '2:' + colLetter(COL.name)), true).setAllowInvalid(true).build();
    [3, 5, 7, 9, 11, 13].forEach(function(c) { fights.getRange(2, c, FIGHT_ROWS, 1).setDataValidation(names); });
  });

  var run = sheet_(ss, SHEET_RUN);
  if (run.getRange(1, 1).getValue() !== 'Run Pokémon Null') {
    run.getRange(1, 1).setValue('Run Pokémon Null');
    run.getRange(2, 1, 1, 2).setValues([['Tentative n°', 1]]);
    run.getRange(3, 4).setValue('Équipe actuelle');
    run.getRange(4, 4, 1, 9).setValues([['Slot', 'Nom', 'Pokémon', 'Niv.', 'PV', 'Statut', 'Objet', 'Talent', 'Attaques']]);
    run.getRange(15, 1).setValue('Top frags');
    run.getRange(15, 8).setValue('Cimetière');
    run.getRange(15, 14).setValue('Frags par split');
    tryFormat_(function() {
      run.getRange(1, 1).setFontSize(16).setFontWeight('bold');
      [run.getRange(3, 4), run.getRange(15, 1), run.getRange(15, 8), run.getRange(15, 14)].forEach(function(r) { r.setFontWeight('bold').setFontSize(12); });
      [run.getRange(4, 4, 1, 9), run.getRange(16, 1, 1, 6), run.getRange(16, 8, 1, 5), run.getRange(16, 14, 1, 2)].forEach(function(r) {
        r.setFontWeight('bold').setBackground('#232e51').setFontColor('#ffffff');
      });
      run.setColumnWidth(12, 320);
    });
  }
  tryFormat_(function() { ss.setActiveSheet(run); ss.moveActiveSheet(1); });
  return { pokemon: pk, fights: fights, run: run };
}

function block_(rows, width, height, empty) {
  var out = rows.slice(0, height).map(function(r) { return r.slice(0, width); });
  if (!rows.length && empty) out.push([empty].concat(Array(width - 1).fill('')));
  while (out.length < height) out.push(Array(width).fill(''));
  return out;
}

// Tableaux du Run calculés en JS (classement, cimetière, frags par split).
function runTables(pokemonRows, stats) {
  var C = COL, top = [], dead = [], perSplit = SPLITS.map(function(sp) { return [sp, 0]; });
  pokemonRows.forEach(function(r) {
    var name = String(r[C.name - 1] || ''), st = stats[name];
    if (!name) return;
    if (st && st.frags > 0) top.push([name, r[3], st.frags, st.leads, st.fights, r[C.status - 1]]);
    if (r[C.status - 1] === STATUS.dead) dead.push([name, r[3], r[5], r[2], r[C.deathCause - 1]]);
  });
  Object.keys(stats).forEach(function(name) {
    SPLITS.forEach(function(sp, i) { perSplit[i][1] += stats[name].splits[sp]; });
  });
  top.sort(function(a, b) { return b[2] - a[2] || b[3] - a[3]; });
  return {
    top: [['Nom', 'Pokémon', 'Frags', 'Leads', 'Combats', 'Statut']].concat(block_(top, 6, 15, 'Aucun frag pour l\'instant')),
    dead: [['Nom', 'Pokémon', 'Niv.', 'Zone', 'Mort contre']].concat(block_(dead, 5, 60, 'Aucun mort')),
    splits: [['Split', 'Frags']].concat(perSplit)
  };
}

// Recalcule frags / leads / combats (onglet Pokémon) et les tableaux du Run.
function refreshStats(ss, s) {
  s = s || { pokemon: ss.getSheetByName(SHEET_POKEMON), fights: ss.getSheetByName(SHEET_FIGHTS), run: ss.getSheetByName(SHEET_RUN) };
  if (!s.pokemon || !s.fights || !s.run) return;
  var fl = s.fights.getLastRow();
  var stats = computeStats(fl > 1 ? s.fights.getRange(2, 1, fl - 1, 14).getValues() : []);
  var last = s.pokemon.getLastRow();
  if (last > 1) {
    var rows = s.pokemon.getRange(2, 1, last - 1, COL.deathCause).getValues();
    var statValues = rows.map(function(r) {
      var st = stats[String(r[COL.name - 1] || '').trim()];
      if (!r[COL.name - 1]) return Array(3 + SPLITS.length).fill('');
      if (!st) return [0, 0, 0].concat(SPLITS.map(function() { return 0; }));
      return [st.frags, st.leads, st.fights].concat(SPLITS.map(function(sp) { return st.splits[sp]; }));
    });
    s.pokemon.getRange(2, COL.frags, statValues.length, statValues[0].length).setValues(statValues);
  } else rows = [];
  var t = runTables(rows, stats);
  s.run.getRange(16, 1, t.top.length, 6).setValues(t.top);
  s.run.getRange(16, 8, t.dead.length, 5).setValues(t.dead);
  s.run.getRange(16, 14, t.splits.length, 2).setValues(t.splits);
}

// Recalcul automatique quand tu modifies Combats ou « Mort contre ».
function onEdit(e) {
  var sh = e && e.range && e.range.getSheet();
  if (!sh) return;
  var name = sh.getName();
  if (name === SHEET_FIGHTS || (name === SHEET_POKEMON && e.range.getColumn() <= COL.deathCause && e.range.getLastColumn() >= COL.deathCause))
    refreshStats(e.source);
}

function applyPayload(ss, payload, now) {
  var s = ensureStructure(ss), pk = s.pokemon;
  var stamp = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  var last = pk.getLastRow();
  var existing = last > 1 ? pk.getRange(2, 1, last - 1, AUTO_HEADERS.length).getValues() : [];
  var plan = planPokemonRows(existing, payload, stamp);
  plan.updates.concat(plan.appends).forEach(function(u) {
    pk.getRange(u.row, 1, 1, u.values.length).setValues([u.values]);
    pk.getRange(u.row, COL.sync).setValue(u.stamp);
  });
  var summary = runSummary(payload); summary[0][1] = stamp;
  s.run.getRange(3, 1, summary.length, 2).setValues(summary);
  s.run.getRange(5, 4, 6, 9).setValues(teamRows(payload));
  refreshStats(ss, s);
  return { rows: plan.updates.length + plan.appends.length };
}

// Export pour les tests Node (sans effet dans Apps Script).
if (typeof module !== 'undefined') module.exports = { planPokemonRows: planPokemonRows, computeStats: computeStats, runTables: runTables, validatePayload: validatePayload,
  runSummary: runSummary, teamRows: teamRows, applyPayload: applyPayload, ensureStructure: ensureStructure, refreshStats: refreshStats,
  headers_: headers_, COL: COL, colLetter: colLetter, SPLITS: SPLITS };
