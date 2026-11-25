// Combat en direct : le calculateur suit le combat lu par le Lua (Pokémon actifs et PV des deux côtés).
// Appliqué seulement quand le combat change : tu peux modifier le calc entre deux actions.
(function(root) {
    "use strict";
    var lastKey = null;

    function k(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

    /** Set du calculateur pour le Pokémon adverse actif : « Espèce (Dresseur) ». */
    function enemySetId(enemy, activeIndex, setdex) {
        var T = root.NullTrainers, trainers = T && T.cached(setdex);
        if (!trainers || !enemy || !enemy.length) return null;
        var trainer = T.matchTeam(trainers, enemy.map(function(m) { return { species: m.species, level: m.level }; }));
        var mon = enemy[activeIndex - 1];
        if (!trainer || !mon) return null;
        var want = k(mon.species), calcSpecies = null;
        trainer.mons.some(function(m) {
            if (!trainer.random && m.level !== mon.level) return false;
            var names = [m.species].concat(m.alts || []);
            var hit = names.filter(function(n) { return T.keysOf(n).indexOf(want) >= 0; })[0];
            if (hit) calcSpecies = names.filter(function(n) { return k(n) === want; })[0] || hit;
            return !!hit;
        });
        if (!calcSpecies || !setdex[calcSpecies]) return null;
        var key = Object.keys(setdex[calcSpecies]).filter(function(n) { return T.groupName(n) === trainer.name; })[0];
        return key ? { id: calcSpecies + " (" + key + ")", trainer: trainer.name, mon: mon } : null;
    }

    function setSide(sel, id) {
        if (!id || $(sel).val() === id) return;
        $(sel).val(id).change();
        $(sel).closest(".poke-info").find(".select2-chosen").first().text(id);
    }
    function setHp(panel, hp, maxHP) {
        if (typeof hp !== "number" || !maxHP) return;
        var calcMax = Number(panel.find(".max-hp").first().text());
        if (calcMax === maxHP) panel.find(".current-hp").first().val(hp).trigger("keyup");
        else panel.find(".percent-hp").first().val(Math.round(hp * 1000 / maxHP) / 10).trigger("keyup");
    }

    function onData(data, index) {
        var b = data && data.battle;
        if (!b || !b.active || !b.enemy || typeof $ === "undefined" || !root.SETDEX_SV) { lastKey = null; return null; }
        var u = (index || {})[b.active.player];
        var me = (data.party || []).filter(function(m) { return m.uid === b.active.player; })[0];
        var foe = enemySetId(b.enemy, b.active.enemy, root.SETDEX_SV);
        var key = JSON.stringify([b.active, b.enemy.map(function(m) { return m.hp; }), me && me.hp]);
        if (key === lastKey) return null;
        lastKey = key;
        if (u) setSide(".player", u.species + " (" + u.nameProp + ")");
        if (me) setHp($("#p1"), me.hp, me.maxHP);
        if (foe) { setSide(".opposing", foe.id); setHp($("#p2"), foe.mon.hp, foe.mon.maxHP); }
        return { player: u ? u.species + " (" + u.nameProp + ")" : null, opponent: foe && foe.id };
    }

    root.NullLiveBattle = { onData: onData, enemySetId: enemySetId };
})(typeof window !== "undefined" ? window : globalThis);
