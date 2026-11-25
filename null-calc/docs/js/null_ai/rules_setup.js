(function(root, factory) {
    "use strict";
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.NullAIRulesSetup = factory();
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";
    // Stat boosts, stat drops, risky HP-cost setup and stage copying.
    // order preserves the previous core's branch precedence across
    // families. run(frame) returns true only when this move's routine ends.
    // The frame owns score buffers/callbacks; families retain no battle state.
    function createRules(h) {
        var names = h.names, hasMove = h.hasMove, ability = h.ability, stat = h.stat, category = h.category, fail = h.fail, assume = h.assume, fact = h.fact, resetMoves = h.resetMoves, playerKills = h.playerKills, hitsToKO = h.hitsToKO, threat = h.threat, PHAZING = h.PHAZING;
        // Supplied Null 1.2.4 ROM amounts, not modern dex defaults. Pinch berries
        // heal maxHP / 2. See rom-setup-berries.json / audit-setup-berries.py.
        var HEALING_BERRIES = {
            "Oran Berry": { flat: 10, trigger: 2 }, "Sitrus Berry": { percent: 25, trigger: 2 },
            "Figy Berry": { divisor: 2, trigger: 4 }, "Wiki Berry": { divisor: 2, trigger: 4 },
            "Mago Berry": { divisor: 2, trigger: 4 }, "Aguav Berry": { divisor: 2, trigger: 4 },
            "Iapapa Berry": { divisor: 2, trigger: 4 }
        };
        var SPEED_SETUP = names("Autotomize|Agility|Rock Polish|Trailblaze|Flame Charge|Aqua Step|Esper Wing|Scale Shot");
        var OFFENSIVE = {
            "Swords Dance": "atk", "Howl": "atk", "Meditate": "atk", "Sharpen": "atk",
            "Dragon Dance": "atk", "Shift Gear": "atk", "Hone Claws": "atk",
            "Tidy Up": "atk", "Nasty Plot": "spa", "Tail Glow": "spa",
            "Power-Up Punch": "atk", "Mystical Power": "spa", "Torch Song": "spa"
        };
        var LOWER = {
            "Growl": "atk", "Charm": "atk", "Feather Dance": "atk", "Lunge": "atk",
            "Trop Kick": "atk", "Breaking Swipe": "atk", "Chilling Water": "atk",
            "Confide": "spa", "Mystical Fire": "spa", "Struggle Bug": "spa", "Snarl": "spa",
            "Eerie Impulse": "spa", "Spirit Break": "spa", "Skittersmack": "spa",
            "Tail Whip": "def", "Leer": "def", "Screech": "def", "Rock Smash": "def",
            "Fire Lash": "def", "Thunderous Kick": "def", "Acid Spray": "spd",
            "Metal Sound": "spd", "Fake Tears": "spd", "Lumina Crash": "spd", "Apple Acid": "spd"
        };
        var SPEED_LOWER = names("Scary Face|String Shot|Cotton Spore|Icy Wind|Electroweb|Glaciate|Rock Tomb|Mud Shot|Low Sweep|Drum Beating|Pounce|Bulldoze");
        var ACCURACY_LOWER = names("Sand Attack|Smokescreen|Kinesis|Flash|Mud-Slap|Muddy Water|Octazooka|Leaf Tornado|Night Daze");
        var DEFENSIVE = { "Stuff Cheeks": ["def"], "Harden": ["def"], "Withdraw": ["def"], "Barrier": ["def"],
            "Acid Armor": ["def"], "Iron Defense": ["def"], "Cotton Guard": ["def"], "Shelter": ["def"],
            "Amnesia": ["spd"], "Defense Curl": ["def"], "Stockpile": ["def", "spd"], "Cosmic Power": ["def", "spd"], "Psyshield Bash": ["def"] };
        var MIXED = { "No Retreat": "atk", "Victory Dance": "atk", "Coil": "atk", "Bulk Up": "atk", "Curse": "atk", "Calm Mind": "spa", "Quiver Dance": "spa", "Take Heart": "spa" };
        function setupSurvival(s, move) {
            if (s.context && typeof s.context.playerKOsAfterSetup === "boolean") {
                return { ko: s.context.playerKOsAfterSetup, rules: ["Risky setup: post-setup KO check supplied by battle context"] };
            }
            // Playcode calls CanFaintTargetAfterDrum, whose implementation was not
            // supplied. Model the documented HP-cost + berry check and disclose it;
            // this is a scoring preview, not a simulation of the whole turn.
            assume(s, "Post-setup survival estimates the missing native helper with mean incoming damage, integer HP cost and an immediately eligible healing berry; turn order and later residual damage are not simulated.");
            var ai = s.opponent, ctx = s.context || {}, hp = ai.hp;
            var cost = ["Belly Drum", "Fillet Away", "Filet Away"].includes(move.name) ? Math.floor(ai.maxHP / 2) :
                move.name === "Clangorous Soul" ? Math.floor(ai.maxHP / 3) : 0;
            hp -= cost;
            var rules = [], berry = HEALING_BERRIES[ai.item];
            var unnerve = [s.player].concat(s.players || []).some(function(mon) {
                return mon && mon.hp > 0 && ability(mon, "Unnerve|As One (Glastrier)|As One (Spectrier)");
            });
            var itemBlocked = s.field && s.field.magicRoom || ai.ability === "Klutz" || ctx.opponentEmbargo;
            if (hp > 0 && berry && !itemBlocked && !unnerve && !ctx.opponentHealBlock) {
                var trigger = ai.ability === "Gluttony" ? 2 : berry.trigger;
                if (hp <= Math.floor(ai.maxHP / trigger)) {
                    var heal = berry.flat || (berry.percent ? Math.floor(ai.maxHP * berry.percent / 100) : Math.floor(ai.maxHP / berry.divisor));
                    heal = Math.max(1, heal) * (ai.ability === "Ripen" ? 2 : 1);
                    if (ai.ability === "Cheek Pouch") heal += Math.max(1, Math.floor(ai.maxHP / 3));
                    var restored = Math.min(ai.maxHP - hp, heal); hp += restored;
                    rules.push("Risky setup: " + ai.item + " restores " + restored + " HP" + (ai.ability === "Gluttony" ? " (Gluttony: 50% HP trigger)" : ""));
                }
            }
            var incoming = threat(s).mean;
            if (move.name === "Shell Smash") {
                // Preserve a labelled fallback, but respect White Herb and Contrary.
                // A full stage-dependent damage recalculation is not available here.
                if (ai.ability === "Contrary") incoming *= 2 / 3;
                else if (ai.item !== "White Herb" || itemBlocked) incoming *= 1.5;
                assume(s, "Shell Smash's post-setup damage uses an approximate defensive multiplier, with White Herb and Contrary taken into account.");
            }
            rules.push("Risky setup: Estimated HP after " + move.name + ": " + hp + "/" + ai.maxHP);
            rules.forEach(function(rule) { s._assumptions.add(rule); });
            return { ko: incoming >= hp, rules: rules };
        }
        function offensiveSetup(f, i, boosted) {
            var s = f.state, ai = f.opponent, player = f.player, fast = f.fast, add = f.add, roll = f.roll, useless = f.useless, incapacitated = f.incapacitated;
            if (stat(ai, boosted) >= 6) { useless(i, "setup at the stat cap"); return; }
            if (ability(player, "Unaware") || resetMoves(s, false)) add(i, -20, "Offensive Setup: Unaware/reset -20");
            if (playerKills(s)) add(i, -20, "Offensive Setup: player OHKO -20");
            var hits = hitsToKO(s);
            if (!fast && hits === 2) add(i, -5, "Offensive Setup: player fast 2HKO -5");
            if (incapacitated()) roll(i, 3, 0.9, "Offensive Setup: incapacitated +3 (90%)");
            else if (hits >= 4) add(i, fast ? 2 : 1, "Offensive Setup: 4+ hits +1/+2");
            var punished = boosted === "atk" && (hasMove(player, names("Foul Play|Confuse Ray|Supersonic|Swagger|Flatter|Sweet Kiss")) || (fast && hasMove(player, names("Burning Jealousy|Alluring Voice"))));
            if (hasMove(player, PHAZING) && !fact(s, "opponentLastMon")) punished = true;
            if (punished) add(i, -5, "Offensive Setup: documented counterplay -5");
            if (stat(ai, boosted) >= 2) roll(i, -1, 0.8, "Offensive Setup: boosted stat >=+2, -1 (80%)");
        }
        function defensiveSetup(f, i, boosted, name) {
            var s = f.state, ai = f.opponent, player = f.player, fast = f.fast, add = f.add, roll = f.roll, branch = f.branch, useless = f.useless, incapacitated = f.incapacitated;
            if (boosted.every(function(key) { return stat(ai, key) >= 6; })) { useless(i, "defensive setup at the stat cap"); return; }
            if (ability(player, "Unaware") || resetMoves(s, false)) add(i, -20, "Defensive Setup: Unaware/reset -20");
            if (playerKills(s)) add(i, -20, "Defensive Setup: player OHKO -20");
            if (!fast && hitsToKO(s) === 2) add(i, -5, "Defensive Setup: player fast 2HKO -5");
            if (hasMove(player, PHAZING) && !fact(s, "opponentLastMon")) add(i, -5, "Defensive Setup: phazing -5");
            var bonus = 0;
            if (boosted.length === 2) { if (stat(ai, "def") < 1 || stat(ai, "spd") < 1) bonus += 2; }
            else if (boosted[0] === "def") {
                if (category(player, "Physical") && !category(player, "Special")) bonus++;
                if (stat(ai, "def") >= 2 && !hasMove(ai, names("Body Press"))) bonus--;
            } else {
                if (category(player, "Special") && !category(player, "Physical")) bonus++;
                if (stat(ai, "spd") >= 2 && !hasMove(ai, names("Stored Power"))) bonus--;
            }
            var inside = [{ amount: bonus, probability: 1 }];
            function insideGate(amount, probability) {
                var next = [];
                inside.forEach(function(o) { next.push({ amount: o.amount, probability: o.probability * (1 - probability) }, { amount: o.amount + amount, probability: o.probability * probability }); });
                inside = next;
            }
            if (incapacitated()) insideGate(2, 0.9);
            if (hasMove(ai, names("Stored Power|Body Press"))) insideGate(1, 0.5);
            branch(i, [{ amount: 0, probability: 0.2 }].concat(inside.map(function(o) { return { amount: o.amount, probability: o.probability * 0.8 }; })), "Defensive Setup: shared 80% gate, documented stat/90% incapacitation/50% Stored Power or Body Press bonuses");
            if (name === "Defense Curl" && hasMove(ai, names("Rollout|Ice Ball")) && !fact(s, "opponentDefenseCurl")) add(i, 1, "Defense Curl: Rollout/Ice Ball synergy +1");
            if (name === "Stockpile" && hasMove(ai, names("Spit Up|Swallow"))) add(i, 1, "Stockpile: Spit Up/Swallow +1");
        }
        return [
            { order: 10, id: "defensive-setup", run: function(f) {
                var i = f.slot, applyUtility = f.applyUtility, routine = f.routine;
                if (applyUtility && DEFENSIVE[routine]) { defensiveSetup(f, i, DEFENSIVE[routine], routine); return true; }
                return false;
            } },
            { order: 20, id: "mixed-setup", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, i = f.slot, applyUtility = f.applyUtility, routine = f.routine, useless = f.useless;
                if (applyUtility && (MIXED[routine] || (ai.ability === "Contrary" && routine === "Superpower"))) {
                    var mixedStat = MIXED[routine] || "atk";
                    if (routine === "Curse" && (ai.types || []).includes("Ghost")) {
                        if (fact(s, "playerCursed")) useless(i, "already cursed target");
                        return true;
                    }
                    var defensive = mixedStat === "atk" ? category(player, "Physical") && !category(player, "Special") : category(player, "Special") && !category(player, "Physical");
                    if (defensive) defensiveSetup(f, i, [mixedStat === "atk" ? "def" : "spd"], routine);
                    else offensiveSetup(f, i, mixedStat);
                    return true;
                }
                return false;
            } },
            { order: 30, id: "offensive-setup", run: function(f) {
                var s = f.state, ai = f.opponent, i = f.slot, applyUtility = f.applyUtility, contrarySetup = f.contrarySetup, routine = f.routine;
                if (applyUtility && (OFFENSIVE[routine] || ["Growth", "Work Up"].includes(routine) || contrarySetup)) {
                    if (["Growth", "Work Up"].includes(routine)) assume(s, "Dual-offense setup uses the attacking category present in the AI moveset to select its stat-cap and repeated-boost checks.");
                    offensiveSetup(f, i, OFFENSIVE[routine] || (contrarySetup ? "spa" : category(ai, "Physical") ? "atk" : "spa")); return true;
                }
                return false;
            } },
            { order: 90, id: "stat-lowering", run: function(f) {
                var player = f.player, i = f.slot, applyUtility = f.applyUtility, routine = f.routine, add = f.add, roll = f.roll, useless = f.useless;
                if (applyUtility && LOWER[routine]) {
                    var lowered = LOWER[routine];
                    if (stat(player, lowered) <= -6 || player.item === "Clear Amulet" || ability(player, "Clear Body|White Smoke|Full Metal Body|Mirror Armor|Contrary|Flower Veil")) { useless(i, "blocked or reversed stat drop"); return true; }
                    if (stat(player, lowered) <= -1) roll(i, -2, 0.8, "Stat lowering: already -1 or lower, -2 (80%)");
                    else roll(i, 1, 0.2, "Stat lowering: +1 (20%)");
                    if ((lowered === "atk" && !category(player, "Physical")) || (lowered === "spa" && !category(player, "Special"))) add(i, -2, "Stat lowering: no corresponding attacking category -2");
                    return true;
                }
                return false;
            } },
            { order: 100, id: "speed-lowering", run: function(f) {
                var s = f.state, player = f.player, fast = f.fast, m = f.move, i = f.slot, isStatus = f.isStatus, applyUtility = f.applyUtility, routine = f.routine, add = f.add, useless = f.useless;
                if (m.name === "Syrup Bomb") {
                    if (f.damageCase.hdm[i]) return true;
                    if (s.context && s.context.playerSyrupBomb) add(i,-20,"Syrup Bomb: effect already active -20");
                    var blocked=stat(player,"spe")<=-6 || player.item==="Clear Amulet" || ability(player,"Clear Body|White Smoke|Full Metal Body|Mirror Armor|Contrary") || player.ability==="Flower Veil" && (player.types||[]).includes("Grass");
                    if (!blocked && !fast) add(i,6,"Syrup Bomb: can lower target Speed and AI is slower +6");
                    else f.traces[i].push("Syrup Bomb: blocked Speed reduction or AI already faster; no utility bonus");
                    return true;
                }
                if (applyUtility && SPEED_LOWER.has(routine)) {
                    if (stat(player, "spe") <= -6 || player.item === "Clear Amulet" || ability(player, "Clear Body|White Smoke|Full Metal Body|Mirror Armor|Contrary|Flower Veil")) { useless(i, "blocked or reversed speed drop"); return true; }
                    if (fast) add(i, -2, "Speed lowering: already faster -2");
                    else if (isStatus) add(i, 1, "Speed lowering: slower, status move +1");
                    if(s.field&&s.field.gameType==="Doubles"&&["allAdjacent","allAdjacentFoes"].includes(m.target))add(i,1,"Doubles: spread speed lowering +1");
                    return true;
                }
                return false;
            } },
            { order: 110, id: "speed-setup", run: function(f) {
                var s = f.state, ai = f.opponent, fast = f.fast, i = f.slot, applyUtility = f.applyUtility, routine = f.routine, add = f.add, roll = f.roll, useless = f.useless;
                if (applyUtility && (SPEED_SETUP.has(routine) || routine === "Rapid Spin")) {
                    if (stat(ai, "spe") >= 6) { useless(i, "speed setup at the stat cap"); return true; }
                    if (resetMoves(s, true) || fast) add(i, -20, "Speed Setup: reset/phazing or already faster -20");
                    else roll(i, 1, 0.8, "Speed Setup: slower +1 (80%)");
                    if (routine === "Rapid Spin") {
                        if (fact(s, "opponentLeechSeeded") || fact(s, "opponentWrapped")) add(i, 1, "Rapid Spin: removes seed/binding +1");
                        if (s.field && (s.field.opponentSpikes || s.field.opponentToxicSpikes || s.field.opponentStealthRock || s.field.opponentStickyWeb)) roll(i, 2, 0.5, "Rapid Spin: hazards present +2 (50%)");
                    }
                    return true;
                }
                return false;
            } },
            { order: 120, id: "legacy-offensive-setup", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, fast = f.fast, m = f.move, i = f.slot, applyUtility = f.applyUtility, add = f.add, roll = f.roll, useless = f.useless, incapacitated = f.incapacitated;
                if (applyUtility && OFFENSIVE[m.name]) {
                    var boosted = OFFENSIVE[m.name];
                    if (stat(ai, boosted) >= 6) fail("Setup at the stat cap requires the exact useless-move check.");
                    if (ability(player, "Unaware") || resetMoves(s, false)) add(i, -20, "Offensive Setup: Unaware/reset -20");
                    if (playerKills(s)) add(i, -20, "Offensive Setup: player OHKO -20");
                    else {
                        var hits = hitsToKO(s);
                        if (!fast && hits === 2) add(i, -5, "Offensive Setup: player fast 2HKO -5");
                        if (player.status === "slp" || player.status === "frz") {
                            if (fact(s, "playerIncapacitated")) roll(i, 3, 0.9, "Offensive Setup: incapacitated +3 (90%)");
                            else if (hits >= 4) add(i, fast ? 2 : 1, "Offensive Setup: 4+ hits +1/+2");
                        } else if (hits >= 4) add(i, fast ? 2 : 1, "Offensive Setup: 4+ hits +1/+2");
                    }
                    var punished = boosted === "atk" && (hasMove(player, names("Foul Play|Confuse Ray|Supersonic|Swagger|Flatter|Sweet Kiss")) || (fast && hasMove(player, names("Burning Jealousy|Alluring Voice"))));
                    if (hasMove(player, PHAZING) && !fact(s, "opponentLastMon")) punished = true;
                    if (punished) add(i, -5, "Offensive Setup: documented counterplay -5");
                    if (stat(ai, boosted) >= 2) roll(i, -1, 0.8, "Offensive Setup: boosted stat >=+2, -1 (80%)");
                    return true;
                }
                return false;
            } },
            { order: 140, id: "accuracy-lowering", run: function(f) {
                var ai = f.opponent, player = f.player, i = f.slot, applyUtility = f.applyUtility, routine = f.routine, add = f.add, roll = f.roll;
                if (applyUtility && ACCURACY_LOWER.has(routine)) {
                    if (stat(player, "acc") <= -2) roll(i, -2, 0.8, "Accuracy lowering: player accuracy <= -2, -2 (80%)");
                    if (ai.hp > ai.maxHP * 0.9) roll(i, 2, 0.8, "Accuracy lowering: above 90% HP +2 (80%)");
                    else if (ai.hp > ai.maxHP * 0.6) roll(i, 1, 0.8, "Accuracy lowering: above 60% HP +1 (80%)");
                    else if (ai.hp < ai.maxHP * 0.6) add(i, -1, "Accuracy lowering: below 60% HP -1");
                    return true;
                }
                return false;
            } },
            { order: 280, id: "evasion", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, m = f.move, i = f.slot, add = f.add, roll = f.roll, useless = f.useless;
                if (["Double Team", "Minimize"].includes(m.name)) {
                    if (ability(player, "Unaware") || resetMoves(s, true)) add(i, -20, "Evasion Setup: Unaware/reset/phazing -20");
                    if (stat(ai, "eva") >= 6) { useless(i, "evasion setup at the stat cap"); return true; }
                    if (ai.hp > ai.maxHP * 0.9) roll(i, 1, 0.8, "Evasion Setup: HP above 90%, +1 (80%)");
                    else if (ai.hp > ai.maxHP * 0.6) roll(i, 1, 0.6, "Evasion Setup: HP above 60%, +1 (60%)");
                    return true;
                }
                return false;
            } },
            { order: 300, id: "topsy-turvy", run: function(f) {
                var player = f.player, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Topsy-Turvy" || m.name === "Topsy Turvy") {
                    var positive = 0, negative = 0;
                    Object.keys(player.boosts || {}).forEach(function(key) {
                        var stage = player.boosts[key];
                        positive += Math.max(0, stage); negative += Math.max(0, -stage);
                    });
                    add(i, positive > negative ? 1 : -1, "Topsy Turvy: positive stage sum exceeds negative sum +1, otherwise -1");
                    return true;
                }
                return false;
            } },
            { order: 610, id: "risky-setup", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, m = f.move, i = f.slot, add = f.add, branch = f.branch, incapacitated = f.incapacitated, traces = f.traces;
                if (["Shell Smash", "Belly Drum", "Fillet Away", "Filet Away", "Clangorous Soul"].includes(m.name)) {
                    var resetRisk = ability(player, "Unaware") || resetMoves(s, false) || hasMove(player, PHAZING) && !fact(s, "opponentLastMon");
                    if (resetRisk) add(i, -20, "Risky setup: reset/Unaware/phazing -20");
                    if (m.name === "Shell Smash" && !resetRisk) {
                        // Native 1.2.6 BadMove case 283 reaches these checks
                        // for the normal ability branch as well as Contrary.
                        var capped = ai.ability === "Contrary" ? stat(ai,"def") >= 6 || stat(ai,"spd") >= 6 : stat(ai,"atk") >= 6 || stat(ai,"spa") >= 6;
                        if (capped) add(i,-20,"Shell Smash: a checked boosting stat cannot rise -20");
                        else if (stat(ai,"def") <= -1 || stat(ai,"spd") <= -1) add(i,-20,"Shell Smash: Defense or Sp. Defense already lowered -20");
                        else {
                            var itemBlocked = ai.ability === "Klutz" || !!(s.field && s.field.magicRoom) || !!(s.context && s.context.opponentEmbargo);
                            var sash = typeof ai.nativeSashSturdyProtected === "boolean" ? ai.nativeSashSturdyProtected : ai.hp === ai.maxHP && (ai.ability === "Sturdy" || ai.item === "Focus Sash" && !itemBlocked);
                            var disguise = ai.name === "Mimikyu" && ai.ability === "Disguise" && !(s.context && s.context.opponentDisguiseBroken) && !ability(player,"Mold Breaker|Teravolt|Turboblaze");
                            if (!sash && !disguise && !(s.context && s.context.opponentSubstitute) && playerKills(s)) add(i,-20,"Shell Smash: target can KO before setup and no native survival protection -20");
                        }
                    }
                    if (["Belly Drum", "Fillet Away", "Filet Away"].includes(m.name)) {
                        if (ai.ability === "Contrary" || Math.floor(100 * ai.hp / ai.maxHP) <= 50 || stat(ai, "atk") > 0) {
                            add(i, -20, "Risky setup: Contrary, at most 50% HP or already raised Attack -20");
                        }
                    }
                    if (m.name === "Clangorous Soul" && ai.hp <= Math.floor(ai.maxHP / 3)) add(i, -20, "Risky setup: insufficient HP for Clangorous Soul -20");
                    var survival = setupSurvival(s, m), setupBonus = survival.ko ? -2 : 2;
                    traces[i] = traces[i].concat(survival.rules);
                    if (incapacitated()) branch(i, [{ amount: 3, probability: 0.9 }, { amount: setupBonus, probability: 0.1 }], "Risky setup: incapacitated +3 (90%); otherwise evaluates post-setup survival (10%)");
                    else add(i, setupBonus, "Risky setup: player faints AI after setup -2, otherwise +2");
                    return true;
                }
                return false;
            } },
            { order: 620, id: "acupressure", run: function(f) {
                var s = f.state, player = f.player, fast = f.fast, m = f.move, i = f.slot, add = f.add, roll = f.roll, incapacitated = f.incapacitated;
                if (m.name === "Acupressure") {
                    if (playerKills(s)) add(i, -20, "Acupressure: player KO -20");
                    if (ability(player, "Unaware") || resetMoves(s, true)) add(i, -20, "Acupressure: reset/Unaware/phazing -20");
                    var acupressureHits = hitsToKO(s);
                    if (!fast && acupressureHits === 2) add(i, -5, "Acupressure: player fast 2HKO -5");
                    if (incapacitated()) roll(i, 3, 0.9, "Acupressure: incapacitated +3 (90%)");
                    else if (acupressureHits >= 4) add(i, fast ? 2 : 1, "Acupressure: 4+ hits +1/+2");
                    return true;
                }
                return false;
            } },
            { order: 630, id: "charge", run: function(f) {
                var s = f.state, ai = f.opponent, player = f.player, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Charge") { if (playerKills(s)) add(i, -20, "Charge: player KO -20"); if (hasMove(player, PHAZING)) add(i, -20, "Charge: phazing -20"); if (ai.moves.some(function(am) { return am.type === "Electric"; })) add(i, 1, "Charge: Electric attack available +1"); return true; }
                return false;
            } },
            { order: 660, id: "psych-up", run: function(f) {
                var s = f.state, c = f.damageCase, ai = f.opponent, player = f.player, m = f.move, i = f.slot, routine = f.routine, add = f.add, traces = f.traces;
                if (m.name === "Psych Up" || m.name === "Spectral Thief") {
                    if (m.name === "Spectral Thief" && c.hdm[i]) { traces[i].push("Spectral Thief: HDM skips corresponding secondary status routine (Summary)"); return true; }
                    if (stat(player, "atk") > stat(ai, "atk") && category(ai, "Physical")) add(i, 1, "Psych Up/Spectral Thief: higher player Attack and physical attacks +1");
                    if (stat(player, "spa") > stat(ai, "spa") && category(ai, "Special")) add(i, 1, "Psych Up/Spectral Thief: higher player Sp. Attack and special attacks +1");
                    assume(s, "Psych Up/Spectral Thief's 'unconditional +1 for every other stat' is interpreted inside the higher-player-stat loop; the document does not clarify that scope.");
                    ["def", "spd", "spe", "acc", "eva"].forEach(function(key) { if (stat(player, key) > stat(ai, key)) add(i, 1, "Psych Up/Spectral Thief: higher player " + key + " +1"); });
                    return true;
                }
                return false;
            } },
            { order: 670, id: "critical-setup", run: function(f) {
                var ai = f.opponent, player = f.player, m = f.move, i = f.slot, add = f.add;
                if (m.name === "Laser Focus" || m.name === "Focus Energy") {
                    if (ability(player, "Battle Armor|Shell Armor")) add(i, -20, "Critical setup: target cannot be crit -20");
                    if (ai.ability === "Sniper" || m.name === "Focus Energy" && (ai.ability === "Super Luck" || ai.item === "Scope Lens" || ai.moves.some(function(am) { return am.highCrit; }))) add(i, 1, "Critical setup: critical synergy +1"); return true;
                }
                return false;
            } }
        ];
    }
    return { createRules: createRules };
});
