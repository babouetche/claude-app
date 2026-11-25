"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const ai = require("../docs/js/null_ai/core.js");

function move(name, damage, extra = {}) {
    return { name, category: "Physical", priority: 0, effect: "HIT", damage: Array.isArray(damage) ? damage : [damage], ...extra };
}
function status(name, extra = {}) { return move(name, 0, { category: "Status", ...extra }); }
function state(moves) {
    return {
        player: { name: "Player", hp: 500, maxHP: 500, speed: 100, paralyzedSpeed: 25, status: "", ability: "", item: "", types: ["Normal"], boosts: {}, moves: [move("Tackle", 10)] },
        opponent: { name: "Opponent", hp: 450, maxHP: 500, speed: 100, status: "", ability: "", item: "", types: ["Normal"], boosts: {}, moves },
        field: { gameType: "Singles", playerSpikes: 0, playerToxicSpikes: 0, playerStealthRock: false, playerStickyWeb: false },
        context: { playerConfused: false, playerInfatuated: false, playerIncapacitated: false, opponentFirstTurn: true, opponentLastMon: false, playerLastMon: false,
            opponentTeamSize: 6, opponentAliveCount: 6, protectionLastTurn: false, protectionStreak: 0, opponentEndTurnFaint: false,
            opponentCursed: false, opponentInfatuated: false, opponentPerishSong: false, opponentLeechSeeded: false, opponentYawn: false,
            playerCursed: false, playerPerishSong: false, playerLeechSeeded: false, playerYawn: false, playerTrapped: false,
            playerSaltCured: false, opponentLastMove: "", playerLastMove: "", playerSubstitute: false, opponentSubstitute: false }
    };
}
function distribution(s, expected, expectedStatus) {
    const out = ai.getNullAIMoveProbabilities(s);
    assert.ok(["determined", "estimated"].includes(out.status), out.reasons.join(" "));
    if (expectedStatus) assert.equal(out.status, expectedStatus, out.assumptions.join(" "));
    const ps = out.moves.map(m => m.probability);
    assert.ok(ps.every(p => Number.isFinite(p) && p >= 0 && p <= 1));
    assert.ok(Math.abs(ps.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    if (expected) expected.forEach((p, i) => assert.ok(Math.abs(ps[i] - p) < 1e-9, `${ps} != ${expected}`));
    return out;
}

test("default estimates give three equal KOs one third each and identify the RNG assumption", () => {
    const s = state([move("Surf", 600), move("Tackle", 700), move("Pound", 800)]);
    const out = distribution(s, [1 / 3, 1 / 3, 1 / 3], "estimated");
    assert.ok(out.assumptions.some(a => /random score checks.*independent/.test(a)));
    s.context.calculationMode = "strict";
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
});

test("overlapping damage estimates retain the multiplicity of equal rolls", () => {
    const s = state([move("Surf", [10, 10, 20]), move("Tackle", 15)]);
    const out = distribution(s, [1 / 3, 2 / 3], "estimated");
    assert.ok(out.assumptions.some(a => /duplicate damage values/.test(a)));
    s.context.calculationMode = "strict";
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
});

test("the screenshot's Stealth Rock matchup now has finite probabilities", () => {
    const s = state([move("Thunderbolt", [224, 269], { category: "Special" }), move("Ice Beam", [36, 45], { category: "Special" }), status("Stealth Rock"), status("(No Move)")]);
    distribution(s);
    s.field.playerStealthRock = true;
    const out = distribution(s, [1, 0, 0, 0], "estimated");
    assert.ok(out.moves[2].rules.some(r => /maximum layers/.test(r)));
});

test("hazard formula uses living party fraction: 3 of 5 gives a 45% gate", () => {
    const s = state([status("Stealth Rock"), status("Powder")]);
    s.context.opponentFirstTurn = false;
    s.context.opponentTeamSize = 5; s.context.opponentAliveCount = 3;
    s.player.moves[0].type = "Fire";
    distribution(s, [0.225, 0.775], "determined");
});

test("a last-player-Pokemon hazard loses to a normal damage move", () => {
    const s = state([move("Surf", 100), status("Stealth Rock")]);
    s.context.playerLastMon = true;
    distribution(s, [1, 0]);
});

test("mixed and defensive setup routines produce scores based on player attacking category", () => {
    const s = state([move("Surf", 100), status("Iron Defense")]);
    distribution(s, [0.325, 0.675]);
    s.opponent.moves[1] = status("Calm Mind");
    distribution(s, [0.125, 0.875]);
    s.player.ability = "Unaware";
    distribution(s, [1, 0]);
});

test("confusion is supported and an already confused target receives a disclosed useless penalty", () => {
    const s = state([move("Surf", 100), status("Confuse Ray")]);
    distribution(s, [0.53125, 0.46875]);
    s.context.playerConfused = true;
    distribution(s, [1, 0], "estimated");
});

test("Protect uses residual conditions, first-turn behavior and protection history", () => {
    const s = state([move("Surf", 100), status("Protect")]);
    distribution(s, [1, 0]);
    s.context.opponentFirstTurn = false; s.context.playerLeechSeeded = true;
    distribution(s, [0.25, 0.75]);
    s.context.protectionStreak = 2;
    distribution(s, [1, 0]);
});

test("slow recovery below 50% is useful and explicitly labels the ambiguous source ordering", () => {
    const s = state([move("Surf", 100), status("Recover")]);
    s.opponent.hp = 200; s.opponent.speed = 90;
    const out = distribution(s, [0.25, 0.75], "estimated");
    assert.ok(out.assumptions.some(a => /more specific <50%/.test(a)));
});

test("Salt Cure respects the summary: secondary utility does not stack with HDM", () => {
    const s = state([move("Salt Cure", 100), move("Surf", 50)]);
    distribution(s, [1, 0], "determined");
    s.opponent.moves[0].damage = [50]; s.opponent.moves[1].damage = [100];
    distribution(s, [0.45, 0.55]);
    s.player.types = ["Water"];
    distribution(s, [0.775, 0.225]);
});

test("Palafin pivot is an exclusive score, not an additive HDM bonus", () => {
    const s = state([move("Flip Turn", 600), move("Surf", 700)]);
    s.opponent.name = "Palafin";
    distribution(s, [0.375, 0.625]);
});

test("Fake Out stacks its documented +9 with HDM, then becomes unusable after first turn", () => {
    const s = state([move("Fake Out", 100, { priority: 3 }), move("Surf", 150)]);
    distribution(s, [1, 0]);
    s.context.opponentFirstTurn = false;
    distribution(s, [0, 1], "estimated");
});

test("single-hit Focus Sash prevents the estimate from treating the protected target as a KO", () => {
    const s = state([move("Surf", 600), status("Thunder Wave")]);
    s.player.item = "Focus Sash";
    distribution(s, [0.625, 0.375], "estimated");
});

test("Trick Room reverses speed-based KO bonuses while a tie still counts as AI faster", () => {
    const s = state([move("Surf", 600), move("Aqua Jet", 600, { priority: 1 })]);
    s.opponent.speed = 90;
    distribution(s, [0, 1]);
    s.field.trickRoom = true;
    distribution(s, [0.5, 0.5]);
});

test("copied routines disclose predictions and strict mode hides them; incomplete doubles stays unavailable", () => {
    let out = ai.getNullAIMoveProbabilities(state([move("Surf", 100), status("Copycat")]));
    assert.equal(out.status,"estimated");assert.ok(out.assumptions.some(a=>a.includes("predicted player action")));
    const copy=state([move("Surf",100),status("Copycat")]);copy.context.calculationMode="strict";out=ai.getNullAIMoveProbabilities(copy);
    assert.equal(out.status, "unavailable");
    assert.deepEqual(out.moves[1].probabilityBounds, [0, 1]);
    const s = state([move("Surf", 100), status("Protect")]); s.field.gameType = "Doubles";
    out = ai.getNullAIMoveProbabilities(s); assert.equal(out.status, "unavailable");
});

test("adapter estimates are disclosed, strict mode refuses them, and input state is immutable", () => {
    const s = state([move("Surf", 100), move("Tackle", 20)]);
    s.assumptions = ["Aligned multi-hit rolls from the calculator"];
    const before = JSON.stringify(s);
    const out = distribution(s, [1, 0], "estimated");
    assert.ok(out.assumptions.includes(s.assumptions[0]));
    assert.equal(JSON.stringify(s), before);
    s.context.calculationMode = "strict";
    assert.equal(ai.getNullAIMoveProbabilities(s).status, "unavailable");
});

test("independent exact score integration agrees with exhaustive branch aggregation including ties", () => {
    const base = [6, 6, 6], legal = [true, true, true];
    const vars = [0, 1, 2].map(i => ({ outcomes: [{ delta: [], probability: 0.75 }, { delta: base.map((_, j) => i === j ? 2 : 0), probability: 0.25 }] }));
    const scenarios = [];
    for (let mask = 0; mask < 8; mask++) {
        const scores = base.map((v, i) => v + ((mask >> i) & 1 ? 2 : 0));
        const probability = base.reduce((p, _, i) => p * ((mask >> i) & 1 ? 0.25 : 0.75), 1);
        scenarios.push({ scores, probability });
    }
    const expected = ai.aggregateScenarios(scenarios, legal), actual = ai.solveIndependent(base, vars, legal);
    actual.forEach((p, i) => assert.ok(Math.abs(p - expected[i]) < 1e-12));
});
