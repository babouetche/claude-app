(function(root, factory) {
    "use strict";
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.NullAIRulesDamage = factory();
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";
    // Named attacking, pivot and damage-history routines.
    // order preserves the previous core's branch precedence across
    // families. run(frame) returns true only when this move's routine ends.
    // The frame owns score buffers/callbacks; families retain no battle state.
    function createRules(h) {
        var names = h.names, hasMove = h.hasMove, ability = h.ability, stat = h.stat, category = h.category, assume = h.assume, fact = h.fact, resetMoves = h.resetMoves, playerKills = h.playerKills, aiHitsToKO = h.aiHitsToKO, PHAZING = h.PHAZING;
        var RECHARGE = names("Hyper Beam|Blast Burn|Hydro Cannon|Frenzy Plant|Giga Impact|Rock Wrecker|Roar of Time|Prismatic Laser|Meteor Assault|Eternabeam");
        return [
            { order: 200, id: "explosion-memento", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, m = f.move, i = f.slot, add = f.add, roll = f.roll, useless = f.useless;
                if (["Explosion", "Self-Destruct", "Misty Explosion", "Memento"].includes(m.name)) {
                    var ratioExplode = ai.hp / ai.maxHP;
                    if (ratioExplode < 0.1) add(i, 10, "Explosion/Memento: below 10% HP +10");
                    else if (ratioExplode < 0.33) roll(i, 8, 0.7, "Explosion/Memento: below 33% HP +8 (70%)");
                    else roll(i, 7, ratioExplode < 0.66 ? 0.5 : 0.05, "Explosion/Memento: +7 (50% below 66%, otherwise 5%)");
                    if (fact(s, "opponentLastMon")) add(i, fact(s, "playerLastMon") ? -1 : -10, "Explosion/Memento: last AI Pokemon -1/-10");
                    if (m.name === "Memento" && (stat(player, "atk") <= -6 && stat(player, "spa") <= -6 || player.item === "Clear Amulet" || ability(player, "Clear Body|White Smoke|Full Metal Body|Mirror Armor"))) useless(i, "Memento cannot lower stats");
                    return true;
                }
                return false;
            } },
            { order: 210, id: "final-gambit", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, fast = f.fast, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Final Gambit") {
                    add(i, fast && ai.hp >= player.hp ? 8 : fast && playerKills(s) ? 7 : 6, "Final Gambit: fast sufficient HP +8, fast threatened +7, otherwise +6");
                    if (fact(s, "opponentLastMon")) add(i, fact(s, "playerLastMon") ? -1 : -10, "Final Gambit: last AI Pokemon -1/-10");
                    return true;
                }
                return false;
            } },
            { order: 220, id: "pivot", run: function(f) {
                var s = f.state, legal = f.legal, ai = f.opponent, player = f.player, m = f.move, i = f.slot, add = f.add, base = f.base, variables = f.variables, traces = f.traces;
                if (["U-turn", "Volt Switch", "Flip Turn", "Parting Shot"].includes(m.name)) {
                    if (ai.name === "Palafin" || ai.name === "Palafin-Zero") {
                        base[i] = 12; f.replaceVariables(variables.filter(function(v) { return !v.outcomes.some(function(o) { return o.delta && o.delta[i]; }); }));
                        traces[i] = ["Palafin: pivot score +12 replaces all other move scores"]; return true;
                    }
                    if (m.name !== "Parting Shot" && aiHitsToKO(s, legal) > 3) add(i, 6, "Pivot: AI needs more than 3 hits +6");
                    if (hasMove(player, PHAZING)) add(i, -1, "Pivot: player has phazing -1");
                    return true;
                }
                return false;
            } },
            { order: 230, id: "knock-off", run: function(f) {
                var s = f.state, legal = f.legal, player = f.player, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Knock Off") {
                    var unremovable = !player.item || player.item !== "Eviolite" && /ite$/.test(player.item) || /Orb$|Plate$|Drive$|Memory$/.test(player.item) && ability(player, "Multitype|RKS System|Primordial Sea|Desolate Land|Delta Stream");
                    if (!unremovable && aiHitsToKO(s, legal) > 3) add(i, 6, "Knock Off: removable item and more than 3 hits +6");
                    return true;
                }
                return false;
            } },
            { order: 240, id: "two-turn", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, m = f.move, i = f.slot, add = f.add, roll = f.roll;
                if (["Meteor Beam", "Electro Shot", "Sky Attack", "Freeze Shock", "Ice Burn", "Geomancy"].includes(m.name)) {
                    var herbUsable = ai.item === "Power Herb" && ai.ability !== "Klutz" && !(s.field && s.field.magicRoom) && !(s.context && s.context.opponentEmbargo);
                    var immediate = herbUsable || (m.name === "Electro Shot" && s.field && ["Rain", "Heavy Rain"].includes(s.field.weather)) || fact(s, "moveImmediate");
                    if (m.name === "Geomancy") {
                        if (playerKills(s)) add(i, -20, "Geomancy: player KO -20");
                        if (ability(player, "Unaware") || resetMoves(s, true)) add(i, -20, "Geomancy: reset/phazing -20");
                    }
                    if (!immediate) add(i, -20, "Two-turn move: cannot immediately execute -20");
                    else if (["Meteor Beam", "Electro Shot"].includes(m.name)) add(i, 9, "Two-turn move: immediate execution +9");
                    else if (m.name === "Geomancy") roll(i, 9, 0.8, "Two-turn move: immediate execution +9 (80%)");
                    // Sky Attack, Freeze Shock and Ice Burn keep their ordinary
                    // damage/KO scores; Null 1.2.5 removed the old +9 routine.
                    return true;
                }
                return false;
            } },
            { order: 250, id: "future-sight", run: function(f) {
                var s = f.state, m = f.move, i = f.slot, routine = f.routine, add = f.add, useless = f.useless;
                if (m.name === "Future Sight" || m.name === "Doom Desire") {
                    if (m.name === "Doom Desire") assume(s, "Doom Desire uses Future Sight's documented routine by shared delayed-damage behavior.");
                    add(i, 6, "Future Sight: default +6");
                    if (fact(s, "futureSightActive")) useless(i, "delayed attack already pending");
                    return true;
                }
                return false;
            } },
            { order: 310, id: "recharge", run: function(f) {
                var c = f.damageCase, m = f.move, i = f.slot, add = f.add;
                if (RECHARGE.has(m.name)) {
                    if (!c.kill[i]) add(i, -1, "Recharge: cannot KO -1");
                    return true;
                }
                return false;
            } },
            { order: 320, id: "salt-cure-hdm", run: function(f) {
                var m = f.move, i = f.slot, routine = f.routine, traces = f.traces;
                if (m.name === "Salt Cure") {
                    traces[i].push("Salt Cure: HDM uses damage scoring; secondary routine does not stack (Summary)"); return true;
                }
                return false;
            } },
            { order: 380, id: "first-turn", run: function(f) {
                var s = f.state, c = f.damageCase, player = f.player, m = f.move, i = f.slot, add = f.add, useless = f.useless;
                if (m.name === "Fake Out" || m.name === "First Impression") {
                    if (!fact(s, "opponentFirstTurn")) { useless(i, "first-turn-only move after first turn"); return true; }
                    if (m.name === "Fake Out") {
                        add(i, 9, "Fake Out: +9 stacks with HDM");
                        var immuneFlinch = player.ability === "Inner Focus" || player.ability === "Shield Dust" || player.item === "Covert Cloak" || fact(s, "playerSubstitute");
                        if (immuneFlinch && !c.kill[i]) add(i, -30, "Fake Out: cannot flinch and cannot KO -30");
                    }
                    return true;
                }
                return false;
            } },
            { order: 390, id: "feint", run: function(f) {
                var s = f.state, player = f.player, c = f.damageCase, m = f.move, i = f.slot, roll = f.roll;
                if (m.name === "Feint") {
                    var protection = names("Protect|Detect|Spiky Shield|Silk Trap|King's Shield|King’s Shield|Baneful Bunker|Obstruct|Burning Bulwark");
                    if (s.field && s.field.gameType === "Doubles" && hasMove(player, protection)) {
                        if(c.kill[i]) f.branch(i,[{amount:13,probability:.1},{amount:6,probability:.09},{amount:0,probability:.81}],"Feint: protection +13 (10%); failed check falls through to KO +6 (9% overall)");
                        else roll(i, 13, 0.1, "Feint: target has a protection move +13 (10%) in Doubles");
                    }
                    else if (c.kill[i]) roll(i, 6, 0.1, s.field && s.field.gameType === "Doubles" ? "Feint: can KO +6 (10%)" : "Feint: can KO +6 (10%) in Singles");
                    return true;
                }
                return false;
            } },
            { order: 400, id: "upper-hand", run: function(f) {
                var player = f.player, m = f.move, i = f.slot;
                if (m.name === "Upper Hand") {
                    if ((player.moves || []).some(function(pm) { return pm.category !== "Status" && pm.priority > 0; }))
                        f.branch(i,[{amount:-20,probability:.9},{amount:13,probability:.1}],"Upper Hand: exclusive discouragement -20 (90%) or attack-priority bonus +13 (10%)");
                    else f.add(i,-20,"Upper Hand: target has no attacking priority move -20");
                    return true;
                }
                return false;
            } },
            { order: 410, id: "pursuit", run: function(f) {
                var c = f.damageCase, ai = f.opponent, player = f.player, fast = f.fast, m = f.move, i = f.slot, add = f.add, roll = f.roll;
                if (m.name === "Pursuit") {
                    if (ability(ai, "Truant|Defeatist") && ability(player, "Mummy|Wandering Spirit|Lingering Aroma")) { add(i, 12, "Pursuit: remove negative ability +12"); return true; }
                    if (c.kill[i]) add(i, 11, "Pursuit: KO +11");
                    else if (player.hp < player.maxHP * 0.2) add(i, 10, "Pursuit: target below 20% HP +10");
                    else if (player.hp < player.maxHP * 0.4) roll(i, 8, 0.5, "Pursuit: target below 40% HP +8 (50%)");
                    if (fast) add(i, 3, "Pursuit: faster +3");
                    return true;
                }
                return false;
            } },
            { order: 420, id: "sucker-punch-thunderclap", run: function(f) {
                var s = f.state, m = f.move, i = f.slot, routine = f.routine, roll = f.roll;
                if (m.name === "Sucker Punch" || m.name === "Thunderclap") {
                    if (["Sucker Punch", "Thunderclap"].includes(fact(s, "opponentLastMove"))) roll(i, -20, 0.66, "Sucker Punch/Thunderclap: same routine last turn -20 (66%)");
                    return true;
                }
                return false;
            } },
            { order: 440, id: "damage-phazing", run: function(f) {
                var s = f.state, player = f.player, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Dragon Tail" || m.name === "Circle Throw") {
                    if (fact(s, "playerPerishSong")) add(i, -20, "Damaging phazing: Perish Song target -20");
                    if (playerKills(s)) add(i, -20, "Damaging phazing: player can KO AI -20");
                    return true;
                }
                return false;
            } },
            { order: 450, id: "baton-pass", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, m = f.move, i = f.slot, add = f.add, roll = f.roll;
                if (m.name === "Baton Pass") {
                    var positivePass = Object.values(ai.boosts || {}).some(function(v) { return v > 0; }) || fact(s, "opponentSubstitute") || fact(s, "opponentPositivePass");
                    if (hasMove(player, PHAZING) && !Object.values(ai.boosts || {}).some(function(v) { return v > 0; })) add(i, -20, "Baton Pass: phazing and no raised stat -20");
                    roll(i, -1, 0.25, "Baton Pass: -1 (25%)");
                    if (positivePass) add(i, 1, "Baton Pass: positive effect can be passed +1");
                    return true;
                }
                return false;
            } },
            { order: 470, id: "teleport", run: function(f) {
                var s = f.state, legal = f.legal, fast = f.fast, m = f.move, i = f.slot, add = f.add, roll = f.roll;
                if (m.name === "Teleport" || m.name === "Chilly Reception") {
                    if (fast && playerKills(s)) add(i, -20, "Teleport/Chilly Reception: faster and threatened -20");
                    if (aiHitsToKO(s, legal) > 3) roll(i, 1, 0.5, "Teleport/Chilly Reception: more than 3 hits +1 (50%)");
                    return true;
                }
                return false;
            } },
            { order: 570, id: "fell-stinger", run: function(f) {
                var c = f.damageCase, fast = f.fast, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Fell Stinger") { if (c.kill[i]) add(i, fast ? 9 : 6, "Fell Stinger: KO +9 fast / +6 slow"); return true; }
                return false;
            } },
            { order: 580, id: "secret-power", run: function(f) {
                var s = f.state, m = f.move, i = f.slot, roll = f.roll;
                if (m.name === "Secret Power") { if (s.field && s.field.terrain === "Grassy") roll(i, 6, 0.25, "Secret Power: Grassy Terrain +6 (25%)"); return true; }
                return false;
            } },
            { order: 590, id: "ohko", run: function(f) {
                var s = f.state, legal = f.legal, player = f.player, m = f.move, i = f.slot, add = f.add;
                if (["Fissure", "Horn Drill", "Guillotine", "Sheer Cold"].includes(m.name)) {
                    add(i, aiHitsToKO(s, legal) >= 3 ? 6 : 5, "OHKO moves: 3+ hits +6, otherwise +5");
                    if (fact(s, "lockOn")) add(i, 8, "OHKO moves: Lock On +8");
                    if (player.item === "Focus Band" || player.hp === player.maxHP && (player.item === "Focus Sash" || player.ability === "Sturdy")) add(i, -20, "OHKO moves: survival item/ability -20");
                    return true;
                }
                return false;
            } },
            { order: 600, id: "named-partner", run: function(f) {
                var m = f.move, i = f.slot, routine = f.routine, traces = f.traces;
                if (["Beat Up", "Round", "Pollen Puff"].includes(m.name)) { traces[i].push("Named partner routine applies only to Doubles; Singles use ordinary damage scoring"); return true; }
                return false;
            } },
            { order: 650, id: "counter", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, fast = f.fast, m = f.move, i = f.slot, add = f.add, roll = f.roll;
                if (m.name === "Counter" || m.name === "Mirror Coat" || m.name === "Metal Burst") {
                    var activeSurvival = ai.hp === ai.maxHP && (ai.item === "Focus Sash" || ai.ability === "Sturdy");
                    if (m.name === "Metal Burst") {
                        if (fast) add(i, -20, "Metal Burst: faster -20");
                        if (activeSurvival) add(i, 2, "Metal Burst: Focus Sash/Sturdy +2");
                        roll(i, 1, 0.25, "Metal Burst: +1 (25%)");
                        if (category(player, "Status")) roll(i, -1, 0.5, "Metal Burst: player has status move -1 (50%)");
                    } else {
                        var counterCategory = m.name === "Counter" ? "Physical" : "Special";
                        var onlyCategory = category(player, counterCategory) && !category(player, counterCategory === "Physical" ? "Special" : "Physical") && !category(player, "Status");
                        if (onlyCategory) roll(i, 2, activeSurvival && playerKills(s) ? 1 : 0.8, "Counter/Mirror Coat: only matching attacks +2 (80%, or guaranteed when threatened with survival)");
                        if (fast) roll(i, -1, 0.25, "Counter/Mirror Coat: faster -1 (25%)");
                        if (category(player, "Status")) roll(i, -1, 0.25, "Counter/Mirror Coat: player status move -1 (25%)");
                    }
                    return true;
                }
                return false;
            } },
            { order: 720, id: "relic-song", run: function(f) {
                var ai = f.opponent, m = f.move, i = f.slot, add = f.add, roll = f.roll;
                if (m.name === "Relic Song") { if (ai.name === "Meloetta") add(i, 10, "Relic Song: Meloetta +10"); else if (ai.name === "Meloetta-Pirouette") roll(i, 1, 0.25, "Relic Song: Pirouette +1 (25%)"); return true; }
                return false;
            } },
            { order: 730, id: "fling", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, fast = f.fast, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Fling") { if (ai.item === "King's Rock" && fast && !ability(player, "Inner Focus|Shield Dust") && player.item !== "Covert Cloak") add(i, 9, "Fling: King's Rock and faster flinchable target +9"); return true; }
                return false;
            } },
            { order: 740, id: "metronome", run: function(f) {
                var s = f.state, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Metronome") { if (fact(s, "opponentAliveCount") <= Math.floor(fact(s, "opponentTeamSize") / 3)) add(i, -5, "Metronome: last third of team -5"); return true; }
                return false;
            } },
            { order: 760, id: "repeated-use", run: function(f) {
                var s = f.state, m = f.move, i = f.slot, routine = f.routine, add = f.add, roll = f.roll;
                if (m.name === "Rollout" || m.name === "Ice Ball" || m.name === "Fury Cutter" || m.name === "Echoed Voice") {
                    assume(s, "Repeated-use move scores are treated as an additional routine alongside HDM; their stacking is not clarified in the public document.");
                    add(i, 6, "Repeated-use move: +6");
                    if (["Rollout", "Ice Ball"].includes(m.name)) { roll(i, 1, 0.5, "Rollout/Ice Ball: additional +1 (50%)"); if (fact(s, "opponentDefenseCurl")) add(i, 1, "Rollout/Ice Ball: Defense Curl +1"); }
                    else if (fact(s, "opponentLastMove") === m.name) add(i, 2, "Fury Cutter/Echoed Voice: used last turn +2");
                    return true;
                }
                return false;
            } }
        ];
    }
    return { createRules: createRules };
});
