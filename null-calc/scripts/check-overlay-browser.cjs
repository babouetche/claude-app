'use strict';
// Overlay OBS (docs/overlay.html) : équipe, boîte, morts, icônes chargées, mise à jour en direct.
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.NULL_AI_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs', 'run-data.js'), shots = process.argv[2];
function assert(c, m) { if (!c) throw new Error(m); }
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
    fixture(d => { d.party[0].species = 'Darmanitan-Galar-Zen'; });
    const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
    page.on('pageerror', e => errors.push(e.message));
    const url = 'file://' + path.join(root, 'docs/overlay.html');
    await page.goto(url + '?vue=tout&fond=1');
    await page.waitForSelector('.team .mon');
    await page.waitForFunction(() => Array.from(document.images).every(i => i.complete && i.naturalWidth > 0));
    const info = await page.evaluate(() => ({
      team: document.querySelectorAll('.team .mon').length, box: document.querySelectorAll('.grid')[0].children.length,
      dead: document.querySelectorAll('.dead').length, status: document.querySelector('.status').textContent,
      ko: !!document.querySelector('.mon.ko'), item: document.querySelector('.item').textContent,
      firstIcon: document.querySelector('.team img').src.split('/').pop(), hp: document.querySelector('.hp i').style.width }));
    assert(info.team === 2 && info.box === 1 && info.dead === 1, JSON.stringify(info));
    assert(info.status === 'BRÛ' && info.ko && info.item === 'Leftovers', JSON.stringify(info));
    assert(info.firstIcon === 'Darmanitan-Galar.png', 'repli d’icône : ' + info.firstIcon);
    assert(info.hp === '82.5%', 'PV : ' + info.hp);
    if (shots) await page.screenshot({ path: path.join(shots, 'overlay-tout.png') });
    // Mise à jour en direct
    fixture(d => { d.party[0].hp = 10; });
    await page.waitForFunction(() => document.querySelector('.hp i').style.width === '25%', null, { timeout: 5000 });
    // Boîte : 6 Pokémon max par ligne par défaut
    await page.goto(url + '?vue=boite');
    await page.waitForSelector('.grid .mon');
    const gridCols = await page.evaluate(() => getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length);
    assert(gridCols === 6, 'colonnes boîte : ' + gridCols);
    // 40 Pokémon en boîte : 30 affichés (6 × 5), page 1/2, puis page 2/2 après le défilement
    fixture(d => { const m = d.box[0]; d.box = Array.from({ length: 40 }, (_, i) => Object.assign({}, m, { uid: 'b' + i, level: i + 1 })); });
    await page.goto(url + '?vue=boite&defilement=2');
    await page.waitForFunction(() => document.querySelectorAll('.grid .mon').length === 30);
    assert((await page.textContent('#overlay')).includes('1/2'), 'page 1/2');
    await page.waitForFunction(() => document.querySelectorAll('.grid .mon').length === 10, null, { timeout: 5000 });
    assert((await page.textContent('#overlay')).includes('2/2'), 'page 2/2');
    fixture(d => { d.party[0].hp = 10; });
    // Vue équipe seule, transparente
    await page.goto(url + '?vue=equipe&taille=3');
    await page.waitForSelector('.team .mon');
    assert(await page.evaluate(() => !document.querySelector('.grid') && getComputedStyle(document.body).backgroundColor === 'rgba(0, 0, 0, 0)'), 'vue équipe transparente');
    if (shots) await page.screenshot({ path: path.join(shots, 'overlay-equipe.png'), omitBackground: true });
    assert(!errors.length, errors.join(' | '));
    console.log('OK: overlay OBS — équipe/boîte/morts, icônes, statut, K.O., objets, PV en direct, fond transparent.');
  } finally { await browser.close(); if (fs.existsSync(out)) fs.unlinkSync(out); }
})().catch(e => { console.error(e); process.exit(1); });
