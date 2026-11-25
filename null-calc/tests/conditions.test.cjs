'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../docs/js/run/conditions.js');
const C = globalThis.NullTrainerConditions;

test('conditions : nom exact, double « A & B [Double] », rien pour un autre dresseur', () => {
  const map = { 'Youngster Calvin': 'Gauntlet', 'Hiker Clark & Youngster Johnson [Double]': 'B2B', 'Leader Winona': 'Perma Rain + Electric Terrain · Gauntlet' };
  assert.deepEqual(C.conditionsFor('Youngster Calvin', map), ['Gauntlet']);
  assert.deepEqual(C.conditionsFor('Youngster Johnson', map), ['B2B']);
  assert.deepEqual(C.conditionsFor('Hiker Clark & Youngster Johnson', map), ['B2B']);
  assert.deepEqual(C.conditionsFor('Leader Winona', map), ['Perma Rain + Electric Terrain', 'Gauntlet']);
  assert.deepEqual(C.conditionsFor('Youngster Calvi', map), []);
  assert.deepEqual(C.conditionsFor('', map), []);
});
