/**
 * Pokémon Null — Suivi de run automatique (Google Sheets) — v2
 * ============================================================
 * • Reçoit la run envoyée par le calculateur (onglet « Suivi de run »).
 * • Importe et met à jour chaque semaine les données OFFICIELLES de Null
 *   (rencontres + taux, objets, dresseurs) depuis le Drive du jeu.
 * • Calcule tout seul : zones déjà capturées, espèces déjà possédées,
 *   dresseurs battus, prochain dresseur, frags / leads / combats.
 *
 * Installation : google-sheets/INSTALLATION.md
 * Aucune formule n'est utilisée : la feuille marche quelle que soit sa langue.
 */

// ------------------------------------------------------------ Paramètres
var SOURCES = {
  encounters: '1EdJf2JRe5dLPEX1vWmbeRFeCIh-7hgos-t52JQd1Xb8',  // Pokémon Locations (officiel)
  items: '1ForxCI9BczgfLYHEOTd-3Cg4tEa3Nn_VNk5nx-OLedo',       // Item Locations (officiel)
  trainers: '1mwHPt0AMzOJ_hfmDrVZpKP-Hf4eTT0ROhY8Wa7bY7r8'     // Trainer Battles (officiel)
};
var TRAINER_SHEETS = [['Roxanne Split', 'Roxanne'], ['Brawly Split', 'Brawly'], ['Wattson Split', 'Wattson'], ['Norman Split', 'Norman'],
  ['Flannery Split', 'Flannery'], ['Winona Split', 'Winona'], ['Tate&Liza Split', 'Tate & Liza'], ['Steven Split', 'Steven'],
  ['Victory Road Split', 'Victory Road'], ['Pokémon League', 'Ligue'], ['Other', 'Autres']];
var SPLITS = TRAINER_SHEETS.map(function(t) { return t[1]; });
var SHEETS = { run: '🏠 Run', pokemon: '🐾 Pokémon', fights: '⚔️ Combats', encounters: '🌿 Rencontres', trainers: '🎯 Dresseurs', items: '🎒 Objets', archive: '📦 Archives' };
var LEGACY_NAMES = { 'Run': 'run', 'Pokémon': 'pokemon', 'Combats': 'fights' };

var AUTO_HEADERS = ['UID', '#', 'Zone', 'Pokémon', 'Nom', 'Niveau', 'Statut', 'Talent', 'Nature',
  'IV PV', 'IV Atq', 'IV Déf', 'IV AtS', 'IV DéS', 'IV Vit', 'Moy. IV', 'Type PC', 'Objet', 'Attaques', 'Nv capture'];
var MANUAL_HEADERS = ['Mort contre'];
var STAT_HEADERS = ['Frags', 'Leads', 'Combats'];
var SYNC_HEADER = 'Dernière synchro';
var COL = { uid: 1, order: 2, zone: 3, species: 4, name: 5, level: 6, status: 7, deathCause: 21, frags: 22, leads: 23, fights: 24, splits: 25 };
COL.sync = COL.splits + SPLITS.length;
var FIGHT_ROWS = 1000;
var FIGHT_HEADERS = ['Dresseur', 'Split', 'Lead', 'Frags', 'Pokémon 2', 'Frags', 'Pokémon 3', 'Frags', 'Pokémon 4', 'Frags', 'Pokémon 5', 'Frags', 'Pokémon 6', 'Frags', 'Notes'];
var ENC_HEADERS = ['Zone', 'Zone Nuzlocke', 'Méthode', 'Pokémon', 'Niveau', 'Taux', 'Ma capture', 'Espèce déjà capturée'];
var TRAINER_HEADERS = ['Split', 'Lieu', 'Dresseur', '#', 'Pokémon', 'Niv.', 'Objet', 'Talent', 'Nature', 'Attaques', 'Battu', 'Niv. max'];
var ITEM_HEADERS = ['Catégorie', 'Objet', 'Lieu / info', 'Récupéré'];
var ARCHIVE_HEADERS = ['Tentative', 'Fin de la run', 'Nom', 'Pokémon', 'Zone', 'Niveau', 'Statut', 'Frags', 'Leads', 'Combats', 'Mort contre'];
var STATUS_FR = { slp: 'Endormi', psn: 'Empoisonné', tox: 'Gravement empoisonné', brn: 'Brûlé', par: 'Paralysé', frz: 'Gelé', frb: 'Gelure' };
var STATUS = { team: 'Équipe', ko: 'K.O. (équipe)', box: 'Boîte', dead: 'Mort', gone: 'Absent' };
var METHODS_FR = { 'Land': 'Herbes', 'Fishing': 'Pêche', 'Surf': 'Surf', 'Rock Smash': 'Éclate-Roc', 'Other': 'Spécial' };
// Noms de zones du jeu (MAPSEC, d'après le Lua officiel) : une rencontre par zone en Nuzlocke.
var MAPSECS = ['Littleroot Town', 'Oldale Town', 'Dewford Town', 'Lavaridge Town', 'Fallarbor Town', 'Verdanturf Town', 'Pacifidlog Town',
  'Petalburg City', 'Slateport City', 'Mauville City', 'Rustboro City', 'Fortree City', 'Lilycove City', 'Mossdeep City', 'Sootopolis City',
  'Ever Grande City', 'Granite Cave', 'Mt. Chimney', 'Safari Zone', 'Battle Frontier', 'Petalburg Woods', 'Rusturf Tunnel', 'Abandoned Ship',
  'New Mauville', 'Meteor Falls', 'Mt. Pyre', 'Shoal Cave', 'Seafloor Cavern', 'Victory Road', 'Mirage Island', 'Cave of Origin',
  'Southern Island', 'Fiery Path', 'Jagged Pass', 'Sealed Chamber', 'Scorched Slab', 'Island Cave', 'Icicle Cave', 'Desert Ruins',
  'Ancient Tomb', 'Sky Pillar', 'Aqua Hideout', 'Magma Hideout', 'Mirage Tower', 'Birth Island', 'Faraway Island', 'Artisan Cave',
  'Marine Cave', 'Land Cave', 'Desert Underpass', 'Altering Cave', 'Navel Rock', 'Trainer Hill', 'Littleroot Grove', 'Oldale Grove',
  'Petalburg Grove', 'Verdanturf Tunnel', 'Verdanturf Grotto', 'Altering Grove', 'Route 102 Grove', 'Rustboro Grove'];
for (var r_ = 101; r_ <= 134; r_++) MAPSECS.push('Route ' + r_);

// Palette (reprend les couleurs du calculateur)
var C_ = { navy: '#1f2a44', navy2: '#2c3a5e', gold: '#f2c14e', white: '#ffffff', ink: '#1b1f2a', muted: '#6b7280',
  band1: '#ffffff', band2: '#f3f5fa', green: '#d8f3e0', greenInk: '#17663a', red: '#f9d6d9', redInk: '#9b1c2c',
  orange: '#fde7c8', orangeInk: '#8a4b00', blue: '#dbe8ff', blueInk: '#1d4ea8', grey: '#e5e7eb', manual: '#fff4d6', beaten: '#eef7f0' };

function headers_() { return AUTO_HEADERS.concat(MANUAL_HEADERS, STAT_HEADERS, SPLITS, [SYNC_HEADER]); }

// ---------------------------------------------------------------- Web App
function doPost(e) {
  var payload;
  try { payload = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'JSON invalide' }); }
  var problem = validatePayload(payload);
  if (problem) return json_({ ok: false, error: problem });
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
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
  SpreadsheetApp.getUi().createMenu('⚡ Null Run')
    .addItem('Installer / tout mettre à jour', 'setupAll')
    .addItem('Réimporter les données officielles', 'importReferenceMenu')
    .addItem('Recalculer les stats', 'refreshAllMenu')
    .addToUi();
}
function setupAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ensureStructure(ss), log = importReference(ss, s);
  refreshAll(ss, s);
  installWeeklyTrigger_();
  ss.toast('Feuille prête (' + log.join(', ') + '). Mise à jour des données officielles chaque lundi.', 'Null Run', 10);
}
function importReferenceMenu() { var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ensureStructure(ss), log = importReference(ss, s); refreshAll(ss, s); ss.toast(log.join(', '), 'Null Run', 6); }
function refreshAllMenu() { refreshAll(SpreadsheetApp.getActiveSpreadsheet(), null, null, true); }
function weeklyRefresh() { var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ensureStructure(ss); importReference(ss, s); refreshAll(ss, s); }
function installWeeklyTrigger_() {
  var exists = ScriptApp.getProjectTriggers().some(function(t) { return t.getHandlerFunction() === 'weeklyRefresh'; });
  if (!exists) ScriptApp.newTrigger('weeklyRefresh').timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create();
}

// Recalcul automatique quand tu modifies Combats ou « Mort contre ».
function onEdit(e) {
  var sh = e && e.range && e.range.getSheet();
  if (!sh) return;
  var name = sh.getName(), ss = e.source;
  if (name === SHEETS.fights) {
    var s = sheets_(ss);
    refreshAll(ss, s, null, false);
  } else if (name === SHEETS.pokemon && e.range.getColumn() <= COL.deathCause && e.range.getLastColumn() >= COL.deathCause) refreshAll(ss, null, null, false);
}

// =================================================================== LOGIQUE PURE
function validatePayload(p) {
  if (!p || p.kind !== 'null-run' || !p.data) return 'Données non reconnues';
  var d = p.data;
  if (!Array.isArray(d.party) || !Array.isArray(d.box) || !Array.isArray(d.dead)) return 'Équipe/boîtes manquantes';
  if (d.party.length > 6) return 'Équipe invalide';
  return '';
}
function str_(v) { return v === undefined || v === null ? '' : String(v).trim(); }
function displayName(mon) { return mon.nickname && String(mon.nickname).trim() ? String(mon.nickname).trim() : mon.species; }
function colLetter(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function key_(s) { return str_(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function fill_(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }

function autoValues(mon, state) {
  var iv = mon.ivs || {};
  var list = [iv.hp, iv.atk, iv.def, iv.spa, iv.spd, iv.spe];
  var avg = list.every(function(v) { return typeof v === 'number'; }) ? Math.round(list.reduce(function(a, b) { return a + b; }, 0) / 6 * 10) / 10 : '';
  return [mon.uid, null, mon.metLocation || '', mon.species, displayName(mon), mon.level || '', STATUS[state],
    mon.ability || '', mon.nature || '', iv.hp, iv.atk, iv.def, iv.spa, iv.spd, iv.spe, avg, mon.hiddenPower || '',
    mon.item || '', (mon.moves || []).map(function(m) { return m.name === 'Hidden Power' && mon.hiddenPower ? 'Hidden Power ' + mon.hiddenPower : m.name; }).join(', '),
    mon.metLevel || ''].map(function(v) { return v === undefined || v === null ? '' : v; });
}

/** Lignes de l'onglet Pokémon : mises à jour sur place, ajouts, « Absent ». Colonnes manuelles jamais écrites. */
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
      if (vals.map(String).join('\u0001') === existing[i].slice(0, vals.length).map(String).join('\u0001')) return;
      updates.push({ row: i + 2, values: vals, stamp: stamp });
    } else {
      next += 1; lastRow += 1;
      vals[COL.order - 1] = next;
      appends.push({ row: lastRow, values: vals, stamp: stamp });
    }
  });
  existing.forEach(function(r, i) {
    if (r[0] && !seen[r[0]] && r[COL.status - 1] !== STATUS.gone && r[COL.status - 1] !== STATUS.dead) {
      var vals = r.slice(0, AUTO_HEADERS.length); vals[COL.status - 1] = STATUS.gone;
      updates.push({ row: i + 2, values: vals, stamp: stamp });
    }
  });
  return { updates: updates, appends: appends };
}

/** Frags / leads / combats par nom, à partir des lignes de l'onglet Combats. */
function computeStats(rows) {
  var stats = {};
  function get(name) {
    if (!stats[name]) { stats[name] = { frags: 0, leads: 0, fights: 0, splits: {} }; SPLITS.forEach(function(sp) { stats[name].splits[sp] = 0; }); }
    return stats[name];
  }
  rows.forEach(function(r) {
    var split = str_(r[1]), seen = {};
    for (var c = 2; c <= 12; c += 2) {
      var name = str_(r[c]);
      if (!name) continue;
      var st = get(name), raw = str_(r[c + 1]), n = Number(raw.replace(',', '.'));
      if (!raw || !isFinite(n) || n < 0) n = 0;
      if (!seen[name]) { st.fights += 1; seen[name] = true; }
      if (c === 2) st.leads += 1;
      st.frags += n;
      if (st.splits.hasOwnProperty(split)) st.splits[split] += n;
    }
  });
  return stats;
}

// ---------------------------------------------------------------- Rencontres
/** Zone de la carte → zone Nuzlocke (nom de zone du jeu, comme le lieu de capture). */
function mapsecFor(zone) {
  var z = str_(zone), lower = z.toLowerCase();
  var under = z.match(/^(Route \d+) Underwater$/i);
  if (under) return 'Underwater (' + under[1] + ')';
  var best = '';
  MAPSECS.forEach(function(m) {
    var ml = m.toLowerCase();
    if ((lower === ml || lower.indexOf(ml + ' ') === 0 || lower.indexOf(ml + '(') === 0) && m.length > best.length) best = m;
  });
  return best || z;
}

/** Tableau officiel (zones en colonnes Level/Pokémon, méthodes en lignes) → lignes. */
function parseEncounterGrid(values) {
  if (!values || values.length < 3) return [];
  var head = values[0] || [], sub = values[1] || [], pairs = [];
  for (var c = 0; c < sub.length - 1; c++) {
    if (str_(sub[c]) === 'Level' && str_(sub[c + 1]) === 'Pokémon') {
      var zone = str_(head[c]) || str_(head[c + 1]) || str_(head[c - 1]);
      if (zone) pairs.push({ c: c, zone: zone });
    }
  }
  var method = '', acc = {}, order = [];
  for (var r = 2; r < values.length; r++) {
    var row = values[r] || [], label = str_(row[0]);
    if (label) method = label;
    if (!method) continue;
    var rate = parseFloat(str_(row[1]).replace('%', '').replace(',', '.'));
    pairs.forEach(function(p) {
      var species = str_(row[p.c + 1]), level = str_(row[p.c]);
      if (!species) return;
      var special = method === 'Other' || !isFinite(rate);
      var m = METHODS_FR[method] || method, k = p.zone + '|' + m + '|' + species;
      if (!acc[k]) { acc[k] = { zone: p.zone, method: m, species: species, levels: [], rate: special ? '' : 0 }; order.push(k); }
      if (!special && acc[k].rate !== '') acc[k].rate += rate;
      var lv = Number(level); if (level && isFinite(lv) && lv > 0) acc[k].levels.push(lv);
    });
  }
  return order.map(function(k) {
    var e = acc[k], lv = e.levels, lo = lv.length ? Math.min.apply(null, lv) : 0, hi = lv.length ? Math.max.apply(null, lv) : 0;
    return { zone: e.zone, method: e.method, species: e.species, level: lv.length ? (lo === hi ? String(lo) : lo + '-' + hi) : '',
      rate: e.rate === '' ? '' : Math.round(e.rate * 100) / 100 };
  });
}

/** Onglet « Special Encounters » (échanges, cadeaux, casino). */
function parseSpecialEncounters(values) {
  var out = [], section = '';
  (values || []).forEach(function(row) {
    var a = str_(row[0]), b = str_(row[1]), c = str_(row[2]);
    if (!a && !b) return;
    if (a && !b && !c) { section = a; return; }
    if (/^(Wanted Pokémon|Location|Pool)$/.test(a)) return;
    if (/^Trades/i.test(section)) out.push({ zone: b, method: 'Échange', species: c + (a ? ' (contre ' + a + ')' : ''), level: '', rate: '' });
    else if (/^Game Corner/i.test(section)) out.push({ zone: 'Game Corner — ' + a, method: 'Casino', species: b, level: '', rate: '' });
    else out.push({ zone: a, method: 'Cadeau / fixe', species: b, level: '', rate: '' });
  });
  return out;
}

/** « Ma capture » et « Espèce déjà capturée » pour chaque ligne de rencontre. */
function encounterStatus(encounters, pokemonRows) {
  var byZone = {}, species = {};
  pokemonRows.forEach(function(r) {
    var name = str_(r[COL.name - 1]); if (!name) return;
    var sp = str_(r[COL.species - 1]), status = str_(r[COL.status - 1]);
    species[key_(sp)] = true;
    var z = mapsecFor(r[COL.zone - 1]);
    (byZone[z] = byZone[z] || []).push((status === STATUS.dead ? '✝ ' : '✔ ') + name + (name !== sp ? ' (' + sp + ')' : ''));
  });
  return encounters.map(function(e) {
    var z = e.nuzlocke || mapsecFor(e.zone);
    var base = str_(e.species).replace(/ \(contre .*\)$/, '');
    return [(byZone[z] || []).join(', '), species[key_(base)] ? 'Oui' : ''];
  });
}

// ---------------------------------------------------------------- Dresseurs
var TRAINER_KEYS = ['Name', 'Pokémon', 'Level', 'Held Item', 'Ability', 'Nature', 'Moves'];
/** Onglet « X Split » officiel (blocs verticaux) → dresseurs. */
function parseTrainerSheet(values, split) {
  var out = [], area = '', cur = null, mode = null, moveRows = 0, slots = [];
  function set(field, rest) { rest.forEach(function(v, i) { if (slots[i]) slots[i][field] = v; }); }
  function setSpecies(rest) {
    if (!cur) return;
    slots = rest.map(function(s) { return s && s !== 'None' ? { species: s, level: '', item: '', ability: '', nature: '', moves: [] } : null; });
    cur.mons = slots.filter(Boolean);
  }
  function addMoves(rest) { rest.forEach(function(v, i) { if (slots[i] && v && v !== 'None') slots[i].moves.push(v); }); }
  (values || []).forEach(function(row) {
    var a = str_(row[0]), rest = [1, 2, 3, 4, 5, 6].map(function(i) { return str_(row[i]); }), any = rest.some(Boolean);
    if (a === 'Name') { cur = { split: split, area: area, name: rest[0], mons: [] }; out.push(cur); slots = []; mode = null; return; }
    if (a === 'Pokémon') { mode = 'species'; if (any) { setSpecies(rest); mode = null; } return; }
    if (mode === 'species' && !a) { setSpecies(rest); mode = null; return; }
    if (a === 'Level') { set('level', rest); mode = null; return; }
    if (a === 'Held Item') { set('item', rest); mode = null; return; }
    if (a === 'Ability') { set('ability', rest); mode = null; return; }
    if (a === 'Nature') { set('nature', rest); mode = null; return; }
    if (a === 'Moves') { mode = 'moves'; moveRows = 1; addMoves(rest); return; }
    if (mode === 'moves' && !a && any && moveRows < 4) { addMoves(rest); moveRows++; return; }
    if (a && TRAINER_KEYS.indexOf(a) < 0 && !any) { area = a; mode = null; return; }
    if (!a && !any) mode = null;
  });
  out.forEach(function(t) { t.mons.forEach(function(m) { if (m.item === 'None') m.item = ''; if (m.ability === 'None') m.ability = ''; }); });
  return out.filter(function(t) { return t.name; });
}

// Boss et level caps (« Mechanic Changes », doc officielle). Root Academy : noms des dresseurs du jeu.
var BOSS_CAPS = [['Youngster Ren', 13, 'exact'], ['Youngster Levi', 19, 'exact'], ['Lass Videl', 25, 'exact'], ['Youngster Itachi', 29, 'exact'],
  ['Roxanne', 38], ['Brawly', 45], ['Glacia', 53, 'glacia1'], ['Wattson', 59], ['Norman', 66], ['Flannery', 72], ['Winona', 77],
  ['Maxie', 82], ['Tate', 86], ['Archie', 91], ['Steven', 95], ['Glacia', 99, 'glacia2'], ['Wallace', 100]];

/** Level cap déduit des combats saisis : cap du premier boss pas encore battu. */
function capFromFights(foughtNames) {
  var keys = foughtNames.map(key_), glacia = foughtNames.filter(function(n) { return /glacia/i.test(n); });
  var beaten = BOSS_CAPS.map(function(b) {
    if (b[2] === 'exact') return keys.indexOf(key_(b[0])) >= 0;
    if (b[2] === 'glacia1') return glacia.length >= 1;
    if (b[2] === 'glacia2') return glacia.length >= 2;
    return keys.some(function(k) { return k.indexOf(key_(b[0])) >= 0; });
  });
  var any = beaten.some(Boolean), i = beaten.indexOf(false), lastIdx = beaten.lastIndexOf(true);
  return { any: any, beaten: beaten.filter(Boolean).length, cap: i < 0 ? 100 : BOSS_CAPS[i][1], next: i < 0 ? 'Tous battus' : BOSS_CAPS[i][0],
    last: lastIdx < 0 ? '' : BOSS_CAPS[lastIdx][0] };
}

function isBoss(name) { return /\b(Leader|Elite Four|Champion|Rival)\b|\[Boss\]/i.test(name); }

/** Lignes de l'onglet Dresseurs (une ligne par Pokémon adverse). */
function trainerRows(trainers, fought) {
  var rows = [];
  trainers.forEach(function(t) {
    var beaten = fought[key_(t.name)] ? '✔' : '';
    var maxLv = t.mons.reduce(function(m, x) { return Math.max(m, Number(x.level) || 0); }, 0) || '';
    var mons = t.mons.length ? t.mons : [null];
    mons.forEach(function(m, i) {
      rows.push([i ? '' : t.split, i ? '' : t.area, i ? '' : t.name, m ? i + 1 : '', m ? m.species : 'Équipe aléatoire (voir doc officiel)',
        m ? (Number(m.level) || m.level) : '', m ? m.item : '', m ? m.ability : '', m ? m.nature : '', m ? m.moves.join(', ') : '',
        i ? '' : beaten, i ? '' : maxLv]);
    });
  });
  return rows;
}

/** Relit l'onglet Dresseurs (liste ordonnée). */
function trainersFromRows(rows) {
  var out = [], cur = null;
  rows.forEach(function(r) {
    if (str_(r[2])) { cur = { split: str_(r[0]), area: str_(r[1]), name: str_(r[2]), maxLevel: 0, mons: [] }; out.push(cur); }
    if (cur && r[3] !== '' && str_(r[4])) { cur.mons.push(str_(r[4])); cur.maxLevel = Math.max(cur.maxLevel, Number(r[5]) || 0); }
  });
  return out;
}

/** Prochain dresseur : premier de la liste officielle pas encore dans Combats. */
function nextTrainer(trainers, fought) {
  for (var i = 0; i < trainers.length; i++) if (!fought[key_(trainers[i].name)]) return trainers[i];
  return null;
}

// ---------------------------------------------------------------- Objets
function parseItemSheet(name, values) {
  var out = [];
  function add(cat, item, loc) { item = str_(item); loc = str_(loc); if (item && !/^(Item|Berry|Move|Location|TRUE|FALSE)$/.test(item)) out.push([cat, item, loc]); }
  values = values || [];
  if (name === 'Held Items') values.forEach(function(r) { add('Objet tenu', r[1], r[2]); if (str_(r[4])) add('Baie', r[4], str_(r[5]) + (str_(r[6]) ? ' — quantité : ' + str_(r[6]) : '')); });
  else if (name === 'TM/HMs and Move Tutors') values.forEach(function(r) { add('CT / CS', r[1], r[2]); add('Tuteur', r[4], r[5]); });
  else if (name === 'Evolution Items') values.forEach(function(r) { if (/^All items/.test(str_(r[0]))) return; add('Objet d\'évolution', r[0], r[1]); });
  else if (name === 'Special') values.forEach(function(r) {
    add(/Memory$/.test(str_(r[1])) ? 'Mémoire' : 'Méga-gemme / spécial', r[1], r[2]);
    add(/Memory$/.test(str_(r[3])) ? 'Mémoire' : 'Méga-gemme / spécial', r[3], r[4]);
  });
  else if (name === 'Resources') {
    var right = 'Menthe';
    values.forEach(function(r) {
      if (/Heart Scale Locations/i.test(str_(r[0]))) return;
      if (str_(r[1]) && !/^(TRUE|FALSE)$/.test(str_(r[1]))) add('Écaille Cœur', 'Heart Scale', str_(r[1]) + (str_(r[2]) ? ' — ' + str_(r[2]) : ''));
      if (str_(r[3]) === 'Other') { right = 'Ressource'; return; }
      if (str_(r[4])) add(right, r[4], r[5]);
    });
  } else if (name === 'Other') {
    values.forEach(function(r) {
      if (!/^(League Shop|Item)$/.test(str_(r[0])) && str_(r[0])) add('Boutique de la Ligue', r[0], str_(r[1]) ? str_(r[1]) + ' Écailles Cœur' : '');
      if (str_(r[2]) && !/^(Wild Held Items|Item)$/.test(str_(r[2]))) add('Objet sauvage', r[2], str_(r[3]) + (str_(r[4]) ? ' — ' + str_(r[4]) : ''));
    });
  }
  return out;
}

// ---------------------------------------------------------------- Tableau de bord
function runSummary(payload) {
  var d = payload.data, b = payload.bosses || {};
  return {
    party: d.party.length, ko: d.party.filter(function(m) { return m.hp === 0; }).length, box: d.box.length, dead: d.dead.length,
    captures: d.party.length + d.box.length + d.dead.length,
    maxLevel: d.party.reduce(function(m, p) { return Math.max(m, p.level || 0); }, 0),
    cap: b.cap || '', nextBoss: b.next || 'Tous battus', beaten: (b.beaten || []).length
  };
}

function teamRows(payload) {
  var rows = payload.data.party.map(function(m) {
    var pct = m.maxHP ? Math.round(m.hp * 100 / m.maxHP) / 100 : 0;
    return [m.slot, displayName(m), m.species, m.level, m.hp + ' / ' + m.maxHP, pct, m.hp === 0 ? 'K.O.' : (STATUS_FR[m.status] || 'OK'),
      m.item || '', m.ability || '', (m.moves || []).map(function(x) { return x.name === 'Hidden Power' && m.hiddenPower ? 'Hidden Power ' + m.hiddenPower : x.name; }).join(', ')];
  });
  while (rows.length < 6) rows.push(fill_(10, ''));
  return rows;
}

function block_(rows, width, height, empty) {
  var out = rows.slice(0, height).map(function(r) { return r.slice(0, width); });
  if (!rows.length && empty) out.push([empty].concat(fill_(width - 1, '')));
  while (out.length < height) out.push(fill_(width, ''));
  return out;
}
function bar_(value, max) { if (!(value > 0)) return ''; var n = Math.max(1, Math.round(value / max * 12)); return new Array(n + 1).join('█'); }

function runTables(pokemonRows, stats) {
  var top = [], dead = [], perSplit = SPLITS.map(function(sp) { return [sp, 0]; });
  pokemonRows.forEach(function(r) {
    var name = str_(r[COL.name - 1]), st = stats[name];
    if (!name) return;
    if (st && st.frags > 0) top.push([name, r[3], st.frags, st.leads, st.fights]);
    if (r[COL.status - 1] === STATUS.dead) dead.push([name, r[3], r[5], r[2], r[COL.deathCause - 1]]);
  });
  Object.keys(stats).forEach(function(name) { SPLITS.forEach(function(sp, i) { perSplit[i][1] += stats[name].splits[sp]; }); });
  var max = Math.max.apply(null, perSplit.map(function(p) { return p[1]; }).concat([0]));
  top.sort(function(a, b) { return b[2] - a[2] || b[3] - a[3]; });
  top = top.map(function(r, i) { return [i < 3 ? ['🥇', '🥈', '🥉'][i] : '#' + (i + 1)].concat(r); });
  return {
    top: block_(top, 6, 15, 'Aucun frag pour l\'instant'),
    dead: block_(dead, 5, 15, 'Aucun mort 🎉'),
    splits: perSplit.map(function(p) { return [p[0], p[1], bar_(p[1], max)]; })
  };
}

// =================================================================== ÉCRITURE
var RUN = { title: 1, info: 2, kpiLabel: 4, kpiValue: 5, kpiSub: 6, teamTitle: 8, teamHead: 9, teamFirst: 10, tablesTitle: 17, tablesHead: 18, tablesFirst: 19 };
var KPIS = ['Équipe', 'Captures', 'Morts', 'Level cap', 'Prochain boss', 'Prochain dresseur'];

function sheets_(ss) {
  function get(key) {
    var name = SHEETS[key], sh = ss.getSheetByName(name);
    if (sh) return sh;
    for (var old in LEGACY_NAMES) if (LEGACY_NAMES[old] === key && ss.getSheetByName(old)) { sh = ss.getSheetByName(old); sh.setName(name); return sh; }
    return ss.insertSheet(name);
  }
  return { run: get('run'), pokemon: get('pokemon'), fights: get('fights'), encounters: get('encounters'), trainers: get('trainers'), items: get('items'), archive: get('archive') };
}
function tryFormat_(fn) { try { fn(); } catch (e) { if (typeof Logger !== 'undefined') Logger.log('Mise en forme ignorée : ' + e); } }

function ensureStructure(ss) {
  var s = sheets_(ss), created = false;
  [[s.pokemon, headers_()], [s.fights, FIGHT_HEADERS], [s.encounters, ENC_HEADERS], [s.trainers, TRAINER_HEADERS], [s.items, ITEM_HEADERS], [s.archive, ARCHIVE_HEADERS]].forEach(function(p) {
    var range = p[0].getRange(1, 1, 1, p[1].length);
    if (range.getValues()[0].join('|') !== p[1].join('|')) { range.setValues([p[1]]); created = true; }
  });
  var run = s.run;
  if (run.getRange(RUN.title, 1).getValue() !== 'POKÉMON NULL — SUIVI DE RUN') {
    created = true;
    var attempt = run.getRange(RUN.info, 1).getValue() === 'Tentative n°' ? run.getRange(RUN.info, 2).getValue() || 1 : 1;
    tryFormat_(function() { run.clear(); run.getRange(1, 1, run.getMaxRows(), run.getMaxColumns()).breakApart(); });
    run.getRange(RUN.title, 1).setValue('POKÉMON NULL — SUIVI DE RUN');
    run.getRange(RUN.info, 1, 1, 4).setValues([['Tentative n°', attempt, 'Dernière synchro', 'En attente du calculateur']]);
    KPIS.forEach(function(k, i) { run.getRange(RUN.kpiLabel, 1 + i * 2).setValue(k); });
    run.getRange(RUN.teamTitle, 1).setValue('⚔  Équipe actuelle');
    run.getRange(RUN.teamHead, 1, 1, 10).setValues([['Slot', 'Nom', 'Pokémon', 'Niv.', 'PV', 'PV %', 'Statut', 'Objet', 'Talent', 'Attaques']]);
    run.getRange(RUN.tablesTitle, 1, 1, 16).setValues([['🏆  Top frags', '', '', '', '', '', '', '✝  Morts', '', '', '', '', '', '📊  Frags par split', '', '']]);
    run.getRange(RUN.tablesHead, 1, 1, 16).setValues([['Rang', 'Nom', 'Pokémon', 'Frags', 'Leads', 'Combats', '', 'Nom', 'Pokémon', 'Niv.', 'Zone', 'Mort contre', '', 'Split', 'Frags', '']]);
  }
  // La mise en forme complète est appliquée à l'installation (ou si la page vient d'être créée).
  if (created || PropertiesService.getDocumentProperties().getProperty('styleVersion') !== '3') {
    tryFormat_(function() { styleAll_(ss, s); });
    PropertiesService.getDocumentProperties().setProperty('styleVersion', '3');
  }
  return s;
}

function header_(range) { range.setFontWeight('bold').setBackground(C_.navy).setFontColor(C_.white).setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(true); }
function rule_() { return SpreadsheetApp.newConditionalFormatRule(); }

function styleAll_(ss, s) {
  var tabs = { run: C_.gold, pokemon: '#22c55e', fights: '#ef4444', trainers: '#3b82f6', encounters: '#10b981', items: '#a855f7', archive: '#64748b' };
  ['run', 'pokemon', 'fights', 'trainers', 'encounters', 'items', 'archive'].forEach(function(k, i) {
    s[k].setTabColor(tabs[k]); ss.setActiveSheet(s[k]); ss.moveActiveSheet(i + 1);
  });
  ss.getSheets().forEach(function(sh) { if (sh.getName() === 'Feuille 1' || sh.getName() === 'Sheet1') { if (sh.getLastRow() === 0) ss.deleteSheet(sh); } });
  ss.setActiveSheet(s.run);

  // --- 🏠 Run
  var run = s.run;
  run.setHiddenGridlines(true);
  run.getRange(1, 1, 40, 16).setFontFamily('Roboto').setFontColor(C_.ink).setVerticalAlignment('middle');
  run.getRange(RUN.title, 1, 1, 16).merge().setBackground(C_.navy).setFontColor(C_.gold).setFontSize(20).setFontWeight('bold').setHorizontalAlignment('center');
  run.setRowHeight(RUN.title, 52);
  run.getRange(RUN.info, 1, 1, 16).setBackground(C_.navy2).setFontColor(C_.white).setFontSize(10);
  run.getRange(RUN.info, 2).setBackground(C_.manual).setFontColor(C_.ink).setFontWeight('bold').setHorizontalAlignment('center');
  run.getRange(RUN.info, 4, 1, 3).merge().setFontWeight('bold');
  run.setRowHeight(3, 10); run.setRowHeight(7, 14); run.setRowHeight(16, 14);
  KPIS.forEach(function(k, i) {
    var c = 1 + i * 2;
    [RUN.kpiLabel, RUN.kpiValue, RUN.kpiSub].forEach(function(r) { run.getRange(r, c, 1, 2).merge(); });
    run.getRange(RUN.kpiLabel, c).setFontSize(9).setFontColor(C_.muted).setFontWeight('bold').setHorizontalAlignment('center');
    run.getRange(RUN.kpiValue, c).setFontSize(i >= 4 ? 11 : 22).setFontWeight('bold').setHorizontalAlignment('center').setWrap(true).setFontColor(i === 2 ? C_.redInk : C_.navy);
    run.getRange(RUN.kpiSub, c).setFontSize(9).setFontColor(C_.muted).setHorizontalAlignment('center').setWrap(true);
    run.getRange(RUN.kpiLabel, c, 3, 2).setBackground(C_.band2).setBorder(true, true, true, true, null, null, '#c7cede', SpreadsheetApp.BorderStyle.SOLID);
  });
  run.setRowHeight(RUN.kpiValue, 42);
  [[RUN.teamTitle, 1], [RUN.tablesTitle, 1], [RUN.tablesTitle, 8], [RUN.tablesTitle, 14]].forEach(function(p) {
    run.getRange(p[0], p[1]).setFontSize(13).setFontWeight('bold').setFontColor(C_.navy);
  });
  header_(run.getRange(RUN.teamHead, 1, 1, 10));
  header_(run.getRange(RUN.tablesHead, 1, 1, 6)); header_(run.getRange(RUN.tablesHead, 8, 1, 5)); header_(run.getRange(RUN.tablesHead, 14, 1, 3));
  run.getRange(RUN.tablesHead, 15, 1, 2).merge();
  run.getRange(RUN.teamFirst, 6, 6, 1).setNumberFormat('0%').setHorizontalAlignment('center');
  run.getRange(RUN.teamFirst, 1, 6, 10).setBorder(true, true, true, true, null, true, '#e2e6ef', SpreadsheetApp.BorderStyle.SOLID);
  run.getRange(RUN.tablesFirst, 1, 15, 6).setBorder(true, true, true, true, null, true, '#e2e6ef', SpreadsheetApp.BorderStyle.SOLID);
  run.getRange(RUN.tablesFirst, 8, 15, 5).setBorder(true, true, true, true, null, true, '#e2e6ef', SpreadsheetApp.BorderStyle.SOLID);
  run.getRange(RUN.tablesFirst, 14, SPLITS.length, 3).setBorder(true, true, true, true, null, true, '#e2e6ef', SpreadsheetApp.BorderStyle.SOLID);
  run.getRange(RUN.tablesFirst, 16, SPLITS.length, 1).setFontColor('#3b82f6');
  run.getRange(RUN.tablesFirst, 1, 15, 1).setHorizontalAlignment('center');
  run.getRange(RUN.tablesFirst, 4, 15, 3).setHorizontalAlignment('center');
  [70, 110, 110, 55, 80, 65, 110, 110, 110, 280, 110, 140, 16, 110, 55, 150].forEach(function(w, i) { run.setColumnWidth(i + 1, w); });
  var hp = run.getRange(RUN.teamFirst, 6, 6, 1), st = run.getRange(RUN.teamFirst, 7, 6, 1), dead = run.getRange(RUN.tablesFirst, 8, 15, 5);
  run.setConditionalFormatRules([
    rule_().whenCellEmpty().setBackground(C_.white).setRanges([hp]).build(),
    rule_().whenNumberLessThanOrEqualTo(0.25).setBackground(C_.red).setFontColor(C_.redInk).setRanges([hp]).build(),
    rule_().whenNumberLessThanOrEqualTo(0.5).setBackground(C_.orange).setFontColor(C_.orangeInk).setRanges([hp]).build(),
    rule_().whenNumberGreaterThan(0.5).setBackground(C_.green).setFontColor(C_.greenInk).setRanges([hp]).build(),
    rule_().whenTextEqualTo('K.O.').setBackground(C_.red).setFontColor(C_.redInk).setRanges([st]).build(),
    rule_().whenTextEqualTo('OK').setFontColor(C_.greenInk).setRanges([st]).build(),
    rule_().whenCellNotEmpty().setBackground('#fdf2f3').setRanges([dead]).build()
  ]);

  // --- 🐾 Pokémon
  var pk = s.pokemon, h = headers_(), rows = Math.max(pk.getMaxRows() - 1, 1);
  pk.setFrozenRows(1); pk.setFrozenColumns(COL.name);
  header_(pk.getRange(1, 1, 1, h.length));
  pk.getRange(1, COL.deathCause).setBackground('#b7791f');
  pk.setRowHeight(1, 36);
  pk.hideColumns(COL.uid);
  pk.getRange(2, COL.deathCause, rows, 1).setBackground(C_.manual);
  pk.getRange(2, COL.frags, rows, 3).setFontWeight('bold').setHorizontalAlignment('center');
  pk.getRange(2, 10, rows, 7).setHorizontalAlignment('center');
  var widths = {}; widths[2] = 36; widths[3] = 150; widths[4] = 120; widths[5] = 110; widths[6] = 50; widths[7] = 105; widths[8] = 115; widths[9] = 75;
  for (var c = 10; c <= 15; c++) widths[c] = 46;
  widths[16] = 58; widths[17] = 80; widths[18] = 110; widths[19] = 270; widths[20] = 70; widths[21] = 170;
  for (var c2 = COL.frags; c2 < COL.sync; c2++) widths[c2] = 64;
  widths[COL.sync] = 140;
  Object.keys(widths).forEach(function(k) { pk.setColumnWidth(Number(k), widths[k]); });
  var statusRange = pk.getRange(2, COL.status, rows, 1), ivRange = pk.getRange(2, 10, rows, 6);
  var statusRules = [[STATUS.team, C_.green, C_.greenInk], [STATUS.ko, C_.orange, C_.orangeInk], [STATUS.box, C_.blue, C_.blueInk],
    [STATUS.dead, C_.red, C_.redInk], [STATUS.gone, C_.grey, C_.muted]].map(function(x) {
    return rule_().whenTextEqualTo(x[0]).setBackground(x[1]).setFontColor(x[2]).setBold(true).setRanges([statusRange]).build();
  });
  pk.setConditionalFormatRules(statusRules.concat([
    rule_().setGradientMinpointWithValue('#f8b4b4', SpreadsheetApp.InterpolationType.NUMBER, '0')
      .setGradientMidpointWithValue('#fff3c4', SpreadsheetApp.InterpolationType.NUMBER, '15')
      .setGradientMaxpointWithValue('#9ae6b4', SpreadsheetApp.InterpolationType.NUMBER, '31').setRanges([ivRange]).build()
  ]));

  // --- ⚔️ Combats
  var f = s.fights;
  f.setFrozenRows(1); header_(f.getRange(1, 1, 1, FIGHT_HEADERS.length)); f.setRowHeight(1, 32);
  [210, 110, 110, 50, 110, 50, 110, 50, 110, 50, 110, 50, 110, 50, 240].forEach(function(w, i) { f.setColumnWidth(i + 1, w); });
  f.getRange(2, 2, FIGHT_ROWS, 1).setFontColor(C_.muted);
  [4, 6, 8, 10, 12, 14].forEach(function(c) { f.getRange(2, c, FIGHT_ROWS, 1).setHorizontalAlignment('center').setBackground(C_.band2).setFontWeight('bold'); });
  f.getRange(2, 1, FIGHT_ROWS, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(s.trainers.getRange('C2:C'), true).setAllowInvalid(true).build());
  f.getRange(2, 2, FIGHT_ROWS, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(SPLITS, true).setAllowInvalid(true).build());
  var names = SpreadsheetApp.newDataValidation().requireValueInRange(pk.getRange(colLetter(COL.name) + '2:' + colLetter(COL.name)), true).setAllowInvalid(true).build();
  [3, 5, 7, 9, 11, 13].forEach(function(c) { f.getRange(2, c, FIGHT_ROWS, 1).setDataValidation(names); });
  f.getRange(1, 1).setNote('Choisis le dresseur dans la liste : le split se remplit tout seul. Mets ensuite le lead et chaque Pokémon utilisé avec ses frags.');

  // --- 🌿 Rencontres / 🎯 Dresseurs / 🎒 Objets
  [[s.encounters, ENC_HEADERS, [170, 150, 95, 150, 60, 60, 230, 130]], [s.trainers, TRAINER_HEADERS, [100, 160, 250, 30, 130, 45, 120, 120, 75, 340, 55, 65]],
   [s.items, ITEM_HEADERS, [180, 200, 460, 85]], [s.archive, ARCHIVE_HEADERS, [80, 130, 120, 120, 150, 55, 110, 55, 55, 65, 180]]].forEach(function(p) {
    p[0].setFrozenRows(1); header_(p[0].getRange(1, 1, 1, p[1].length)); p[0].setRowHeight(1, 32);
    p[2].forEach(function(w, i) { p[0].setColumnWidth(i + 1, w); });
    p[0].getRange(2, 1, Math.max(p[0].getMaxRows() - 1, 1), p[1].length).setVerticalAlignment('middle').setFontSize(10);
  });
  s.encounters.getRange('E2:F').setHorizontalAlignment('center');
  s.encounters.getRange('F2:F').setNumberFormat('0.##"%"');
  s.encounters.getRange('G1:H1').setBackground('#0f766e');
  s.trainers.getRange('D2:D').setHorizontalAlignment('center').setFontColor(C_.muted);
  s.trainers.getRange('F2:F').setHorizontalAlignment('center').setFontWeight('bold');
  s.trainers.getRange('K2:L').setHorizontalAlignment('center').setFontWeight('bold');
  s.trainers.getRange('K1:K1').setBackground('#0f766e');
  s.trainers.getRange('J2:J').setWrap(true);
  s.items.getRange(1, 4).setBackground('#b7791f');
  s.items.getRange('A2:A').setFontWeight('bold').setFontColor(C_.navy2);
  s.items.getRange('C2:C').setWrap(true);
}

// ---------------------------------------------------------------- Import officiel
function readSheet_(id, name) {
  var sh = SpreadsheetApp.openById(id).getSheetByName(name);
  return sh ? sh.getDataRange().getValues() : [];
}

function writeTable_(sh, width, rows) {
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, width).clearContent();
  if (rows.length) {
    if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
    sh.getRange(2, 1, rows.length, width).setValues(rows);
  }
}

// Bandes alternées par groupe (zone, catégorie, dresseur), une seule écriture.
function bandColors_(groups, width, special) {
  var out = [], g = -1, prev = null;
  groups.forEach(function(k, i) {
    if (k !== '' && k !== prev) { g++; prev = k; }
    var color = (special && special(i)) || (g % 2 ? C_.band2 : C_.band1);
    out.push(fill_(width, color));
  });
  return out;
}

function importReference(ss, s) {
  s = s || ensureStructure(ss);
  var log = [];
  try {
    var enc = parseEncounterGrid(readSheet_(SOURCES.encounters, 'Encounter Tables'))
      .concat(parseEncounterGrid(readSheet_(SOURCES.encounters, 'Other Tables')))
      .concat(parseSpecialEncounters(readSheet_(SOURCES.encounters, 'Special Encounters')));
    if (!enc.length) throw new Error('aucune rencontre lue');
    writeTable_(s.encounters, ENC_HEADERS.length, enc.map(function(e) { return [e.zone, mapsecFor(e.zone), e.method, e.species, e.level, e.rate, '', '']; }));
    tryFormat_(function() { s.encounters.getRange(2, 1, enc.length, ENC_HEADERS.length).setBackgrounds(bandColors_(enc.map(function(e) { return e.zone; }), ENC_HEADERS.length)); });
    log.push(enc.length + ' rencontres');
  } catch (e) { log.push('Rencontres non importées (' + e.message + ')'); }
  try {
    var src = SpreadsheetApp.openById(SOURCES.trainers), trainers = [];
    TRAINER_SHEETS.forEach(function(t) { var sh = src.getSheetByName(t[0]); if (sh) trainers = trainers.concat(parseTrainerSheet(sh.getDataRange().getValues(), t[1])); });
    if (!trainers.length) throw new Error('aucun dresseur lu');
    writeTable_(s.trainers, TRAINER_HEADERS.length, trainerRows(trainers, {}));
    log.push(trainers.length + ' dresseurs');
  } catch (e) { log.push('Dresseurs non importés (' + e.message + ')'); }
  try {
    var last = s.items.getLastRow(), checked = {};
    if (last > 1) s.items.getRange(2, 1, last - 1, 4).getValues().forEach(function(r) { if (r[3] === true) checked[r[0] + '|' + r[1] + '|' + r[2]] = true; });
    var items = [];
    ['Held Items', 'TM/HMs and Move Tutors', 'Evolution Items', 'Special', 'Resources', 'Other'].forEach(function(n) { items = items.concat(parseItemSheet(n, readSheet_(SOURCES.items, n))); });
    if (!items.length) throw new Error('aucun objet lu');
    var rows = items.map(function(i) { return [i[0], i[1], i[2], !!checked[i[0] + '|' + i[1] + '|' + i[2]]]; });
    writeTable_(s.items, 4, rows);
    tryFormat_(function() {
      s.items.getRange(2, 4, rows.length, 1).insertCheckboxes();
      s.items.getRange(2, 1, rows.length, 4).setBackgrounds(bandColors_(rows.map(function(r) { return r[0]; }), 4));
    });
    log.push(items.length + ' objets');
  } catch (e) { log.push('Objets non importés (' + e.message + ')'); }
  PropertiesService.getDocumentProperties().setProperty('referenceImport', new Date().toISOString() + ' — ' + log.join(', '));
  return log;
}

// ---------------------------------------------------------------- Mise à jour dynamique
function fightRows_(s) { var n = s.fights.getLastRow(); return n > 1 ? s.fights.getRange(2, 1, n - 1, FIGHT_HEADERS.length).getValues() : []; }
function pokemonRows_(s) { var n = s.pokemon.getLastRow(); return n > 1 ? s.pokemon.getRange(2, 1, n - 1, COL.deathCause).getValues() : []; }
function trainerSheetRows_(s) { var n = s.trainers.getLastRow(); return n > 1 ? s.trainers.getRange(2, 1, n - 1, TRAINER_HEADERS.length).getValues() : []; }

// Remplit le split d'un combat à partir du nom du dresseur.
function fillFightSplits_(s) {
  var splitOf = {};
  trainersFromRows(trainerSheetRows_(s)).forEach(function(t) { splitOf[key_(t.name)] = t.split; });
  fightRows_(s).forEach(function(r, i) {
    if (str_(r[0]) && !str_(r[1]) && splitOf[key_(r[0])]) s.fights.getRange(i + 2, 2).setValue(splitOf[key_(r[0])]);
  });
}

// Empreinte d'un contenu, pour ne réécrire un gros onglet que s'il a changé.
function changed_(key, value) {
  var props = PropertiesService.getDocumentProperties(), text = JSON.stringify(value), h = text.length + ':' + hash_(text);
  if (props.getProperty(key) === h) return false;
  props.setProperty(key, h); return true;
}
function hash_(t) { var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h; }

function refreshAll(ss, s, summary, force) {
  s = s || ensureStructure(ss);
  fillFightSplits_(s);
  var fights = fightRows_(s), stats = computeStats(fights), rows = pokemonRows_(s);
  if (force === undefined) force = !summary;
  if (rows.length) {
    var statValues = rows.map(function(r) {
      var name = str_(r[COL.name - 1]);
      if (!name) return fill_(3 + SPLITS.length, '');
      var st = stats[name];
      return st ? [st.frags, st.leads, st.fights].concat(SPLITS.map(function(sp) { return st.splits[sp]; })) : fill_(3 + SPLITS.length, 0);
    });
    s.pokemon.getRange(2, COL.frags, statValues.length, statValues[0].length).setValues(statValues);
  }
  var t = runTables(rows, stats);
  s.run.getRange(RUN.tablesFirst, 1, 15, 6).setValues(t.top);
  s.run.getRange(RUN.tablesFirst, 8, 15, 5).setValues(t.dead);
  s.run.getRange(RUN.tablesFirst, 14, t.splits.length, 3).setValues(t.splits);

  // Dresseurs battus + prochain dresseur
  var fought = {}, foughtNames = {};
  fights.forEach(function(r) { if (str_(r[0])) { fought[key_(r[0])] = true; foughtNames[str_(r[0])] = true; } });
  var trows = trainerSheetRows_(s), trainers = trainersFromRows(trows);
  if (trows.length && (changed_('hashFought', [Object.keys(fought).sort(), trows.length]) || force)) {
    var owner = '', battu = trows.map(function(r) { if (str_(r[2])) owner = key_(r[2]); return [str_(r[2]) ? (fought[owner] ? '✔' : '') : '']; });
    s.trainers.getRange(2, 11, battu.length, 1).setValues(battu);
    tryFormat_(function() {
      var who = '', groups = trows.map(function(r) { if (str_(r[2])) who = str_(r[2]); return who; });
      s.trainers.getRange(2, 1, trows.length, TRAINER_HEADERS.length).setBackgrounds(bandColors_(groups, TRAINER_HEADERS.length, function(i) {
        return fought[key_(groups[i])] ? C_.beaten : (isBoss(groups[i]) ? '#fff7e0' : null);
      }));
      s.trainers.getRange(2, 3, trows.length, 1).setFontWeight('bold');
    });
  }
  var next = nextTrainer(trainers, fought);
  s.run.getRange(RUN.kpiValue, 11).setValue(next ? next.name : (trainers.length ? 'Tous battus' : 'Liste à importer'));
  s.run.getRange(RUN.kpiSub, 11).setValue(next ? next.split + ' · ' + next.area + (next.maxLevel ? ' · Niv. max ' + next.maxLevel : '') : '');

  // Rencontres : zones capturées / espèces possédées
  var el = s.encounters.getLastRow();
  var captures = rows.map(function(r) { return [r[COL.zone - 1], r[COL.species - 1], r[COL.name - 1], r[COL.status - 1]].join('|'); });
  if (el > 1 && (changed_('hashCaptures', [captures, el]) || force)) {
    var enc = s.encounters.getRange(2, 1, el - 1, 4).getValues().map(function(r) { return { zone: r[0], nuzlocke: str_(r[1]), species: r[3] }; });
    s.encounters.getRange(2, 7, enc.length, 2).setValues(encounterStatus(enc, rows));
    tryFormat_(function() {
      var g = s.encounters.getRange('G2:G'), hcol = s.encounters.getRange('H2:H');
      s.encounters.setConditionalFormatRules([
        rule_().whenTextStartsWith('✝').setBackground(C_.red).setFontColor(C_.redInk).setRanges([g]).build(),
        rule_().whenTextStartsWith('✔').setBackground(C_.green).setFontColor(C_.greenInk).setRanges([g]).build(),
        rule_().whenTextEqualTo('Oui').setBackground(C_.orange).setFontColor(C_.orangeInk).setRanges([hcol]).build()
      ]);
    });
  }
  // Level cap / prochain boss : déduits de l'onglet Combats s'il contient un boss, sinon cases du calculateur.
  var caps = capFromFights(Object.keys(foughtNames));
  if (summary) PropertiesService.getDocumentProperties().setProperty('lastSummary', JSON.stringify(summary));
  else { try { summary = JSON.parse(PropertiesService.getDocumentProperties().getProperty('lastSummary') || 'null'); } catch (e) { summary = null; } }
  if (summary) {
    var cap = caps.any ? caps.cap : summary.cap, nextBoss = caps.any ? caps.next : summary.nextBoss, beaten = caps.any ? caps.beaten : summary.beaten;
    s.run.getRange(RUN.kpiValue, 1, 1, 10).setValues([[summary.party + ' / 6', '', summary.captures, '', summary.dead, '', cap ? 'Niv. ' + cap : '—', '', nextBoss, '']]);
    s.run.getRange(RUN.kpiSub, 1, 1, 10).setValues([[summary.ko ? summary.ko + ' K.O.' : 'Tous debout', '', summary.box + ' en boîte', '', summary.dead ? 'Repose en paix' : 'Aucun mort', '',
      'Niv. max équipe : ' + summary.maxLevel, '', beaten + ' boss battu' + (beaten > 1 ? 's' : '') + (caps.any ? ' (Combats)' : ''), '']]);
  }
}

// ---------------------------------------------------------------- Nouvelle run
/**
 * Nouvelle partie détectée (le numéro de dresseur de la sauvegarde a changé) :
 * la run précédente est archivée dans 📦 Archives, puis Pokémon, Combats et le
 * tableau de bord repartent de zéro et la tentative augmente de 1.
 */
function archiveRun_(ss, s, stamp) {
  var props = PropertiesService.getDocumentProperties();
  var last = s.pokemon.getLastRow(), rows = last > 1 ? s.pokemon.getRange(2, 1, last - 1, COL.sync).getValues().filter(function(r) { return str_(r[COL.name - 1]); }) : [];
  var fights = fightRows_(s).filter(function(r) { return r.some(function(c) { return str_(c); }); });
  var attempt = Number(s.run.getRange(RUN.info, 2).getValue()) || 1;
  if (rows.length || fights.length) {
    var stats = computeStats(fights), dead = rows.filter(function(r) { return r[COL.status - 1] === STATUS.dead; }).length;
    var frags = rows.reduce(function(t, r) { var st = stats[str_(r[COL.name - 1])]; return t + (st ? st.frags : 0); }, 0);
    var foughtNames = fights.map(function(r) { return str_(r[0]); }).filter(Boolean), caps = capFromFights(foughtNames);
    var summary = [attempt, stamp, '▶ RÉSUMÉ', rows.length + ' captures · ' + dead + ' morts', caps.last ? 'Dernier boss battu : ' + caps.last : '',
      rows.reduce(function(m, r) { return Math.max(m, Number(r[COL.level - 1]) || 0); }, 0), '', frags, '', fights.length, ''];
    var out = [summary].concat(rows.map(function(r) {
      var st = stats[str_(r[COL.name - 1])] || { frags: 0, leads: 0, fights: 0 };
      return [attempt, stamp, r[COL.name - 1], r[COL.species - 1], r[COL.zone - 1], r[COL.level - 1], r[COL.status - 1], st.frags, st.leads, st.fights, r[COL.deathCause - 1]];
    }));
    var start = Math.max(s.archive.getLastRow(), 1) + 1;
    if (s.archive.getMaxRows() < start + out.length) s.archive.insertRowsAfter(s.archive.getMaxRows(), start + out.length - s.archive.getMaxRows());
    s.archive.getRange(start, 1, out.length, ARCHIVE_HEADERS.length).setValues(out);
    tryFormat_(function() { s.archive.getRange(start, 1, 1, ARCHIVE_HEADERS.length).setFontWeight('bold').setBackground(C_.blue).setFontColor(C_.blueInk); });
  }
  if (last > 1) s.pokemon.getRange(2, 1, last - 1, COL.sync).clearContent();
  var fl = s.fights.getLastRow();
  if (fl > 1) s.fights.getRange(2, 1, fl - 1, FIGHT_HEADERS.length).clearContent();
  s.run.getRange(RUN.info, 2).setValue(attempt + 1);
  s.run.getRange(RUN.teamFirst, 1, 6, 10).clearContent();
  ['hashFought', 'hashCaptures', 'lastSummary'].forEach(function(k) { props.setProperty(k, ''); });
  return { attempt: attempt + 1, archived: rows.length };
}

function applyPayload(ss, payload, now) {
  var s = ensureStructure(ss), pk = s.pokemon;
  var stamp = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  var props = PropertiesService.getDocumentProperties(), runId = str_(payload.runId), previousRun = props.getProperty('runId');
  if (runId && previousRun && runId !== previousRun) archiveRun_(ss, s, stamp);
  if (runId) props.setProperty('runId', runId);
  var last = pk.getLastRow();
  var existing = last > 1 ? pk.getRange(2, 1, last - 1, AUTO_HEADERS.length).getValues() : [];
  var plan = planPokemonRows(existing, payload, stamp);
  plan.updates.concat(plan.appends).forEach(function(u) {
    pk.getRange(u.row, 1, 1, u.values.length).setValues([u.values]);
    pk.getRange(u.row, COL.sync).setValue(u.stamp);
  });
  s.run.getRange(RUN.info, 4).setValue(stamp);
  s.run.getRange(RUN.teamFirst, 1, 6, 10).setValues(teamRows(payload));
  // Première synchro sans données officielles : import unique.
  if (s.encounters.getLastRow() < 2 && !PropertiesService.getDocumentProperties().getProperty('referenceImport')) importReference(ss, s);
  refreshAll(ss, s, runSummary(payload), false);
  return { rows: plan.updates.length + plan.appends.length };
}

// Export pour les tests Node (sans effet dans Apps Script).
if (typeof module !== 'undefined') module.exports = { planPokemonRows: planPokemonRows, computeStats: computeStats, runTables: runTables, validatePayload: validatePayload,
  runSummary: runSummary, teamRows: teamRows, applyPayload: applyPayload, ensureStructure: ensureStructure, refreshAll: refreshAll,
  parseEncounterGrid: parseEncounterGrid, parseSpecialEncounters: parseSpecialEncounters, parseTrainerSheet: parseTrainerSheet,
  parseItemSheet: parseItemSheet, trainerRows: trainerRows, trainersFromRows: trainersFromRows, nextTrainer: nextTrainer,
  encounterStatus: encounterStatus, mapsecFor: mapsecFor, capFromFights: capFromFights, importReference: importReference, headers_: headers_,
  COL: COL, RUN: RUN, SHEETS: SHEETS, ARCHIVE_HEADERS: ARCHIVE_HEADERS, colLetter: colLetter, SPLITS: SPLITS };
