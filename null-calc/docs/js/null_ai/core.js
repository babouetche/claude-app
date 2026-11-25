(function(root, factory) {
    "use strict";
    if (typeof module === "object" && module.exports) module.exports = factory(
        require("./rules_setup.js"), require("./rules_status.js"), require("./rules_field.js"),
        require("./rules_survival.js"), require("./rules_damage.js"));
    else root.NullMoveAI = factory(root.NullAIRulesSetup, root.NullAIRulesStatus, root.NullAIRulesField,
        root.NullAIRulesSurvival, root.NullAIRulesDamage);
})(typeof window !== "undefined" ? window : globalThis, function(setupRules, statusRules, fieldRules, survivalRules, damageRules) {
    "use strict";

    // Source: Pokemon Null AI, sections "Brief summary", "Damaging Moves",
    // named move routines and Q&A. See documentation/DOCUMENTATION_COMPLETE.md for the coverage
    // boundary. The default estimates disclose their RNG/context assumptions;
    // context.calculationMode = "strict" only returns identifiable distributions.
    var SOURCE = "https://docs.google.com/document/d/1KwkghD6eOZ026HR81C7yToDD_7fPwL2Iccc_XNL-G48/edit";
    var EPSILON = 1e-10;
    var NO_HDM = names("Explosion|Self-Destruct|Misty Explosion|Final Gambit|Meteor Beam|Electro Shot|Future Sight|Fissure|Horn Drill|Guillotine|Sheer Cold|Feint|Upper Hand");
    var NO_KILL = names("Explosion|Self-Destruct|Misty Explosion|Final Gambit|Rollout|Ice Ball|Fissure|Horn Drill|Guillotine|Sheer Cold");
    var CHOICE_EXCEPTIONS = names("Memento|Parting Shot|Baton Pass|Teleport|Chilly Reception|Sleep Talk|Me First|Copycat|Mimic|Transform|Sketch|Nature Power|Assist|Metronome");
    var PHAZING = names("Roar|Whirlwind|Dragon Tail|Circle Throw");
    var RESET = names("Haze|Clear Smog|Freezy Frost|Topsy-Turvy|Topsy Turvy");
    var HAZARDS = names("Stealth Rock|Stone Axe|Spikes|Ceaseless Edge|Toxic Spikes|Sticky Web");
    var BINDING = names("Fire Spin|Whirlpool|Sand Tomb|Magma Storm|Clamp|Bind|Wrap|Infestation|Snap Trap|Thunder Cage");
    var TRAPPING = names("Octolock|Mean Look|Block|Spider Web|Anchor Shot|Spirit Shackle|Thousand Waves|Jaw Lock");
    var SECONDARY_ROUTINES = { "Luster Purge": "Metal Sound", "Mist Ball": "Confide", "Seed Flare": "Metal Sound",
        "Sacred Fire": "Will-O-Wisp", "Dynamic Punch": "Confuse Ray", "Chatter": "Confuse Ray", "Mortal Spin": "Toxic" };
    // These routines have history, party or incompletely described checks. They
    // must never silently fall through to the ordinary damaging-move routine.
    var SPECIAL = names("Fake Out|First Impression|Feint|Upper Hand|Pursuit|Sucker Punch|Thunderclap|Knock Off|U-turn|Volt Switch|Flip Turn|Dragon Tail|Circle Throw|Thousand Waves|Anchor Shot|Spirit Shackle|Jaw Lock|Stone Axe|Ceaseless Edge|Pollen Puff|Beat Up|Round|Fury Cutter|Echoed Voice|Rollout|Ice Ball|Final Gambit|Future Sight|Doom Desire|Meteor Beam|Electro Shot|Sky Attack|Freeze Shock|Ice Burn|Secret Power|Fell Stinger|Spectral Thief|Relic Song|Snore|Counter|Mirror Coat|Metal Burst|Fissure|Horn Drill|Guillotine|Sheer Cold|Explosion|Self-Destruct|Misty Explosion|Fling|Rapid Spin|Order Up|Freezy Frost|Zippy Zap|Glitzy Glow|Baddy Bad|Sappy Seed|Sparkly Swirl|Mortal Spin|Psychic Noise");
    // Effect names come from the Null dataset, not a generic AI implementation.
    var ORDINARY_EFFECTS = names("HIT|MULTI|PAY|BURN|FREEZE|PARALYZE|FLINCH|RECOIL|RAMPAGE|POISON|ARG|SPECIAL|CONFUSE|SPEED|ATTACK|RECHARGE|LOW|LEVEL|EARTHQUAKE|FLAIL|FALSE|DEFENSE|HIDDEN|ALL|FACADE|SUPERPOWER|BRICK|ERUPTION|OVERHEAT|WAKE|HAMMER|GYRO|BRINE|BUG|CLOSE|PAYBACK|VARY|PUNISHMENT|CHANGE|PSYSHOCK|VENOSHOCK|SMACK|ALWAYS|FLAME|HEAT|ELECTRO|FOUL|CLEAR|STORED|HEX|INCINERATE|ACROBATICS|WEATHER|HURRICANE|V|ATTACKER|MAX|PHOTON|RETURN|DYNAMAX|SNIPE|BODY|GRAV|EXPANDING|GRASSY|RISING|TERRAIN|LASH|INFERNAL|SPIN|GLAIVE|MAKE|COLLISION|PSYBLADE|HYDRO|IVY");

    function names(text) { return new Set(text.split("|")); }
    function hasMove(mon, list) { return (mon.moves || []).some(function(m) { return list.has(m.name); }); }
    function ability(mon, list) { return list.split("|").indexOf(mon.ability) !== -1; }
    function stat(mon, key) { return (mon.boosts || {})[key] || 0; }
    function category(mon, kind) { return (mon.moves || []).some(function(m) { return m.name !== "(No Move)" && m.category === kind; }); }
    function fasterAtSpeeds(a, b, field) { return field && field.trickRoom ? a <= b : a >= b; }
    function faster(s) { return fasterAtSpeeds(s.opponent.speed, s.player.speed, s.field); }
    function lastResortReady(mon, context) {
        context = context || {};
        var moves = mon.moves || [], others = moves.filter(function(m) { return m.name !== "(No Move)" && m.name !== "Last Resort"; });
        if (!others.length) return false;
        var tried = others.map(function(m) {
            if (m.usedSinceEntry !== undefined && typeof m.usedSinceEntry !== "boolean") throw new Error("Move attempts since entry must be true or false.");
            if (m.usedSinceEntry === true || context.opponentLastMove === m.name) return true;
            if (m.usedSinceEntry === false) return false;
            return context.opponentFirstTurn === true || context.opponentTurnsActive === 1 ? false : null;
        });
        return tried.some(function(v) { return v === false; }) ? false : tried.every(function(v) { return v === true; }) ? true : null;
    }
    function moveAvailability(mon, context) {
        context = context || {};
        var reasons = [], hasLastResort = (mon.moves || []).some(function(m) { return m.name === "Last Resort"; });
        var ready = hasLastResort ? lastResortReady(mon, context) : true;
        var legal = (mon.moves || []).map(function(m, i) {
            var enabled = m.name !== "(No Move)" && m.usable !== false && m.pp !== 0 && (context.forcedMoveSlot === undefined || context.forcedMoveSlot === i);
            if (enabled && m.name === "Last Resort") {
                if (ready === null) throw new Error("Last Resort history is unknown: enter the other moves attempted since this Pokémon entered battle.");
                if (!ready) reasons[i] = "Last Resort is locked: every other known move must have been attempted since entry. Failed attempts count.";
                enabled = ready;
            }
            return enabled;
        });
        return {legal:legal, reasons:reasons};
    }
    function fail(reason) { throw new Error(reason); }
    function assume(s, message) {
        if (!s._estimate) fail(message);
        s._assumptions.add(message);
    }
    function fact(s, key, fallback) {
        if (!s.context || typeof s.context[key] === "undefined") {
            if (typeof fallback === "undefined") {
                var defaults = { opponentFirstTurn: true, opponentLastMon: false, playerLastMon: false,
                    opponentTeamSize: 6, opponentAliveCount: 6, protectionStreak: 0, opponentLastMove: "", playerLastMove: "" };
                fallback = Object.prototype.hasOwnProperty.call(defaults, key) ? defaults[key] : false;
            }
            assume(s, "Battle context " + key + " was not entered; using " + JSON.stringify(fallback) + ".");
            return fallback;
        }
        return s.context[key];
    }
    function resetMoves(s, phazing) { return hasMove(s.player, RESET) || (phazing && hasMove(s.player, PHAZING)); }
    function same(a, b) { return a.every(function(p, i) { return Math.abs(p - b[i]) < EPSILON; }); }
    function choice(scores, legal) {
        var max = -Infinity, winners = [];
        scores.forEach(function(score, i) {
            if (!legal[i]) return;
            if (score > max) { max = score; winners = [i]; }
            else if (score === max) winners.push(i);
        });
        return scores.map(function(_, i) { return winners.indexOf(i) < 0 ? 0 : 1 / winners.length; });
    }

    // Aggregate a VERIFIED joint distribution. Sum branch masses reaching each
    // maximum, then split ties uniformly. No softmax, sampling or normalization.
    function aggregateScenarios(scenarios, legal) {
        if (!Array.isArray(legal) || !legal.some(Boolean) || !Array.isArray(scenarios) || !scenarios.length) fail("A joint distribution needs at least one legal move and one branch.");
        var probabilities = legal.map(function() { return 0; }), mass = 0;
        scenarios.forEach(function(branch) {
            if (!Number.isFinite(branch.probability) || branch.probability < 0 ||
                !Array.isArray(branch.scores) || branch.scores.length !== legal.length ||
                branch.scores.some(function(v) { return !Number.isFinite(v); })) fail("Invalid joint score distribution.");
            mass += branch.probability;
            choice(branch.scores, legal).forEach(function(p, i) { probabilities[i] += p * branch.probability; });
        });
        if (Math.abs(mass - 1) > EPSILON) fail("Joint branch probabilities must sum to 1.");
        return probabilities;
    }

    // A random variable represents one documented random check, possibly changing
    // multiple scores. The document gives marginal odds but not correlations.
    // E[f(X)] is identifiable without independence when f is additively separable.
    // Test that property over EVERY combination before using marginal odds.
    function solveMarginals(base, variables, legal) {
        var baseline = choice(base, legal);
        var contributions = variables.map(function(variable) {
            var mass = variable.outcomes.reduce(function(sum, o) { return sum + o.probability; }, 0);
            if (Math.abs(mass - 1) > EPSILON) fail("Invalid documented random branch mass.");
            return variable.outcomes.map(function(o) {
                var adjusted = base.map(function(score, i) { return score + (o.delta[i] || 0); });
                return choice(adjusted, legal).map(function(p, i) { return p - baseline[i]; });
            });
        });
        var count = 0;
        function visit(index, scores, predicted) {
            if (++count > 100000) fail("Random branch proof exceeds the supported limit.");
            if (index === variables.length) {
                if (!same(choice(scores, legal), predicted)) fail("The documentation does not specify the joint law of competing random score checks.");
                return;
            }
            variables[index].outcomes.forEach(function(o, branch) {
                visit(index + 1,
                    scores.map(function(score, i) { return score + (o.delta[i] || 0); }),
                    predicted.map(function(p, i) { return p + contributions[index][branch][i]; }));
            });
        }
        visit(0, base, baseline);
        var result = baseline.slice();
        variables.forEach(function(variable, v) {
            variable.outcomes.forEach(function(o, branch) {
                contributions[v][branch].forEach(function(p, i) { result[i] += o.probability * p; });
            });
        });
        return result;
    }

    // Exact enumeration of the specified independent model, not Monte Carlo.
    // Each routine's own shared gate remains one variable (e.g. sleep bonuses).
    // Convolving the score distributions avoids an exponential branch tree.
    function solveIndependent(base, variables, legal) {
        if (!Array.isArray(base) || !Array.isArray(legal) || base.length !== legal.length || !legal.some(Boolean) || base.some(function(v) { return !Number.isFinite(v); })) fail("Invalid independent score model.");
        var distributions = base.map(function(score) { return new Map([[score, 1]]); });
        variables.forEach(function(variable) {
            var mass = variable.outcomes.reduce(function(sum, o) {
                if (!Number.isFinite(o.probability) || o.probability < 0 || (o.delta || []).some(function(v) { return !Number.isFinite(v); })) fail("Invalid independent score gate.");
                return sum + o.probability;
            }, 0);
            if (Math.abs(mass - 1) > EPSILON) fail("Independent score gate probabilities must sum to 1.");
            var indices = new Set();
            variable.outcomes.forEach(function(o) { (o.delta || []).forEach(function(d, i) { if (d) indices.add(i); }); });
            if (indices.size > 1) fail("An independent score gate unexpectedly affects multiple moves.");
            if (!indices.size) return;
            var i = Array.from(indices)[0], next = new Map();
            distributions[i].forEach(function(mass, score) {
                variable.outcomes.forEach(function(o) {
                    var value = score + ((o.delta || [])[i] || 0);
                    next.set(value, (next.get(value) || 0) + mass * o.probability);
                });
            });
            distributions[i] = next;
        });
        return base.map(function(_, i) {
            if (!legal[i]) return 0;
            var probability = 0;
            distributions[i].forEach(function(mass, score) {
                var ties = [1];
                distributions.forEach(function(other, j) {
                    if (j === i || !legal[j]) return;
                    var below = 0, equal = 0;
                    other.forEach(function(p, value) { if (value < score) below += p; else if (value === score) equal += p; });
                    var next = Array(ties.length + 1).fill(0);
                    ties.forEach(function(p, k) { next[k] += p * below; next[k + 1] += p * equal; });
                    ties = next;
                });
                probability += mass * ties.reduce(function(sum, p, k) { return sum + p / (k + 1); }, 0);
            });
            return probability;
        });
    }

    function validateState(s, completeDoubleTarget) {
        if (!s || !s.player || !s.opponent) fail("Missing Pokemon data.");
        if(s.context&&s.context.trainerAIFlags!==undefined) {
            var mask=s.context.trainerAIFlags, supported=s.field&&s.field.gameType==="Doubles"?167:39;
            if(!Number.isInteger(mask)||mask!==supported) fail("This trainer's AI flag combination is not implemented; the documentary profile cannot certify its native move choice.");
        }
        if (s.field && s.field.gameType === "Doubles" && !completeDoubleTarget) fail("Doubles require all four battlers and move-target scoring; this snapshot is incomplete.");
        [s.player, s.opponent].forEach(function(mon) {
            if (!Number.isFinite(mon.hp) || !Number.isFinite(mon.maxHP) || mon.maxHP <= 0 ||
                mon.hp < 0 || mon.hp > mon.maxHP || !Number.isFinite(mon.speed) || mon.speed < 0) fail("Invalid HP or speed data.");
            if (Object.values(mon.boosts || {}).some(function(stage) { return !Number.isInteger(stage) || stage < -6 || stage > 6; })) fail("Invalid stat stages.");
        });
        if (s.player.hp === 0 || s.opponent.hp === 0) fail("A fainted Pokemon has no move-choice distribution for this matchup.");
        if (!Array.isArray(s.opponent.moves) || s.opponent.moves.length > 4) fail("Invalid opposing moveset.");
        if (s.opponent.moves.some(function(m) { return !m || typeof m.name !== "string" || !m.name ||
            (m.name !== "(No Move)" && m.usable !== false && m.pp !== 0 && !["Status", "Physical", "Special"].includes(m.category)); })) fail("Incomplete opposing move data.");
    }

    function damageCases(s, legal) {
        var moves = s.opponent.moves;
        var rolls = moves.map(function(m, i) {
            if (!legal[i] || m.category === "Status") return [{ damage: 0, probability: 1 }];
            if (!Array.isArray(m.damage) || !m.damage.length || m.damage.some(function(d) { return !Number.isFinite(d) || d < 0; })) fail("Missing AI damage support for " + m.name + ".");
            var counts = new Map();
            m.damage.forEach(function(d) { counts.set(d, (counts.get(d) || 0) + 1 / m.damage.length); });
            var values = Array.from(counts, function(pair) { return { damage: pair[0], probability: pair[1] }; });
            if (s._estimate && values.length > 16) {
                assume(s, "Long damage supports were reduced to 16 weighted quantile points for responsive calculation.");
                values.sort(function(a, b) { return a.damage - b.damage; });
                var reduced = [], total = 0, slot = 0;
                values.forEach(function(v) {
                    var target = Math.min(15, Math.floor((total + v.probability / 2) * 16));
                    if (!reduced[target]) reduced[target] = { damage: v.damage, probability: 0 };
                    reduced[target].probability += v.probability;
                    total += v.probability; slot = target;
                });
                values = reduced.filter(Boolean);
            }
            return values;
        });
        var cases = new Map(), values = [], visits = 0;
        function visit(i, probability) {
            if (++visits > 100000) fail("Damage support exceeds the supported limit.");
            if (i < rolls.length) { rolls[i].forEach(function(d) { values[i] = d.damage; visit(i + 1, probability * d.probability); }); return; }
            var kill = moves.map(function(m, j) {
                var survives = s.player.hp === s.player.maxHP && (s.player.item === "Focus Sash" || s.player.ability === "Sturdy") && !(m.hits > 1);
                return legal[j] && m.category !== "Status" && !survives && values[j] >= s.player.hp;
            });
            var eligible = moves.map(function(m, j) { return legal[j] && m.category !== "Status" && !NO_HDM.has(m.name); });
            var max = Math.max.apply(null, values.filter(function(_, j) { return eligible[j]; }).concat([0]));
            var hdm = moves.map(function(_, j) { return eligible[j] && values[j] > 0 && (kill[j] || values[j] === max); });
            var key = hdm.map(Number).join("") + ":" + kill.map(Number).join("");
            if (!cases.has(key)) cases.set(key, { hdm: hdm, kill: kill, probability: 0 });
            cases.get(key).probability += probability;
        }
        visit(0, 1);
        return Array.from(cases.values());
    }

    function threat(s) {
        var damaging = (s.player.moves || []).filter(function(m) { return m.category !== "Status" && m.name !== "(No Move)" && (!(s.field&&s.field.gameType==='Doubles')||m.usable!==false&&m.pp!==0); });
        if (!damaging.length) return { low: 0, high: 0, mean: 0 };
        if (damaging.some(function(m) { return !Array.isArray(m.damage) || !m.damage.length || m.damage.some(function(d) { return !Number.isFinite(d) || d < 0; }); })) fail("Missing player damage data.");
        var bounds = {
            low: Math.max.apply(null, damaging.map(function(m) { return Math.min.apply(null, m.damage); })),
            high: Math.max.apply(null, damaging.map(function(m) { return Math.max.apply(null, m.damage); })),
            mean: Math.max.apply(null, damaging.map(function(m) { return m.damage.reduce(function(a, b) { return a + b; }, 0) / m.damage.length; }))
        };
        if (bounds.high >= s.opponent.hp && s.opponent.hp === s.opponent.maxHP &&
            (s.opponent.item === "Focus Sash" || ability(s.opponent, "Sturdy|Disguise|Ice Face"))) {
            assume(s, "Survival effects use calculator damage and full-HP Focus Sash/Sturdy for single-hit moves; the exact internal AI survival check is undocumented.");
            if ((s.opponent.item === "Focus Sash" || s.opponent.ability === "Sturdy") && damaging.every(function(m) { return !(m.hits > 1); })) {
                bounds.low = Math.min(bounds.low, s.opponent.hp - 1);
                bounds.high = Math.min(bounds.high, s.opponent.hp - 1);
                bounds.mean = Math.min(bounds.mean, s.opponent.hp - 1);
            }
        }
        return bounds;
    }
    function playerKills(s) {
        var t = threat(s);
        if (t.low >= s.opponent.hp) return true;
        if (t.high < s.opponent.hp) return false;
        if (s.context && typeof s.context.playerCanKO !== "undefined") return s.context.playerCanKO;
        assume(s, "An ambiguous player KO check uses the mean of the calculator's damage rolls.");
        return t.mean >= s.opponent.hp;
    }
    function hitsToKO(s) {
        var t = threat(s), hp = s.opponent.hp;
        var low = t.high > 0 ? Math.ceil(hp / t.high) : Infinity;
        var high = t.low > 0 ? Math.ceil(hp / t.low) : Infinity;
        if (low === high) return low;
        if (s.context && typeof s.context.playerHitsToKO !== "undefined") return s.context.playerHitsToKO;
        assume(s, "An ambiguous player hits-to-KO check uses mean calculator damage.");
        return t.mean > 0 ? Math.ceil(hp / t.mean) : Infinity;
    }
    function aiHitsToKO(s, legal) {
        var attacks = s.opponent.moves.filter(function(m, i) { return legal[i] && m.category !== "Status" && m.damage && !NO_HDM.has(m.name); });
        if (!attacks.length) return Infinity;
        var low = Math.max.apply(null, attacks.map(function(m) { return Math.min.apply(null, m.damage); }));
        var high = Math.max.apply(null, attacks.map(function(m) { return Math.max.apply(null, m.damage); }));
        var few = high ? Math.ceil(s.player.hp / high) : Infinity, many = low ? Math.ceil(s.player.hp / low) : Infinity;
        if (few === many) return few;
        if (s.context && typeof s.context.opponentHitsToKO !== "undefined") return s.context.opponentHitsToKO;
        assume(s, "An ambiguous AI hits-to-KO check uses the strongest mean calculator damage.");
        var mean = Math.max.apply(null, attacks.map(function(m) { return m.damage.reduce(function(a, b) { return a + b; }, 0) / m.damage.length; }));
        return mean ? Math.ceil(s.player.hp / mean) : Infinity;
    }
    function aiMaxKills(s, legal) {
        return s.opponent.moves.some(function(m, i) {
            return legal[i] && m.category !== "Status" && m.damage && Math.max.apply(null, m.damage) >= s.player.hp;
        });
    }

    // Families are registered once; scoreCase keeps the exact historical order.
    // No family owns a global/current battle: a fresh explicit frame is passed
    // for each move and damage case, keeping Singles and target scoring identical.
    var ruleHelpers = {
        names: names,
        hasMove: hasMove,
        ability: ability,
        stat: stat,
        category: category,
        fasterAtSpeeds: fasterAtSpeeds,
        fail: fail,
        assume: assume,
        fact: fact,
        resetMoves: resetMoves,
        playerKills: playerKills,
        hitsToKO: hitsToKO,
        aiHitsToKO: aiHitsToKO,
        threat: threat,
        PHAZING: PHAZING,
        HAZARDS: HAZARDS,
        BINDING: BINDING,
        TRAPPING: TRAPPING
    };
    var scoringRules = [setupRules, statusRules, fieldRules, survivalRules, damageRules].flatMap(function(family) {
        if (!family || typeof family.createRules !== "function") throw new Error("Load all Null AI scoring families before core.js.");
        return family.createRules(ruleHelpers);
    }).sort(function(a, b) { return a.order - b.order; });
    if (new Set(scoringRules.map(function(rule) { return rule.order; })).size !== scoringRules.length)
        throw new Error("Duplicate Null AI rule dispatch order.");

    function scoreCase(s, c, legal) {
        var base = legal.map(function() { return 0; }), variables = [], traces = legal.map(function() { return []; });
        function add(i, amount, rule) { base[i] += amount; traces[i].push(rule); }
        function roll(i, amount, probability, rule) {
            traces[i].push(rule);
            if (probability === 1) { base[i] += amount; return; }
            if (probability === 0) return;
            var delta = base.map(function() { return 0; }); delta[i] = amount;
            variables.push({ outcomes: [
                { delta: [], probability: 1 - probability }, { delta: delta, probability: probability }
            ] });
        }
        function branch(i, outcomes, rule) {
            traces[i].push(rule);
            variables.push({ outcomes: outcomes.map(function(o) {
                var delta = base.map(function() { return 0; }); delta[i] = o.amount;
                return { delta: delta, probability: o.probability };
            }) });
        }
        function useless(i, reason) {
            assume(s, "The document describes a usual -20 useless-move penalty; applying it to " + reason + ".");
            add(i, -20, "Useless move: " + reason + " -20 (document's usual penalty)");
        }
        function incapacitated() {
            if (player.status !== "slp" && player.status !== "frz") return false;
            return fact(s, "playerIncapacitated", true);
        }
        var ai = s.opponent, player = s.player, fast = faster(s), maxKills = aiMaxKills(s, legal);
        ai.moves.forEach(function(m, i) {
            if (!legal[i]) return;
            var original=m, copied=["Copycat","Mirror Move","Me First"].includes(m.name), isStatus = m.category === "Status";
            if(copied) {
                // TryToFaint scores the original call move. BadMove/Viability
                // recurse on predictedMoves[target], not on last-used move.
                var predicted=m.copiedMove||(s.player.moves||[]).find(function(pm){return pm.name===fact(s,"predictedPlayerMove","");});
                if(!predicted&&s._estimate){predicted=(s.player.moves||[]).filter(function(pm){return pm.name!=="(No Move)"&&pm.usable!==false&&pm.pp!==0;}).sort(function(a,b){return Math.max.apply(null,b.damage||[0])-Math.max.apply(null,a.damage||[0]);})[0];}
                if(!predicted)fail("Identify the AI-predicted player move to score "+m.name+".");
                if(!m.predictionConfirmed)assume(s,"Copied move: the predicted player action is an estimate; set the predicted move to confirm the scenario.");
                add(i,6,"Copied move: original call move receives the status +6 base");
                var key=m.name==="Mirror Move"?"mirrorMoveBanned":m.name==="Copycat"?"copycatBanned":"meFirstBanned";
                var banned=predicted[key];
                if(banned===undefined){banned=false;assume(s,"Copy eligibility is unverified; this estimate assumes the predicted move is allowed. Confirm the restriction for this scenario.");}
                if(banned||m.name==="Me First"&&!fast){if(fast||m.name==="Me First")add(i,-20,"Copied move: banned prediction or slow Me First -20");return;}
                m=Object.assign({},predicted,{usable:true,pp:undefined});isStatus=m.category==="Status";
                traces[i].push(original.name+" evaluates predicted "+m.name);
            }
            if (m.unknownSecondary) assume(s, "A guaranteed secondary effect has no verified mapping for " + m.name + "; its ordinary damage score is used.");
            if (!copied && isStatus && m.name !== "Nature Power" && m.name !== "Memento") add(i, 6, "Summary: status base +6");
            if (c.hdm[i]) { add(i, 6, "Damaging Moves: HDM +6"); roll(i, 2, 0.25, "Damaging Moves: HDM +2 (25%)"); }
            if (c.kill[i] && !NO_KILL.has(m.name)) {
                add(i, fast || m.priority > 0 ? 6 : 3, "Damaging Moves: fast/priority KO +6, slow KO +3");
                if (fast && ability(ai, "Moxie|Beast Boost|Chilling Neigh|Grim Neigh|As One (Glastrier)|As One (Spectrier)")) add(i, 1, "Damaging Moves: faster KO ability +1");
            }
            if (!isStatus && m.priority > 0 && m.name !== "Feint" && !fast) {
                if (playerKills(s)) add(i, c.hdm[i] ? 5 : 11, "Priority: slower and threatened +5 HDM / +11 otherwise");
                else if (ai.item === "Eject Button") add(i, 11, "Priority: slower with Eject Button +11");
            }
            if ((ai.status === "frz" || ai.status === "fbt") && m.thawsUser) add(i, 12, "Thawing move +12");
            if (/^Choice (Band|Specs|Scarf)$/.test(ai.item) && isStatus && !CHOICE_EXCEPTIONS.has(m.name)) add(i, -20, "Choice AI: status penalty -20");
            if (isStatus && (m.statusBlocked || (ai.ability === "Prankster" && (player.types || []).includes("Dark") && m.target !== "self" && m.target !== "allySide" && m.target !== "all"))) { useless(i, "blocked " + m.name); return; }
            // Native 1.2.6 BadMove at 0x0815eb88 adds the target mask guard:
            // selected target (0), both foes (8), or foes-and-ally (32).
            // A faster AI must not penalize its self/field/ally moves here.
            var targetBits = m.nativeTargetBits, foeTarget = Number.isInteger(targetBits) ? targetBits === 0 || !!(targetBits & 0x28) : ["normal", "any", "adjacentFoe", "allAdjacentFoes", "allAdjacent"].includes(m.target || "normal");
            if (s.context && s.context.playerSemiInvulnerable && fast && foeTarget && m.nativeEffect !== 150 && !names("Fly|Dig|Dive|Bounce|Phantom Force|Shadow Force|Sky Drop").has(m.name) && m.hitsSemiInvulnerable !== true) {
                if (names("Gust|Twister|Thunder|Hurricane|Sky Uppercut|Smack Down|Thousand Arrows|Earthquake|Magnitude|Fissure|Surf|Whirlpool").has(m.name) && m.hitsSemiInvulnerable === undefined)
                    assume(s, "The target's semi-invulnerable phase is unspecified; this move may reach particular phases. The estimate assumes the selected move cannot reach it.");
                add(i, -20, "Semi-invulnerable target: faster AI and opponent-targeting move -20");
            }
            if (!isStatus && !["Counter", "Mirror Coat", "Metal Burst", "Fissure", "Horn Drill", "Guillotine", "Sheer Cold"].includes(m.name) && m.damage && m.damage.every(function(d) { return d === 0; })) {
                if (s._estimate) useless(i, "ineffective " + m.name);
                else traces[i].push("Ineffective attack: score 0 is an upper bound before its unknown useless-move penalty");
                return;
            }

            // The new native effect-391 BadMove handler keeps the HDM guard.
            // It penalizes a non-HDM at the cap; a strongest damaging attack
            // may still be selected for damage even with full hazards.
            if (["Stone Axe", "Ceaseless Edge"].includes(m.name) && !c.hdm[i]) {
                var fullHazard = m.name === "Stone Axe" ? !!(s.field && s.field.playerStealthRock) : Number(s.field && s.field.playerSpikes || 0) >= 3;
                if (fullHazard) add(i, -20, "Damaging hazard: maximum layers and not HDM -20");
            }

            // A damaging guaranteed secondary follows its status routine only
            // when it is not HDM; it does not stack another +6 with HDM.
            var contrarySetup = ai.ability === "Contrary" && ["Leaf Storm", "Overheat", "Draco Meteor", "Superpower"].includes(m.name);
            // Syrup Bomb has its own conditional +6 native routine. Alluring
            // Voice's effect 75 has no native BadMove/Viability handler; its
            // corrected 100% effect parameter must not create a confusion AI.
            var utility = !["Syrup Bomb", "Alluring Voice"].includes(m.name) && (isStatus || m.guaranteedEffect === true || contrarySetup || HAZARDS.has(m.name) || BINDING.has(m.name) || TRAPPING.has(m.name) || m.name === "Salt Cure");
            if (!isStatus && utility && !c.hdm[i]) add(i, 6, "Summary: guaranteed secondary base +6 outside HDM");
            var applyUtility = utility && (isStatus || !c.hdm[i]);
            var routine = m.secondaryRoutine || SECONDARY_ROUTINES[m.name] || m.name;
            if (applyUtility && m.statusBlocked) { useless(i, "blocked secondary effect of " + m.name); return; }
            if (m.fieldAlreadyActive) { useless(i, "already active " + m.name); return; }
            var frame = {
                state: s, damageCase: c, legal: legal, opponent: ai, player: player, fast: fast, maxKills: maxKills,
                move: m, slot: i, isStatus: isStatus, applyUtility: applyUtility, contrarySetup: contrarySetup, routine: routine,
                base: base, variables: variables, traces: traces, add: add, roll: roll, branch: branch, useless: useless,
                incapacitated: incapacitated, replaceVariables: function(next) { variables = next; frame.variables = next; }
            };
            if (scoringRules.some(function(rule) { return rule.run(frame); })) return;
            if (m.name === "Alluring Voice") { traces[i].push("Alluring Voice: native effect has no secondary scoring routine; ordinary damage/KO scores only"); return; }
            if (["Copycat", "Mirror Move", "Me First"].includes(m.name)) fail("Recursive copied-move prediction is unsupported: " + m.name + ".");
            if (!isStatus && utility) {
                if (!c.hdm[i]) assume(s, "No additional secondary-effect score is described for " + m.name + "; the documented +6 base outside HDM is used.");
                traces[i].push("Summary: guaranteed secondary uses +6 outside HDM; HDM keeps its damage routine");
                return;
            }
            if (isStatus && m.name !== "Nature Power") {
                if(s.field&&s.field.gameType==="Doubles"&&["Helping Hand","Dragon Cheer","Coaching","Instruct","Heal Pulse","Floral Healing","Teatime","Ally Switch","Follow Me","Rage Powder"].includes(m.name)) {traces[i].push("Doubles-specific routine is evaluated by the four-battler solver");return;}
                if (s._estimate) {
                    assume(s, "No further " + (s.field&&s.field.gameType==="Doubles"?"opponent-target":"Singles") + " routine is described for " + m.name + "; only the document's general status base score and known usability checks are applied.");
                    traces[i].push("Summary: general status base +6; undocumented additional bonuses are not assumed");
                    return;
                }
                fail("Incomplete or unsupported Null routine: " + m.name + ".");
            }
            if (SPECIAL.has(m.name) || isStatus) fail("Incomplete or unsupported Null routine: " + m.name + ".");
            if (m.guaranteedEffect && !c.hdm[i]) fail("The guaranteed secondary routine is unknown for " + m.name + ".");
            if (!ORDINARY_EFFECTS.has(m.effect)) fail("Unverified Null move effect: " + m.name + " (" + (m.effect || "missing") + ").");
        });
        return { base: base, variables: variables, traces: traces };
    }

    function getNullAIMoveProbabilities(s) {
        var rawMoves = s && s.opponent && Array.isArray(s.opponent.moves) ? s.opponent.moves : [];
        var moves = rawMoves.map(function(m) { return m && typeof m === "object" ? m : { name: "(Unknown Move)" }; });
        var forcedSlot = s && s.context && s.context.forcedMoveSlot;
        var legal = moves.map(function(m, i) { return m.name !== "(No Move)" && m.usable !== false && m.pp !== 0 &&
            (forcedSlot === undefined || forcedSlot === i); });
        var requestedMode = s && s.context && s.context.calculationMode;
        s = Object.assign({}, s, { _estimate: requestedMode !== "strict", _assumptions: new Set(s && Array.isArray(s.assumptions) ? s.assumptions : []) });
        var excludedReasons = [];
        moves.forEach(function(m) { if (m.damageEstimated) s._assumptions.add("Damage support for " + m.name + " uses the calculator's approximated multi-hit routine."); });
        function result(status, probabilities, reasons, traces) {
            return { status: status, scope: "conditional-on-move", calculationMode: s._estimate ? "estimate" : "strict", source: SOURCE, reasons: reasons || [], assumptions: Array.from(s._assumptions),
                moves: moves.map(function(m, i) { return { move: m.name, probability: legal[i] ? (probabilities ? probabilities[i] : null) : 0,
                    probabilityBounds: legal[i] && !probabilities ? [0, 1] : undefined, rules: excludedReasons[i] ? [excludedReasons[i]] : traces ? traces[i] : [] }; }) };
        }
        try {
            validateState(s);
            var availability = moveAvailability(s.opponent, s.context || {}); legal = availability.legal; excludedReasons = availability.reasons;
            if (forcedSlot !== undefined && (!Number.isInteger(forcedSlot) || forcedSlot < 0 || forcedSlot >= moves.length)) fail("Invalid forced move slot.");
            if (moves.some(function(m) { return typeof m.pp !== "undefined" && (!Number.isInteger(m.pp) || m.pp < 0 || m.pp > 64); })) fail("Remaining PP must be an integer from 0 to 64.");
            if (!legal.some(Boolean)) return result("no-legal-moves", null, ["All selected moves are absent or unusable. Struggle is outside these four slots."]);
            if (legal.filter(Boolean).length === 1) return result("determined", legal.map(function(v) { return Number(v); }), [], legal.map(function(v) { return v ? ["Only one usable move: selected conditional on using a move"] : []; }));
            if (s.jointScoreScenarios) return result("determined", aggregateScenarios(s.jointScoreScenarios, legal));
            if (!s._estimate && s._assumptions.size) fail("Strict mode cannot certify approximated state/damage: " + Array.from(s._assumptions).join(" "));
            if (!s._estimate && moves.every(function(m, i) { return !legal[i] || (m.category !== "Status" && m.damage && m.damage.every(function(d) { return d === 0; })); })) fail("All damage is ineffective; the document does not exhaustively specify useless-move scoring.");
            var possibleKO = moves.some(function(m, i) { return legal[i] && m.damage && Math.max.apply(null, m.damage) >= s.player.hp; });
            if (possibleKO && ((s.player.hp === s.player.maxHP && (s.player.item === "Focus Sash" || ability(s.player, "Sturdy|Disguise"))) ||
                ability(s.player, "Ice Face"))) assume(s, "Survival effects use calculator damage and full-HP Focus Sash/Sturdy for single-hit moves; the exact internal AI survival routine is undocumented.");
            var cases = damageCases(s, legal), answer = null, weighted = legal.map(function() { return 0; }), damageDependent = false, allTraces = legal.map(function() { return new Set(); });
            cases.forEach(function(c) {
                var scored = scoreCase(s, c, legal), probabilities;
                try { probabilities = solveMarginals(scored.base, scored.variables, legal); }
                catch (err) {
                    if (!s._estimate) throw err;
                    assume(s, "Competing random score checks are treated as independent; the public document gives their odds without their joint RNG law.");
                    probabilities = solveIndependent(scored.base, scored.variables, legal);
                }
                // For an immune ordinary attack, zero is only an upper bound on
                // its unknown useless-move score. A zero pick probability at
                // that bound proves any non-positive penalty irrelevant.
                if (!s._estimate && moves.some(function(m, i) { return legal[i] && m.category !== "Status" && m.damage && m.damage.every(function(d) { return d === 0; }) && probabilities[i] > EPSILON; })) fail("An ineffective move could win; its exact useless-move penalty is not specified.");
                scored.traces.forEach(function(t, i) { t.forEach(function(rule) { allTraces[i].add(rule); }); });
                if (answer && !same(answer, probabilities)) damageDependent = true;
                probabilities.forEach(function(p, i) { weighted[i] += p * c.probability; });
                answer = probabilities;
            });
            if (damageDependent) {
                assume(s, "Damage-roll positions are equiprobable and rolled independently for each move; duplicate damage values retain their multiplicity.");
                answer = weighted;
            }
            var sum = answer.reduce(function(a, b) { return a + b; }, 0);
            if (Math.abs(sum - 1) > EPSILON || answer.some(function(p) { return p < -EPSILON || p > 1 + EPSILON; })) fail("Invalid move-choice probability mass.");
            return result(s._assumptions.size ? "estimated" : "determined", answer.map(function(p) { return Math.max(0, Math.min(1, p)); }), [], allTraces.map(function(t) { return Array.from(t); }));
        } catch (err) { return result("unavailable", null, [err.message]); }
    }

    // Internal score distributions for the four-battler adapter. This does not
    // lift the guard on the existing two-battler probability API. Each move's
    // marginal score keeps all documented checks and damage-case multiplicity;
    // the doubles solver must disclose the missing joint law across targets.
    function getTargetScoreDistributions(input) {
        var moves = input && input.opponent && input.opponent.moves || [], context = input && input.context || {}, mode = context.calculationMode;
        var legal = moves.map(function(m, i) { return m && m.name !== "(No Move)" && m.usable !== false && m.pp !== 0 &&
            (context.forcedMoveSlot === undefined || context.forcedMoveSlot === i); });
        var s = Object.assign({}, input, { _estimate: mode !== "strict", _assumptions: new Set(input && input.assumptions || []) });
        try {
            if (!s.context || !(s.context.doublesComplete || s.context.scoreOnly && (!s.field || s.field.gameType !== "Doubles"))) fail("A complete four-battler context is required for target scores.");
            validateState(s, true);
            legal = moveAvailability(s.opponent, context).legal;
            var distributions = moves.map(function() { return new Map(); }), traces = moves.map(function() { return new Set(); });
            if (!legal.some(Boolean)) return { status: "no-legal-moves", legal: legal, distributions: [], assumptions: [] };
            damageCases(s, legal).forEach(function(c) {
                var scored = scoreCase(s, c, legal);
                moves.forEach(function(m, i) {
                    if (!legal[i]) return;
                    var marginal = new Map([[scored.base[i], 1]]);
                    scored.variables.forEach(function(v) {
                        var next = new Map();
                        marginal.forEach(function(mass, score) { v.outcomes.forEach(function(o) {
                            var value = score + (o.delta[i] || 0); next.set(value, (next.get(value) || 0) + mass * o.probability);
                        }); }); marginal = next;
                    });
                    marginal.forEach(function(mass, score) { distributions[i].set(score, (distributions[i].get(score) || 0) + mass * c.probability); });
                    scored.traces[i].forEach(function(t) { traces[i].add(t); });
                });
            });
            return { status: s._assumptions.size ? "estimated" : "determined", legal: legal,
                distributions: distributions.map(function(d) { return Array.from(d, function(pair) { return { score: pair[0], probability: pair[1] }; }); }),
                rules: traces.map(function(t) { return Array.from(t); }), assumptions: Array.from(s._assumptions) };
        } catch (err) { return { status: "unavailable", legal: legal, distributions: [], reasons: [err.message], assumptions: Array.from(s._assumptions) }; }
    }

    return { getNullAIMoveProbabilities: getNullAIMoveProbabilities, aggregateScenarios: aggregateScenarios,
        solveMarginals: solveMarginals, solveIndependent: solveIndependent, getTargetScoreDistributions: getTargetScoreDistributions,
        lastResortReady:lastResortReady, moveAvailability:moveAvailability, source: SOURCE };
});
