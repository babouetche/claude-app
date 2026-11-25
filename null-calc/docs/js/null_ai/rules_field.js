(function(root, factory) {
    "use strict";
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.NullAIRulesField = factory();
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";
    // Hazards, screens, weather/terrain, rooms and phazing.
    // order preserves the previous core's branch precedence across
    // families. run(frame) returns true only when this move's routine ends.
    // The frame owns score buffers/callbacks; families retain no battle state.
    function createRules(h) {
        var names = h.names, hasMove = h.hasMove, stat = h.stat, category = h.category, fasterAtSpeeds = h.fasterAtSpeeds, fail = h.fail, assume = h.assume, fact = h.fact, HAZARDS = h.HAZARDS;
        return [
            { order: 130, id: "hazards", run: function(f) {
                var s = f.state, player = f.player, i = f.slot, applyUtility = f.applyUtility, routine = f.routine, add = f.add, roll = f.roll, branch = f.branch, useless = f.useless;
                if (applyUtility && HAZARDS.has(routine)) {
                    var field = s.field || {}, key = { "Stealth Rock": "playerStealthRock", "Stone Axe": "playerStealthRock", "Spikes": "playerSpikes", "Ceaseless Edge": "playerSpikes", "Toxic Spikes": "playerToxicSpikes", "Sticky Web": "playerStickyWeb" }[routine];
                    if (typeof field[key] === "undefined") assume(s, "Hazard state for " + routine + " was not entered; assuming no existing layers.");
                    var layers = Number(field[key] || 0), capped = /Spikes/.test(key) ? (key === "playerToxicSpikes" ? 2 : 3) : 1;
                    if (layers >= capped && !["Stone Axe", "Ceaseless Edge"].includes(routine)) { useless(i, "hazard already at maximum layers"); return true; }
                    if (fact(s, "playerLastMon")) { add(i, -10, "Hazards: player last Pokemon -10; native branch ends here"); return true; }
                    if (fact(s, "opponentFirstTurn")) {
                        if (routine === "Sticky Web") add(i, 3, "Sticky Web: first turn +3");
                        else if (routine === "Toxic Spikes" || !fact(s, "opponentLastMon")) roll(i, 2, 0.98, "Hazards: native first-turn bonus +2 (98%)");
                    }
                    var total = Number(fact(s, "opponentTeamSize")), alive = Number(fact(s, "opponentAliveCount"));
                    if (!Number.isInteger(total) || total < 1 || total > 6 || !Number.isInteger(alive) || alive < 1 || alive > total) fail("Invalid opposing party counts for hazards.");
                    var hazardBonus=.75*alive/total;
                    if (routine === "Ceaseless Edge") {
                        if (layers >= 1) roll(i,-1,.98,"Ceaseless Edge: existing Spikes layer -1 (98%)");
                        roll(i,1,hazardBonus,"Ceaseless Edge: independent living-team hazard bonus +1");
                    } else if (["Spikes", "Toxic Spikes"].includes(routine) && layers >= 1)
                        branch(i,[{amount:-1,probability:.98},{amount:1,probability:.02*hazardBonus},{amount:0,probability:.02*(1-hazardBonus)}],"Spikes/Toxic Spikes: existing-layer malus, ELSE bonus; mutually exclusive C branches");
                    else roll(i,1,hazardBonus,"Hazards: +1 with probability 75% × living AI team / total AI team");
                    // The old shared C fell through into Spikes a second time
                    // for damaging hazards. That bug is fixed in Null 1.2.5.
                    return true;
                }
                return false;
            } },
            { order: 190, id: "screens", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, m = f.move, i = f.slot, add = f.add, roll = f.roll, useless = f.useless;
                if (["Light Screen", "Reflect", "Aurora Veil"].includes(m.name)) {
                    var shouldScreen = m.name === "Reflect" ? category(player, "Physical") : m.name === "Light Screen" ? category(player, "Special") : s.field && ["Snow", "Hail"].includes(s.field.weather);
                    if (m.name === "Aurora Veil" && !shouldScreen) { useless(i, "Aurora Veil requires snow/hail"); return true; }
                    if (shouldScreen) { roll(i, 1, 0.5, "Screens: suitable attacking category/weather +1 (50%)"); if (ai.item === "Light Clay") add(i, 1, "Screens: Light Clay +1"); }
                    return true;
                }
                return false;
            } },
            { order: 330, id: "weather-terrain", run: function(f) {
                var m = f.move, i = f.slot, add = f.add, roll = f.roll, useless = f.useless;
                if (["Sunny Day", "Rain Dance", "Sandstorm", "Hail", "Snowscape", "Electric Terrain", "Grassy Terrain", "Misty Terrain", "Psychic Terrain"].includes(m.name)) {
                    if (m.fieldAlreadyActive) fail("The exact useless field-move penalty is not specified.");
                    add(i, 2, "Weather/Terrain: +2");
                    if (m.extendedByItem) roll(i, 1, 0.8, "Weather/Terrain: duration item +1 (80%)");
                    return true;
                }
                return false;
            } },
            { order: 350, id: "gravity", run: function(f) {
                var m = f.move, i = f.slot, base = f.base, variables = f.variables, traces = f.traces;
                if (m.name === "Gravity") {
                    if (m.fieldAlreadyActive) fail("Repeated field-effect scoring is not fully specified.");
                    traces[i].push("Gravity: 50% outer gate; +4 (75%) / +5 (25%) inside it");
                    var four = base.map(function() { return 0; }), five = four.slice(); four[i] = 4; five[i] = 5;
                    variables.push({ outcomes: [
                        { delta: [], probability: 0.5 }, { delta: four, probability: 0.375 }, { delta: five, probability: 0.125 }
                    ] });
                    return true;
                }
                return false;
            } },
            { order: 360, id: "field-sport", run: function(f) {
                var m = f.move, i = f.slot, roll = f.roll;
                if (["Mud Sport", "Water Sport", "Magic Room"].includes(m.name)) {
                    if (m.fieldAlreadyActive) fail("Repeated field-effect scoring is not fully specified.");
                    roll(i, 3, 0.25, "Field move: +3 (25%)"); return true;
                }
                return false;
            } },
            { order: 370, id: "trick-room-tailwind", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, fast = f.fast, m = f.move, i = f.slot, add = f.add, roll = f.roll;
                if (m.name === "Trick Room" || m.name === "Tailwind") {
                    if (m.fieldAlreadyActive) fail("Repeated field-effect scoring is not fully specified.");
                    if (hasMove(player, names("Trick Room|Taunt"))) roll(i, -1, 0.5, "Trick Room/Tailwind: counterplay -1 (50%)");
                    var slowTeam = s.field && s.field.gameType === "Doubles" && m.name === "Tailwind" && s.players && s.players.some(function(p) { return p.hp > 0 && (!fasterAtSpeeds(ai.speed,p.speed,s.field) || s.partner && s.partner.hp > 0 && !fasterAtSpeeds(s.partner.speed,p.speed,s.field)); });
                    add(i, slowTeam ? 3 : fast ? (m.name === "Trick Room" ? -1 : 0) : (m.name === "Trick Room" ? 4 : 3), "Trick Room/Tailwind: speed-based bonus");
                    if (m.name === "Tailwind" && s.field && s.field.playerTailwind && !fast) add(i, 3, "Tailwind: player Tailwind and slower +3");
                    return true;
                }
                return false;
            } },
            { order: 430, id: "status-phazing", run: function(f) {
                var s = f.state, m = f.move, i = f.slot, roll = f.roll, useless = f.useless;
                if (m.name === "Roar" || m.name === "Whirlwind") {
                    if (fact(s, "playerLastMon")) { useless(i, "no remaining target to phaze"); return true; }
                    var spikes = s.field && s.field.playerSpikes || 0;
                    if (spikes) roll(i, 1, spikes >= 3 ? 1 : spikes === 2 ? 0.75 : 0.5, "Roar/Whirlwind: Spikes +1 (50%/75%/100%)");
                    if (s.field && s.field.playerStealthRock) roll(i, 1, 0.5, "Roar/Whirlwind: Stealth Rock +1 (50%)");
                    roll(i, -1, 0.5, "Roar/Whirlwind: -1 (50%)"); return true;
                }
                return false;
            } },
            { order: 690, id: "wonder-room", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, m = f.move, i = f.slot, add = f.add, roll = f.roll;
                if (m.name === "Wonder Room") {
                    if (!Number.isFinite(ai.defense) || !Number.isFinite(ai.specialDefense)) assume(s, "Wonder Room defensive stats are absent; no defensive-stat bonus is assumed.");
                    if (category(player, "Physical") && ai.defense < ai.specialDefense || category(player, "Special") && ai.specialDefense < ai.defense) add(i, 1, "Wonder Room: better defensive stat +1");
                    roll(i, 2, 0.25, "Wonder Room: +2 (25%)"); return true;
                }
                return false;
            } }
        ];
    }
    return { createRules: createRules };
});
