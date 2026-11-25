// Overlay OBS : lit docs/run-data.js (écrit par lua/NullCalcSync.lua) et affiche équipe / boîte / morts.
(function(root) {
    "use strict";
    var params = new URLSearchParams(location.search);
    var view = (params.get("vue") || "equipe").toLowerCase();
    var size = Math.max(1, Math.min(4, Number(params.get("taille")) || 2));
    var cols = Math.max(1, Math.min(30, Number(params.get("colonnes")) || 10));
    var showItems = params.get("objets") !== "0";
    var direction = params.get("sens") === "colonne" ? "colonne" : "ligne";
    document.documentElement.style.setProperty("--s", size);
    if (params.get("fond") === "1") document.body.classList.add("fond");

    var STATUS = { brn: "BRÛ", par: "PAR", psn: "PSN", tox: "TOX", slp: "SOM", frz: "GEL", frb: "GLR" };
    var lastBody = null, pollTag = null;

    // Nom d'espèce du jeu → icône du calculateur (docs/icons/<Nom>.png).
    var ICON_EXCEPTIONS = {
        "Aegislash-Both": "Aegislash", "Aegislash-Shield": "Aegislash", "Type: Null": "Type-Null", "Zygarde-10": "Zygarde-10%25",
        "Oricorio-Pa'u ": "Oricorio-Pa'u", "Pichu-Spiky-eared": "Pichu", "Mime Jr.": "Mime%20Jr.", "Jangmo-o": "Jangmo-O", "Hakamo-o": "Hakamo-O",
        "Pikachu-Belle": "Pikachu", "Pikachu-Cosplay": "Pikachu", "Pikachu-Libre": "Pikachu", "Pikachu-PhD": "Pikachu",
        "Pikachu-Pop-Star": "Pikachu", "Pikachu-Rock-Star": "Pikachu"
    };
    function iconName(species) {
        var name = String(species || "");
        if (ICON_EXCEPTIONS[name]) return ICON_EXCEPTIONS[name];
        if (/^(Farfetch|Sirfetch)/.test(name)) name = name.replace(/’|'/g, "");
        name = name.replace(/^Mr\. Mime/, "Mr-Mime").replace(/^Mr\. Rime/, "Mr-Rime");
        if (/^Genesect/.test(name)) name = "Genesect";
        if (/^Gourgeist-/.test(name)) name = "Gourgeist";
        return name.replace(/ /g, "-");
    }
    // Forme sans icône propre : on retire le dernier suffixe (Darmanitan-Galar-Zen → Darmanitan-Galar → Darmanitan).
    function iconCandidates(species) {
        var name = iconName(species), list = [name], parts = name.split("-");
        while (parts.length > 1) { parts.pop(); list.push(parts.join("-")); }
        list.push("None");
        return list;
    }
    function icon(species) {
        var img = document.createElement("img"), list = iconCandidates(species), i = 0;
        img.alt = species;
        img.src = "icons/" + list[0] + ".png";
        img.onerror = function() { if (++i < list.length) img.src = "icons/" + list[i] + ".png"; };
        return img;
    }
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
    function display(mon) { return mon.nickname && mon.nickname.trim() ? mon.nickname.trim() : mon.species; }

    function monCard(mon, kind) {
        var ko = kind === "team" && mon.hp === 0;
        var card = el("div", "mon" + (ko ? " ko" : "") + (kind === "dead" ? " dead" : ""));
        card.title = display(mon) + " (" + mon.species + ")";
        card.appendChild(icon(mon.species));
        if (kind !== "dead") card.appendChild(el("span", "lv", "N." + mon.level));
        if (kind === "dead") card.appendChild(el("span", "cross", "✝"));
        if (ko) card.appendChild(el("span", "status st-ko", "K.O."));
        else if (mon.status && STATUS[mon.status]) card.appendChild(el("span", "status st-" + mon.status, STATUS[mon.status]));
        if (kind === "team") {
            card.appendChild(el("div", "name", display(mon)));
            var pct = mon.maxHP ? Math.max(0, Math.min(100, mon.hp * 100 / mon.maxHP)) : 0, bar = el("div", "hp"), fill = el("i", pct > 50 ? "ok" : pct > 20 ? "mid" : "low");
            fill.style.width = pct + "%"; bar.appendChild(fill); card.appendChild(bar);
        }
        if (showItems && mon.item && kind !== "dead") card.appendChild(el("div", "item", mon.item));
        return card;
    }

    function section(title, children, layout) {
        var s = el("div", "section");
        if (view === "tout") s.appendChild(el("div", "title", title));
        s.appendChild(layout); children.forEach(function(c) { layout.appendChild(c); });
        return s;
    }
    function grid() { var g = el("div", "grid"); g.style.gridTemplateColumns = "repeat(" + cols + ", calc(40px * var(--s)))"; return g; }

    function render(data) {
        var out = document.getElementById("overlay");
        out.innerHTML = "";
        if (view === "equipe" || view === "tout") {
            var team = data.party.map(function(m) { return monCard(m, "team"); });
            out.appendChild(section("ÉQUIPE", team, el("div", "row team " + direction)));
        }
        if (view === "boite" || view === "tout") {
            out.appendChild(section("BOÎTE (" + data.box.length + ")", data.box.map(function(m) { return monCard(m, "box"); }), grid()));
        }
        if (view === "morts" || view === "tout") {
            out.appendChild(section("CIMETIÈRE (" + data.dead.length + ")", data.dead.map(function(m) { return monCard(m, "dead"); }), grid()));
        }
    }

    root.NullRunSync = {
        receive: function(payload) {
            if (!payload || !payload.data || !Array.isArray(payload.data.party)) return;
            var body = JSON.stringify(payload.data);
            if (body === lastBody) return;
            lastBody = body;
            render(payload.data);
        }
    };
    function poll() {
        if (pollTag && pollTag.parentNode) pollTag.parentNode.removeChild(pollTag);
        var tag = document.createElement("script");
        tag.src = "run-data.js?t=" + Date.now();
        document.head.appendChild(tag); pollTag = tag;
    }
    root.NullOverlay = { iconName: iconName, iconCandidates: iconCandidates };
    poll();
    setInterval(poll, 1000);
})(window);
