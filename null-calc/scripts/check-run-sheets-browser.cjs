'use strict';
// Bout en bout : le calculateur envoie la run, le vrai Code.gs (dans une fausse feuille) l'écrit, puis le calc affiche la confirmation.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert');
const { chromium } = require(process.env.NULL_AI_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs', 'run-data.js');
const SHEET_URL = 'https://script.google.com/macros/s/TEST_deploiement-123/exec';
const testSrc = fs.readFileSync(path.join(root, 'tests/google-sheets.test.cjs'), 'utf8');
const fakeSpreadsheet = new Function('assert', testSrc.slice(testSrc.indexOf('function fakeSpreadsheet'), testSrc.indexOf('const ctx =')) + '; return fakeSpreadsheet;')(assert);
const props = {};
const ctx = { module: { exports: {} }, SpreadsheetApp: { newDataValidation: () => { throw new Error('test'); } }, Utilities: { formatDate: d => d.toISOString() },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ setProperty: (k, v) => { props[k] = v; }, getProperty: k => props[k] || null }) },
  ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(root, 'google-sheets/Code.gs'), 'utf8'), ctx);
const sheet = fakeSpreadsheet();
ctx.SpreadsheetApp.getActiveSpreadsheet = () => sheet;
(async () => {
  if (fs.existsSync(out)) throw new Error('docs/run-data.js existe déjà : test annulé.');
  const text = fs.readFileSync(path.join(root, 'tests/fixtures/run-data-sample.js'), 'utf8');
  fs.writeFileSync(out, text.replace(/"writtenAt":\d+/, '"writtenAt":' + Math.floor(Date.now() / 1000)));
  const browser = await chromium.launch(), errors = [];
  let posts = 0;
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://script.google.com/**', async route => {
      const req = route.request();
      if (req.method() === 'POST') {
        posts++;
        const res = vm.runInContext('doPost', ctx)({ postData: { contents: req.postData() } });
        return route.fulfill({ status: 200, body: res.text });
      }
      const cb = new URL(req.url()).searchParams.get('callback');
      const res = vm.runInContext('doGet', ctx)({ parameter: { callback: cb } });
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: res.text });
    });
    await page.goto('file://' + path.join(root, 'CALCULATEUR.html'));
    await page.click('#header-run-button');
    await page.waitForSelector('#run-sheets');
    await page.fill('#run-sheets-url', 'https://exemple.com/pas-bon');
    await page.click('#run-sheets >> text=Enregistrer');
    assert.match(await page.textContent('#run-sheets-status'), /URL invalide/);
    await page.fill('#run-sheets-url', SHEET_URL);
    await page.click('#run-sheets >> text=Enregistrer');
    await page.waitForFunction(() => /Feuille à jour/.test(document.getElementById('run-sheets-status').textContent), null, { timeout: 15000 });
    const pk = sheet.sheets['Pokémon'];
    assert.equal(pk.cells['2,5'].v, 'Pyro'); assert.equal(pk.cells['5,7'].v, 'Mort');
    assert.equal(sheet.sheets['Run'].cells['7,2'].v, 1, 'compteur de morts');
    assert.equal(posts, 1, 'un seul envoi pour des données identiques');
    // Sans changement dans le jeu, aucun nouvel envoi
    await page.waitForTimeout(4000);
    assert.equal(posts, 1, 'pas de renvoi si rien ne change');
    assert.ok(!errors.length, errors.join(' | '));
    console.log('OK: Google Sheets — URL vérifiée, envoi, écriture par Code.gs, confirmation, pas de doublon.');
  } finally { await browser.close(); if (fs.existsSync(out)) fs.unlinkSync(out); }
})().catch(e => { console.error(e); process.exit(1); });
