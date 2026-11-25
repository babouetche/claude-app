// Suivi de run Pokémon Null : logique pure (sans DOM), testée dans tests/run-model.test.cjs.
// Entrée : les données écrites par lua/NullCalcSync.lua (équipe, boîtes, morts).
(function(root, factory) {
    "use strict";
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.NullRunModel = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";

    // Boss et level caps, d'après « Mechanic Changes » (documentation officielle Null).
    var BOSSES = [
        { name: "Root Academy Trainer 1", cap: 13 },
        { name: "Root Academy Trainer 2", cap: 19 },
        { name: "Root Academy Trainer 3", cap: 25 },
        { name: "Root Academy Trainer 4", cap: 29 },
        { name: "Leader Roxanne", cap: 38 },
        { name: "Leader Brawly", cap: 45 },
        { name: "Ex Elite Four Glacia", cap: 53 },
        { name: "Leader Wattson", cap: 59 },
        { name: "Leader Norman", cap: 66 },
        { name: "Leader Flannery", cap: 72 },
        { name: "Leader Winona", cap: 77 },
        { name: "Magma Hideout Maxie", cap: 82 },
        { name: "Leader Tate & Liza", cap: 86 },
        { name: "Seafloor Cavern Archie", cap: 91 },
        { name: "Leader Steven", cap: 95 },
        { name: "Ex Elite Four Glacia 2", cap: 99 },
        { name: "Champion Wallace", cap: 100 }
    ];

    // Noms du Lua officiel absents du calculateur. Chaque équivalence a été
    // vérifiée : même espèce, mêmes statistiques de base et mêmes types.
    var SPECIES_EQUIVALENTS = {
        "Pikachu-Belle": "Pikachu", "Pikachu-Cosplay": "Pikachu", "Pikachu-Libre": "Pikachu",
        "Pikachu-PhD": "Pikachu", "Pikachu-Pop-Star": "Pikachu", "Pikachu-Rock-Star": "Pikachu",
        "Pichu-Spiky-eared": "Pichu"
    };
    // Orthographe différente pour le même talent.
    var ABILITY_EQUIVALENTS = { "Embody Aspect (Hearthflame)": "Embody Aspect (Heartflame)" };
    var STATUS_LABELS = { "": "Healthy", slp: "Asleep", psn: "Poisoned", tox: "Badly Poisoned",
        brn: "Burned", par: "Paralyzed", frz: "Frozen", frb: "Frostbite" };
    var STATUS_FR = { "": "", slp: "Endormi", psn: "Empoisonné", tox: "Gravement empoisonné",
        brn: "Brûlé", par: "Paralysé", frz: "Gelé", frb: "Gelure" };
    var TAG = "Run";

    function key(text) { return String(text || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

    // Résolution d'un nom : exact, puis équivalence explicite, puis forme
    // normalisée (casse/ponctuation) uniquement si elle désigne UN seul nom.
    function makeResolver(names, explicit) {
        var exact = new Set(names), loose = new Map();
        names.forEach(function(name) {
            var k = key(name);
            loose.set(k, loose.has(k) && loose.get(k) !== name ? null : name);
        });
        return function(name) {
            if (!name) return null;
            var trimmed = String(name).trim();
            if (exact.has(trimmed)) return trimmed;
            if (explicit && explicit[trimmed] && exact.has(explicit[trimmed])) return explicit[trimmed];
            var found = loose.get(key(trimmed));
            return found || null;
        };
    }

    function makeResolvers(calcData) {
        return {
            species: makeResolver(calcData.species, SPECIES_EQUIVALENTS),
            move: makeResolver(calcData.moves),
            item: makeResolver(calcData.items),
            ability: makeResolver(calcData.abilities, ABILITY_EQUIVALENTS)
        };
    }

    function displayName(mon) { return mon.nickname && mon.nickname.trim() ? mon.nickname.trim() : mon.species; }

    // Construit le set du calculateur. Toute donnée non reconnue est signalée,
    // jamais remplacée en silence.
    function buildSet(mon, resolvers) {
        var warnings = [], species = resolvers.species(mon.species);
        if (!species) return { species: null, set: null, warnings: ["Espèce inconnue du calculateur : " + mon.species] };
        if (species !== mon.species && SPECIES_EQUIVALENTS[mon.species])
            warnings.push(mon.species + " est calculé comme " + species + " (mêmes stats et types).");
        var moves = [];
        (mon.moves || []).forEach(function(m) {
            var name = m.name;
            if (name === "Hidden Power" && mon.hiddenPower) name = "Hidden Power " + mon.hiddenPower;
            var resolved = resolvers.move(name);
            if (resolved) moves.push(resolved);
            else warnings.push("Attaque inconnue du calculateur : " + m.name);
        });
        var item = "";
        if (mon.item) {
            item = resolvers.item(mon.item) || "";
            if (!item) warnings.push("Objet sans données de combat dans le calculateur : " + mon.item + " (ignoré).");
        }
        var ability = resolvers.ability(mon.ability);
        if (mon.ability && !ability) warnings.push("Talent inconnu du calculateur : " + mon.ability);
        var ivs = mon.ivs || {};
        var set = {
            level: mon.level,
            evs: { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 }, // Null : EV supprimés
            ivs: { hp: ivs.hp, at: ivs.atk, df: ivs.def, sa: ivs.spa, sd: ivs.spd, sp: ivs.spe },
            moves: moves,
            nature: mon.nature,
            item: item,
            isCustomSet: true
        };
        if (ability) set.ability = ability;
        return { species: species, set: set, warnings: warnings };
    }

    // Nom de set stable par individu (uid) : « Surnom [Run] », numéroté si besoin.
    function assignNames(mons, previous, resolvers) {
        var taken = new Set(), names = {};
        mons.forEach(function(mon) {
            var old = previous[mon.uid], species = resolvers.species(mon.species);
            if (old && old.species === species && old.base === displayName(mon)) {
                names[mon.uid] = old.nameProp; taken.add(species + "|" + old.nameProp);
            }
        });
        mons.forEach(function(mon) {
            if (names[mon.uid]) return;
            var species = resolvers.species(mon.species), base = displayName(mon), n = 1, name;
            do { name = base + " [" + TAG + (n > 1 ? " " + n : "") + "]"; n++; } while (taken.has(species + "|" + name));
            taken.add(species + "|" + name); names[mon.uid] = name;
        });
        return names;
    }

    // Plan de synchronisation : quoi créer/mettre à jour, où le ranger, quoi retirer.
    // previous : { uid: { species, nameProp, base, signature } } de la synchro précédente.
    function planSync(data, previous, resolvers) {
        previous = previous || {};
        var alive = [], warnings = [];
        (data.party || []).forEach(function(mon) { alive.push({ mon: mon, place: "team", order: mon.slot }); });
        (data.box || []).forEach(function(mon) { alive.push({ mon: mon, place: "box", order: 100 + mon.box * 30 + mon.boxSlot }); });
        var names = assignNames(alive.map(function(a) { return a.mon; }), previous, resolvers);
        var index = {}, upserts = [], removals = [];
        alive.forEach(function(entry) {
            var mon = entry.mon, built = buildSet(mon, resolvers);
            built.warnings.forEach(function(w) { warnings.push(displayName(mon) + " : " + w); });
            if (!built.species) return;
            var signature = JSON.stringify(built.set), nameProp = names[mon.uid];
            index[mon.uid] = { species: built.species, nameProp: nameProp, base: displayName(mon), signature: signature };
            var old = previous[mon.uid];
            upserts.push({ uid: mon.uid, species: built.species, nameProp: nameProp, set: built.set, place: entry.place,
                order: entry.order, changed: !old || old.signature !== signature || old.species !== built.species || old.nameProp !== nameProp });
        });
        Object.keys(previous).forEach(function(uid) {
            var old = previous[uid], now = index[uid];
            if (!now || now.species !== old.species || now.nameProp !== old.nameProp)
                removals.push({ uid: uid, species: old.species, nameProp: old.nameProp, dead: (data.dead || []).some(function(m) { return m.uid === uid; }) });
        });
        upserts.sort(function(a, b) { return a.order - b.order; });
        return { upserts: upserts, removals: removals, index: index, warnings: warnings };
    }

    // Captures par zone (lieu de rencontre), vivants et morts confondus.
    function encounters(data) {
        var zones = new Map();
        function add(mon, state) {
            var zone = mon.metLocation || "Lieu inconnu";
            if (!zones.has(zone)) zones.set(zone, []);
            zones.get(zone).push({ uid: mon.uid, species: mon.species, nickname: mon.nickname, level: mon.level, state: state });
        }
        (data.party || []).forEach(function(m) { add(m, m.hp === 0 ? "ko" : "team"); });
        (data.box || []).forEach(function(m) { add(m, "box"); });
        (data.dead || []).forEach(function(m) { add(m, "dead"); });
        return Array.from(zones, function(pair) { return { zone: pair[0], mons: pair[1] }; })
            .sort(function(a, b) { return a.zone.localeCompare(b.zone, "fr"); });
    }

    // Prochain boss non coché et cap en vigueur (cap du prochain boss).
    function levelCap(beaten) {
        beaten = beaten || {};
        for (var i = 0; i < BOSSES.length; i++) {
            if (!beaten[BOSSES[i].name]) return { boss: BOSSES[i], index: i, cap: BOSSES[i].cap };
        }
        return { boss: null, index: BOSSES.length, cap: 100 };
    }

    function summary(data) {
        var party = data.party || [];
        return {
            party: party.length,
            fainted: party.filter(function(m) { return m.hp === 0; }).length,
            box: (data.box || []).length,
            dead: (data.dead || []).length,
            maxLevel: party.reduce(function(max, m) { return Math.max(max, m.level || 0); }, 0)
        };
    }

    return { BOSSES: BOSSES, SPECIES_EQUIVALENTS: SPECIES_EQUIVALENTS, ABILITY_EQUIVALENTS: ABILITY_EQUIVALENTS,
        STATUS_LABELS: STATUS_LABELS, STATUS_FR: STATUS_FR, makeResolver: makeResolver, makeResolvers: makeResolvers,
        buildSet: buildSet, planSync: planSync, encounters: encounters, levelCap: levelCap, summary: summary,
        displayName: displayName };
});
