const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const baseline = require('./fixtures/null-baseline.json');
const removed = require('./fixtures/removed-smogon-sets.json');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sha = source => crypto.createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');

test('all 50 protected Null data, import, order and damage files match the original', () => {
    for (const [file, digest] of Object.entries(baseline.hashes)) assert.equal(sha(read(file)), digest, file);
});
// The exact supplied ZIP is protected by input-preservation.test.cjs. These
// portable tests require neither a Git checkout nor the original upstream.
test('all 2280 Null sets and their indices, trainer names and order are intact', () => {
    const context = {};
    vm.runInNewContext(read('docs/js/data/sets/gen9.js'), context);
    const dex = context.SETDEX_SV, trainers = new Set(), indices = [];
    for (const sets of Object.values(dex)) for (const [trainer, set] of Object.entries(sets)) {
        trainers.add(trainer); indices.push(set.index);
    }
    assert.equal(Object.keys(dex).length, baseline.species);
    assert.equal(indices.length, baseline.sets);
    assert.equal(trainers.size, baseline.trainers);
    assert.deepEqual(indices.slice().sort((a, b) => a - b), Array.from({ length: 2280 }, (_, i) => i));
    // The byte-level fixture above also locks every original field and both
    // object insertion orders; this does not rebuild or sort runtime datasets.
    assert.equal(sha(read('docs/js/data/sets/gen9.js')), baseline.hashes['docs/js/data/sets/gen9.js']);
});
test('foreign Smogon presets are absent while every import container remains usable', () => {
    for (const group of removed) {
        const context = {};
        vm.runInNewContext(read(group.file), context);
        assert.deepEqual(Object.keys(context[group.symbol]), []);
        context[group.symbol]['Pikachu'] = { 'Imported Null set': { moves: ['Thunderbolt'] } };
        assert.equal(context[group.symbol].Pikachu['Imported Null set'].moves[0], 'Thunderbolt');
        assert.equal(group.removed.length, group.sets);
    }
});
test('AI numeric metadata uses the pinned ROM before the historical Pokédex', () => {
    const context = { exports: {} };
    vm.runInNewContext(read('docs/js/data/nulldex/moves.js'), context);
    vm.runInNewContext(read('docs/js/null_ai/metadata.js'), context);
    const rom = require('./fixtures/' + require('../scripts/release-config.json').romFixture);
    for (const move of Object.values(context.exports.BattleMovedex)) {
        const data = context.NullAIMoveMetadata[move.name];
        const native = rom.moves[move.name];
        assert.equal(data.accuracy, native ? native.accuracy : move.accuracy === true ? 101 : move.accuracy);
        if(native){assert.equal(data.basePower,native.basePower);assert.equal(data.pp,native.pp);assert.equal(data.priority,native.priority);}
        assert.equal(data.thawsUser, !!(move.flags && move.flags.defrost));
    }
});
test('the page and its template load all added scripts and styles from local files', () => {
    for (const html of ['docs/index.html', 'docs/index.template.html']) {
        const source = read(html);
        for (const file of ['metadata', 'core', 'state', 'switch', 'ui']) {
            assert.ok(source.includes(`./js/null_ai/${file}.js`));
            assert.ok(fs.existsSync(path.join(root, 'docs/js/null_ai', file + '.js')));
        }
        assert.ok(source.includes('./css/null-ai.css'));
    }
});
