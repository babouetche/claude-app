// Dresseurs de Pokémon Null : base ordonnée (données du calculateur), reconnaissance
// d'une équipe adverse lue dans le jeu, prochain dresseur et level cap automatiques.
(function(root, factory) {
    "use strict";
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.NullTrainers = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";

    // Boss et level caps (« Mechanic Changes », doc officielle), dans l'ordre du jeu.
    // Chaque boss est résolu sur le premier dresseur correspondant APRÈS le boss précédent.
    var BOSSES = [
        { label: "Root Academy 1", match: /^Root Academy Trainer #1$/, cap: 13 },
        { label: "Root Academy 2", match: /^Root Academy Trainer #2$/, cap: 19 },
        { label: "Root Academy 3", match: /^Root Academy Trainer #3$/, cap: 25 },
        { label: "Root Academy 4", match: /^Root Academy Trainer #4$/, cap: 29 },
        { label: "Roxanne", match: /Roxanne/, cap: 38 },
        { label: "Brawly", match: /Brawly/, cap: 45 },
        { label: "Glacia", match: /Glacia/, cap: 53 },
        { label: "Wattson", match: /Wattson/, cap: 59 },
        { label: "Norman", match: /Norman/, cap: 66 },
        { label: "Flannery", match: /Flannery/, cap: 72 },
        { label: "Winona", match: /Winona/, cap: 77 },
        { label: "Maxie", match: /Maxie/, cap: 82 },
        { label: "Tate & Liza", match: /Leader (Tate|Liza)/, cap: 86 },
        { label: "Archie", match: /Archie/, cap: 91 },
        { label: "Steven", match: /^Leader Steven/, cap: 95 },
        { label: "Glacia 2", match: /Glacia/, cap: 99 },
        { label: "Wallace", match: /Wallace/, cap: 100 }
    ];
    // Les « Root Academy Trainer #N Slot k » sont les 3 tirages aléatoires d'un même dresseur.
    function groupName(key) { var m = /^(Root Academy Trainer #\d+) Slot \d+$/.exec(key); return m ? m[1] : key; }
    function k(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
    // Noms du calculateur ↔ noms lus dans le jeu (Lua officiel), vérifiés sur toute la base.
    var GAME_NAMES = { "Darmanitan-Zen-Mode": "Darmanitan-Zen", "Darmanitan-Zen-Mode-Galar": "Darmanitan-Galar-Zen", "Aegislash-Shield": "Aegislash-Both",
        "Tatsugiri-Stretchy": "Tatsugiri", "Tatsugiri-Droopy": "Tatsugiri", "Tatsugiri-Curly": "Tatsugiri" };
    // Toutes les écritures acceptées pour une espèce : nom, nom du jeu, forme de base d'une Méga sans base dans l'équipe.
    function keysOf(species) {
        var out = [k(species)];
        if (GAME_NAMES[species]) out.push(k(GAME_NAMES[species]));
        var mega = /^(.+?)-Mega(-[XYZ])?$/.exec(species);
        if (mega) out.push(k(mega[1]));
        return out;
    }

    /** SETDEX (sets des dresseurs du calculateur) → dresseurs ordonnés comme dans le jeu. */
    function buildTrainers(setdex) {
        var byName = {};
        Object.keys(setdex || {}).forEach(function(species) {
            Object.keys(setdex[species]).forEach(function(key) {
                var set = setdex[species][key];
                if (!set || set.index === undefined || set.isCustomSet) return;
                var name = groupName(key);
                var t = byName[name] || (byName[name] = { name: name, order: Infinity, random: name !== key, slots: {}, slotKeys: {} });
                t.slotKeys[key] = true;
                t.order = Math.min(t.order, set.index);
                // Une Méga ou une forme de combat partage l'emplacement de sa forme de base : on garde le nom le plus court.
                var slot = t.slots[set.index];
                if (!slot || species.length < slot.species.length)
                    t.slots[set.index] = { species: species, level: set.level, item: set.item || "", ability: set.ability || "", moves: set.moves || [], index: set.index };
            });
        });
        return Object.keys(byName).map(function(n) {
            var t = byName[n];
            var all = Object.keys(t.slots).map(Number).sort(function(a, b) { return a - b; }).map(function(i) { return t.slots[i]; });
            // Forme de combat (Méga, Primo, Zygarde-Complete, Wishiwashi-School, Minior-Meteor…) : même niveau et
            // même objet que sa forme de base dans l'équipe. Le jeu stocke l'une ou l'autre : les deux sont acceptées.
            t.mons = [];
            all.forEach(function(m) {
                var base = t.mons.filter(function(o) {
                    return o.level === m.level && o.item === m.item && (m.species.indexOf(o.species + "-") === 0 || o.species.indexOf(m.species + "-") === 0);
                })[0];
                if (base) { base.alts.push(m.species); if (m.species.length < base.species.length) { base.alts.push(base.species); base.species = m.species; } }
                else t.mons.push(Object.assign({ alts: [] }, m));
            });
            t.slotCount = t.random ? Object.keys(t.slotKeys).length : t.mons.length;
            delete t.slots; delete t.slotKeys;
            t.maxLevel = t.mons.reduce(function(m, x) { return Math.max(m, x.level || 0); }, 0);
            return t;
        }).sort(function(a, b) { return a.order - b.order; });
    }

    /** Dresseur correspondant à une équipe lue dans le jeu (espèce + niveau), ou null. */
    function matchTeam(trainers, team, afterOrder) {
        if (!team || !team.length) return null;
        var best = null;
        trainers.forEach(function(t) {
            // Chaque Pokémon lu prend un emplacement libre de même niveau dont l'espèce (ou une forme) correspond.
            var used = [], hit = 0;
            team.forEach(function(w) {
                var wk = k(w.species);
                for (var i = 0; i < t.mons.length; i++) {
                    var m = t.mons[i];
                    if (used[i] || m.level !== w.level) continue;
                    if ([m.species].concat(m.alts).some(function(a) { return keysOf(a).indexOf(wk) >= 0; })) { used[i] = true; hit++; return; }
                }
            });
            var wanted = team;
            // Équipe exacte (même taille, mêmes espèces, mêmes niveaux) : un sauvage ne peut pas correspondre.
            // Root Academy : un Pokémon tiré dans chaque emplacement aléatoire.
            var full = hit === wanted.length && wanted.length === t.slotCount;
            // Combat double contre deux dresseurs : l'équipe lue contient les deux équipes entières.
            var partOfDouble = !t.random && t.mons.length >= 2 && hit === t.mons.length && wanted.length > hit;
            if (!full && !partOfDouble) return;
            var score = (full ? 2 : 1) * 1000 + hit - (t.mons.length - hit) * 10 - (afterOrder !== undefined && t.order < afterOrder ? 500 : 0);
            if (!best || score > best.score || (score === best.score && t.order < best.trainer.order)) best = { trainer: t, score: score };
        });
        return best && best.trainer;
    }

    /** À partir des combats détectés : dresseurs affrontés, prochain dresseur, level cap. */
    function progress(trainers, fights) {
        var fought = {}, last = -1;
        (fights || []).forEach(function(f) {
            var t = matchTeam(trainers, f.team, last);
            if (t) { fought[t.name] = { trainer: t, at: f.t }; last = Math.max(last, t.order); }
        });
        var next = null;
        for (var i = 0; i < trainers.length; i++) {
            if (trainers[i].order > last && !fought[trainers[i].name]) { next = trainers[i]; break; }
        }
        // Level cap : premier boss non affronté.
        var after = -1, cap = 100, nextBoss = null, beaten = 0;
        for (var b = 0; b < BOSSES.length; b++) {
            var boss = BOSSES[b], resolved = null;
            for (var j = 0; j < trainers.length; j++) if (trainers[j].order > after && boss.match.test(trainers[j].name)) { resolved = trainers[j]; break; }
            if (!resolved) continue;
            after = resolved.order;
            var done = !!fought[resolved.name] || (boss.label === "Tate & Liza" && Object.keys(fought).some(function(n) { return /Leader (Tate|Liza)/.test(n); }));
            if (!done) { cap = boss.cap; nextBoss = { label: boss.label, trainer: resolved }; break; }
            beaten++;
        }
        return { fought: fought, next: next, cap: cap, nextBoss: nextBoss, bossesBeaten: beaten, lastOrder: last };
    }

    return { BOSSES: BOSSES, keysOf: keysOf, buildTrainers: buildTrainers, matchTeam: matchTeam, progress: progress, groupName: groupName };
});
