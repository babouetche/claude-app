(function(root) {
    "use strict";
    function calculate(gen, attacker, defender, move, field) {
        if (root.NullBattleStore) root.NullBattleStore.recordEngineCall();
        return calc.calculate(gen, attacker, defender, move, field);
    }
    function engineKey() {
        // Keep the exact installed engine (ROM adapter + browser mechanics
        // hooks). Complete model inputs avoid fragile hand-picked HP/stat keys.
        var hooks = {};
        Object.keys(calc).forEach(function(k) { if (typeof calc[k] === "function") hooks[k] = calc[k]; });
        Object.keys(root).forEach(function(k) { if (/^calculate/.test(k) && typeof root[k] === "function") hooks["global:" + k] = root[k]; });
        function methods(prefix, object) {
            var depth = 0;
            while (object && object !== Object.prototype) {
                Object.getOwnPropertyNames(object).forEach(function(k) {
                    var descriptor = Object.getOwnPropertyDescriptor(object,k);
                    if (typeof descriptor.value === "function") hooks[prefix + ":" + depth + ":" + k] = descriptor.value;
                });
                object = Object.getPrototypeOf(object); depth++;
            }
        }
        methods("Pokemon",calc.Pokemon.prototype); methods("Move",calc.Move.prototype); methods("Field",calc.Field.prototype);
        hooks.generationGet = calc.Generations.get;
        return { hooks:hooks, rom:calc.nullVerifiedROM, verified:root.NullVerifiedData && root.NullVerifiedData.romSHA256 };
    }
    function stateKey(player, opponent, field, overrides, settings, baseState) {
        var selected = $("#p2 .set-selector").val() || "", api=root.NullVersion126Trainers;
        var trainer=api?api.trainerForSet(selected):getTrainerNameFromSet(selected), rows = [];
        // Include the current actual rows, not an identity token: importing or
        // editing a custom set must never reuse an earlier party reconstruction.
        Object.keys(SETDEX_SV).forEach(function(name) { Object.keys(SETDEX_SV[name]).forEach(function(key) {
            var set = SETDEX_SV[name][key]; if (set.index !== undefined && (api?api.matchesTrainer(key,trainer):String(key).trim()===trainer)) rows.push([name,key,set]);
        }); });
        return { player:player, opponent:opponent, field:field, overrides:overrides, settings:settings, base:baseState,
            generation:gen, selected:selected, playerSelection:$("#p1 .set-selector").val(), playerHP:$("#p1 .current-hp").val(), opponentHP:$("#p2 .current-hp").val(),
            playerStatus:$("#p1 .status").val(), rows:rows, marks:typeof opposingMarkedSetIds !== "undefined" ? Array.from(opposingMarkedSetIds).sort() : [], engine:engineKey() };
    }
    function names(text) { return new Set(text.split("|")); }
    var GUARANTEED = names("Nuzzle|Buzzy Buzz|Splishy Splash|Sizzly Slide|Mystical Fire|Acid Spray|Apple Acid|Lumina Crash|Struggle Bug|Snarl|Spirit Break|Skittersmack|Lunge|Trop Kick|Breaking Swipe|Chilling Water|Rock Smash|Fire Lash|Thunderous Kick|Icy Wind|Electroweb|Glaciate|Rock Tomb|Mud Shot|Low Sweep|Drum Beating|Pounce|Bulldoze|Trailblaze|Flame Charge|Aqua Step|Esper Wing|Power-Up Punch|Mystical Power|Torch Song");
    // Ordinary attacks use the document's Damaging Moves routine. Unreviewed
    // attacks stay unavailable rather than silently receiving generic scores.
    var ORDINARY = names("Tackle|Scratch|Pound|Surf|Earthquake|Stone Edge|Thunderbolt|Ice Beam|Flamethrower|Fire Blast|Thunder Punch|Ice Punch|Fire Punch|Body Slam|Shadow Ball|Psychic|Moonblast|Energy Ball|Earth Power|Flash Cannon|Dark Pulse|Air Slash|Iron Head|Rock Slide|Scald|Sludge Bomb|Sludge Wave|Hydro Pump|Waterfall|Dragon Claw|Dragon Pulse|Dragon Rush|Outrage|Draco Meteor|Leaf Storm|Overheat|Superpower|Close Combat|Brave Bird|Flare Blitz|Double-Edge|Return|Frustration|Play Rough|Dazzling Gleam|Shadow Claw|Shadow Sneak|Aqua Jet|Quick Attack|Extreme Speed|Bullet Punch|Mach Punch|Vacuum Wave|Ice Shard|Ice Spinner|Icicle Crash|Night Slash|Crunch|Bug Buzz|X-Scissor|Aerial Ace|Air Cutter|Leaf Blade|Razor Leaf|Leafage|Magical Leaf|Petal Blizzard|Petal Dance|Seed Bomb|Power Whip|Wood Hammer|Gunk Shot|Poison Jab|Megahorn|Head Smash|Rock Blast|Rock Throw|Rock Tomb|Rock Slide|Smack Down|Power Gem|Moongeist Beam|Sunsteel Strike|Photon Geyser|Expanding Force|Stored Power|Body Press|Foul Play|Weather Ball|Hydro Steam|Freeze-Dry|Tri Attack|Steel Beam|Make It Rain|Boomburst|Hyper Voice|Disarming Voice|Ancient Power|Silver Wind|Ominous Wind|Signal Beam|Aura Sphere|Focus Blast|Dynamic Punch|Hammer Arm|Bulldoze|High Horsepower|Earth Power|Dig|Water Gun|Bubble|Bubble Beam|Hydro Cannon|Hyper Beam|Giga Impact|Blast Burn|Frenzy Plant|Rock Wrecker|Roar of Time|Prismatic Laser|Meteor Assault|Eternabeam|Psyshock|Psystrike|Psybeam|Confusion|Extrasensory|Zen Headbutt|Luster Purge|Mist Ball|Sacred Sword|Secret Sword|Sacred Fire|Aeroblast|Seed Flare|V-create|Bolt Strike|Blue Flare|Fusion Bolt|Fusion Flare|Thunder|Blizzard|Hurricane|Heat Wave|Eruption|Water Spout|Brine|Facade|Hex|Venoshock|Infernal Parade|Avalanche|Payback|Punishment|Acrobatics|Sonic Boom|Dragon Rage|Seismic Toss|Night Shade|Strength|Cut|Rock Climb|Covet|Thief|Gust|Wing Attack|Peck|Drill Peck|Poison Sting|Cross Poison|Snipe Shot|Snipe Shot|Rising Voltage|Grassy Glide|Terrain Pulse|Electro Ball|Gyro Ball|Heavy Slam|Heat Crash|Low Kick|Grass Knot|Flail|Reversal|Slash|Crabhammer|Slam|Rage|Rage Fist|Raging Bull|Stomp|Bite|Headbutt|Super Fang|Nature's Madness|Ruination|False Swipe");
    function metadata(name) { return root.NullAIMoveMetadata[name] || {}; }
    function effectiveStatusMoveType(move, user) {
        // Damage calculation returns early for status moves, before its Normalize type change.
        return move.category === "Status" && (move.originalName || move.name) === "Thunder Wave" && user && user.ability === "Normalize" ? "Normal" : move.type;
    }
    function statusBlocked(move, target, field, user) {
        var targetKind = metadata(move.originalName).target || move.target;
        if (["self", "all", "allySide", "foeSide", "allyTeam"].includes(targetKind)) return false;
        var name = move.originalName, types = target.types, a = target.ability;
        var grounded = calc.isGrounded(target, field);
        if (move.category === "Status" && (a === "Good as Gold" || (a === "Magic Bounce" && metadata(move.originalName).flags && metadata(move.originalName).flags.reflectable))) return true;
        var statusMoves = names("Spore|Sleep Powder|Stun Spore|Poison Powder|Thunder Wave|Glare|Nuzzle|Buzzy Buzz|Splishy Splash|Hypnosis|Sing|Lovely Kiss|Grass Whistle|Dark Void|Yawn|Toxic|Poison Gas|Toxic Thread|Will-O-Wisp|Sizzly Slide");
        if (statusMoves.has(name)) {
            if (["Purifying Salt", "Comatose"].includes(a) || (field.terrain === "Misty" && grounded)) return true;
            if (a === "Leaf Guard" && ["Sun", "Harsh Sunshine"].includes(field.weather)) return true;
            if (a === "Flower Veil" && types.includes("Grass")) return true;
        }
        if (["Spore", "Sleep Powder", "Stun Spore", "Poison Powder", "Powder"].includes(name) &&
            (types.includes("Grass") || a === "Overcoat" || target.item === "Safety Goggles")) return true;
        if (["Thunder Wave", "Glare", "Stun Spore", "Nuzzle", "Buzzy Buzz", "Splishy Splash"].includes(name)) {
            var type = effectiveStatusMoveType(move, user);
            var immuneToType = name === "Thunder Wave" && types.some(function(t) { return target.gen.types.get(calc.toID(type)).effectiveness[t] === 0; });
            if ((type === "Normal" || type === "Fighting") && (field.defenderSide.isForesight || user && ["Scrappy", "Mind's Eye"].includes(user.ability))) immuneToType = false;
            return types.includes("Electric") || a === "Limber" || (name === "Thunder Wave" &&
                (immuneToType || type === "Electric" && ["Volt Absorb", "Motor Drive", "Lightning Rod"].includes(a)));
        }
        if (["Spore", "Sleep Powder", "Hypnosis", "Sing", "Lovely Kiss", "Grass Whistle", "Dark Void", "Yawn"].includes(name)) {
            return ["Insomnia", "Vital Spirit", "Sweet Veil"].includes(a) || (field.terrain === "Electric" && grounded);
        }
        if (["Toxic", "Poison Gas", "Poison Powder", "Toxic Thread"].includes(name)) {
            return ((!user || user.ability !== "Corrosion") && types.some(function(t) { return t === "Poison" || t === "Steel"; })) || a === "Immunity";
        }
        if (["Will-O-Wisp", "Sizzly Slide"].includes(name)) return types.includes("Fire") || a === "Water Veil" || a === "Water Bubble";
        return false;
    }
    function fieldInfo(name, ai, field) {
        var weather = { "Sunny Day": "Sun", "Rain Dance": "Rain", "Sandstorm": "Sand", "Hail": "Hail", "Snowscape": "Snow" };
        var terrain = { "Electric Terrain": "Electric", "Grassy Terrain": "Grassy", "Misty Terrain": "Misty", "Psychic Terrain": "Psychic" };
        var extension = { "Sunny Day": "Heat Rock", "Rain Dance": "Damp Rock", "Sandstorm": "Smooth Rock", "Hail": "Icy Rock", "Snowscape": "Icy Rock" };
        return {
            fieldAlreadyActive: !!((weather[name] && field.weather === weather[name]) || (terrain[name] && field.terrain === terrain[name]) ||
                (name === "Tailwind" && field.attackerSide.isTailwind) || (name === "Gravity" && field.isGravity) ||
                (name === "Magic Room" && field.isMagicRoom)),
            extendedByItem: terrain[name] ? ai.item === "Terrain Extender" : !!extension[name] && ai.item === extension[name]
        };
    }
    function damageSupport(result, move) {
        if (move.category === "Status") return [0];
        if (typeof result.damage === "number") return [result.damage];
        if (!Array.isArray(result.damage)) return null;
        // Keep all 16 engine rolls, including duplicates. For multiple hits,
        // aligned rolls provide a bounded estimate without an exponential list.
        // The model labels these totals as an estimate of the AI damage check.
        if (result.damage.some(Array.isArray)) {
            var arrays = result.damage.map(function(d) { return Array.isArray(d) ? d : [d]; });
            var count = Math.max.apply(null, arrays.map(function(a) { return a.length; }));
            return Array.from({ length: count }, function(_, i) {
                return arrays.reduce(function(sum, a) { return sum + a[Math.min(i, a.length - 1)]; }, 0);
            });
        }
        return result.damage.map(function(d) { return d * Math.max(1, move.hits || 1); });
    }
    function predictionMove(move, mon) {
        var copy = move.clone(), dex = mon.gen.moves.get(calc.toID(copy.originalName));
        // The existing category selector contains only Physical/Special. Read
        // native status categories for AI without changing that selector or its
        // damage calculation behavior.
        if (dex && dex.category === "Status") copy.category = "Status";
        copy.isCrit = !!(dex && dex.willCrit);
        copy.timesUsed = 1;
        if (dex && Array.isArray(dex.multihit)) copy.hits = mon.ability === "Skill Link" ? 5 : mon.item === "Loaded Dice" ? 4 : 3;
        return copy;
    }
    function snapshot(mon, side, moveList, field) {
        var paralyzed = mon.clone(); paralyzed.status = "par";
        var hp = side ? Number($(side + " .current-hp").val()) : mon.curHP();
        return { name: mon.name, hp: hp, maxHP: mon.maxHP(),
            nativeSashSturdyProtected: hp === mon.maxHP() && (mon.ability === "Sturdy" || !field.isMagicRoom && mon.ability !== "Klutz" && mon.item === "Focus Sash"),
            speed: calc.getFinalSpeed(mon.gen, mon, field, field.attackerSide),
            paralyzedSpeed: calc.getFinalSpeed(mon.gen, paralyzed, field, field.attackerSide),
            status: mon.status, ability: mon.ability, item: mon.item, types: mon.types.slice(),
            boosts: Object.assign({}, mon.boosts), stats: Object.assign({}, mon.stats), defense: mon.stats.def, specialDefense: mon.stats.spd,
            nativeSpeciesID:root.NullVerifiedData&&root.NullVerifiedData.species[mon.name]&&root.NullVerifiedData.species[mon.name].romId, moves: moveList };
    }
    function describeMove(move, result, user, target, field) {
        var name = move.originalName || move.name, data = metadata(name), fieldMove = fieldInfo(name, user, field);
        var guaranteed = data.accuracy > 70 && (GUARANTEED.has(name) || data.secondaryChance >= 100 || ["Rapid Spin", "Freezy Frost", "Psyshield Bash", "Scale Shot", "Clear Smog"].includes(name) ||
            (user.ability === "Serene Grace" && data.secondaryChance >= 50));
        if (target.ability === "Shield Dust" || target.item === "Covert Cloak" || user.ability === "Sheer Force") guaranteed = false;
        return { name: name, type: effectiveStatusMoveType(move, user), category: move.category, priority: move.priority,
            bp: data.basePower === undefined ? move.bp : data.basePower, basePower: data.basePower === undefined ? move.bp : data.basePower,
            accuracy: data.accuracy, target: data.target, nativeTargetBits:data.nativeTargetBits, nativeEffect:data.nativeEffect,
            hitsSemiInvulnerable:data.nativeEffect===150?true:undefined, effect: move.category === "Status" ? "STATUS" : "HIT",
            damage: damageSupport(result, move), damageEstimated: move.hits > 1 || (Array.isArray(result.damage) && result.damage.some(Array.isArray)),
            hits: move.hits || 1, guaranteedEffect: guaranteed, drain: !!move.drain,
            secondaryChance: data.secondaryChance, secondaryDescription: data.description,
            sound: !!(data.flags && data.flags.sound), wind: !!(data.flags && data.flags.wind),
            superEffective: move.category !== "Status" && target.types.reduce(function(x,t) { return x * user.gen.types.get(calc.toID(move.type)).effectiveness[t]; }, 1) > 1,
            gravityBlocked: !!field.isGravity && ["Fly", "Bounce", "Sky Drop", "High Jump Kick", "Jump Kick", "Splash", "Magnet Rise", "Telekinesis"].includes(name),
            highCrit: !!(move.isCrit || move.critRatio > 1 || /high critical-hit ratio/i.test(data.description || "")),
            unknownSecondary: false, thawsUser: !!data.thawsUser,
            statusBlocked: statusBlocked(move, target, field, user), fieldAlreadyActive: fieldMove.fieldAlreadyActive,
            extendedByItem: fieldMove.extendedByItem };
    }
    function copiedMoves(actor, defender, actorMoves, defenderMoves, field, context) {
        var calls = actorMoves.filter(function(m) { return ["Copycat", "Mirror Move", "Me First"].includes(m.name); });
        if (!calls.length) return;
        var predicted = defenderMoves.find(function(m) { return m.name === context.predictedPlayerMove; });
        if (context.predictedPlayerMove && !predicted) throw new Error("The predicted player move must belong to the target's current move set.");
        if (!predicted) predicted = defenderMoves.filter(function(m) { return m.name !== "(No Move)" && m.usable !== false && m.pp !== 0; }).sort(function(a,b) {
            function mean(m) { return (m.damage || [0]).reduce(function(x,y) { return x+y; }, 0) / Math.max(1,(m.damage || []).length); }
            return mean(b)-mean(a);
        })[0];
        if (!predicted) return;
        var move = predictionMove(new calc.Move(gen,predicted.name,{ability:actor.ability,item:actor.item}),actor);
        var result = calculate(gen,actor.clone(),defender.clone(),move,field.clone());
        var descriptor = describeMove(move,result,actor,defender,field);
        calls.forEach(function(m) {
            m.copiedMove=Object.assign({},descriptor); m.predictionConfirmed=!!context.predictedPlayerMove;
            if(context.copyEligibility) m.copiedMove[m.name==="Mirror Move"?"mirrorMoveBanned":m.name==="Copycat"?"copycatBanned":"meFirstBanned"]=context.copyEligibility==="banned";
        });
    }
    function entryDamage(mon, field) {
        if (mon.item === "Heavy-Duty Boots" || mon.ability === "Magic Guard") return 0;
        var side = field.attackerSide, amount = 0;
        if (side.isSR && mon.ability !== "Mountaineer") {
            var effectiveness = mon.types.reduce(function(total, type) { return total * mon.gen.types.get("rock").effectiveness[type]; }, 1);
            amount += Math.floor(mon.maxHP() * effectiveness / 8);
        }
        if (side.spikes && calc.isGrounded(mon, field)) amount += Math.floor(mon.maxHP() / (side.spikes === 1 ? 8 : side.spikes === 2 ? 6 : 4));
        return amount;
    }
    function trainerNumber(value, fallback, min, max, label) {
        if (value === undefined) return fallback;
        if ((typeof value !== "number" && typeof value !== "string") || typeof value === "string" && !value.trim()) throw new Error("Invalid trainer numeric data: " + label + ".");
        var number = Number(value);
        if (!Number.isInteger(number) || number < min || number > max) throw new Error("Invalid trainer numeric data: " + label + ".");
        return number;
    }
    var abilitySpellings={};
    function engineAbility(name){
        if(!abilitySpellings[gen]){
            abilitySpellings[gen]={};
            (calc.ABILITIES[gen]||[]).forEach(function(value){abilitySpellings[gen][calc.toID(value)]=value;});
        }
        return abilitySpellings[gen][calc.toID(name)]||name;
    }
    function partyPokemon(name, set, currentHP) {
        // Two preserved trainer labels use the old Zen-Mode spelling. Resolve
        // only the model identity; their distinct sets/party IDs stay intact.
        var modelName = {"Darmanitan-Zen-Mode":"Darmanitan-Zen", "Darmanitan-Zen-Mode-Galar":"Darmanitan-Galar-Zen"}[name] || name;
        var ivs = {}, evs = {}, ability=engineAbility(set.ability);
        LEGACY_STATS[gen].forEach(function(legacy) {
            var key = legacyStatToStat(legacy);
            // Some preserved trainer rows store IV/EV values as strings.
            // Stats.calcStat adds IVs before multiplying: numeric strings
            // would concatenate and create impossible reserve statistics.
            ivs[key] = trainerNumber(set.ivs && set.ivs[legacy], 31, 0, 31, "IV " + legacy);
            evs[key] = trainerNumber(set.evs && set.evs[legacy], 0, 0, 252, "EV " + legacy);
        });
        return new calc.Pokemon(gen, modelName, { level: trainerNumber(set.level, 50, 1, 100, "level"), ability: ability,
            abilityOn: !["Unburden", "Flash Fire", "Electromorphosis"].includes(ability),
            item: set.item || "", nature: set.nature, ivs: ivs, evs: evs, curHP: currentHP,
            status: typeof CALC_STATUS !== "undefined" ? CALC_STATUS[set.status] : "",
            moves: (set.moves || []).map(function(n) { return new calc.Move(gen, n, { ability: ability, item: set.item }); }) });
    }
    function reserveClone(mon, field) {
        var copy = mon.clone();
        // The Null Q&A sees a reserve Castform before Forecast transforms it.
        // Weather Ball alone gets the STAB of the form it will receive. Keep
        // all incoming and other outgoing profiles in its current base form.
        if (copy.name === "Castform" && copy.ability === "Forecast") copy.ability = "(other)";
        // The damage engine activates terrain seeds automatically. The Null
        // switch AI explicitly does not anticipate consumption: counter that
        // one boost on the disposable input, retaining the held item itself.
        if (!field.isMagicRoom && copy.ability !== "Klutz" && /^(Electric|Grassy|Misty|Psychic) Seed$/.test(copy.item || "") && field.terrain === copy.item.split(" ")[0]) {
            var key = ["Electric", "Grassy"].includes(field.terrain) ? "def" : "spd";
            copy.boosts[key] = copy.ability === "Contrary" ? 1 : -1;
        }
        return copy;
    }
    function reserveAttackClone(mon, field, move, player) {
        var copy = reserveClone(mon, field);
        if (mon.name === "Castform" && mon.ability === "Forecast" && move.originalName === "Weather Ball" &&
            !["Cloud Nine", "Air Lock"].includes(player.ability)) {
            var type = {Rain:"Water", "Heavy Rain":"Water", Sun:"Fire", "Harsh Sunshine":"Fire", Hail:"Ice", Snow:"Ice"}[field.weather];
            if (type) copy.types = [type];
        }
        return copy;
    }
    function collapseBattleForms(rows, selected) {
        // First form is the party form used by reserve AI, not the form that
        // an entry ability will produce. Native Marcster/Charlie/Winona party
        // records contain a Minior core (1321/colour variants), not its shell.
        // An explicitly selected active form still takes precedence below.
        var families = [
            ["Minior", "Minior-Meteor"], ["Eiscue", "Eiscue-Noice"], ["Wishiwashi", "Wishiwashi-School"],
            ["Zygarde", "Zygarde-Complete"], ["Morpeko", "Morpeko-Hangry"],
            ["Darmanitan", "Darmanitan-Zen", "Darmanitan-Zen-Mode"],
            ["Darmanitan-Galar", "Darmanitan-Galar-Zen", "Darmanitan-Zen-Mode-Galar"],
            ["Necrozma-Dusk-Mane", "Necrozma-Ultra"], ["Terapagos", "Terapagos-Terastal", "Terapagos-Stellar"],
            ["Groudon", "Groudon-Primal"], ["Kyogre", "Kyogre-Primal"]
        ];
        rows.forEach(function(r) { r.aliases = [r.id]; });
        families.forEach(function(family) {
            var variants = rows.filter(function(r) { return family.includes(r.name); });
            if (variants.length < 2) return;
            function sameSet(a, b) {
                var keys = Array.from(new Set(Object.keys(a.set).concat(Object.keys(b.set)))).filter(function(k) { return !["index", "ability"].includes(k); });
                return keys.every(function(k) { return JSON.stringify(a.set[k]) === JSON.stringify(b.set[k]); });
            }
            if (!variants.every(function(r) { return sameSet(variants[0], r); })) return;
            var chosen = variants.find(function(r) { return r.id === selected; }) || variants.slice().sort(function(a, b) { return family.indexOf(a.name) - family.indexOf(b.name); })[0];
            chosen.aliases = variants.map(function(r) { return r.id; });
            chosen.orderIndex = Math.min.apply(null, variants.map(function(r) { return r.set.index; }));
            rows = rows.filter(function(r) { return !variants.includes(r) || r === chosen; });
        });
        return rows.sort(function(a, b) { return (a.orderIndex === undefined ? a.set.index : a.orderIndex) - (b.orderIndex === undefined ? b.set.index : b.orderIndex); });
    }
    function nativePartyRows(rows, selected) {
        var api=root.NullVersion126Trainers;
        if(!api)return null;
        var groups=new Map(),unknown=[];
        rows.forEach(function(row){
            var slot=api.slotForSet(row.id);
            if(!slot){row.aliases=[row.id];unknown.push(row);return;}
            if(!groups.has(slot.id))groups.set(slot.id,{slot:slot,rows:[]});
            groups.get(slot.id).rows.push(row);
        });
        if(!groups.size)return null;
        groups.forEach(function(group){
            var variants=group.rows.sort(function(a,b){return a.set.index-b.set.index;});
            var chosen=variants.find(function(row){return row.id===selected;})||
                variants.find(function(row){return row.name===group.slot.native.species;})||variants[0];
            chosen.aliases=Array.from(new Set(group.slot.aliases.concat(variants.map(function(row){return row.id;}))));
            chosen.orderIndex=group.slot.partyOrder;chosen.nativeSlot=group.slot;
            unknown.push(chosen);
        });
        return unknown.sort(function(a,b){
            return (a.orderIndex===undefined?a.set.index:a.orderIndex)-(b.orderIndex===undefined?b.set.index:b.orderIndex);
        });
    }
    function readParty(player, ai, field, overrides, doubles, context, reference) {
        var selected = reference ? reference.selectedID : $("#p2 .set-selector").val() || "", trainerAPI=root.NullVersion126Trainers;
        var trainer = trainerAPI?trainerAPI.trainerForSet(selected):getTrainerNameFromSet(selected), rows = [];
        var party = { complete: false, trainerName: trainer, candidates: [], assumptions: [] };
        // Two cooperating trainers own separate native party halves. The
        // metadata contains only groups whose pointers/counts were verified.
        if(field.gameType==="Doubles"&&trainerAPI&&trainerAPI.ownerForSet)party.owner=trainerAPI.ownerForSet(selected)||null;
        if (!trainer || trainer === "Blank Set" || trainer === "Wandering Spirit") return party;
        Object.keys(SETDEX_SV).forEach(function(name) {
            Object.keys(SETDEX_SV[name]).forEach(function(key) {
                var set = SETDEX_SV[name][key];
                if (set.index !== undefined && (trainerAPI?trainerAPI.matchesTrainer(key,trainer):String(key).trim()===trainer)) rows.push({ id: name + " (" + key + ")", name: name, set: set });
            });
        });
        rows.sort(function(a, b) { return a.set.index - b.set.index; });
        // The supplied dataset contains both base and mega display rows. They
        // represent one party slot, regardless of the icon display preference.
        var nativeRows=nativePartyRows(rows.filter(function(r){return r.name!=="None";}),selected),megaBases=new Set();
        if(nativeRows)rows=nativeRows;
        else {
            megaBases = new Set(rows.filter(function(r) { return r.name.includes("-Mega"); }).map(function(r) { return pokedex[r.name] && pokedex[r.name].baseSpecies; }));
            var allRows = rows.slice();
            rows = collapseBattleForms(rows.filter(function(r) { return r.name !== "None" && !megaBases.has(r.name); }), selected);
            rows.forEach(function(r) {
                if (!r.name.includes("-Mega") || !pokedex[r.name]) return;
                allRows.filter(function(base) { return base.name === pokedex[r.name].baseSpecies; }).forEach(function(base) {
                    r.aliases.push(base.id);
                    r.orderIndex = Math.min(r.orderIndex === undefined ? r.set.index : r.orderIndex, base.set.index);
                });
            });
        }
        rows.sort(function(a,b) { return (a.orderIndex === undefined ? a.set.index : a.orderIndex) - (b.orderIndex === undefined ? b.set.index : b.orderIndex); });
        if (!rows.length) return party;
        if (rows.length > 6 || /^Root Academy.* Slot \d+/i.test(trainer)) {
            party.assumptions.push("Cette banque contient des Pokémon possibles, pas une équipe adverse certaine. Le switch automatique nécessite une équipe connue.");
            return party;
        }
        party.complete = true;
        var selectedName = selected.split(" (")[0], activeID = rows.some(function(r) { return r.id === selected; }) ? selected : null;
        if (!activeID) {
            var aliases = rows.filter(function(r) { return r.name.includes("-Mega") && pokedex[r.name] && pokedex[r.name].baseSpecies === selectedName; });
            if (aliases.length === 1) activeID = aliases[0].id;
            else party.complete = false;
        }
        var records = [];
        rows.forEach(function(row, order) {
            try {
                // HP/PP/availability belong to the logical party slot. Keep
                // controls entered under its other display form, including
                // pre-fix Minior-Meteor inputs and frozen Switch into states.
                var override = overrides && (overrides[row.id] || row.aliases.map(function(id) { return overrides[id]; }).find(Boolean)) || {};
                var active = row.id === activeID;
                var partner = !!(doubles && row.aliases.includes(doubles.opponentPartnerID));
                var nativeReserve=!active&&!partner&&row.nativeSlot&&row.nativeSlot.native;
                var modelSet=nativeReserve?Object.assign({},row.set,{ability:nativeReserve.ability}):row.set;
                var mon = partyPokemon(nativeReserve?nativeReserve.species:row.name, modelSet);
                var hp = override.hp !== undefined ? Number(override.hp) : override.hpPercent !== undefined ? Math.floor(mon.maxHP() * Number(override.hpPercent) / 100) : mon.maxHP();
                if (active) hp = reference ? reference.opponentHP : doubles && doubles.opponentHP !== undefined ? doubles.opponentHP : Number($("#p2 .current-hp").val());
                if (partner) hp = doubles.opponentPartnerHP;
                hp = Math.max(0, Math.min(mon.maxHP(), hp));
                mon.originalCurHP = hp || mon.maxHP();
                var marked = typeof opposingMarkedSetIds !== "undefined" && row.aliases.some(function(id) { return opposingMarkedSetIds.has(id); });
                var alive = !marked && hp > 0 && override.alive !== false;
                records.push({row:row, order:order, override:override, mon:mon, hp:hp, active:active, partnerActive:partner, alive:alive});
            } catch (err) { party.complete = false; party.assumptions.push("Réserve " + row.name + " non calculable : " + err.message); }
        });
        var faintCounts = root.NullFaintContext.counts(records, context && context.opponentFaintCount);
        party.faintContext = faintCounts;
        records.forEach(function(record) {
            var row=record.row, order=record.order, override=record.override, mon=record.mon, hp=record.hp, active=record.active, alive=record.alive;
            try {
                mon.alliesFainted = faintCounts.known;
                var effective = mon.clone();
                if (field.isMagicRoom || effective.ability === "Klutz") effective.item = "";
                var hazardDamage = entryDamage(effective, field), before = hp;
                // Native reserve scoring builds both damage profiles at the
                // party's raw HP, before subtracting entry hazards for its
                // separate survival check. HP-based move power follows that
                // order too (Water Spout/Eruption, Flail/Reversal, etc.).
                mon.originalCurHP = Math.max(1, hp);
                var attackMoves = [], incoming = [], incomingMoves = [], postKOMoves = [];
                var faintDependent = mon.ability === "Supreme Overlord" || mon.moves.some(function(m) { return ["Retaliate", "Last Respects"].includes(m.originalName); });
                for (var j = 0; j < 4; j++) {
                    var am = predictionMove(mon.moves[j] || new calc.Move(gen, "(No Move)"), mon);
                    var pm = predictionMove(player.moves[j], player);
                    if(doubles){
                        am.target=metadata(am.originalName).doublesTarget||am.target;pm.target=metadata(pm.originalName).doublesTarget||pm.target;
                        if(am.target==='allAdjacentFoes'&&doubles.playerAliveCount<2||am.target==='allAdjacent'&&doubles.playerAliveCount+Number(doubles.opponentPartnerAlive)<2)am.target='normal';
                        if(pm.target==='allAdjacentFoes'&&1+Number(doubles.opponentPartnerAlive)<2||pm.target==='allAdjacent'&&1+Number(doubles.opponentPartnerAlive)+Number(doubles.playerPartnerAlive)<2)pm.target='normal';
                        am.overrides=Object.assign({},am.overrides,{target:am.target});pm.overrides=Object.assign({},pm.overrides,{target:pm.target});
                    }
                    var rawPower = am.bp;
                    am.overrides=Object.assign({},am.overrides,{basePower:root.NullFaintContext.basePower(am,faintCounts.known,false)});
                    am.bp=am.overrides.basePower;
                    var outgoing = calculate(gen, reserveAttackClone(mon, field, am, player), player.clone(), am, field.clone());
                    var incomingResult = calculate(gen, player.clone(), reserveClone(mon, field), pm, field.clone().swap());
                    var attackDescription=describeMove(am,outgoing,mon,player,field);
                    if (override.moves && override.moves[j]) Object.assign(attackDescription,override.moves[j]);
                    attackMoves.push(attackDescription);
                    if (faintDependent) {
                        var postMon=mon.clone(),postMove=am.clone();postMon.alliesFainted=faintCounts.afterKO;
                        postMove.bp=rawPower;
                        postMove.overrides=Object.assign({},postMove.overrides,{basePower:root.NullFaintContext.basePower(postMove,faintCounts.afterKO,true)});
                        postMove.bp=postMove.overrides.basePower;
                        var postResult=calculate(gen,reserveAttackClone(postMon,field,postMove,player),player.clone(),postMove,field.clone());
                        var postDescription=describeMove(postMove,postResult,postMon,player,field);
                        // Keep explicit PP/usability/history overrides in both scenarios.
                        if (override.moves && override.moves[j]) Object.assign(postDescription,override.moves[j]);
                        postDescription.effectiveBasePower=postMove.bp;
                        postKOMoves.push(postDescription);
                    }
                    var incomingDescription=describeMove(pm,incomingResult,player,mon,field.clone().swap());
                    if (doubles && doubles.playerMoves[j]) { incomingDescription.usable=doubles.playerMoves[j].usable; incomingDescription.pp=doubles.playerMoves[j].pp; }
                    incomingMoves.push(incomingDescription);
                    incoming.push(incomingDescription.usable===false||incomingDescription.pp===0||["Explosion","Self-Destruct","Misty Explosion","Final Gambit"].includes(pm.originalName)?[0]:damageSupport(incomingResult,pm)||[0]);
                }
                var snap = snapshot(mon, null, attackMoves, field);
                if (faintDependent) { snap.postKOMoves=postKOMoves; snap.alliesFainted=faintCounts.known; snap.alliesFaintedAfterKO=faintCounts.afterKO; }
                snap.speed = calc.getFinalSpeed(effective.gen, effective, field, field.attackerSide);
                Object.assign(snap, { name: row.name, evaluationForm:mon.name, id: row.id, aliases: row.aliases, partyIndex: order, active: active, alive: alive,
                    hp: before, entryHazardDamage: hazardDamage,
                    nativeSashSturdyProtected: before === mon.maxHP() && (effective.item === "Focus Sash" || effective.ability === "Sturdy"), incomingMoves: incomingMoves,
                    incomingDamage: incoming.reduce(function(best, d) { return Math.max.apply(null, d) > Math.max.apply(null, best) ? d : best; }, [0]) });
                party.candidates.push(snap);
            } catch (err) { party.complete = false; party.assumptions.push("Réserve " + row.name + " non calculable : " + err.message); }
        });
        party.assumptions.push("Les réserves sont supposées à 100 % de PV et disponibles, sauf KO marqué ou PV renseignés.");
        if (megaBases.size) party.assumptions.push("Les formes Mega du calculateur sont utilisées telles qu'affichées ; transformation à l'entrée non simulée.");
        return party;
    }
    function frozenPartyInputKey(overrides) {
        var input={party:overrides&&overrides.party||{},marks:typeof opposingMarkedSetIds!=="undefined"?Array.from(opposingMarkedSetIds).sort():[]};
        return root.NullBattleStore?root.NullBattleStore.key(input):JSON.stringify(input);
    }
    function activePartySlots(party, slots) {
        if(!slots)return;
        party.candidates.forEach(function(c){
            var partner=(c.aliases||[c.id]).includes(slots.partnerID),primary=(c.aliases||[c.id]).includes(slots.primaryID);
            if(!partner&&!primary)return;
            c.active=true;c.partnerActive=partner;c.hp=partner?slots.partnerHP:slots.primaryHP;c.maxHP=partner?slots.partnerMaxHP:slots.primaryMaxHP;c.alive=c.hp>0;
        });
    }
    function frozenPartyBuilder(player, ai, field, overrides, doubles, slots, constraint) {
        function copy(value) {
            if(root.NullBattleStore)return root.NullBattleStore.clone(value,true);
            if(!value||typeof value!=="object")return value;
            if(typeof value.clone==="function")return value.clone();
            var result=Array.isArray(value)?[]:{};Object.keys(value).forEach(function(k){result[k]=k==="gen"?value[k]:copy(value[k]);});return result;
        }
        // Capture independent model graphs, never the mutable returned state.
        // The original player and field remain the damage reference while
        // reserve HP/availability (and their conditional move power) stay live.
        var capturedPlayer=copy(player),capturedAI=copy(ai),capturedField=copy(field),capturedDoubles=copy(doubles),capturedSlots=copy(slots),capturedConstraint=copy(constraint);
        var initial=frozenPartyInputKey(overrides),originalContext=Object.assign({},overrides&&overrides.context);
        var reference={selectedID:$("#p2 .set-selector").val()||"",opponentHP:doubles?doubles.opponentHP:Number($("#p2 .current-hp").val())};
        return function(controls) {
            if(frozenPartyInputKey(controls)===initial)return null;
            var facts=Object.assign({},originalContext,controls&&controls.context);
            function build() {
                var party=readParty(copy(capturedPlayer),copy(capturedAI),copy(capturedField),controls&&controls.party,copy(capturedDoubles),facts,reference);
                activePartySlots(party,capturedSlots);
                if(capturedConstraint&&capturedConstraint.complete===false){party.complete=false;party.assumptions=Array.from(new Set(party.assumptions.concat(capturedConstraint.assumptions||[])));}
                return party;
            }
            if(!root.NullBattleStore)return build();
            return root.NullBattleStore.memo("frozen-party",{battle:stateKey(capturedPlayer,capturedAI,capturedField,controls,capturedDoubles),reference:reference,slots:capturedSlots,constraint:capturedConstraint},build);
        };
    }
    function readBattleState(results, overrides) {
        // Read fresh Pokemon so damage-engine mutations (Intimidate, consumed
        // items, stat drops) cannot be applied a second time to displayed results.
        var player = createPokemon($("#p1")), ai = createPokemon($("#p2"));
        checkStatBoost(player, ai);
        var field = createField().clone().swap();
        if (!root.NullBattleStore) return buildBattleState(player,ai,field,overrides);
        return root.NullBattleStore.memo("single-state",stateKey(player,ai,field,overrides),function() { return buildBattleState(player,ai,field,overrides); });
    }
    function buildBattleState(player, ai, field, overrides) {
        var playerMoves = [], aiMoves = [];
        var predictedPlayer, predictedAI;
        // Protection toggles describe a damage simulation, not a known choice
        // by the opponent; use unprotected copies for the decision estimate.
        field.attackerSide.isProtected = field.defenderSide.isProtected = false;
        for (var i = 0; i < 4; i++) {
            var pm = predictionMove(player.moves[i], player), am = predictionMove(ai.moves[i], ai);
            if (am.isZ || am.isMax || pm.isZ || pm.isMax) throw new Error("La sélection des attaques Z/Max n'est pas documentée pour Null.");
            var pr = calculate(gen, player.clone(), ai.clone(), pm, field.clone().swap());
            var ar = calculate(gen, ai.clone(), player.clone(), am, field.clone());
            if (!predictedPlayer) predictedPlayer = ar.defender;
            if (!predictedAI) predictedAI = ar.attacker;
            var desc = describeMove(am, ar, ar.attacker, ar.defender, field);
            if (overrides && overrides.moves && overrides.moves[i]) Object.assign(desc, overrides.moves[i]);
            aiMoves.push(desc);
            playerMoves.push(describeMove(pm, pr, pr.attacker, pr.defender, field.clone().swap()));
        }
        var state = { player: snapshot(predictedPlayer, "#p1", playerMoves, field.clone().swap()),
            opponent: snapshot(predictedAI, "#p2", aiMoves, field),
            field: { gameType: field.gameType, playerTailwind: field.defenderSide.isTailwind,
                weather: field.weather, terrain: field.terrain, magicRoom: !!field.isMagicRoom, trickRoom: !!field.isTrickRoom,
                playerSpikes: field.defenderSide.spikes, opponentSpikes: field.attackerSide.spikes,
                playerStealthRock: field.defenderSide.isSR, opponentStealthRock: field.attackerSide.isSR,
                playerReflect: field.defenderSide.isReflect, playerLightScreen: field.defenderSide.isLightScreen,
                opponentReflect: field.attackerSide.isReflect, opponentLightScreen: field.attackerSide.isLightScreen,
                playerAuroraVeil: field.defenderSide.isAuroraVeil, opponentAuroraVeil: field.attackerSide.isAuroraVeil },
            context: Object.assign({}, overrides && overrides.context) };
        var extra = state.context;
        copiedMoves(ai,player,aiMoves,playerMoves,field,extra);
        extra.playerLastMoveInfo=playerMoves.find(function(m) { return m.name===extra.playerLastMove; });
        state.party = readParty(player, ai, field, overrides && overrides.party, null, extra);
        if (extra.opponentTurnsActive === undefined) extra.opponentTurnsActive = extra.turnInBattle === undefined ? 1 : extra.turnInBattle;
        if (extra.opponentFirstTurn === undefined) extra.opponentFirstTurn = extra.opponentTurnsActive <= 1;
        if (extra.playerLeechSeeded === undefined) extra.playerLeechSeeded = field.defenderSide.isSeeded;
        if (extra.opponentLeechSeeded === undefined) extra.opponentLeechSeeded = field.attackerSide.isSeeded;
        if (extra.playerSaltCured === undefined) extra.playerSaltCured = !!player.isSaltCure;
        if (state.party.complete) {
            if (extra.opponentAliveCount === undefined) extra.opponentAliveCount = state.party.candidates.filter(function(c) { return c.alive; }).length;
            if (extra.opponentTeamSize === undefined) extra.opponentTeamSize = state.party.candidates.length;
            if (extra.opponentLastMon === undefined) extra.opponentLastMon = extra.opponentAliveCount <= 1;
        }
        ["playerToxicSpikes", "opponentToxicSpikes", "playerStickyWeb", "opponentStickyWeb"].forEach(function(key) {
            state.field[key] = extra[key] || 0;
        });
        if ($("#p1 .status").val() === "Confused") state.context.playerConfused = true;
        state.assumptions = [];
        if (aiMoves.concat(playerMoves).some(function(m) { return m.damageEstimated; })) state.assumptions.push("Dégâts multi-coups estimés selon le nombre de coups du calculateur et des rolls alignés.");
        if (state.player.speed === state.opponent.speed && (player.ability === "Analytic" || ai.ability === "Analytic" || aiMoves.concat(playerMoves).some(function(m) { return m.name === "Payback"; }))) state.assumptions.push("Égalité de vitesse Analytic/Payback : dégâts du moteur utilisés pour l'estimation.");
        state.rebuildFrozenParty=frozenPartyBuilder(player,ai,field,overrides);
        return state;
    }
    function doublePartner(settings) {
        if(settings.setID==="__empty__") {var empty=new calc.Pokemon(gen,"Pikachu",{level:1,moves:Array.from({length:4},function(){return new calc.Move(gen,"(No Move)");})});empty.originalCurHP=0;return empty;}
        if(!Number.isInteger(settings.level)||settings.level<1||settings.level>100||!Number.isFinite(Number(settings.hp))||Number(settings.hp)<0)throw new Error("Invalid partner level or HP.");
        ['ivs','evs','boosts'].forEach(function(k){Object.values(settings[k]||{}).forEach(function(v){if(!Number.isInteger(v)||v<(k==='boosts'?-6:0)||v>(k==='boosts'?6:k==='ivs'?31:252))throw new Error("Invalid partner IV, EV or stat stage.");});});
        var id=settings.setID||"", split=id.indexOf(" ("), name=id.slice(0,split), key=id.slice(split+2,-1);
        if(split<0||!pokedex[name]) throw new Error("Choose both active partners to provide all four battlers.");
        var set=SETDEX_SV[name]&&SETDEX_SV[name][key]||{}, base=partyPokemon(name,set);
        var opts={level:settings.level||base.level,nature:settings.nature||base.nature,ability:settings.ability,
            abilityOn:settings.abilityOn!==false,item:settings.item||"",ivs:settings.ivs,evs:settings.evs,boosts:settings.boosts,
            status:settings.status||"",moves:settings.moves.map(function(m){return new calc.Move(gen,m.name,{ability:settings.ability,item:settings.item});})};
        var mon=new calc.Pokemon(gen,name,opts);
        if(settings.types&&settings.types.length) mon.types=settings.types;
        if(Number(settings.hp)>mon.maxHP())throw new Error("Partner HP exceeds its maximum; update Current HP after changing stats.");
        mon.originalCurHP=Number(settings.hp);
        return mon;
    }
    function readDoubleBattleState(results, overrides, settings, baseState) {
        settings=settings||{};overrides=overrides||{};
        if(!settings.playerPartner||!settings.opponentPartner||!settings.playerPartner.setID||!settings.opponentPartner.setID) return {complete:false};
        var p=createPokemon($("#p1")),a=createPokemon($("#p2"));checkStatBoost(p,a);
        var field=createField().clone().swap();
        if (!root.NullBattleStore) return buildDoubleBattleState(results,overrides,settings,baseState,p,a,field);
        return root.NullBattleStore.memo("double-state",stateKey(p,a,field,overrides,settings,baseState),function() { return buildDoubleBattleState(results,overrides,settings,baseState,p,a,field); });
    }
    function buildDoubleBattleState(results, overrides, settings, baseState, p, a, field) {
        var p2=doublePartner(settings.playerPartner),a2=doublePartner(settings.opponentPartner);
        var pi=Number(settings.playerSlot)||0,ai=Number(settings.opponentSlot)||0;
        var players=pi?[p2,p]:[p,p2],opponents=ai?[a2,a]:[a,a2];
        field.attackerSide.isProtected=field.defenderSide.isProtected=false;
        var context=Object.assign({},overrides.context,{doublesComplete:true}), simple=baseState || readBattleState(results,overrides);
        var primaryID=$("#p2 .set-selector").val(), otherID=settings.opponentPartner.setID;
        var primaryCandidate=simple.party.candidates.find(function(c){return (c.aliases||[c.id]).includes(primaryID);});
        var otherCandidate=simple.party.candidates.find(function(c){return (c.aliases||[c.id]).includes(otherID);});
        function marked(c){return c&&typeof opposingMarkedSetIds!=="undefined"&&(c.aliases||[c.id]).some(function(id){return opposingMarkedSetIds.has(id);});}
        if(marked(primaryCandidate))a.originalCurHP=0;
        if(marked(otherCandidate))a2.originalCurHP=0;
        if(otherCandidate&&primaryCandidate&&otherCandidate.id===primaryCandidate.id) throw new Error("The two opposing active slots cannot use the same trainer party slot.");
        var state={complete:true,selectedPlayer:pi,selectedOpponent:ai,field:Object.assign({},simple.field),context:context,assumptions:[],players:[],opponents:[],matchups:[],party:simple.party};
        function monSnapshot(mon,side,overridesForMon,f) {
            var list=mon.moves.map(function(m,i){var desc=describeMove(predictionMove(m,mon),{damage:[0]},mon,mon,f);Object.assign(desc,overridesForMon&&overridesForMon.moves&&overridesForMon.moves[i]);desc.target=metadata(desc.name).doublesTarget||m.target||'unknown';desc.contact=!!(metadata(desc.name).flags&&metadata(desc.name).flags.contact);return desc;});
            var snap=snapshot(mon,side,list,f);if(!side)snap.hp=mon.originalCurHP;
            if(overridesForMon&&overridesForMon.setID==="__empty__")snap.name="Empty slot";
            return snap;
        }
        players.forEach(function(mon,j){state.players[j]=monSnapshot(mon,j===pi?"#p1":null,j===pi?null:settings.playerPartner,field.clone().swap());});
        opponents.forEach(function(mon,j){
            var extra=j===ai?overrides:settings.opponentPartner, snap=monSnapshot(mon,j===ai?"#p2":null,extra,field);
            if(j===ai&&marked(primaryCandidate))snap.hp=0;
            if(j!==ai&&marked(otherCandidate))snap.hp=0;
            snap.firstTurn=j===ai?context.opponentFirstTurn:settings.opponentPartner.firstTurn;
            snap.plannedMove=j===ai?settings.primaryPlannedMove:settings.opponentPartner.plannedMove;
            snap.lastMove=j===ai?context.opponentLastMove:settings.opponentPartner.lastMove;
            snap.context=j===ai?Object.assign({},context):Object.assign({},context,{forcedMoveSlot:settings.opponentPartner.forcedMoveSlot,opponentFirstTurn:snap.firstTurn,opponentWakeupTurn:settings.opponentPartner.wakeupTurn});
            if(j!==ai)Object.keys(snap.context).filter(function(k){return k.startsWith("opponent")&&!["opponentFirstTurn","opponentWakeupTurn"].includes(k)||["protectionStreak","protectionLastTurn","lockOn","moveImmediate","resistsPlayerLastMove"].includes(k);}).forEach(function(k){delete snap.context[k];});
            state.opponents[j]=snap;
        });
        function pair(actor,index,defender,targetIndex,ally) {
            var f=field.clone(),ac=actor.clone(),dc=defender.clone();
            if(ally) f.defenderSide=f.attackerSide;
            else {
                if(state.opponents[1-index].hp>0&&opponents[1-index].ability==="Friend Guard") f.attackerSide.isFriendGuard=true;
                if(state.players[1-targetIndex].hp>0&&players[1-targetIndex].ability==="Friend Guard") f.defenderSide.isFriendGuard=true;
            }
            var outgoing=[],incoming=[];
            for(var k=0;k<4;k++) {
                var am=predictionMove(actor.moves[k]||new calc.Move(gen,"(No Move)"),actor),pm=predictionMove(defender.moves[k]||new calc.Move(gen,"(No Move)"),defender);
                var source=ally?state.opponents[1-index]:state.players[targetIndex];
                am.target=state.opponents[index].moves[k].target;pm.target=source.moves[k].target;
                if(am.isZ||am.isMax||pm.isZ||pm.isMax)throw new Error("Z/Max move choice is not documented for Null.");
                var foesAlive=state.players.filter(function(x){return x.hp>0;}).length;
                if(am.target==="allAdjacentFoes"&&foesAlive<2||am.target==="allAdjacent"&&foesAlive+Number(state.opponents[1-index].hp>0)<2)am.target="normal";
                if(pm.target==="allAdjacentFoes"&&state.opponents.filter(function(x){return x.hp>0;}).length<2||!ally&&pm.target==="allAdjacent"&&state.opponents.filter(function(x){return x.hp>0;}).length+Number(state.players[1-targetIndex].hp>0)<2)pm.target="normal";
                // calculate() clones moves and reconstructs target from overrides.
                am.overrides=Object.assign({},am.overrides,{target:am.target});pm.overrides=Object.assign({},pm.overrides,{target:pm.target});
                if(ally&&am.originalName==='Pollen Puff')am.overrides.bp=0;
                var ar=calculate(gen,ac.clone(),dc.clone(),am,f.clone()),pr=calculate(gen,dc.clone(),ac.clone(),pm,f.clone().swap());
                var ad=describeMove(am,ar,actor,defender,f),pd=describeMove(pm,pr,defender,actor,f.clone().swap());
                ad.usable=state.opponents[index].moves[k].usable;ad.pp=state.opponents[index].moves[k].pp;ad.usedSinceEntry=state.opponents[index].moves[k].usedSinceEntry;
                ad.target=state.opponents[index].moves[k].target;pd.target=source.moves[k].target;pd.usable=source.moves[k].usable;pd.pp=source.moves[k].pp;
                ad.damage=damageSupport(ar,am);ad.damageEstimated=am.hits>1||Array.isArray(ar.damage)&&ar.damage.some(Array.isArray);
                ad.superEffective=defender.types.reduce(function(x,t){return x*actor.gen.types.get(calc.toID(am.type)).effectiveness[t];},1)>1;
                outgoing.push(ad);incoming.push(pd);
            }
            var foe=Object.assign({},ally?state.opponents[1-index]:state.players[targetIndex],{moves:incoming}), aiMon=Object.assign({},state.opponents[index],{moves:outgoing});
            var facts=Object.assign({},state.opponents[index].context);
            if(!ally&&targetIndex!==pi)Object.keys(facts).filter(function(k){return k.startsWith("player")&&!["playerToxicSpikes","playerStickyWeb"].includes(k);}).forEach(function(k){delete facts[k];});
            if(!ally&&targetIndex!==pi) { delete facts.predictedPlayerMove; delete facts.copyEligibility; }
            if(!ally) copiedMoves(actor,defender,outgoing,incoming,f,facts);
            facts.playerLastMoveInfo=incoming.find(function(m) { return m.name===facts.playerLastMove; });
            return {player:foe,opponent:aiMon,field:state.field,context:facts,assumptions:outgoing.concat(incoming).some(function(m){return m.damageEstimated;})?["Doubles: multi-hit damage uses the calculator's approximated aligned rolls."]:[]};
        }
        opponents.forEach(function(mon,j){state.matchups[j]=[pair(mon,j,players[0],0,false),pair(mon,j,players[1],1,false)];state.matchups[j].ally=pair(mon,j,opponents[1-j],1-j,true);});
        if(state.opponents.some(function(mon){return mon.moves.some(function(m){return m.name!=='(No Move)'&&metadata(m.name).doublesTargetSource==='standard-fallback';});}))state.assumptions.push("Doubles: target kinds use standard Showdown metadata where the supplied Null move data omits them; Null power, effects and trainer sets are preserved.");
        if(state.players.concat(state.opponents).some(function(m){return m.hp>0&&['Lightning Rod','Storm Drain','Sweet Veil','Aroma Veil','Flower Veil'].includes(m.ability);}))state.assumptions.push("Doubles: partner-wide protection and ability-based move redirection are not fully simulated; verify those interactions manually.");
        var referenceIndex=state.players[ai].hp>0?ai:1-ai;
        var reference=state.matchups[ai][referenceIndex].player, switchField=field.clone();
        if(state.opponents[1-ai].hp>0&&opponents[1-ai].ability==='Friend Guard')switchField.attackerSide.isFriendGuard=true;
        if(state.players[1-referenceIndex].hp>0&&players[1-referenceIndex].ability==='Friend Guard')switchField.defenderSide.isFriendGuard=true;
        var partyDoubleInfo={playerAliveCount:state.players.filter(function(m){return m.hp>0;}).length,playerPartnerAlive:state.players[1-referenceIndex].hp>0,opponentPartnerAlive:state.opponents[1-ai].hp>0,playerMoves:state.players[referenceIndex].moves,
            opponentHP:state.opponents[ai].hp,opponentPartnerID:otherID,opponentPartnerHP:state.opponents[1-ai].hp};
        var partySlots={primaryID:primaryID,partnerID:otherID,primaryHP:state.opponents[ai].hp,primaryMaxHP:state.opponents[ai].maxHP,partnerHP:state.opponents[1-ai].hp,partnerMaxHP:state.opponents[1-ai].maxHP};
        var party=readParty(players[referenceIndex],a,switchField,overrides.party,partyDoubleInfo,context);
        activePartySlots(party,partySlots);
        state.party=party;
        if(otherID!=="__empty__"&&party.complete&&!otherCandidate){party.complete=false;party.assumptions=party.assumptions.concat(["The other opponent is not part of the selected trainer party; replacement predictions require a confirmed shared party."]);}
        state.switchState={player:reference,opponent:state.matchups[ai][referenceIndex].opponent,field:state.field,party:party,assumptions:state.assumptions,
            context:Object.assign({},state.matchups[ai][referenceIndex].context,{doublesComplete:true,doublesOpponentSlot:ai,doublesPlayerSlot:referenceIndex,opponentCanKOAnyPlayer:state.matchups[ai].some(function(pair,j){return state.players[j].hp>0&&pair.opponent.moves.some(function(m){return m.usable!==false&&m.pp!==0&&m.category!=="Status"&&m.damage&&Math.min.apply(null,m.damage)>=state.players[j].hp;});}),
                playerHasAvoidMove:state.players.some(function(x){return x.hp>0&&x.moves.some(function(m){return m.usable!==false&&m.pp!==0&&["Pursuit","Roar","Whirlwind","Dragon Tail","Circle Throw"].includes(m.name);});})})};
        var possibleKO=false,meanKO=false;
        state.matchups[ai].forEach(function(pair,j){if(state.players[j].hp<=0)return;pair.opponent.moves.forEach(function(m){if(m.usable===false||m.pp===0||m.category==='Status'||!m.damage)return;var hp=state.players[j].hp;if(Math.min.apply(null,m.damage)<hp&&Math.max.apply(null,m.damage)>=hp){possibleKO=true;if(m.damage.reduce(function(a,b){return a+b;},0)/m.damage.length>=hp)meanKO=true;}});});
        if(!state.switchState.context.opponentCanKOAnyPlayer&&possibleKO){state.switchState.context.opponentCanKOAnyPlayer=meanKO;state.switchState.context.opponentAnyPlayerKOEstimated=true;}
        if(reference.hp<=0)state.switchState.context.doublesComplete=false;
        state.rebuildFrozenParty=frozenPartyBuilder(players[referenceIndex],a,switchField,overrides,partyDoubleInfo,partySlots,{complete:party.complete,assumptions:party.assumptions});
        return state;
    }
    root.NullMoveAIState = { readBattleState: readBattleState, readDoubleBattleState:readDoubleBattleState, createDoublePartner:doublePartner,
        effectiveStatusMoveType:effectiveStatusMoveType, isStatusBlocked:statusBlocked };
})(window);
