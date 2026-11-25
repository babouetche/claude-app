(function(root, factory) {
    "use strict";
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.NullAIRulesSurvival = factory();
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";
    // Protection, healing, substitute, sleep-only and party recovery.
    // order preserves the previous core's branch precedence across
    // families. run(frame) returns true only when this move's routine ends.
    // The frame owns score buffers/callbacks; families retain no battle state.
    function createRules(h) {
        var names = h.names, hasMove = h.hasMove, ability = h.ability, category = h.category, assume = h.assume, fact = h.fact, playerKills = h.playerKills, threat = h.threat;
        var RECOVERY = names("Recover|Slack Off|Heal Order|Roost|Strength Sap|Morning Sun|Synthesis|Moonlight|Rest|Pain Split|Soft-Boiled|Milk Drink|Shore Up");
        var PROTECTION = names("Protect|Detect|Spiky Shield|Silk Trap|King's Shield|King’s Shield|Baneful Bunker|Obstruct|Burning Bulwark");
        return [
            { order: 170, id: "protection", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, fast = f.fast, m = f.move, i = f.slot, add = f.add, roll = f.roll, incapacitated = f.incapacitated;
                if (PROTECTION.has(m.name)) {
                    if (incapacitated()) add(i, -20, "Protection: player incapacitated -20");
                    if (fact(s, "opponentEndTurnFaint")) add(i, -10, "Protection: AI faints at end of turn -10");
                    if (fact(s, "protectionStreak") >= 2) add(i, -10, "Protection: two successful consecutive protections -10");
                    else if (fact(s, "protectionLastTurn")) roll(i, -10, 0.5, "Protection: protection last turn -10 (50%)");
                    if (m.name === "King's Shield" || m.name === "King’s Shield") {
                        // Native 1.2.6 restricts the +10 form-change incentive
                        // to Blade (species1278), while Shield still receives
                        // the ordinary physical-attacker/default +1 routine.
                        if (["Aegislash", "Aegislash-Blade"].includes(ai.name) && !incapacitated() && ai.nativeSashSturdyProtected !== true && !fast && playerKills(s))
                            roll(i, 10, 0.8, "King's Shield: threatened slow Aegislash-Blade +10 (80%)");
                        // The native default check also runs when the physical
                        // 75% check fails: .75 + .25*.375 = .84375 nominally.
                        roll(i, 1, category(player, "Physical") ? 0.84375 : 0.375, "King's Shield: physical check then default fallback +1 (84.375% physical, 37.5% otherwise)");
                        return true;
                    }
                    if (ability(ai, "Power Construct|Zen Mode") && ai.hp <= ai.maxHP / 2 && !fact(s, "opponentTransformed")) { roll(i, 8, 0.8, "Protection: enables form change +8 (80%)"); return true; }
                    var aiResidual = ["brn", "psn", "tox"].includes(ai.status) || fact(s, "opponentCursed") || fact(s, "opponentInfatuated") || fact(s, "opponentPerishSong") || fact(s, "opponentLeechSeeded") || fact(s, "opponentYawn");
                    var playerResidual = ["brn", "psn", "tox"].includes(player.status) || fact(s, "playerCursed") || fact(s, "playerPerishSong") || fact(s, "playerLeechSeeded") || fact(s, "playerYawn");
                    if (aiResidual) add(i, -1, "Protection: AI residual condition -1");
                    if (playerResidual) add(i, 1, "Protection: player residual condition +1");
                    if (fact(s, "opponentFirstTurn")) {
                        if (ai.ability === "Speed Boost" && !fast) roll(i, 3, 0.8, "Protection: first-turn Speed Boost and slower +3 (80%)");
                        else if (!((/^(Toxic|Flame) Orb$/.test(ai.item) && ability(ai, "Guts|Quick Feet")) || (ai.item === "Flame Orb" && ai.ability === "Flare Boost"))) add(i, -1, "Protection: first turn default -1");
                    }
                    return true;
                }
                return false;
            } },
            { order: 180, id: "endure", run: function(f) {
                var s = f.state, ai = f.opponent, m = f.move, i = f.slot, add = f.add, roll = f.roll;
                if (m.name === "Endure") {
                    if (fact(s, "protectionStreak") >= 2) add(i, -10, "Endure: two successful consecutive protections -10");
                    else if (fact(s, "protectionLastTurn")) roll(i, -10, 0.5, "Endure: protection last turn -10 (50%)");
                    if (playerKills(s) && (hasMove(ai, names("Flail|Reversal|Endeavor|Rage Fist")) || /^(Liechi|Ganlon|Salac|Petaya|Apicot|Lansat|Starf|Micle|Custap) Berry$/.test(ai.item))) add(i, 2, "Endure: pinch/low-HP synergy +2");
                    else if (playerKills(s) && ai.ability === "Speed Boost") add(i, 1 + Number(hasMove(ai, names("Baton Pass"))), "Endure: Speed Boost/Baton Pass +1/+2");
                    else roll(i, -1, 0.5, "Endure: default -1 (50%)");
                    return true;
                }
                return false;
            } },
            { order: 260, id: "recovery", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, fast = f.fast, m = f.move, i = f.slot, add = f.add, roll = f.roll, useless = f.useless;
                if (RECOVERY.has(m.name)) {
                    if (m.name === "Pain Split" && (player.hp - ai.hp) / 2 <= ai.maxHP * 0.3) { useless(i, "Pain Split recovers at most 30%"); return true; }
                    var heal = m.name === "Rest" ? 1 : ["Morning Sun", "Synthesis", "Moonlight"].includes(m.name) ? 0.67 : 0.5;
                    if (m.name === "Pain Split") {
                        assume(s, "Pain Split's recovery decision uses its actual shared-HP gain; the document only specifies its >30% eligibility threshold.");
                        heal = Math.max(0, Math.min(1, (player.hp - ai.hp) / 2 / ai.maxHP));
                    }
                    if (ai.hp === ai.maxHP && (m.name !== "Rest" || !ai.status)) { useless(i, "recovery at full HP"); return true; }
                    var t = threat(s), healHP = ai.maxHP * heal;
                    if ((ai.status === "tox" && m.name !== "Rest") || t.low >= healHP) { add(i, -1, "Recovery: Should AI Recover false, -1"); return true; }
                    if (t.high >= healHP) {
                        assume(s, "Recovery's ambiguous damage threshold uses mean player damage.");
                        if (t.mean >= healHP) { add(i, -1, "Recovery: estimated damage exceeds recovery -1"); return true; }
                    }
                    var canKO = playerKills(s), ratio = ai.hp / ai.maxHP;
                    if (fast) {
                        if (canKO) {
                            if (t.high < Math.min(ai.maxHP, ai.hp + healHP)) add(i, 1, "Recovery: prevents a KO +1");
                            else if (t.low >= Math.min(ai.maxHP, ai.hp + healHP)) add(i, -1, "Recovery: cannot prevent a KO -1");
                            else { assume(s, "Recovery's ambiguous survival check uses mean player damage."); add(i, t.mean < Math.min(ai.maxHP, ai.hp + healHP) ? 1 : -1, "Recovery: estimated survival +1/-1"); }
                        } else if (ratio < 0.4) add(i, 1, "Recovery: faster, below 40% +1");
                        else if (ratio > 0.4 && ratio < 0.66) { add(i, -1, "Recovery: default false -1"); roll(i, 2, 0.5, "Recovery: faster, 40-66% true (50%)"); }
                        else add(i, -1, "Recovery: default false -1");
                    } else if (ratio < 0.5) {
                        assume(s, "Slow recovery: the document lists overlapping <70% and <50% conditions; the more specific <50% condition is applied first.");
                        add(i, 1, "Recovery: slower, below 50% +1 (threshold-order estimate)");
                    }
                    else if (ratio < 0.7) { add(i, -1, "Recovery: default false -1"); roll(i, 2, 0.75, "Recovery: slower, below 70% true (75%)"); }
                    else add(i, -1, "Recovery: default false -1");
                    return true;
                }
                return false;
            } },
            { order: 270, id: "drain", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, m = f.move, i = f.slot, add = f.add;
                if (m.drain) {
                    if (player.ability !== "Liquid Ooze") {
                        if (ai.hp <= ai.maxHP / 2) {
                            var minDrain = Math.min.apply(null, m.damage), maxDrain = Math.max.apply(null, m.damage);
                            if (minDrain * 4 >= player.hp) add(i, 6, "Drain-Moves: half HP or less and at most 4 hits +6");
                            else if (maxDrain * 4 >= player.hp) {
                                assume(s, "Drain's ambiguous four-hit threshold uses mean move damage.");
                                if (m.damage.reduce(function(a, b) { return a + b; }, 0) / m.damage.length * 4 >= player.hp) add(i, 6, "Drain-Moves: estimated four-hit check +6");
                            }
                        }
                        if (ai.item === "Big Root") add(i, 1, "Drain-Moves: Big Root +1");
                    }
                    return true;
                }
                return false;
            } },
            { order: 480, id: "substitute-shed-tail", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, fast = f.fast, m = f.move, i = f.slot, add = f.add, roll = f.roll, useless = f.useless;
                if (m.name === "Substitute" || m.name === "Shed Tail") {
                    var sound = (player.moves || []).some(function(pm) { return pm.sound; });
                    if ((sound && (m.name === "Shed Tail" || ai.ability !== "Soundproof")) || player.ability === "Infiltrator") add(i, -20, "Substitute/Shed Tail: sound/Infiltrator counterplay -20");
                    if (ai.hp <= ai.maxHP * (m.name === "Shed Tail" ? 0.5 : 0.25) || fact(s, "opponentSubstitute")) { useless(i, "insufficient HP or existing Substitute"); return true; }
                    if (m.name === "Shed Tail") roll(i, 1, fast && playerKills(s) ? 0.5 : 0.25, "Shed Tail: faster threatened +1 (50%), otherwise +1 (25%)");
                    else {
                        if (fact(s, "playerPerishSong")) add(i, 1, "Substitute: player Perish Song +1");
                        if (["brn", "psn", "tox", "fbt"].includes(player.status)) roll(i, 1, 0.25, "Substitute: player status +1 (25%)");
                        if (ai.hp > ai.maxHP * 0.7 && fact(s, "playerWrapped")) roll(i, 1, 0.25, "Substitute: wrapped player and >70% HP +1 (25%)");
                        if (ai.ability === "Speed Boost") roll(i, 1, 0.25, "Substitute: Speed Boost +1 (25%)");
                        roll(i, -1, 0.5, "Substitute: -1 (50%)");
                    }
                    return true;
                }
                return false;
            } },
            { order: 490, id: "sleep-only", run: function(f) {
                var s = f.state, ai = f.opponent, m = f.move, i = f.slot, add = f.add, useless = f.useless;
                if (m.name === "Snore" || m.name === "Sleep Talk") {
                    if (ai.status === "slp" && !fact(s, "opponentWakeupTurn") && !(m.name === "Sleep Talk" && ai.ability === "Comatose")) add(i, 15, "Snore/Sleep Talk: asleep and not wakeup turn +15");
                    else if (ai.status !== "slp" && ai.ability !== "Comatose") useless(i, "sleep-only move while awake");
                    return true;
                }
                return false;
            } },
            { order: 500, id: "destiny-bond", run: function(f) {
                var s = f.state, ai = f.opponent, fast = f.fast, m = f.move, i = f.slot, add = f.add, roll = f.roll;
                if (m.name === "Destiny Bond") {
                    if (ai.hp === ai.maxHP && (ai.item === "Focus Sash" || ai.ability === "Disguise")) add(i, -20, "Destiny Bond: active Focus Sash/Disguise -20");
                    if (fast && playerKills(s)) roll(i, 1, 0.815, "Destiny Bond: faster threatened +1 (81.5%)");
                    else if (!fast) roll(i, -1, 0.5, "Destiny Bond: slower -1 (50%)");
                    return true;
                }
                return false;
            } },
            { order: 510, id: "wish", run: function(f) {
                var s = f.state, ai = f.opponent, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Wish") {
                    var wishParty = Array.isArray(s.party) ? s.party : s.party && s.party.candidates;
                    if (wishParty ? wishParty.some(function(mon) { return mon.hp > 0 && mon.hp < mon.maxHP * 0.65; }) : fact(s, "partyBelow65", ai.hp < ai.maxHP * 0.65)) add(i, 1, "Wish: party member below 65% HP +1"); return true;
                }
                return false;
            } },
            { order: 520, id: "party-status", run: function(f) {
                var s = f.state, ai = f.opponent, m = f.move, i = f.slot, routine = f.routine, add = f.add;
                if (m.name === "Aromatherapy" || m.name === "Heal Bell") {
                    if (m.name === "Heal Bell") assume(s, "Heal Bell uses Aromatherapy's documented party-status routine by shared healing behavior.");
                    var statusParty = Array.isArray(s.party) ? s.party : s.party && s.party.candidates;
                    if (statusParty ? statusParty.some(function(mon) { return !!mon.status; }) : fact(s, "partyHasStatus", !!ai.status)) add(i, 1, "Aromatherapy: party member has status +1"); return true;
                }
                return false;
            } },
            { order: 680, id: "magnet-rise", run: function(f) {
                var player = f.player, fast = f.fast, m = f.move, i = f.slot, add = f.add, roll = f.roll;
                if (m.name === "Magnet Rise") { if (fast && (player.moves || []).some(function(pm) { return pm.type === "Ground"; })) roll(i, 2, 0.9, "Magnet Rise: faster and Ground move +2 (90%)"); else add(i, -1, "Magnet Rise: otherwise -1"); return true; }
                return false;
            } },
            { order: 750, id: "revival-blessing", run: function(f) {
                var m = f.move, i = f.slot, roll = f.roll;
                if (m.name === "Revival Blessing") { roll(i, 2, 0.5, "Revival Blessing: +2 (50%); first fainted party slot"); return true; }
                return false;
            } }
        ];
    }
    return { createRules: createRules };
});
