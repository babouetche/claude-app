"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const ai = require("../docs/js/null_ai/switch.js");
const attack = (damage, extras) => Object.assign({name: "Surf", category: "Special", bp: 90, damage: [damage]}, extras);
function state(extras) {
    return Object.assign({
        player: {name: "Player", hp: 100, maxHP: 100, speed: 100, item: "", ability: "", moves: [attack(60)]},
        opponent: {name: "Opponent", hp: 100, maxHP: 100, speed: 90, item: "", ability: "", boosts: {}, moves: [attack(60)]},
        field: {gameType: "Singles", weather: "", terrain: ""}, context: {opponentTurnsActive: 1},
        party: {complete: true, candidates: [{id: "Reserve", name: "Reserve", partyIndex: 0, hp: 100, maxHP: 100, alive: true, active: false, speed: 90, switchScore: 2, moves: [attack(60)], incomingDamage: [20]}]}
    }, extras);
}
test("no valid reserve means no switch, even for Perish Song", () => {
    const s = state(); s.party.candidates[0].alive = false; s.context.perishNextTurn = true;
    assert.equal(ai.getSwitchProbabilities(s).probability, 0);
});
test("Perish Song guarantees a switch only into a nonnegative candidate", () => {
    const s = state(); s.context.perishNextTurn = true;
    assert.equal(ai.getSwitchProbabilities(s).probability, 1);
    s.party.candidates[0].switchScore = -1;
    assert.equal(ai.getSwitchProbabilities(s).probability, 0);
});
test("a slow OHKOed Palafin guarantees a switch", () => {
    const s = state(); s.opponent.name = "Palafin-Zero"; s.player.moves[0].damage = [120];
    assert.equal(ai.getSwitchProbabilities(s).probability, 1);
    s.party.candidates[0].switchScore = -1;
    assert.equal(ai.getSwitchProbabilities(s).probability, 0);
});
test("Anti-Setup switches nominal 40% and two ties split equally", () => {
    const s = state(); s.context.opponentTurnsActive = 2; s.context.allMovesUseless = true;
    s.party.candidates.push(Object.assign({}, s.party.candidates[0], {id: "Second", partyIndex: 1}));
    const result = ai.getSwitchProbabilities(s);
    assert.equal(result.probability, 0.4);
    assert.deepEqual(result.candidates.map(c => c.probability), [0.5, 0.5]);
});
test("Anti-Setup Plus alone may select negative-score reserves", () => {
    const s = state(); s.context.opponentTurnsActive = 26; s.party.candidates[0].switchScore = -1;
    assert.equal(ai.getSwitchProbabilities(s).probability, 0.4);
    s.context.opponentTurnsActive = 25;
    assert.equal(ai.getSwitchProbabilities(s).probability, 0);
});
test("Walled respects the 10% and residual-recovery 20% threshold", () => {
    const s = state(); s.context.opponentTurnsActive = 6; s.opponent.moves[0].damage = [15];
    assert.equal(ai.getSwitchProbabilities(s).probability, 0);
    s.context.opponentLeechSeeded = true;
    assert.equal(ai.getSwitchProbabilities(s).probability, 0.2);
});
test("Avoid Switch prevents Support, Weather, Walled and Anti-Stall", () => {
    const s = state(); s.context.opponentTurnsActive = 15; s.opponent.moves[0].damage = [5]; s.opponent.boosts.atk = 1;
    assert.equal(ai.getSwitchProbabilities(s).probability, 0);
    s.opponent.boosts = {}; s.player.moves.push(attack(1, {name: "Pursuit"}));
    assert.equal(ai.getSwitchProbabilities(s).probability, 0);
});
test("Support definition excludes utility moves and Imposter", () => {
    assert.equal(ai.isSupport({ability: "", moves: [attack(30, {name: "Knock Off", bp: 65}), attack(30, {name: "Rock Tomb", bp: 60})]}), true);
    assert.equal(ai.isSupport({ability: "Imposter", moves: [{name: "Transform", category: "Status", bp: 0}]}), false);
    assert.equal(ai.isSupport({moves: [attack(60)]}), false);
});

test("1.2.6 early slow OHKO rejection loses the Sash/Sturdy exemption after entry damage", () => {
    const s=state(),c={...s.party.candidates[0],switchScore:undefined,speed:90,
        hp:100,maxHP:100,item:"Focus Sash",nativeSashSturdyProtected:true,
        moves:[attack(130)],incomingDamage:[120],entryHazardDamage:12};
    let scored=ai.scoreCandidate(c,s,false);
    assert.equal(scored.score,-1);
    assert.equal(scored.scoreDamage.hitsToBeKOed,2,"later native hit wrapper still reads raw HP/protection");
    c.entryHazardDamage=0;
    assert.equal(ai.scoreCandidate(c,s,false).score,4);
    c.item="";c.ability="Sturdy";c.entryHazardDamage=12;
    assert.equal(ai.scoreCandidate(c,s,false).score,-1);
});
test("Regenerator uses recovered image formula HP < two thirds", () => {
    const s = state(); s.opponent.ability = "Regenerator"; s.opponent.hp = 65;
    assert.equal(ai.getSwitchProbabilities(s).probability, 0.4);
    s.opponent.hp = 66;
    assert.equal(ai.getSwitchProbabilities(s).probability, 0);
});
test("Weather and Anti-Stall use their documented 20% routines", () => {
    const s = state(); s.context.opponentTurnsActive = 2; s.opponent.ability = "Drought";
    assert.equal(ai.getSwitchProbabilities(s).probability, 0.2);
    s.field.weather = "Sun";
    assert.equal(ai.getSwitchProbabilities(s).probability, 0);
    s.context.opponentTurnsActive = 13;
    assert.equal(ai.getSwitchProbabilities(s).probability, 0.2);
});
test("absorption uses the reserve talent and does not retrigger an active immunity", () => {
    const s = state(); s.context.opponentTurnsActive=2; s.opponent.ability = "Water Absorb"; s.context.playerLastMoveInfo = attack(60,{type:"Water"});
    s.party.candidates[0].ability="Water Absorb";
    assert.equal(ai.getSwitchProbabilities(s).probability, 0);
    s.opponent.ability="";
    assert.equal(ai.getSwitchProbabilities(s).probability, 0.75);
});
test("post-KO negative maxima expose the unprovided native fallback", () => {
    const s = state(); s.context.switchScenario = "post-ko"; s.party.candidates[0].switchScore = -1;
    s.party.candidates.push(Object.assign({}, s.party.candidates[0], {id: "Second", partyIndex: 1}));
    const result = ai.getSwitchProbabilities(s);
    assert.equal(result.probability, 1); assert.equal(result.fallbackRequired,true); assert.deepEqual(result.candidates.map(c => c.probability), [null, null]);
});
test("entry hazards may eliminate a candidate, Trick Room reverses switch score speed", () => {
    const s = state(); s.context.perishNextTurn = true; s.party.candidates[0].entryHazardDamage = 100;
    assert.equal(ai.getSwitchProbabilities(s).probability, 0);
    const candidate = {name: "Slow", hp: 100, speed: 50, moves: [attack(120)], incomingDamage: [10]};
    assert.equal(ai.scoreCandidate(candidate, s).score, 4);
    s.field.trickRoom = true;
    assert.equal(ai.scoreCandidate(candidate, s).score, 5);
});
test("party pools cannot be silently treated as an actual trainer team", () => {
    const s = state(); s.party.complete = false;
    assert.equal(ai.getSwitchProbabilities(s).probability, null);
    s.context.switchScenario = "guaranteed";
    const result = ai.getSwitchProbabilities(s);
    assert.equal(result.probability, 1); assert.equal(result.status, "estimated");
});
test("a probably scenario is explicitly a user assumption", () => {
    const s = state(); s.context.switchScenario = "probably"; s.context.assumedSwitchProbability = 0.65;
    const result = ai.getSwitchProbabilities(s);
    assert.equal(result.probability, 0.65); assert.equal(result.status, "estimated");
    assert.match(result.assumptions.join(" "), /utilisateur/);
});
test("move probabilities include switch and preserve the conditional distribution", () => {
    const moves = {status: "determined", moves: [{move: "Surf", probability: 0.75}, {move: "Ice Beam", probability: 0.25}]};
    const output = ai.composeActionProbabilities(moves, {probability: 0.2, status: "determined"});
    assert.ok(Math.abs(output.moves[0].probability - 0.6) < 1e-10);
    assert.equal(output.moves[1].probability, 0.2); assert.equal(output.moves[0].conditionalProbability, 0.75);
    assert.ok(Math.abs(output.moves.reduce((sum, m) => sum + m.probability, 0) + output.probability - 1) < 1e-10);
    assert.deepEqual(ai.composeActionProbabilities(moves, {probability: 1}).moves.map(m => m.probability), [0, 0]);
});
test("overlapping native checks continue after a failed roll with nominal probabilities", () => {
    const s = state(); s.context.opponentTurnsActive = 13; s.context.playerLastMoveInfo=attack(60,{type:"Water"});s.party.candidates[0].ability="Water Absorb";
    const result = ai.getSwitchProbabilities(s);
    assert.ok(Math.abs(result.probability-0.8)<1e-12); assert.equal(result.probabilityStatus, "estimated");
    s.context.calculationMode = "strict";
    assert.equal(ai.getSwitchProbabilities(s).probability, null);
});
