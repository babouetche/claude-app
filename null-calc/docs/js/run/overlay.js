// Overlay OBS : lit docs/run-data.js (écrit par lua/NullCalcSync.lua).
// Vues : équipe (verticale), boîte, morts, prochain dresseur, level cap, numéro de run.
(function(root) {
    "use strict";
    var params = new URLSearchParams(location.search);
    var view = (params.get("vue") || "equipe").toLowerCase();
    if (view === "cimetiere") view = "morts";
    var size = Math.max(1, Math.min(4, Number(params.get("taille")) || 2));
    var cols = Math.max(1, Math.min(30, Number(params.get("colonnes")) || 6));
    var rowsParam = Number(params.get("lignes"));
    // Boîte : 6 × 5 (une boîte du jeu). Morts : une bande de 6. Au-delà : défilement page par page.
    var LAYOUT = {
        box: { cols: cols, rows: Math.max(1, Math.min(30, rowsParam || 5)) },
        dead: { cols: cols, rows: Math.max(1, Math.min(30, view === "morts" ? (rowsParam || 1) : 1)) }
    };
    var pageSeconds = Math.max(2, Number(params.get("defilement")) || 5);
    var showItems = params.get("objets") !== "0";
    var direction = params.get("sens") === "ligne" ? "ligne" : "colonne";
    var startRun = Number(params.get("depart")) || 0;
    var needsTrainers = view === "dresseur" || view === "cap" || view === "run" || view === "tout";
    document.documentElement.style.setProperty("--s", size);
    if (params.get("fond") === "1") document.body.classList.add("fond");

    var STATUS = { brn: "BRÛ", par: "PAR", psn: "PSN", tox: "TOX", slp: "SOM", frz: "GEL", frb: "GLR" };
    var page = { box: 0, dead: 0 }, animate = { box: false, dead: false };
    var lastData = null, lastBody = null, pollTag = null, trainers = null;

    // ------------------------------------------------------------- Icônes
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
    function sprite(species) {
        var img = document.createElement("img"), list = iconCandidates(species), i = 0;
        img.className = "sprite"; img.alt = species;
        img.src = "icons/" + list[0] + ".png";
        img.onerror = function() { if (++i < list.length) img.src = "icons/" + list[i] + ".png"; };
        return img;
    }
    // Icône d'objet : numéro du jeu (Lua) ou nom → numéro ; sinon le nom en texte.
    function itemBadge(mon) {
        if (!showItems || !mon.item || mon.item === "None") return null;
        var id = mon.itemId || (root.NULL_ITEM_IDS && root.NULL_ITEM_IDS[mon.item]) || megaStoneId(mon.item);
        if (!id) return el("span", "itemtext", mon.item);
        var img = document.createElement("img");
        img.className = "itemicon"; img.alt = mon.item; img.title = mon.item;
        img.src = "img/items/" + id + ".png";
        img.onerror = function() { var t = el("span", "itemtext", mon.item); if (img.parentNode) img.parentNode.replaceChild(t, img); };
        return img;
    }
    // Méga-gemme sans icône (Crabominite, Tatsugirinite…) : icône d'une autre méga-gemme, toujours la même pour un nom donné.
    var MEGA_IDS = null;
    function megaStoneId(item) {
        if (!/ite( [XYZ])?$/.test(item) || !root.NULL_ITEM_IDS || /^(Eviolite|Everstone|Quick Claw)$/.test(item)) return null;
        if (!MEGA_IDS) {
            var ids = root.NULL_ITEM_IDS;
            MEGA_IDS = ["Venusaurite", "Charizardite X", "Charizardite Y", "Blastoisinite", "Beedrillite", "Gengarite", "Lucarionite", "Gardevoirite", "Garchompite", "Absolite"]
                .map(function(n) { return ids[n]; }).filter(Boolean);
        }
        if (!MEGA_IDS.length) return null;
        var h = 0;
        for (var i = 0; i < item.length; i++) h = (h * 31 + item.charCodeAt(i)) >>> 0;
        return MEGA_IDS[h % MEGA_IDS.length];
    }
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
    function display(mon) { return mon.nickname && mon.nickname.trim() ? mon.nickname.trim() : mon.species; }
    function add(parent, child) { if (child) parent.appendChild(child); return parent; }

    // ------------------------------------------------------------- Cartes
    function teamCard(mon) {
        var ko = mon.hp === 0, card = el("div", "tcard" + (ko ? " ko" : "")), pic = el("div", "pic"), info = el("div", "info");
        card.title = display(mon) + " (" + mon.species + ")";
        pic.appendChild(sprite(mon.species)); add(pic, itemBadge(mon));
        if (ko) pic.appendChild(el("span", "status st-ko", "K.O."));
        else if (mon.status && STATUS[mon.status]) pic.appendChild(el("span", "status st-" + mon.status, STATUS[mon.status]));
        var line = el("div", "line1"); line.appendChild(el("span", "name", display(mon))); line.appendChild(el("span", "lvl", "N." + mon.level));
        var pct = mon.maxHP ? Math.max(0, Math.min(100, mon.hp * 100 / mon.maxHP)) : 0, bar = el("div", "hp"), fill = el("i", pct > 50 ? "ok" : pct > 20 ? "mid" : "low");
        fill.style.width = pct + "%"; bar.appendChild(fill);
        info.appendChild(line); info.appendChild(bar); info.appendChild(el("div", "hptext", mon.hp + " / " + mon.maxHP));
        card.appendChild(pic); card.appendChild(info);
        return card;
    }
    function cell(mon, kind) {
        var c = el("div", "cell" + (kind === "dead" ? " dead" : ""));
        c.title = display(mon) + " (" + mon.species + ")";
        c.appendChild(sprite(mon.species));
        if (kind === "dead") c.appendChild(el("span", "cross", "✝"));
        else { if (kind !== "trainer") c.appendChild(el("span", "lv", "N." + mon.level)); add(c, itemBadge(mon)); }
        return c;
    }

    function section(title, body) {
        var s = el("div", "section");
        if (view === "tout" && title) s.appendChild(el("div", "title", title));
        s.appendChild(body);
        return s;
    }
    function grid(n) { var g = el("div", "grid"); g.style.gridTemplateColumns = "repeat(" + n + ", calc(30px * var(--s)))"; return g; }
    function pagesOf(kind, list) { var l = LAYOUT[kind]; return Math.max(1, Math.ceil(list.length / (l.cols * l.rows))); }
    // Une page de la liste ; quand la page change, la grille glisse depuis la droite.
    function paged(kind, label, list) {
        var l = LAYOUT[kind], perPage = l.cols * l.rows, pages = pagesOf(kind, list);
        if (page[kind] >= pages) page[kind] = 0;
        var g = grid(l.cols);
        list.slice(page[kind] * perPage, (page[kind] + 1) * perPage).forEach(function(m) { g.appendChild(cell(m, kind)); });
        if (animate[kind]) { g.classList.add("slide"); animate[kind] = false; }
        var sec = section(label + " (" + list.length + ")" + (pages > 1 ? " · " + (page[kind] + 1) + "/" + pages : ""), g);
        sec.dataset.pages = pages;
        if (view !== "tout" && pages > 1) sec.insertBefore(el("div", "title page", (page[kind] + 1) + "/" + pages), sec.firstChild);
        return sec;
    }

    // ------------------------------------------------------------- Dresseurs / level cap / run
    function progressOf(data) {
        if (!trainers || !root.NullTrainers) return null;
        return root.NullTrainers.progress(trainers, (data.battle && data.battle.fights) || []);
    }
    function trainerView(data) {
        var p = progressOf(data), box = el("div", "trainer");
        if (!p) { box.appendChild(el("div", "note", "Chargement des dresseurs…")); return box; }
        if (!p.next) { box.appendChild(el("div", "tname", "Tous les dresseurs sont battus !")); return box; }
        var t = p.next;
        box.appendChild(el("div", "tname", t.name.replace(/^Root Academy Trainer #(\d+)$/, "Root Academy — dresseur $1")));
        if (t.random) { box.appendChild(el("div", "note", "Équipe tirée au hasard (" + t.slotCount + " Pokémon parmi " + t.mons.length + ")")); return box; }
        var row = el("div", "row");
        t.mons.forEach(function(m) { row.appendChild(cell({ species: m.species, level: m.level, item: m.item }, "trainer")); });
        box.appendChild(row);
        return box;
    }
    function capView(data) {
        var p = progressOf(data);
        return el("div", "big", p ? String(p.cap) : "…");
    }

    // Numéro de run : runs déjà faites avant le suivi (depart=N) + runs qui ont atteint le level cap 45.
    function runView(data) {
        if (!trainers || !root.NullTrainers) return el("div", "big", "…");
        return el("div", "big", String(startRun + root.NullTrainers.runCount(trainers, data.battle).total));
    }

    function render(data) {
        var out = document.getElementById("overlay");
        out.innerHTML = "";
        if (view === "equipe" || view === "tout") {
            var team = el("div", "team " + direction);
            data.party.forEach(function(m) { team.appendChild(teamCard(m)); });
            out.appendChild(section("ÉQUIPE", team));
        }
        if (view === "boite" || view === "tout") out.appendChild(paged("box", "BOÎTE", data.box));
        if (view === "morts" || view === "tout") out.appendChild(paged("dead", "MORTS", data.dead));
        if (view === "dresseur" || view === "tout") out.appendChild(section("PROCHAIN DRESSEUR", trainerView(data)));
        if (view === "cap" || view === "tout") out.appendChild(section("LEVEL CAP", capView(data)));
        if (view === "run" || view === "tout") out.appendChild(section("RUN", runView(data)));
    }

    // ------------------------------------------------------------- Données
    root.NullRunSync = {
        receive: function(payload) {
            if (!payload || !payload.data || !Array.isArray(payload.data.party)) return;
            var body = JSON.stringify(payload.data);
            if (body === lastBody) return;
            lastBody = body; lastData = payload.data;
            render(payload.data);
        }
    };
    function poll() {
        if (pollTag && pollTag.parentNode) pollTag.parentNode.removeChild(pollTag);
        var tag = document.createElement("script");
        tag.src = "run-data.js?t=" + Date.now();
        document.head.appendChild(tag); pollTag = tag;
    }
    function loadScript(src, done) {
        var tag = document.createElement("script");
        tag.src = src; tag.onload = done; tag.onerror = done;
        document.head.appendChild(tag);
    }
    // Dresseurs : mêmes données que le calculateur (sets 1.2.6 corrigés par la ROM).
    if (needsTrainers) {
        loadScript("js/data/sets/gen9.js", function() {
            loadScript("js/null_ai/version126-trainers.js", function() {
                if (root.SETDEX_SV && root.NullTrainers) trainers = root.NullTrainers.buildTrainers(root.SETDEX_SV);
                if (lastData) render(lastData);
            });
        });
    }
    root.NullOverlay = { iconName: iconName, iconCandidates: iconCandidates, progress: function() { return lastData && progressOf(lastData); } };
    poll();
    setInterval(poll, 1000);
    // Défilement page par page (boîte et morts)
    setInterval(function() {
        if (!lastData) return;
        var changed = false;
        [["box", lastData.box, view === "boite" || view === "tout"], ["dead", lastData.dead, view === "morts" || view === "tout"]].forEach(function(k) {
            if (!k[2]) return;
            var pages = pagesOf(k[0], k[1]);
            if (pages < 2) return;
            page[k[0]] = (page[k[0]] + 1) % pages; animate[k[0]] = true; changed = true;
        });
        if (changed) render(lastData);
    }, pageSeconds * 1000);
})(window);
