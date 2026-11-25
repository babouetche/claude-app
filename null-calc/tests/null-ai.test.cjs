"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const ai = require("../docs/js/null_ai/core.js");

function move(name, damage, extras) {
    return Object.assign({ name, category: "Physical", priority: 0, effect: "HIT", damage: Array.isArray(damage) ? damage : [damage] }, extras);
}
function status(name) { return move(name, 0, { category: "Status" }); }
function state(moves, extras) {
    return Object.assign({
        player: { name: "Player", hp: 500, maxHP: 500, speed: 100, paralyzedSpeed: 25, status: "", ability: "", item: "", types: ["Normal"], boosts: {}, moves: [move("Tackle", 10)] },
        opponent: { name: "Opponent", hp: 500, maxHP: 500, speed: 100, status: "", ability: "", item: "", types: ["Normal"], boosts: {}, moves },
        field: { gameType: "Singles" }, context: { calculationMode: "strict", playerConfused: false, playerInfatuated: false }
    }, extras);
}
function determined(s, expected) {
    const output = ai.getNullAIMoveProbabilities(s);
    assert.equal(output.status, "determined", output.reasons.join(" "));
    const actual = output.moves.map(m => m.probability);
    assert.ok(Math.abs(actual.reduce((a, b) => a + b, 0) - 1) < 1e-10);
    actual.forEach((p, i) => assert.ok(Math.abs(p - expected[i]) < 1e-10, `${actual} differs from ${expected}`));
    return output;
}

test("unambiguously strongest move is selected for every damage and score outcome", () => {
    determined(state([move("Surf", [100, 110]), move("Tackle", [10, 20]), move("Scratch", [15, 25]), move("Pound", [1, 2])]), [1, 0, 0, 0]);
});
test("two equal killing moves split equally even with unspecified boost correlation", () => {
    const s = state([move("Surf", 600), move("Tackle", 700)]);
    const output = determined(s, [0.5, 0.5]);
    assert.ok(output.moves[0].rules.some(r => r.includes("fast/priority KO")));
});
test("three equal killing moves need the missing joint random law", () => {
    const output = ai.getNullAIMoveProbabilities(state([move("Surf", 600), move("Tackle", 700), move("Pound", 800)]));
    assert.equal(output.status, "unavailable");
    assert.match(output.reasons[0], /joint law/);
    assert.deepEqual(output.moves.map(m => m.probability), [null, null, null]);
});
test("damage immunity loses to a usable positive damaging move", () => {
    determined(state([move("Thunderbolt", 0), move("Ice Beam", [20, 25])]), [0, 1]);
});
test("an immune move is never falsely preferred over a penalized status move", () => {
    const s = state([move("Surf", 0), status("Thunder Wave")]); s.opponent.item = "Choice Specs";
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
});
test("zero PP and explicitly unusable moves have zero probability", () => {
    determined(state([move("Surf", 1000, { pp: 0 }), move("Tackle", 20), move("Pound", 900, { usable: false }), move("(No Move)", 0)]), [0, 1, 0, 0]);
});
test("one legal move does not need scores from an unsupported routine", () => {
    determined(state([status("Protect"), move("(No Move)", 0)]), [1, 0]);
});
test("HDM bonus competes with paralysis +1: 25% damage, 75% paralysis", () => {
    determined(state([move("Surf", [80, 100]), status("Thunder Wave")]), [0.25, 0.75]);
});
test("player speed change reverses the paralysis ordering: 12.5% / 87.5%", () => {
    const s = state([move("Surf", [80, 100]), status("Thunder Wave")]);
    s.player.speed = 120; s.player.paralyzedSpeed = 30;
    determined(s, [0.125, 0.875]);
});
test("confusion and infatuation affect paralysis scoring; missing state is withheld", () => {
    const s = state([move("Surf", 80), status("Thunder Wave")]);
    s.context.playerConfused = true;
    determined(s, [0.125, 0.875]);
    s.context.playerConfused = false; s.context.playerInfatuated = true;
    determined(s, [0.125, 0.875]);
    delete s.context.playerInfatuated;
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
});
test("player HP changes a KO into a no-KO and changes the distribution", () => {
    const s = state([move("Surf", [80, 100]), status("Thunder Wave")]);
    s.player.hp = 50;
    determined(s, [1, 0]);
    s.player.hp = 500;
    determined(s, [0.25, 0.75]);
});
test("ambiguous damage ranges are withheld, not uniformly guessed", () => {
    const output = ai.getNullAIMoveProbabilities(state([move("Surf", [10, 20]), move("Tackle", [15, 25])]));
    assert.equal(output.status, "unavailable");
    assert.match(output.reasons[0], /Damage-roll positions/);
});
test("slow priority KO beats a slow ordinary KO using the documented bonuses", () => {
    const s = state([move("Aqua Jet", 600, { priority: 1 }), move("Surf", 700)]);
    s.opponent.speed = 90;
    determined(s, [1, 0]);
});
test("guaranteed secondary does not stack status base with HDM", () => {
    determined(state([move("Nuzzle", 700, { guaranteedEffect: true }), move("Surf", 600)]), [0.5, 0.5]);
});
test("Choice status penalty uses documented exceptions", () => {
    const s = state([move("Surf", 80), status("Thunder Wave")]); s.opponent.item = "Choice Specs";
    determined(s, [1, 0]);
});
test("healthy recovery is discouraged by exactly one point", () => {
    const s = state([move("Surf", 80), status("Recover")]); s.opponent.hp = 450;
    const output = determined(s, [1, 0]);
    assert.ok(output.moves[1].rules.some(r => r.includes("default false -1")));
});
test("contradictory slow recovery thresholds are explicitly unavailable", () => {
    const s = state([move("Surf", 80), status("Recover")]); s.opponent.speed = 90; s.opponent.hp = 200;
    const output = ai.getNullAIMoveProbabilities(s);
    assert.equal(output.status, "unavailable"); assert.match(output.reasons[0], /more specific/);
});
test("strict hazard routine requires the relevant battle context", () => {
    const output = ai.getNullAIMoveProbabilities(state([move("Surf", 80), status("Stealth Rock")]));
    assert.equal(output.status, "unavailable"); assert.match(output.reasons[0], /Stealth Rock/);
});
test("HDM Salt Cure follows summary while strict blocked status moves remain unavailable", () => {
    determined(state([move("Salt Cure", 80), move("Surf", 10)]), [1, 0]);
    const s = state([move("Surf", 80), Object.assign(status("Growl"), { statusBlocked: true })]);
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
    s.opponent.moves[1] = status("Thunder Wave"); s.opponent.ability = "Prankster"; s.player.types = ["Dark"];
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
});
test("blocked stat drops and repeated field effects cannot yield invented probabilities", () => {
    const s = state([move("Surf", 80), status("Scary Face")]);
    s.player.item = "Clear Amulet";
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
    s.player.item = ""; s.player.boosts.spe = -6;
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
    s.opponent.moves[1] = status("Agility"); s.opponent.boosts.spe = 6;
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
    s.opponent.moves[1] = Object.assign(status("Gravity"), { fieldAlreadyActive: true });
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
});
test("doubles and fainted battlers have no invented distribution", () => {
    const s = state([move("Surf", 80), move("Tackle", 10)]);
    s.field.gameType = "Doubles";
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
    s.field.gameType = "Singles"; s.player.hp = 0;
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
});
test("no legal moves reports Struggle separately instead of normalizing zeros", () => {
    const output = ai.getNullAIMoveProbabilities(state([move("Surf", 80, { pp: 0 }), move("(No Move)", 0)]));
    assert.equal(output.status, "no-legal-moves"); assert.deepEqual(output.moves.map(m => m.probability), [0, 0]);
});
test("invalid PP cannot produce a plausible percentage", () => {
    const output = ai.getNullAIMoveProbabilities(state([move("Surf", 80, { pp: -1 }), move("Tackle", 10)]));
    assert.equal(output.status, "unavailable"); assert.match(output.reasons[0], /PP/);
});
test("missing Pokemon and partial move data fail without throwing", () => {
    assert.equal(ai.getNullAIMoveProbabilities(null).status, "unavailable");
    const s = state([null, move("Tackle", 10)]);
    const output = ai.getNullAIMoveProbabilities(s);
    assert.equal(output.status, "unavailable");
    assert.deepEqual(output.moves.map(m => m.probability), [null, null]);
});
test("joint branches reaching the same move are added, ties split uniformly", () => {
    assert.deepEqual(ai.aggregateScenarios([
        { probability: 0.5, scores: [8, 6, 0, 0] },
        { probability: 0.25, scores: [6, 8, 0, 0] },
        { probability: 0.25, scores: [6, 6, 0, 0] }
    ], [true, true, false, false]), [0.625, 0.375, 0, 0]);
});
test("joint branch mass is checked before any normalization", () => {
    assert.throws(() => ai.aggregateScenarios([{ probability: 0.75, scores: [8, 6] }], [true, true]), /sum to 1/);
});
test("rounding and evaluation do not mutate source battle state", () => {
    const s = state([move("Surf", 80), status("Thunder Wave")]); const before = JSON.stringify(s);
    determined(s, [0.25, 0.75]); assert.equal(JSON.stringify(s), before);
});

test("forced Choice or Encore slot eliminates every other move", () => {
    const s = state([move("Surf", 600), status("Protect"), move("Tackle", 50)]);
    s.context.forcedMoveSlot = 1;
    determined(s, [0, 1, 0]);
    s.opponent.moves[1].pp = 0;
    const result = ai.getNullAIMoveProbabilities(s);
    assert.equal(result.status, "no-legal-moves");
    assert.deepEqual(result.moves.map(m => m.probability), [0, 0, 0]);
});
test("invalid forced slot is unavailable", () => {
    const s = state([move("Surf", 100), move("Tackle", 10)]);
    s.context.forcedMoveSlot = 7;
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
});
test("draining attack gets documented low-HP bonus, except against Liquid Ooze", () => {
    const s = state([move("Giga Drain", 140, { drain: true }), move("Surf", 200)]);
    s.opponent.hp = 200;
    determined(s, [0.375, 0.625]);
    s.opponent.item = "Big Root";
    determined(s, [0.75, 0.25]);
    s.player.ability = "Liquid Ooze";
    determined(s, [0, 1]);
});
test("uncertain drain four-hit threshold never uses invented roll odds", () => {
    const s = state([move("Giga Drain", [100, 150], { drain: true }), move("Surf", 200)]);
    s.opponent.hp = 200;
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
});
test("evasion setup uses the documented HP-dependent random check", () => {
    const s = state([status("Double Team"), status("Recover")]);
    s.opponent.hp = 450;
    determined(s, [1, 0]);
    s.player.ability = "Unaware";
    determined(s, [0, 1]);
});
test("Powder reads the player's actual Fire moves", () => {
    const s = state([move("Surf", 80), status("Powder")]);
    determined(s, [1, 0]);
    s.player.moves[0].type = "Fire";
    determined(s, [0.25, 0.75]);
});
test("Topsy Turvy compares sums of positive and negative boosts", () => {
    const s = state([move("Surf", 80), status("Topsy-Turvy")]);
    determined(s, [1, 0]);
    s.player.boosts = { atk: 2, def: -1 };
    determined(s, [0.25, 0.75]);
});
test("empty player move slots are not status moves for Taunt", () => {
    const s = state([status("Taunt"), status("Recover")]);
    s.opponent.hp = 450;
    s.player.moves = [status("(No Move)")];
    determined(s, [0.75, 0.25]);
    s.player.moves.push(status("Growl"));
    determined(s, [1, 0]);
});
test("documented thawing bonus can make a lower-damage attack win", () => {
    const s = state([move("Surf", 100), move("Scald", 70, { thawsUser: true })]);
    determined(s, [1, 0]);
    s.opponent.status = "frz";
    determined(s, [0, 1]);
    s.opponent.status = "fbt";
    determined(s, [0, 1]);
});
test("invalid stat stages and negative speeds do not produce percentages", () => {
    const s = state([move("Surf", 100), move("Tackle", 20)]);
    s.player.boosts.atk = 7;
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
    s.player.boosts.atk = 0; s.player.speed = -1;
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
});
