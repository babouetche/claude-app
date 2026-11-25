'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { predict } = require('../docs/js/null_ai/post_ko.js');
function mon(id, speed, damage, other = {}) {
    return Object.assign({ id, name: id, partyIndex: 0, hp: 100, maxHP: 100, speed, alive: true,
        incomingDamage: [20], moves: [{name:'Tackle',category:'Physical',bp:80,damage:[damage]}] }, other);
}
function state(candidates) {
    return {player:mon('Player',100,20),opponent:mon('Active',80,20),field:{gameType:'Singles'},
        context:{switchScenario:'no-switch'},party:{complete:true,trainerName:'Fixture',candidates}};
}
test('forced replacement uses the faster OHKO reserve, excluding the displayed opponent', () => {
    const s = state([mon('Active',200,200,{active:true}),mon('Fast',150,100,{partyIndex:1}),mon('Slow',50,100,{partyIndex:2})]);
    const before = JSON.stringify(s), r = predict(s);
    assert.equal(r.reason,'ranked');
    assert.equal(r.switch.probability,1);
    assert.equal(r.candidates[0].eligibility,'active');
    assert.equal(r.candidates[1].probability,1);
    assert.equal(r.candidates[2].probability,0);
    assert.equal(JSON.stringify(s),before,'preview must not mutate live state');
});
test('Trick Room reverses the entrant selected by the speed/OHKO rule', () => {
    const s = state([mon('Fast',150,100),mon('Slow',50,100,{partyIndex:1})]);
    assert.equal(predict(s).candidates[0].probability,1);
    s.field.trickRoom = true;
    assert.equal(predict(s).candidates[1].probability,1);
});
test('party order resolves equal post-KO scores and fainted reserves are excluded', () => {
    const s = state([mon('First',150,100),mon('Second',160,100,{partyIndex:1})]);
    assert.equal(predict(s).candidates[0].probability,1);
    s.party.candidates[0].alive = false;
    const r = predict(s);
    assert.equal(r.candidates[0].eligibility,'fainted');
    assert.equal(r.candidates[1].probability,1);
});
test('no reserves, entry-hazard KOs and unsupported doubles have separate explanations', () => {
    assert.equal(predict(state([mon('Active',100,100,{active:true})])).reason,'no-reserves');
    const s = state([mon('Fragile',100,100,{entryHazardDamage:100})]);
    assert.equal(predict(s).reason,'entry-ko');
    s.field.gameType = 'Doubles';
    assert.equal(predict(s).reason,'doubles');
    s.party.complete = false; s.field.gameType = 'Singles';
    assert.equal(predict(s).reason,'unknown-team');
    assert.equal(predict(null).reason,'incomplete');
});
test('strict mode uses the verified no-variance reserve damage and immediate damage is opt-in', () => {
    const s = state([mon('Fast',150,30),mon('Slow',50,30,{partyIndex:1})]);
    s.context.calculationMode='strict';
    s.party.candidates[0].incomingDamage=[20,100];
    // ROM 0x08082060/0x080820e2 explicitly disable the random damage roll.
    // Overlapping battle rolls alone therefore do not make this score unknown.
    assert.deepEqual(predict(s).switch.candidates.map(c=>c.probability),[0,1]);
    s.context.calculationMode='estimate';
    s.context.immediateSwitchDamage = true;
    s.party.candidates[0].incomingDamage=[100];
    assert.equal(predict(s).candidates[0].score,1,'ordinary post-KO does not inherit a pivot penalty');
    assert.equal(predict(s,{immediateDamage:true}).candidates[0].score,-2);
});
test('an approximated OHKO never becomes a certified destination in strict mode', () => {
    const s = state([mon('Approximate',150,100),mon('Slow',50,100,{partyIndex:1})]);
    s.party.candidates[0].moves[0].damageEstimated = true;
    let r = predict(s);
    assert.equal(r.candidates[0].probability,1);
    assert.equal(r.candidates[0].probabilityStatus,'estimated');
    s.context.calculationMode = 'strict'; r = predict(s);
    assert.ok(r.switch.candidates.every(c=>c.probability === null));
});
test('documented doubles post-KO still forces entry when every reserve score is negative', () => {
    const s=state([mon('Active',80,20,{active:true}),mon('Partner',80,20,{active:true,partnerActive:true,partyIndex:1}),
        mon('First',50,20,{partyIndex:2,incomingDamage:[100]}),mon('Second',60,20,{partyIndex:3,incomingDamage:[100]})]);
    s.field.gameType='Doubles';s.context.doublesComplete=true;
    let r=predict(s);assert.equal(r.reason,'ranked');assert.equal(r.switch.probability,1);
    assert.deepEqual(r.switch.candidates.map(c=>c.score),[-1,-1]);
    assert.deepEqual(r.switch.candidates.map(c=>c.probability),[null,null]);
    assert.equal(r.candidates[1].eligibility,'partner');
    r=predict(s,{immediateDamage:true});assert.deepEqual(r.switch.candidates.map(c=>c.score),[-2,-2]);
    assert.deepEqual(r.switch.candidates.map(c=>c.probability),[null,null]);
});
test('doubles Support gets its documented 10 percent bonus and party order breaks the other tie', () => {
    const support=mon('Support',150,100,{partyIndex:1});support.moves[0].bp=70;
    const s=state([mon('First',150,100),support]);s.field.gameType='Doubles';s.context.doublesComplete=true;
    const r=predict(s);assert.ok(Math.abs(r.candidates[0].probability-.9)<1e-12);
    assert.ok(Math.abs(r.candidates[1].probability-.1)<1e-12);
    s.field.trickRoom=true;assert.ok(Math.abs(predict(s).candidates[1].probability-.1)<1e-12);
});
test('Support at base score -1 never gains a bonus after an immediate-entry penalty', () => {
    const ordinary=mon('Ordinary',50,20,{incomingDamage:[100]});
    const support=mon('Support',50,20,{partyIndex:1,incomingDamage:[100]});support.moves[0].bp=70;
    const s=state([ordinary,support]);s.field.gameType='Doubles';s.context.doublesComplete=true;
    const r=predict(s,{immediateDamage:true});assert.deepEqual(r.switch.candidates.map(c=>c.score),[-2,-2]);
    assert.deepEqual(r.switch.candidates.map(c=>c.probability),[null,null]);
});
