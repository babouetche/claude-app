'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.NULL_AI_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const entry = path.resolve(process.env.NULL_CALC_ENTRY || path.join(root, 'CALCULATEUR.html'));
const version=require('./release-config.json');
const fixture = require('../tests/fixtures/'+version.reserveFormFixture);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function checkNativeROM() {
    if (!process.env.NULL_AI_ROM) return {rechecked:false, romSHA256:fixture.romSHA256, records:0};
    const rom = fs.readFileSync(process.env.NULL_AI_ROM);
    assert.equal(sha(rom), fixture.romSHA256, 'Unsupported ROM');
    function proof(p) {
        const offset = Number(p.offset);
        assert.equal(sha(rom.subarray(offset, offset + p.length)), p.sha256, 'Native evidence ' + p.offset);
    }
    proof(fixture.copySpeciesProof);
    let records = 0;
    for (const group of fixture.cases) for (const record of group.records) {
        proof(record); proof(record.speciesProof);
        const offset = Number(record.offset), layout = fixture.layout;
        const label=group.trainer+' @ '+record.offset;
        assert.equal(rom.readUInt16LE(offset + layout.species), record.speciesID, label+' species');
        assert.equal(layout.levelWidth===1?rom.readUInt8(offset + layout.level):rom.readUInt16LE(offset + layout.level), record.level, label+' level');
        record.moves.forEach((id, i) => assert.equal(rom.readUInt16LE(offset + layout.moves + i * 2), id, label+' move '+(i+1)));
        records++;
    }
    return {rechecked:true, romSHA256:fixture.romSHA256, records, groups:fixture.cases.length};
}

(async () => {
    const native = checkNativeROM();
    const browser = await chromium.launch({headless:true, executablePath:process.env.NULL_AI_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const errors = [], groups = [], checks = [];
    try {
        const context = await browser.newContext({viewport:{width:1440,height:1080}}), page = await context.newPage();
        page.on('pageerror', error => errors.push(error.stack));
        await page.route(/^https?:\/\//, route => route.abort());
        await page.goto(pathToFileURL(entry).href, {waitUntil:'load'});
        await page.waitForFunction(() => window.NullPostKOUI && NullPostKOUI.getLastResult());
        const originalData = await page.evaluate(() => JSON.stringify(SETDEX_SV));
        for (const group of fixture.cases) {
            const result = await page.evaluate(g => {
                const rows = Object.entries(SETDEX_SV).filter(([,sets]) => sets[g.trainer]?.index !== undefined);
                const active = rows.filter(([name]) => !g.displayForms.includes(name)).sort((a,b) => a[1][g.trainer].index - b[1][g.trainer].index)[0];
                if (!active) throw Error('Audit needs a different active opponent: ' + g.trainer);
                $('#p2 .set-selector').val(active[0] + ' (' + g.trainer + ')').trigger('change');
                const state = NullMoveAIState.readBattleState(damageResults);
                return {complete:state.party.complete, assumptions:state.party.assumptions,
                    forms:state.party.candidates.filter(c => c.aliases.some(id => g.displayForms.some(name => id === name + ' (' + g.trainer + ')')))
                        .map(c => ({name:c.name, evaluationForm:c.evaluationForm, aliases:c.aliases, active:c.active, speed:c.speed}))};
            }, group);
            assert.equal(result.complete, true, group.trainer + ': ' + result.assumptions.join('; '));
            assert.equal(result.forms.length, 1, group.trainer + ': exactly one logical slot');
            const normalize=name=>({'Darmanitan-Zen-Mode':'Darmanitan-Zen','Darmanitan-Zen-Mode-Galar':'Darmanitan-Galar-Zen'}[name]||name);
            assert.equal(normalize(result.forms[0].evaluationForm||result.forms[0].name), normalize(group.expectedReserveForm), group.trainer);
            assert.equal(result.forms[0].active, false);
            groups.push({trainer:group.trainer, reserveForm:result.forms[0].name, aliases:result.forms[0].aliases});
        }
        checks.push('29 trainer/set groups in eleven non-Mega form families retain the reserve form supported by native party records; duplicate display forms share one logical slot and distinct Darm Zen sets remain separate.');
        const battle = fixture.observedBattle;
        await page.evaluate(s => {
            $('#p1 .set-selector').val(s.player + ' (Blank Set)').trigger('change');
            $('#p1 .level').val(s.level).trigger('change');
            $('#p1 .nature').val(s.nature).trigger('change');
            $('#p1 .ability').val(s.ability).trigger('change');
            $('#p1 .item').val('').trigger('change');
            Object.entries(s.ivs).forEach(([key,value]) => {
                $('#p1 .' + key + ' .ivs').val(value).trigger('change');
                $('#p1 .' + key + ' .evs').val(0).trigger('change');
            });
            s.moves.forEach((name,i) => $('#p1 .move' + (i+1) + ' select.move-selector').val(name).trigger('change'));
            $('#p2 .set-selector').val(s.opponent + ' (' + s.trainer + ')').trigger('change');
            $('#p1 .percent-hp,#p2 .percent-hp').val(100).trigger('change');
            $('#clear').prop('checked',true).trigger('change'); performCalculations();
        }, battle);
        const read = () => page.evaluate(() => ({post:NullPostKOUI.getLastResult(), state:NullMoveAIState.readBattleState(damageResults),
            hp:[$('#p1 .current-hp').val(), $('#p2 .current-hp').val()], damage:damageResults.map(side => side.map(result => result.damage))}));
        const baseline = await read(), candidates = baseline.post.switch.candidates;
        assert.equal(baseline.state.player.hp, battle.hp);
        assert.deepEqual(candidates.map(c => c.name), battle.names);
        assert.deepEqual(candidates.map(c => c.score), battle.scores);
        assert.deepEqual(candidates.map(c => c.probability), battle.probabilities);
        assert.equal(baseline.state.party.candidates.find(c => c.name === 'Minior').speed, battle.coreSpeed);
        await page.evaluate(() => {$('#null-ai-mode').val('strict').trigger('change'); performCalculations();});
        const strict = await read();
        assert.deepEqual(strict.post.switch.candidates.map(c => c.probability), battle.probabilities);
        assert.deepEqual({hp:strict.hp, damage:strict.damage}, {hp:baseline.hp, damage:baseline.damage});
        checks.push('The observed Marcster battle reproduces Minior 90%, Corsola-Galar 10%, Lunatone 0%; strict/estimate agree and the displayed damage/HP remain unchanged.');
        await page.evaluate(() => {$('#p2 .set-selector').val('Minior-Meteor (Hiker Marcster)').trigger('change'); performCalculations();});
        const meteor = await read(), active = meteor.state.party.candidates.find(c => c.active);
        assert.equal(active.name, 'Minior-Meteor'); assert.equal(active.speed, battle.meteorSpeed);
        assert.equal(meteor.state.opponent.name, 'Minior-Meteor');
        checks.push('Selecting the active Meteor form still uses its real 66 Speed; the reserve correction does not force active Pokémon into core form.');
        await page.evaluate(() => {$('#p2 .set-selector').val('Glimmet (Hiker Marcster)').trigger('change'); performCalculations();});
        const alias = await page.evaluate(() => {
            const state = NullMoveAIState.readBattleState(damageResults, {party:{'Minior-Meteor (Hiker Marcster)':{hpPercent:50, moves:[{pp:0,usable:false}]}}});
            const minior = state.party.candidates.find(c => c.name === 'Minior');
            return {hp:minior.hp, maxHP:minior.maxHP, pp:minior.moves[0].pp, usable:minior.moves[0].usable};
        });
        assert.equal(alias.hp, Math.floor(alias.maxHP / 2)); assert.equal(alias.pp, 0); assert.equal(alias.usable, false);
        const row = page.locator('#null-post-ko-team .null-post-ko-row[data-id="Minior (Hiker Marcster)"]');
        await row.locator('button').click();
        assert.equal(await page.locator('.trainer-pok.right-side.null-post-ko-fainted').count(), 2);
        assert.equal((await read()).post.switch.candidates.some(c => c.name === 'Minior'), false);
        await row.locator('button').click();
        assert.deepEqual((await read()).post.switch.candidates.map(c => c.probability), battle.probabilities);
        checks.push('Legacy Meteor HP/PP inputs apply to the logical reserve; KO/Restore crosses both icons, excludes Minior and restores the same ranking.');
        assert.equal(await page.evaluate(() => JSON.stringify(SETDEX_SV)), originalData);
        assert.deepEqual(errors, []);
        const report = {revision:require('./release-config.json').revision, checkedAt:new Date().toISOString(),
            htmlSHA256:sha(fs.readFileSync(entry)), fixtureSHA256:sha(fs.readFileSync(path.join(root,'tests/fixtures/'+version.reserveFormFixture))),
            native, groups, observed:{scores:candidates.map(c => c.score), probabilities:candidates.map(c => c.probability)}, checks, errors};
        fs.writeFileSync(path.join(root, 'verification/reserve-forms-browser.json'), JSON.stringify(report, null, 2) + '\n');
        console.log(JSON.stringify({groups:groups.length, native, checks, errors}, null, 2));
    } finally {await browser.close();}
})().catch(error => {console.error(error.stack || error); process.exitCode = 1;});
