// Combat en direct : le calculateur suit le combat lu par le Lua (Pokémon actifs, PV, boosts, météo, terrain, écrans, pièges).
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

    // Terrain de combat lu dans le jeu → boutons « Field » du calculateur (côté gauche = moi).
    function setCheck(id, on) {
        var e = $("#" + id);
        if (e.length && e.prop("checked") !== !!on) e.prop("checked", !!on).change();
    }
    function setRadio(id) { var e = $("#" + id); if (e.length && !e.prop("checked")) e.prop("checked", true).change(); }
    var WEATHER_IDS = { "": "clear", "Sun": "sun", "Rain": "rain", "Sand": "sand", "Hail": "hail", "Snow": "snow", "Harsh Sunshine": "harsh-sunshine", "Heavy Rain": "heavy-rain" };
    function applyField(f) {
        if (!f) return;
        if (WEATHER_IDS[f.weather || ""]) setRadio(WEATHER_IDS[f.weather || ""]);
        var terrain = String(f.terrain || "").toLowerCase();
        ["electric", "grassy", "misty", "psychic"].forEach(function(id) { if (id !== terrain) setCheck(id, false); });
        if (terrain) setCheck(terrain, true);
        setCheck("trickroom", f.trickRoom); setCheck("magicroom", f.magicRoom); setCheck("wonderroom", f.wonderRoom); setCheck("gravity", f.gravity);
        ["L", "R"].forEach(function(s, i) {
            var x = (f.sides || [])[i];
            if (!x) return;
            setCheck("sr" + s, x.stealthRock);
            setRadio("spikes" + s + Math.max(0, Math.min(3, x.spikes || 0)));
            setCheck("reflect" + s, x.reflect); setCheck("lightScreen" + s, x.lightScreen);
            setCheck("auroraVeil" + s, x.auroraVeil); setCheck("tailwind" + s, x.tailwind);
        });
    }
    var STAT_ROWS = { atk: "at", def: "df", spa: "sa", spd: "sd", spe: "sp" };
    function applyBoosts(panel, boosts) {
        if (!boosts) return;
        Object.keys(STAT_ROWS).forEach(function(k) {
            var sel = panel.find("." + STAT_ROWS[k] + " .boost").first(), v = String(Math.max(-6, Math.min(6, boosts[k] || 0)));
            if (sel.length && sel.val() !== v) sel.val(v).change();
        });
    }

    function onData(data, index) {
        var b = data && data.battle;
        if (!b || !b.active || !b.enemy || typeof $ === "undefined" || !root.SETDEX_SV) { lastKey = null; return null; }
        var u = (index || {})[b.active.player];
        var me = (data.party || []).filter(function(m) { return m.uid === b.active.player; })[0];
        var foe = enemySetId(b.enemy, b.active.enemy, root.SETDEX_SV);
        var live = b.live || null;
        var key = JSON.stringify([b.active, b.enemy.map(function(m) { return m.hp; }), me && me.hp, live]);
        if (key === lastKey) return null;
        lastKey = key;
        var lp = live && live.player[0], le = live && live.enemy[0];
        if (u) setSide(".player", u.species + " (" + u.nameProp + ")");
        if (lp) setHp($("#p1"), lp.hp, lp.maxHP); else if (me) setHp($("#p1"), me.hp, me.maxHP);
        if (foe) { setSide(".opposing", foe.id); if (le) setHp($("#p2"), le.hp, le.maxHP); else setHp($("#p2"), foe.mon.hp, foe.mon.maxHP); }
        if (lp) applyBoosts($("#p1"), lp.boosts);
        if (le && foe) applyBoosts($("#p2"), le.boosts);
        if (live) applyField(live.field);
        return { player: u ? u.species + " (" + u.nameProp + ")" : null, opponent: foe && foe.id };
    }

    root.NullLiveBattle = { onData: onData, enemySetId: enemySetId };
})(typeof window !== "undefined" ? window : globalThis);
