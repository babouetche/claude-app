'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const baseline = require('./fixtures/input-archive.json');
const root = path.resolve(__dirname, '..');
test('every protected data and damage file is byte-for-byte identical to the user ZIP', () => {
    for (const [file, expected] of Object.entries(baseline.hashes)) {
        const bytes = fs.readFileSync(path.join(root, file));
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected, file);
    }
});
