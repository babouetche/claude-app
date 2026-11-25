'use strict';
// Overlay OBS (docs/overlay.html) : équipe verticale, boîte 6×5, morts 6 par 6, prochain dresseur,
// level cap et numéro de run automatiques, icônes d'objets, mise à jour en direct.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { chromium } = require(process.env.NULL_AI_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs', 'run-data.js'), shots = process.argv[2];
function assert(c, m) { if (!c) throw new Error(m); }
// Équipes réelles des dresseurs (mêmes données que le calculateur)
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'docs/js/data/sets/gen9.js'), 'utf8') + ';this.SETDEX_SV=SETDEX_SV;this.window.SETDEX_SV=SETDEX_SV;', ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'docs/js/null_ai/version126-trainers.js'), 'utf8'), ctx);
const T = require(path.join(root, 'docs/js/run/trainers.js')), trainers = T.buildTrainers(ctx.SETDEX_SV);
const teamOf = n => trainers.find(t => t.name === n).mons.map(m => ({ species: m.species, level: m.level }));
function raTeam(n) { const seen = {}, picks = []; Object.keys(ctx.SETDEX_SV).forEach(sp => Object.keys(ctx.SETDEX_SV[sp]).forEach(key => {
  const m = /^Root Academy Trainer #(\d+) Slot (\d+)$/.exec(key); if (m && +m[1] === n && !seen[m[2]]) { seen[m[2]] = 1; picks.push({ species: sp, level: ctx.SETDEX_SV[sp][key].level }); } })); return picks; }
function fixture(mutate) {
  const text = fs.readFileSync(path.join(root, 'tests/fixtures/run-data-sample.js'), 'utf8');
  const prefix = 'window.NullRunSync&&window.NullRunSync.receive(';
  const payload = JSON.parse(text.slice(prefix.length, text.trimEnd().lastIndexOf(')')));
  if (mutate) mutate(payload.data);
  fs.writeFileSync(out, prefix + JSON.stringify(payload) + ');\n');
}
(async () => {
  if (fs.existsSync(out)) throw new Error('docs/run-data.js existe déjà : test annulé.');
  const browser = await chromium.launch(), errors = [];
  try {
    fixture(d => { d.party[0].species = 'Darmanitan-Galar-Zen'; d.battle.fights = []; });
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    page.on('pageerror', e => errors.push(e.message));
    const url = 'file://' + path.join(root, 'docs/overlay.html');
    const imagesOk = () => page.waitForFunction(() => Array.from(document.images).every(i => i.complete && i.naturalWidth > 0));
    // Équipe verticale
    await page.goto(url + '?vue=equipe');
    await page.waitForSelector('.tcard'); await imagesOk();
    const team = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.tcard')), r = cards.map(c => c.getBoundingClientRect());
      return { n: cards.length, vertical: r[1].top > r[0].bottom - 2 && Math.abs(r[1].left - r[0].left) < 2, item: document.querySelector('.tcard img.itemicon').src.split('/').pop(),
        status: document.querySelector('.tcard .status').textContent, ko: !!document.querySelector('.tcard.ko'), hp: document.querySelector('.hp i').style.width,
        firstIcon: document.querySelector('.tcard img.sprite').src.split('/').pop() };
    });
    assert(team.n === 2 && team.vertical, 'équipe verticale ' + JSON.stringify(team));
    assert(team.item === '472.png' && team.status === 'BRÛ' && team.ko && team.hp === '82.5%', JSON.stringify(team));
    assert(team.firstIcon === 'Darmanitan-Galar.png', 'repli d’icône ' + team.firstIcon);
    if (shots) await page.screenshot({ path: path.join(shots, 'overlay-equipe.png'), omitBackground: true });
    fixture(d => { d.party[0].hp = 10; d.battle.fights = []; });
    await page.waitForFunction(() => document.querySelector('.hp i').style.width === '25%', null, { timeout: 5000 });
    // Boîte 6 × 5 serrée, défilement au-delà de 30
    fixture(d => { const m = d.box[0]; d.box = Array.from({ length: 40 }, (_, i) => Object.assign({}, m, { uid: 'b' + i, level: i + 1 })); d.battle.fights = []; });
    await page.goto(url + '?vue=boite&defilement=2');
    await page.waitForFunction(() => document.querySelectorAll('.grid .cell').length === 30);
    const box = await page.evaluate(() => ({ cols: getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length,
      cellW: document.querySelector('.cell').getBoundingClientRect().width, imgW: document.querySelector('.cell img.sprite').getBoundingClientRect().width }));
    assert(box.cols === 6 && box.imgW > box.cellW, 'boîte : ' + JSON.stringify(box));
    await page.waitForFunction(() => document.querySelectorAll('.grid .cell').length === 10, null, { timeout: 5000 });
    // Morts : bande de 6, 6 par 6
    fixture(d => { const m = d.dead[0]; d.dead = Array.from({ length: 14 }, (_, i) => Object.assign({}, m, { uid: 'd' + i })); d.battle.fights = []; });
    await page.goto(url + '?vue=morts&defilement=2');
    await page.waitForFunction(() => document.querySelectorAll('.grid .cell.dead').length === 6);
    await page.waitForFunction(() => document.querySelector('#overlay').textContent.includes('3/3') && document.querySelectorAll('.grid .cell').length === 2, null, { timeout: 7000 });
    // Prochain dresseur + level cap + run, à partir des combats détectés par le Lua
    const fights = [1, 2, 3, 4].map((n, i) => ({ t: i, team: raTeam(n) }));
    fixture(d => { d.battle.fights = fights; d.battle.runIndex = 3; });
    await page.goto(url + '?vue=cap');
    await page.waitForFunction(() => document.querySelector('.big') && document.querySelector('.big').textContent === '38', null, { timeout: 15000 });
    await page.goto(url + '?vue=run&depart=25');
    await page.waitForFunction(() => document.querySelector('.big') && document.querySelector('.big').textContent === '27');
    await page.goto(url + '?vue=dresseur');
    await page.waitForFunction(() => document.querySelector('.trainer .tname'), null, { timeout: 15000 });
    const nextName = await page.textContent('.trainer .tname');
    const expected = T.progress(trainers, fights).next;
    assert(nextName.startsWith(expected.name), 'prochain dresseur : ' + nextName + ' / attendu ' + expected.name);
    // Après Roxanne : cap 45 et dresseur suivant
    fixture(d => { d.battle.fights = fights.concat([{ t: 9, team: teamOf('Leader Roxanne') }]); });
    await page.goto(url + '?vue=tout&fond=1');
    await page.waitForFunction(() => document.querySelectorAll('.big')[0] && document.querySelectorAll('.big')[0].textContent === '45', null, { timeout: 15000 });
    const next2 = T.progress(trainers, fights.concat([{ t: 9, team: teamOf('Leader Roxanne') }])).next;
    await page.waitForFunction(n => document.querySelector('.trainer .tname').textContent.startsWith(n), next2.name);
    const trainerCells = await page.$$eval('.trainer .cell', els => els.length);
    assert(trainerCells === next2.mons.length, 'équipe du prochain dresseur : ' + trainerCells);
    await imagesOk();
    if (shots) await page.screenshot({ path: path.join(shots, 'overlay-tout.png') });
    assert(!errors.length, errors.join(' | '));
    console.log('OK: overlay — équipe verticale, objets en icônes, boîte 6×5, morts 6 par 6, prochain dresseur (' + next2.name + '), level cap 38→45, run auto.');
  } finally { await browser.close(); if (fs.existsSync(out)) fs.unlinkSync(out); }
})().catch(e => { console.error(e); process.exit(1); });
