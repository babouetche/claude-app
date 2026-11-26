'use strict';
// Parcours navigateur de l'onglet « Suivi de run » avec des données issues du test Lua.
// Usage : node scripts/check-run-tracker-browser.cjs [dossier-captures]
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.NULL_AI_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs', 'run-data.js');
const shots = process.argv[2];
function fixture(mutate) {
  const text = fs.readFileSync(path.join(root, 'tests/fixtures/run-data-sample.js'), 'utf8');
  const prefix = 'window.NullRunSync&&window.NullRunSync.receive(';
  const payload = JSON.parse(text.slice(prefix.length, text.trimEnd().lastIndexOf(')')));
  payload.writtenAt = Math.floor(Date.now() / 1000);
  if (mutate) mutate(payload.data);
  fs.writeFileSync(out, prefix + JSON.stringify(payload) + ');\n');
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
(async () => {
  const existed = fs.existsSync(out);
  if (existed) throw new Error('docs/run-data.js existe déjà : test annulé pour ne pas écraser une vraie partie.');
  const browser = await chromium.launch();
  const errors = [];
  try {
    fixture();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(root, 'CALCULATEUR.html'));
    await page.waitForFunction(() => window.NullRunSync && window.NullRunSync.getLatest());
    // Sets créés et rangés dans le calculateur
    const team = await page.$$eval('#team-poke-list .trainer-pok', els => els.map(e => e.getAttribute('data-id')));
    assert(team[0] === 'Torchic (Pyro [Run])' && team[1] === 'Zigzagoon (Zig [Run])', 'Équipe du calc : ' + team);
    const boxed = await page.$$eval('#box-poke-list .trainer-pok', els => els.map(e => e.getAttribute('data-id')));
    assert(boxed.includes('Wingull (Boxy [Run])'), 'Boîte du calc : ' + boxed);
    assert(!boxed.concat(team).some(id => id.startsWith('Poochyena')), 'Un mort ne doit pas être importé');
    const set = await page.evaluate(() => SETDEX_SV['Torchic']['Pyro [Run]']);
    assert(set.level === 14 && set.item === 'Leftovers' && set.ability === 'Blaze' && set.nature === 'Gentle', 'Set Torchic : ' + JSON.stringify(set));
    assert(JSON.stringify(set.moves) === JSON.stringify(['Ember', 'Scratch', 'Explosion']), 'Attaques : ' + set.moves);
    assert(set.ivs.hp === 31 && set.ivs.sp === 28 && set.ivs.sa === 27, 'IV : ' + JSON.stringify(set.ivs));
    const wingull = await page.evaluate(() => SETDEX_SV['Wingull']['Boxy [Run]']);
    assert(wingull.moves.includes('Hidden Power Fighting'), 'Hidden Power typé : ' + wingull.moves);
    // Onglet
    await page.click('#header-run-button');
    await page.waitForSelector('#run-subpage:not([hidden]) .run-card');
    assert(await page.isHidden('.move-result-group'), 'Le calculateur doit être masqué en mode run');
    const cards = await page.$$eval('.run-section', s => s.map(x => x.querySelectorAll('.run-card').length));
    assert(cards[0] === 2, 'Cartes équipe : ' + cards);
    assert((await page.textContent('#run-status')).includes('Synchronisé'), 'Statut : ' + await page.textContent('#run-status'));
    assert((await page.textContent('.run-stat--dead .run-stat-value')) === '1', 'Compteur de morts');
    const overlayUrls = await page.$$eval('#run-overlay input', els => els.map(e => e.value));
    assert(overlayUrls.length === 6 && overlayUrls.every(u => /\/docs\/overlay\.html\?vue=/.test(u)), 'Liens overlay : ' + overlayUrls);
    if (shots) await page.screenshot({ path: path.join(shots, 'run-tracker.png'), fullPage: true });
    // Level cap
    await page.click('.run-bosses summary');
    assert((await page.textContent('.run-cap-value')).includes('13'), 'Cap initial 13');
    await page.check('.run-boss input >> nth=0');
    assert((await page.textContent('.run-cap-value')).includes('19'), 'Cap après Root Academy 1');
    assert(await page.isVisible('.run-cap-value--over') === false, 'Pas au-dessus du cap à 19');
    // Charger Pyro dans le calculateur : PV et statut du jeu
    await page.click('.run-card--team >> nth=0 >> text=Calculer avec');
    await page.waitForSelector('#run-subpage', { state: 'hidden' });
    assert(await page.inputValue('#p1 .current-hp') === '33', 'PV de Pyro : ' + await page.inputValue('#p1 .current-hp'));
    assert(await page.inputValue('#p1 .status') === 'Burned', 'Statut de Pyro');
    // Mise à jour automatique : le jeu change les PV et une attaque
    fixture(d => { d.party[0].hp = 12; d.party[0].moves[2] = { name: 'Flame Charge', pp: 20 }; });
    await page.waitForFunction(() => SETDEX_SV['Torchic']['Pyro [Run]'].moves.includes('Flame Charge'), null, { timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('#p1 .current-hp').value === '12', null, { timeout: 8000 });
    // Évolution + mort : le set change d'espèce, le mort quitte le calc
    fixture(d => { d.party[0].species = 'Combusken'; const z = d.party.splice(1, 1)[0]; z.box = 12; z.boxSlot = 2; d.dead.push(z); });
    await page.waitForFunction(() => !(SETDEX_SV['Torchic'] && SETDEX_SV['Torchic']['Pyro [Run]']) && SETDEX_SV['Combusken']['Pyro [Run]'], null, { timeout: 8000 });
    const team2 = await page.$$eval('#team-poke-list .trainer-pok', els => els.map(e => e.getAttribute('data-id')));
    assert(JSON.stringify(team2) === JSON.stringify(['Combusken (Pyro [Run])']), 'Équipe après évolution/mort : ' + team2);
    if (shots) await page.screenshot({ path: path.join(shots, 'calc-after-sync.png') });
    // Nouvelle run : autre sauvegarde (autre numéro de dresseur) → boss remis à zéro, anciens sets retirés, bannière
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('nullcalc_runBeaten') || '{}'));
    assert(Object.keys(before).length === 1, 'un boss coché avant la nouvelle run');
    fixture(d => {
      d.party = [Object.assign({}, d.party[0], { uid: '99999999-0000beef', species: 'Mudkip', nickname: 'Mud', level: 5, moves: [{ name: 'Water Gun', pp: 25 }] })];
      d.box = []; d.dead = []; d.battle = { runId: '0000beef', runIndex: 2, runCount: 2, fights: [] };
    });
    await page.waitForFunction(() => SETDEX_SV['Mudkip'] && SETDEX_SV['Mudkip']['Mud [Run]'], null, { timeout: 8000 });
    const team3 = await page.$$eval('#team-poke-list .trainer-pok', els => els.map(e => e.getAttribute('data-id')));
    assert(JSON.stringify(team3) === JSON.stringify(['Mudkip (Mud [Run])']), 'Équipe après nouvelle run : ' + team3);
    assert(!(await page.evaluate(() => SETDEX_SV['Combusken'] && SETDEX_SV['Combusken']['Pyro [Run]'])), 'ancien set retiré');
    assert(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('nullcalc_runBeaten') || '{}')).length === 0), 'boss remis à zéro');
    await page.click('#header-run-button');
    await page.waitForSelector('.run-newrun');
    assert((await page.textContent('.run-newrun')).includes('run n°1'), 'bannière : partie arrêtée avant le cap 45, non comptée');
    if (shots) await page.screenshot({ path: path.join(shots, 'run-newrun.png') });
    // Combat détecté par le Lua (dresseur après Root Academy 4) : boss cochés et cap à jour automatiquement
    fixture(d => {
      d.party = [Object.assign({}, d.party[0], { uid: '99999999-0000beef', species: 'Mudkip', nickname: 'Mud', level: 30, moves: [{ name: 'Water Gun', pp: 25 }] })];
      d.box = []; d.dead = [];
      d.battle = { runId: '0000beef', runIndex: 2, runCount: 2, fights: [{ t: 1, team: [{ species: 'Oinkologne', level: 33 }, { species: 'Gumshoos', level: 33 }, { species: 'Talonflame', level: 34 }] }] };
    });
    await page.waitForFunction(() => document.querySelector('.run-cap-value') && document.querySelector('.run-cap-value').textContent.includes('38'), null, { timeout: 8000 });
    assert(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('nullcalc_runBeaten') || '{}')).length === 4), '4 boss Root Academy cochés');
    // Combat en direct : Bug Catcher Beni, 2e Pokémon actif à moitié PV → le calc le sélectionne à droite avec ses PV
    fixture(d => {
      d.party = [Object.assign({}, d.party[0], { uid: '99999999-0000beef', species: 'Mudkip', nickname: 'Mud', level: 30, hp: 40, maxHP: 80, moves: [{ name: 'Water Gun', pp: 25 }] })];
      d.box = []; d.dead = [];
      d.battle = { runId: '0000beef', runIndex: 2, runCount: 2, fights: [{ t: 1, team: [{ species: 'Oinkologne', level: 33 }, { species: 'Gumshoos', level: 33 }, { species: 'Talonflame', level: 34 }] }],
        enemy: [{ species: 'Lumineon', level: 33, hp: 0, maxHP: 100 }, { species: 'Butterfree', level: 33, hp: 50, maxHP: 100 }, { species: 'Spidops', level: 33, hp: 100, maxHP: 100 }, { species: 'Ledian', level: 34, hp: 100, maxHP: 100 }],
        active: { player: '99999999-0000beef', enemy: 2 },
        live: { player: [{ uid: '99999999-0000beef', hp: 40, maxHP: 80, boosts: { atk: 2, def: 0, spe: -1, spa: 0, spd: 0, acc: 0, eva: 0 } }],
          enemy: [{ index: 2, hp: 50, maxHP: 100, boosts: { atk: 0, def: 1, spe: 0, spa: 0, spd: 0, acc: 0, eva: 0 } }],
          field: { weather: 'Rain', terrain: 'Electric', trickRoom: true, magicRoom: false, wonderRoom: false, gravity: false,
            sides: [{ reflect: true, lightScreen: false, auroraVeil: false, tailwind: true, stealthRock: false, spikes: 0 }, { reflect: false, lightScreen: false, auroraVeil: false, tailwind: false, stealthRock: true, spikes: 2 }] } } };
    });
    await page.click('#header-calc-button');
    await page.waitForFunction(() => /Butterfree \(Bug Catcher Beni\)/.test($('.opposing').val() || ''), null, { timeout: 8000 });
    await page.waitForFunction(() => $('#p2 .percent-hp').first().val() === '50', null, { timeout: 8000 });
    assert(/Mudkip \(Mud \[Run\]\)/.test(await page.evaluate(() => $('.player').val())), 'mon Pokémon actif à gauche');
    const field = await page.evaluate(() => ({ rain: $('#rain').prop('checked'), electric: $('#electric').prop('checked'), tr: $('#trickroom').prop('checked'),
      reflectL: $('#reflectL').prop('checked'), tailwindL: $('#tailwindL').prop('checked'), srR: $('#srR').prop('checked'), spikesR2: $('#spikesR2').prop('checked'),
      atk: $('#p1 .at .boost').first().val(), spe: $('#p1 .sp .boost').first().val(), foeDef: $('#p2 .df .boost').first().val() }));
    assert(JSON.stringify(field) === JSON.stringify({ rain: true, electric: true, tr: true, reflectL: true, tailwindL: true, srR: true, spikesR2: true, atk: '2', spe: '-1', foeDef: '1' }), 'terrain en direct : ' + JSON.stringify(field));
    assert(!errors.length, 'Erreurs JS : ' + errors.join(' | '));
    console.log('OK: suivi de run — import, rangement, PV/statut, mise à jour, évolution, mort, level cap, nouvelle run, boss cochés par les combats détectés, combat en direct.');
  } finally {
    await browser.close();
    if (!existed && fs.existsSync(out)) fs.unlinkSync(out);
  }
})().catch(e => { console.error(e); process.exit(1); });
