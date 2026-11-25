'use strict';
// Le panneau « Pourquoi ces % ? » affiche les mêmes % que le calculateur et des règles traduites.
const path = require('node:path');
const { chromium } = require(process.env.NULL_AI_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const shots = process.argv[2];
function assert(c, m) { if (!c) throw new Error(m); }
function num(t) { const m = String(t).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*%/); return m ? Number(m[1]) : null; }
(async () => {
  const browser = await chromium.launch(), errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1300 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(root, 'CALCULATEUR.html'));
    await page.waitForSelector('#null-ai-explain .null-ai-explain-move', { timeout: 20000 });
    const cards = await page.$$eval('#null-ai-explain .null-ai-explain-move', els => els.map(e => ({
      move: e.querySelector('strong').textContent, pct: e.querySelector('.null-ai-explain-pct').textContent,
      scores: (e.querySelector('.null-ai-explain-scores') || {}).textContent || '', rules: Array.from(e.querySelectorAll('li')).map(l => l.textContent) })));
    const shown = await page.$$eval('.null-ai-probability', els => els.map(e => e.textContent));
    const moves = await page.$$eval('label[for^=resultMoveR]', els => els.map(e => e.textContent.trim()));
    assert(cards.length >= 1, 'aucune carte');
    cards.forEach(c => {
      const i = moves.indexOf(c.move);
      assert(i >= 0, 'attaque introuvable ' + c.move);
      const a = num(shown[i]), b = num(c.pct);
      assert(a !== null && b !== null && Math.abs(a - b) < 0.11, c.move + ' : ' + shown[i] + ' vs ' + c.pct);
      assert(c.scores.startsWith('Score possible'), 'scores manquants pour ' + c.move);
    });
    const total = cards.reduce((s, c) => s + (num(c.pct) || 0), 0);
    assert(cards.every(c => c.rules.every(r => !/^Damaging Moves|^Summary/.test(r))), 'règles non traduites');
    if (shots) {
      await page.locator('#null-ai-explain').scrollIntoViewIfNeeded();
      await page.locator('[aria-labelledby=resultHeaderR]').screenshot({ path: path.join(shots, 'ai-explain.png') });
    }
    assert(!errors.length, 'Erreurs JS : ' + errors.join(' | '));
    console.log('OK: explications IA —', cards.map(c => c.move + ' ' + c.pct + ' [' + c.scores.replace('Score possible : ', '') + ']').join(' ; '), '— total', total.toFixed(1), '%');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
