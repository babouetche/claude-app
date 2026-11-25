// Onglet « Suivi de run » : lit docs/run-data.js (écrit par lua/NullCalcSync.lua),
// affiche la run et synchronise l'équipe/les boîtes avec le calculateur.
(function(root) {
    "use strict";
    var $ = root.jQuery, Model = root.NullRunModel;
    if (!$ || !Model) return;

    var POLL_MS = 1500, STALE_SECONDS = 15;
    var KEYS = { last: "nullcalc_runLast", index: "nullcalc_runIndex", beaten: "nullcalc_runBeaten",
        auto: "nullcalc_runAutoSync", hp: "nullcalc_runAutoHp", runId: "nullcalc_runId", attempt: "nullcalc_runAttempt", newRun: "nullcalc_runNewRunAt" };
    var latest = null, receivedAt = 0, resolvers = null, lastWarnings = [], pollTag = null, lastAppliedBody = null;

    function load(k, fallback) { try { var v = root.localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } }
    function save(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

    function calcNames() {
        if (resolvers || !root.calc) return resolvers;
        resolvers = Model.makeResolvers({
            species: Object.keys(root.calc.SPECIES[9]), moves: Object.keys(root.calc.MOVES[9]),
            items: root.calc.ITEMS[9].slice(), abilities: root.calc.ABILITIES[9].slice()
        });
        return resolvers;
    }

    // ------------------------------------------------------------------ Réception
    root.NullRunSync = {
        receive: function(payload) {
            if (!payload || !payload.data || !Array.isArray(payload.data.party)) return;
            var body = JSON.stringify(payload.data);
            // Nouvelle partie (autre numéro de dresseur) : boss et compteur remis à jour.
            var runId = Model.runIdOf(payload.data), previousRun = load(KEYS.runId, null);
            if (runId && previousRun && runId !== previousRun) {
                save(KEYS.beaten, {});
                save(KEYS.attempt, load(KEYS.attempt, 1) + 1);
                save(KEYS.newRun, Date.now());
            }
            if (runId) save(KEYS.runId, runId);
            latest = payload; receivedAt = Date.now();
            save(KEYS.last, payload);
            if (root.NullRunSheets) root.NullRunSheets.onData(payload.data);
            if (body !== lastAppliedBody) {
                lastAppliedBody = body;
                if (load(KEYS.auto, true)) applyToCalc(payload.data);
                render();
            } else renderStatus();
        },
        applyNow: function() { if (latest) applyToCalc(latest.data, true); render(); },
        getLatest: function() { return latest; }
    };

    function poll() {
        if (pollTag && pollTag.parentNode) pollTag.parentNode.removeChild(pollTag);
        var tag = document.createElement("script");
        tag.src = "run-data.js?t=" + Date.now();
        tag.async = true;
        tag.onload = tag.onerror = function() { renderStatus(); };
        document.head.appendChild(tag); pollTag = tag;
    }

    // ---------------------------------------------------------- Synchro calculateur
    function readCustomSets() { try { return JSON.parse(root.localStorage.customsets || "{}") || {}; } catch (e) { return {}; } }
    function megaNames(species) { return typeof root.getMegaOtherFormeSpeciesNames === "function" ? root.getMegaOtherFormeSpeciesNames(species) || [] : []; }
    function removeIcon(species, nameProp) {
        var icon = document.getElementById(species + nameProp); if (icon) icon.remove();
        $("#box-poke-list .trainer-pok, #box-poke-list2 .trainer-pok, #team-poke-list .trainer-pok").filter(function() {
            return this.getAttribute("data-id") === species + " (" + nameProp + ")";
        }).remove();
    }

    function applyToCalc(data, force) {
        if (typeof root.updateDex !== "function" || !calcNames() || $("#randoms").prop("checked")) return;
        var previous = load(KEYS.index, {}), plan = Model.planSync(data, previous, resolvers);
        lastWarnings = plan.warnings;
        var custom = readCustomSets();
        plan.removals.forEach(function(r) {
            [r.species].concat(megaNames(r.species)).forEach(function(species) {
                if (custom[species]) { delete custom[species][r.nameProp]; if (!Object.keys(custom[species]).length) delete custom[species]; }
                if (typeof root.deleteMovesetFromAllSetdex === "function") root.deleteMovesetFromAllSetdex(species, r.nameProp);
                removeIcon(species, r.nameProp);
            });
        });
        plan.upserts.forEach(function(u) {
            if (!custom[u.species]) custom[u.species] = {};
            custom[u.species][u.nameProp] = u.set;
        });
        root.updateDex(custom);
        plan.upserts.forEach(function(u) {
            if ((u.changed || force) && typeof root.appendMegaSavesForSpecies === "function")
                root.appendMegaSavesForSpecies(Object.assign({ name: u.species, nameProp: u.nameProp }, u.set));
        });
        // Rangement : l'équipe dans « Team » (ordre du jeu), le reste dans la boîte.
        var team = document.getElementById("team-poke-list"), box = document.getElementById("box-poke-list");
        plan.upserts.forEach(function(u) {
            var icon = document.getElementById(u.species + u.nameProp);
            if (!icon) return;
            if (u.place === "team" && team) team.appendChild(icon);
            else if (u.place === "box" && box && icon.parentNode === team) box.appendChild(icon);
        });
        if (typeof root.queueBox2SetIdsSync === "function") root.queueBox2SetIdsSync();
        save(KEYS.index, plan.index);
        refreshLeftPanel(data, plan);
    }

    // Le Pokémon affiché à gauche suit la partie : set, PV actuels et statut.
    function refreshLeftPanel(data, plan) {
        if (!load(KEYS.hp, true)) return;
        var current = $("#p1 .set-selector").val() || "";
        var match = plan.upserts.filter(function(u) { return current === u.species + " (" + u.nameProp + ")"; })[0];
        if (!match) return;
        var mon = (data.party || []).filter(function(m) { return m.uid === match.uid; })[0];
        if (match.changed) $(".player").change();
        if (!mon) return;
        var panel = $("#p1"), maxHP = Number(panel.find(".max-hp").first().text());
        if (maxHP === mon.maxHP) panel.find(".current-hp").first().val(mon.hp).trigger("keyup");
        panel.find(".status").first().val(Model.STATUS_LABELS[mon.status || ""] || "Healthy").trigger("change");
    }

    function loadIntoCalc(mon, side) {
        var u = (load(KEYS.index, {}))[mon.uid];
        if (!u) return;
        // Le bouton Calculator retire aussi le #run de l'adresse (sans événement hashchange).
        document.getElementById("header-calc-button").click();
        var id = u.species + " (" + u.nameProp + ")", sel = side === "right" ? ".opposing" : ".player";
        $(sel).val(id).change();
        $(sel).closest(".poke-info").find(".select2-chosen").first().text(id);
        if (side !== "right" && typeof mon.hp === "number") {
            var panel = $("#p1");
            if (Number(panel.find(".max-hp").first().text()) === mon.maxHP) panel.find(".current-hp").first().val(mon.hp).trigger("keyup");
            panel.find(".status").first().val(Model.STATUS_LABELS[mon.status || ""] || "Healthy").trigger("change");
        }
    }

    // --------------------------------------------------------------------- Rendu
    function icon(species) {
        var img = el("img", "run-icon"); img.alt = species; img.loading = "lazy";
        var name = calcNames() && resolvers.species(species) || species;
        if (typeof root.setPokemonIconImgSrc === "function") { try { root.setPokemonIconImgSrc(img, { name: name }, false); } catch (e) {} }
        return img;
    }

    function hpBar(mon) {
        var wrap = el("div", "run-hp"), pct = mon.maxHP ? Math.max(0, Math.min(100, mon.hp * 100 / mon.maxHP)) : 0;
        var bar = el("div", "run-hp-fill " + (pct > 50 ? "ok" : pct > 20 ? "mid" : "low")); bar.style.width = pct + "%";
        wrap.appendChild(bar); wrap.appendChild(el("span", "run-hp-text", mon.hp + " / " + mon.maxHP + " PV"));
        return wrap;
    }

    function monCard(mon, kind, cap) {
        var card = el("article", "run-card run-card--" + kind + (kind === "team" && mon.hp === 0 ? " run-card--ko" : ""));
        var head = el("div", "run-card-head"); head.appendChild(icon(mon.species));
        var title = el("div", "run-card-title");
        title.appendChild(el("strong", "", Model.displayName(mon)));
        title.appendChild(el("span", "run-muted", (mon.nickname ? mon.species + " · " : "") + "Nv. " + mon.level));
        head.appendChild(title);
        if (cap && mon.level > cap) head.appendChild(el("span", "run-badge run-badge--warn", "Au-dessus du cap"));
        if (kind === "team" && mon.hp === 0) head.appendChild(el("span", "run-badge run-badge--dead", "K.O."));
        if (mon.status) head.appendChild(el("span", "run-badge", Model.STATUS_FR[mon.status] || mon.status));
        card.appendChild(head);
        if (kind === "team") card.appendChild(hpBar(mon));
        var info = el("dl", "run-info");
        [["Talent", mon.ability], ["Objet", mon.item || "—"], ["Nature", mon.nature],
         ["IV", mon.ivs ? "PV " + mon.ivs.hp + " · Atq " + mon.ivs.atk + " · Déf " + mon.ivs.def + " · AtS " + mon.ivs.spa + " · DéS " + mon.ivs.spd + " · Vit " + mon.ivs.spe : "?"],
         ["Capturé", (mon.metLocation || "?") + (mon.metLevel ? " (Nv. " + mon.metLevel + ")" : "")]
        ].forEach(function(row) { info.appendChild(el("dt", "", row[0])); info.appendChild(el("dd", "", row[1])); });
        card.appendChild(info);
        var moves = el("ul", "run-moves");
        (mon.moves || []).forEach(function(m) {
            var li = el("li", "", m.name === "Hidden Power" && mon.hiddenPower ? "Hidden Power " + mon.hiddenPower : m.name);
            if (kind === "team") li.appendChild(el("span", "run-muted", " · " + m.pp + " PP"));
            moves.appendChild(li);
        });
        card.appendChild(moves);
        if (kind !== "dead") {
            var actions = el("div", "run-actions"), btn = el("button", "btn btn-small", "Calculer avec");
            btn.type = "button"; btn.addEventListener("click", function() { loadIntoCalc(mon, "left"); });
            actions.appendChild(btn); card.appendChild(actions);
        }
        return card;
    }

    function section(title, count) {
        var s = el("section", "run-section"), h = el("h2", "run-section-title", title);
        if (count !== undefined) h.appendChild(el("span", "run-count", String(count)));
        s.appendChild(h); return s;
    }

    function renderStatus() {
        var box = document.getElementById("run-status");
        if (!box) return;
        var age = latest ? Math.max(0, Math.round(Date.now() / 1000 - latest.writtenAt)) : null;
        var live = latest && receivedAt && age !== null && age <= STALE_SECONDS;
        box.className = "run-status " + (live ? "run-status--live" : latest ? "run-status--stale" : "run-status--off");
        box.textContent = live ? "● Synchronisé avec mGBA (signal il y a " + age + " s)"
            : latest ? "● Pas de signal récent du script Lua : dernières données du " + new Date(latest.writtenAt * 1000).toLocaleString("fr-FR")
            : "● En attente du script Lua (voir « Installation » plus bas)";
    }

    function render() {
        var page = document.getElementById("run-subpage");
        if (!page) return;
        var content = document.getElementById("run-content");
        content.innerHTML = "";
        renderStatus();
        var data = latest && latest.data, beaten = load(KEYS.beaten, {}), capInfo = Model.levelCap(beaten);

        // Résumé + level cap
        var top = el("div", "run-top");
        var stats = el("div", "run-stats");
        var sum = data ? Model.summary(data) : { party: 0, fainted: 0, box: 0, dead: 0, maxLevel: 0 };
        [["Équipe", sum.party + "/6"], ["En boîte", sum.box], ["Morts", sum.dead], ["Niveau max", sum.maxLevel || "—"]].forEach(function(s) {
            var tile = el("div", "run-stat" + (s[0] === "Morts" && sum.dead ? " run-stat--dead" : ""));
            tile.appendChild(el("span", "run-stat-value", String(s[1]))); tile.appendChild(el("span", "run-stat-label", s[0]));
            stats.appendChild(tile);
        });
        top.appendChild(stats);
        var capBox = el("div", "run-cap");
        capBox.appendChild(el("div", "run-cap-title", capInfo.boss ? "Prochain boss : " + capInfo.boss.name : "Tous les boss sont battus"));
        capBox.appendChild(el("div", "run-cap-value" + (sum.maxLevel > capInfo.cap ? " run-cap-value--over" : ""), "Level cap : " + capInfo.cap));
        var details = el("details", "run-bosses"); details.appendChild(el("summary", "", "Boss battus (coche au fur et à mesure)"));
        Model.BOSSES.forEach(function(b) {
            var label = el("label", "run-boss"), cb = el("input"); cb.type = "checkbox"; cb.checked = !!beaten[b.name];
            cb.addEventListener("change", function() { var next = load(KEYS.beaten, {}); if (cb.checked) next[b.name] = true; else delete next[b.name]; save(KEYS.beaten, next); render(); });
            label.appendChild(cb); label.appendChild(document.createTextNode(" " + b.name + " — cap " + b.cap)); details.appendChild(label);
        });
        capBox.appendChild(details); top.appendChild(capBox);
        content.appendChild(top);

        var newRunAt = load(KEYS.newRun, 0);
        if (newRunAt && Date.now() - newRunAt < 24 * 3600 * 1000) {
            var banner = el("div", "run-newrun", "🔄 Nouvelle run détectée — tentative n°" + load(KEYS.attempt, 1) +
                " : boss remis à zéro, anciens sets « [Run] » retirés, ancienne run archivée dans Google Sheets.");
            var ok = el("button", "btn btn-small", "OK"); ok.type = "button";
            ok.addEventListener("click", function() { save(KEYS.newRun, 0); render(); });
            banner.appendChild(ok); content.appendChild(banner);
        }
        if (!data) { content.appendChild(installHelp(true)); return; }

        var team = section("Équipe", data.party.length), grid = el("div", "run-grid");
        data.party.forEach(function(m) { grid.appendChild(monCard(m, "team", capInfo.cap)); });
        team.appendChild(grid); content.appendChild(team);

        if (lastWarnings.length) {
            var warn = section("À vérifier"), list = el("ul", "run-warnings");
            lastWarnings.forEach(function(w) { list.appendChild(el("li", "", w)); });
            warn.appendChild(list); content.appendChild(warn);
        }

        var boxS = section("Boîtes", data.box.length), boxGrid = el("div", "run-grid run-grid--compact");
        data.box.forEach(function(m) { boxGrid.appendChild(monCard(m, "box", capInfo.cap)); });
        if (!data.box.length) boxS.appendChild(el("p", "run-muted", "Aucun Pokémon en boîte."));
        boxS.appendChild(boxGrid); content.appendChild(boxS);

        var deadS = section("Morts (dernières boîtes du PC)", data.dead.length), deadGrid = el("div", "run-grid run-grid--compact");
        data.dead.forEach(function(m) { deadGrid.appendChild(monCard(m, "dead")); });
        if (!data.dead.length) deadS.appendChild(el("p", "run-muted", "Aucun mort pour l'instant. Continue comme ça !"));
        deadS.appendChild(deadGrid); content.appendChild(deadS);

        var encS = section("Captures par zone", Model.encounters(data).length), table = el("table", "run-table");
        var thead = el("tr"); ["Zone", "Pokémon", "État"].forEach(function(h) { thead.appendChild(el("th", "", h)); }); table.appendChild(thead);
        var STATES = { team: "Équipe", box: "Boîte", dead: "Mort", ko: "K.O. (en équipe)" };
        Model.encounters(data).forEach(function(z) {
            z.mons.forEach(function(m, i) {
                var tr = el("tr", "run-row--" + m.state);
                tr.appendChild(el("td", "", i === 0 ? z.zone : ""));
                tr.appendChild(el("td", "", (m.nickname ? m.nickname + " (" + m.species + ")" : m.species) + " · Nv. " + m.level));
                tr.appendChild(el("td", "", STATES[m.state])); table.appendChild(tr);
            });
        });
        encS.appendChild(table); content.appendChild(encS);
        content.appendChild(installHelp(false));
    }

    // Liens de l'overlay OBS (docs/overlay.html), à coller dans une source « Navigateur ».
    function overlayHelp() {
        var d = el("details", "run-sheets run-overlay"); d.id = "run-overlay";
        d.appendChild(el("summary", "", "Overlay OBS (remplace PokemonNullDisplay)"));
        d.appendChild(el("p", "run-muted", "Dans OBS : Sources > + > Navigateur, décoche « Fichier local », colle un lien ci-dessous, largeur 900 × hauteur 300 (à ajuster). Le fond est transparent. Il suffit que mGBA tourne avec NullCalcSync.lua : l'overlay lit directement ses données, pas besoin du calculateur ni de PokemonNullDisplay.exe."));
        [["Équipe", "vue=equipe&taille=2"], ["Boîte", "vue=boite&taille=2&colonnes=6&lignes=5"], ["Morts", "vue=morts&taille=2&colonnes=6&lignes=1"],
         ["Dresseur", "vue=dresseur&taille=2"], ["Level cap", "vue=cap&taille=2"], ["Run", "vue=run&taille=2&depart=1"]].forEach(function(v) {
            var url = new URL("overlay.html?" + v[1], document.baseURI).href;
            var row = el("div", "run-sheets-row"), input = el("input"), btn = el("button", "btn btn-small", "Copier");
            input.readOnly = true; input.value = url; btn.type = "button";
            btn.addEventListener("click", function() {
                input.select();
                try { (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).catch(function() { document.execCommand("copy"); }); } catch (e) { document.execCommand("copy"); }
                btn.textContent = "Copié ✔"; setTimeout(function() { btn.textContent = "Copier"; }, 1500);
            });
            row.appendChild(el("strong", "", v[0])); row.appendChild(input); row.appendChild(btn); d.appendChild(row);
        });
        d.appendChild(el("p", "run-muted", "Options dans le lien : taille=1 à 4, colonnes=N, lignes=N (défile toutes les 5 s au-delà), defilement=S, sens=ligne (équipe horizontale), depart=N (numéro de ta run actuelle pour la vue Run), objets=0 (sans objets), fond=1 (fond sombre)."));
        return d;
    }

    function installHelp(open) {
        var d = el("details", "run-section run-install"); d.open = !!open;
        d.appendChild(el("summary", "run-section-title", "Installation de la synchro automatique (mGBA)"));
        var ol = el("ol");
        ["Utilise mGBA 0.10 ou plus récent.",
         "Copie le Lua officiel du jeu (Null_1.2.6.lua) dans le dossier « lua » du calculateur, à côté de NullCalcSync.lua.",
         "Dans mGBA : Outils > Scripting…, puis Fichier > Charger un script et choisis lua/NullCalcSync.lua.",
         "Garde CALCULATEUR.html ouvert : l'équipe, les boîtes et les morts se mettent à jour tout seuls, et tes sets « [Run] » sont créés dans le calculateur."
        ].forEach(function(t) { ol.appendChild(el("li", "", t)); });
        d.appendChild(ol);
        d.appendChild(el("p", "run-muted", "Le script ne modifie jamais ta partie : il lit seulement la mémoire et écrit docs/run-data.js."));
        return d;
    }

    // ------------------------------------------------------------- Navigation
    function setRunMode(on) {
        document.body.classList.toggle("run-mode", on);
        var page = document.getElementById("run-subpage"); if (page) { page.hidden = !on; page.setAttribute("aria-hidden", on ? "false" : "true"); }
        var tab = document.getElementById("header-run-button"); if (tab) tab.classList.toggle("app-header-tab-active", on);
        if (on) {
            document.getElementById("header-calc-button").classList.remove("app-header-tab-active");
            render();
        } else $(window).trigger("resize");
    }

    function buildPage() {
        var tabs = document.querySelector(".app-header-tabs");
        if (!tabs || document.getElementById("header-run-button")) return;
        var tab = el("a", "btn btn-small app-header-tab", "Suivi de run"); tab.id = "header-run-button"; tab.href = "#run";
        tabs.appendChild(tab);
        var page = el("main", "app-run-subpage"); page.id = "run-subpage"; page.hidden = true; page.setAttribute("aria-label", "Suivi de run");
        var bar = el("div", "run-bar"); bar.appendChild(el("h1", "run-title", "Suivi de run — Pokémon Null"));
        var status = el("div", "run-status"); status.id = "run-status"; bar.appendChild(status);
        var options = el("div", "run-options");
        [[KEYS.auto, "Créer et mettre à jour mes sets « [Run] » dans le calculateur"],
         [KEYS.hp, "Mettre à jour les PV et le statut du Pokémon affiché à gauche"]].forEach(function(opt) {
            var label = el("label", "run-option"), cb = el("input"); cb.type = "checkbox"; cb.checked = load(opt[0], true);
            cb.addEventListener("change", function() { save(opt[0], cb.checked); if (cb.checked && latest) { lastAppliedBody = null; root.NullRunSync.receive(latest); } });
            label.appendChild(cb); label.appendChild(document.createTextNode(" " + opt[1])); options.appendChild(label);
        });
        bar.appendChild(options);
        bar.appendChild(overlayHelp());
        page.appendChild(bar);
        var content = el("div", "run-content"); content.id = "run-content"; page.appendChild(content);
        var dex = document.getElementById("dex-subpage");
        dex.parentNode.insertBefore(page, dex.nextSibling);

        tab.addEventListener("click", function(e) {
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            if (location.hash !== "#run") location.hash = "run"; else setRunMode(true);
        });
        root.addEventListener("hashchange", function() { setRunMode(location.hash === "#run"); });
        document.getElementById("header-calc-button").addEventListener("click", function() { setRunMode(false); });
        document.getElementById("header-dex-button").addEventListener("click", function() { setRunMode(false); });
        setRunMode(location.hash === "#run");
    }

    $(function() {
        buildPage();
        var saved = load(KEYS.last, null);
        if (saved && saved.data) { latest = saved; lastAppliedBody = JSON.stringify(saved.data); render(); }
        poll();
        setInterval(poll, POLL_MS);
        setInterval(renderStatus, 1000);
    });
})(window);
