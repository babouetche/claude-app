'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {audit}=require('../scripts/audit-numeric-inputs.cjs');
test('every constructible trainer set has correct numeric reserve and doubles-partner statistics',()=>{
 const r=audit();assert.equal(r.totalSets,2280);assert.equal(r.verifiedSets+r.excluded.length,r.totalSets);
 assert.equal(r.affectedSets,152);assert.equal(r.verifiedStringSets,r.affectedSets);
 assert.equal(r.affectedKnownPartySets,124);assert.equal(r.affectedBankSets,27);assert.equal(r.affectedUnreadablePartySets,1);
 assert.ok(r.affected.filter(e=>e.trainer==='Leader Roxanne').every(e=>e.partyKind==='known-party'),'Mega aliases must not make a confirmed team look like a bank');
 assert.deepEqual(r.failures,[]);assert.deepEqual(r.dexStrings,[]);assert.deepEqual(r.metadataStrings,[]);
 assert.equal(r.trainerDataUnchanged,true);assert.equal(r.protectedFiles,147);
});
