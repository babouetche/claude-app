(function(root, factory) {
    "use strict";
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.NullAIRulesStatus = factory();
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";
    // Status conditions, trapping and disruption.
    // order preserves the previous core's branch precedence across
    // families. run(frame) returns true only when this move's routine ends.
    // The frame owns score buffers/callbacks; families retain no battle state.
    function createRules(h) {
        var names = h.names, hasMove = h.hasMove, ability = h.ability, category = h.category, fasterAtSpeeds = h.fasterAtSpeeds, fail = h.fail, fact = h.fact, playerKills = h.playerKills, aiHitsToKO = h.aiHitsToKO, BINDING = h.BINDING, TRAPPING = h.TRAPPING;
        var FLINCH = names("Air Slash|Iron Head|Rock Slide|Bite|Dark Pulse|Headbutt|Icicle Crash|Mountain Gale|Waterfall|Zen Headbutt|Zing Zap|Extrasensory");
        var PARALYSIS = names("Thunder Wave|Glare|Stun Spore|Nuzzle|Buzzy Buzz|Splishy Splash");
        var SLEEP = names("Spore|Sleep Powder|Hypnosis|Sing|Lovely Kiss|Grass Whistle|Dark Void|Yawn");
        var POISON = names("Toxic|Poison Gas|Poison Powder|Toxic Thread");
        var BURN = names("Will-O-Wisp|Sizzly Slide");
        var CONFUSION = names("Confuse Ray|Supersonic|Sweet Kiss|Swagger|Flatter");
        return [
            { order: 0, id: "existing-status", run: function(f) {
                var player = f.player, i = f.slot, applyUtility = f.applyUtility, routine = f.routine, useless = f.useless;
                if (applyUtility && (PARALYSIS.has(routine) || SLEEP.has(routine) || POISON.has(routine) || BURN.has(routine) || routine === "Freezy Frost") && player.status) { useless(i, "status already present"); return true; }
                return false;
            } },
            { order: 40, id: "paralysis", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, fast = f.fast, maxKills = f.maxKills, i = f.slot, applyUtility = f.applyUtility, routine = f.routine, add = f.add;
                if (applyUtility && PARALYSIS.has(routine)) {
                    if (!maxKills) {
                        if (!fast && !Number.isFinite(player.paralyzedSpeed)) fail("Missing predicted player speed after paralysis.");
                        if (!fast && fasterAtSpeeds(ai.speed, player.paralyzedSpeed, s.field)) add(i, 2, "Paralysis: speed order reverses +2");
                        else if (hasMove(ai, names("Hex|Infernal Parade")) || hasMove(ai, FLINCH) || fact(s, "playerConfused") || fact(s, "playerInfatuated")) add(i, 2, "Paralysis: synergy +2");
                        else add(i, 1, "Paralysis: default +1");
                    }
                    return true;
                }
                return false;
            } },
            { order: 50, id: "sleep", run: function(f) {
                var s = f.state, ai = f.opponent, maxKills = f.maxKills, m = f.move, i = f.slot, applyUtility = f.applyUtility, routine = f.routine, roll = f.roll;
                if (applyUtility && SLEEP.has(routine)) {
                    if (!maxKills) {
                        var sleepBonus = 1 + Number(hasMove(ai, names("Dream Eater|Nightmare|Snore|Sleep Talk"))) + Number(hasMove(ai, names("Hex|Infernal Parade")) || s.field&&s.field.gameType==='Doubles'&&s.partner&&s.partner.hp>0&&hasMove(s.partner, names("Hex|Infernal Parade")));
                        roll(i, sleepBonus, 0.25, "Sleep: one shared 25% check for all listed bonuses");
                    }
                    if (s.field && s.field.gameType === "Doubles" && m.name === "Dark Void") roll(i, 2, 0.8, "Doubles: Dark Void +2 (80%)");
                    return true;
                }
                return false;
            } },
            { order: 60, id: "poison", run: function(f) {
                var ai = f.opponent, player = f.player, maxKills = f.maxKills, i = f.slot, applyUtility = f.applyUtility, routine = f.routine, roll = f.roll;
                if (applyUtility && POISON.has(routine)) {
                    if (!maxKills && player.hp / player.maxHP > 0.2) {
                        var poisonBonus = Number(!category(player, "Physical") && !category(player, "Special")) + Number(hasMove(ai, names("Protect"))) + Number(hasMove(ai, names("Venoshock|Hex|Infernal Parade|Venom Drench")) || ai.ability === "Merciless");
                        if (poisonBonus) roll(i, poisonBonus, 0.2, "Poison: one shared 20% check");
                    }
                    return true;
                }
                return false;
            } },
            { order: 70, id: "burn-frostbite", run: function(f) {
                var ai = f.opponent, player = f.player, maxKills = f.maxKills, i = f.slot, applyUtility = f.applyUtility, routine = f.routine, roll = f.roll;
                if (applyUtility && (BURN.has(routine) || routine === "Freezy Frost")) {
                    if (!maxKills) roll(i, 1 + Number(category(player, routine === "Freezy Frost" ? "Special" : "Physical") || hasMove(ai, names("Hex|Infernal Parade"))), 0.33, "Burn/Frostbite: shared 33% check (as written in the document)");
                    return true;
                }
                return false;
            } },
            { order: 80, id: "confusion", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, maxKills = f.maxKills, i = f.slot, applyUtility = f.applyUtility, routine = f.routine, add = f.add, roll = f.roll, useless = f.useless;
                if (applyUtility && CONFUSION.has(routine)) {
                    if (fact(s, "playerConfused") || ability(player, "Own Tempo")) { useless(i, "target cannot be confused"); return true; }
                    if (!maxKills) roll(i, 1 + Number(player.status === "par" || fact(s, "playerInfatuated") || (ai.ability === "Serene Grace" && hasMove(ai, FLINCH))), 0.25, "Confusion: shared 25% gate +1 and status/flinch synergy +1");
                    if (["Swagger", "Flatter"].includes(routine) && (hasMove(ai, names("Psych Up|Spectral Thief")) || ai.item === "Mirror Herb" || (routine === "Swagger" && hasMove(ai, names("Foul Play"))))) add(i, 1, "Swagger/Flatter: boosts can be exploited +1");
                    return true;
                }
                return false;
            } },
            { order: 150, id: "binding-trapping", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, i = f.slot, isStatus = f.isStatus, applyUtility = f.applyUtility, routine = f.routine, add = f.add, roll = f.roll, useless = f.useless, base = f.base;
                if (applyUtility && (BINDING.has(routine) || TRAPPING.has(routine))) {
                    if ((player.types || []).includes("Ghost") || player.item === "Shed Shell" || fact(s, "playerTrapped")) {
                        if (BINDING.has(routine) || isStatus) useless(i, "target cannot be trapped again");
                        else add(i, -6, "Trapping: immune target gets no guaranteed-effect base bonus");
                        return true;
                    }
                    if (BINDING.has(routine)) {
                        roll(i, 2, 0.2, "Binding: base +6, additional +2 (20%)");
                        if (["Binding Band", "Grip Claw"].includes(ai.item)) add(i, 1, "Binding: extension item +1");
                    }
                    return true;
                }
                return false;
            } },
            { order: 160, id: "salt-cure-utility", run: function(f) {
                var s = f.state, player = f.player, i = f.slot, applyUtility = f.applyUtility, routine = f.routine, add = f.add, roll = f.roll, useless = f.useless, base = f.base;
                if (applyUtility && routine === "Salt Cure") {
                    if (fact(s, "playerSaltCured")) { useless(i, "Salt Cure already active"); return true; }
                    roll(i, 1, 0.2, "Salt Cure: base +6, additional +1 (20%)");
                    if ((player.types || []).some(function(type) { return type === "Water" || type === "Steel"; })) add(i, 1, "Salt Cure: Water/Steel target +1");
                    return true;
                }
                return false;
            } },
            { order: 290, id: "powder", run: function(f) {
                var player = f.player, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Powder") {
                    add(i, (player.moves || []).some(function(pm) { return pm.type === "Fire"; }) ? 1 : -1, "Powder: player has Fire moves +1, otherwise -1");
                    return true;
                }
                return false;
            } },
            { order: 340, id: "taunt", run: function(f) {
                var player = f.player, m = f.move, i = f.slot, roll = f.roll;
                if (m.name === "Taunt") {
                    if (m.statusBlocked) fail("Taunt usability check is incomplete.");
                    roll(i, category(player, "Status") ? 1 : -1, 0.5, "Taunt: status move +1 (50%), otherwise -1 (50%)"); return true;
                }
                return false;
            } },
            { order: 460, id: "leech-seed", run: function(f) {
                var s = f.state, legal = f.legal, player = f.player, m = f.move, i = f.slot, roll = f.roll, useless = f.useless;
                if (m.name === "Leech Seed") {
                    if ((player.types || []).includes("Grass") || fact(s, "playerLeechSeeded")) { useless(i, "target cannot be Leech Seeded"); return true; }
                    if (!hasMove(player, names("Rapid Spin")) && player.ability !== "Magic Guard") roll(i, 1, 0.5, "Leech Seed: no Rapid Spin/Magic Guard +1 (50%)");
                    if (aiHitsToKO(s, legal) > 3) roll(i, 1, 0.5, "Leech Seed: more than 3 hits +1 (50%)");
                    return true;
                }
                return false;
            } },
            { order: 530, id: "nightmare", run: function(f) {
                var s = f.state, player = f.player, m = f.move, i = f.slot, add = f.add, useless = f.useless;
                if (m.name === "Nightmare") { if (player.status === "slp") add(i, 1, "Nightmare: player asleep +1"); else useless(i, "Nightmare on awake target"); if (fact(s, "playerTrapped")) add(i, 1, "Nightmare: player trapped +1"); return true; }
                return false;
            } },
            { order: 540, id: "perish-song", run: function(f) {
                var s = f.state, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Perish Song") { if (fact(s, "playerTrapped")) add(i, 2, "Perish Song: trapped target +2"); return true; }
                return false;
            } },
            { order: 550, id: "attract", run: function(f) {
                var s = f.state, player = f.player, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Attract") { if (player.status || fact(s, "playerTrapped")) add(i, 1, "Attract: player status/trapping +1"); return true; }
                return false;
            } },
            { order: 560, id: "imprison", run: function(f) {
                var ai = f.opponent, player = f.player, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Imprison") { if ((player.moves || []).some(function(pm) { return pm.name !== "(No Move)" && (ai.moves || []).some(function(am) { return am.name === pm.name; }); })) add(i, 3, "Imprison: shared moves +3"); return true; }
                return false;
            } },
            { order: 640, id: "disable-encore", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, fast = f.fast, m = f.move, i = f.slot, add = f.add, useless = f.useless;
                if (m.name === "Disable" || m.name === "Encore") {
                    var lastName = fact(s, "playerLastMove"), last = (player.moves || []).find(function(pm) { return pm.name === lastName; });
                    if (!lastName) { useless(i, "no player move to disable/encore"); return true; }
                    if (m.name === "Disable" && fast && last && last.damage && Math.max.apply(null, last.damage) >= ai.hp) add(i, 1, "Disable: faster and last move can KO +1");
                    if (m.name === "Encore" && fast && last && (last.category === "Status" || ["Fake Out", "First Impression"].includes(last.name))) add(i, 1, "Encore: faster and encouraged last move +1");
                    return true;
                }
                return false;
            } },
            { order: 700, id: "conversion", run: function(f) {
                var s = f.state, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Conversion") { if (!fact(s, "opponentTypeChanged")) add(i, 2, "Conversion: type can change +2"); return true; }
                return false;
            } },
            { order: 710, id: "conversion-2", run: function(f) {
                var s = f.state, player = f.player, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Conversion 2") { if (fact(s, "resistsPlayerLastMove")) add(i, -20, "Conversion 2: already resists last move -20"); if (playerKills(s)) add(i, 1, "Conversion 2: player KO +1"); return true; }
                return false;
            } }
        ];
    }
    return { createRules: createRules };
});
