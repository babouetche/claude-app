// Envoi automatique du suivi de run vers Google Sheets (Apps Script, voir google-sheets/).
// Appelé par run_tracker.js à chaque lecture de docs/run-data.js.
(function(root) {
    "use strict";
    var KEY_URL = "nullcalc_sheetsUrl", MIN_INTERVAL_MS = 8000, CONFIRM_DELAY_MS = 5000;
    var lastKey = null, lastSent = 0, timer = null, pending = null, state = { sentAt: null, confirmed: null, error: "" }, cbCount = 0;

    function getUrl() { try { return root.localStorage.getItem(KEY_URL) || ""; } catch (e) { return ""; } }
    function validUrl(url) { return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(url || "").trim()); }
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
    function time(d) { return d ? d.toLocaleTimeString("fr-FR") : ""; }

    function bosses() {
        var beaten = {};
        try { beaten = JSON.parse(root.localStorage.getItem("nullcalc_runBeaten") || "{}") || {}; } catch (e) {}
        var info = root.NullRunModel ? root.NullRunModel.levelCap(beaten) : { cap: "", boss: null };
        return { cap: info.cap, next: info.boss ? info.boss.name : "", beaten: Object.keys(beaten) };
    }

    // Données envoyées : tout sauf le texte d'export Showdown (inutile pour la feuille).
    function buildPayload(data) {
        function strip(list) { return (list || []).map(function(m) { var c = Object.assign({}, m); delete c.showdown; return c; }); }
        return { kind: "null-run", version: 1, sentAt: new Date().toISOString(), bosses: bosses(),
            data: { party: strip(data.party), box: strip(data.box), dead: strip(data.dead) } };
    }

    function send(payload) {
        var url = getUrl();
        if (!validUrl(url)) return;
        lastSent = Date.now(); state.sentAt = new Date(); state.error = "";
        // text/plain + no-cors : requête « simple », acceptée depuis une page locale (file://).
        root.fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
            .then(function() { setTimeout(confirm, CONFIRM_DELAY_MS); })
            .catch(function(err) { state.error = "Envoi impossible : " + (err && err.message || err); render(); });
        render();
    }

    // Vérifie que la feuille a bien reçu la synchro (doGet en JSONP).
    function confirm() {
        var url = getUrl();
        if (!validUrl(url)) return;
        var name = "NullRunSheetsCb" + (++cbCount), tag = document.createElement("script");
        root[name] = function(info) {
            delete root[name]; tag.remove();
            var at = info && info.lastSync && info.lastSync.at ? new Date(info.lastSync.at) : null;
            if (at && state.sentAt && at.getTime() >= state.sentAt.getTime() - 60000) { state.confirmed = at; state.error = ""; }
            else state.error = "La feuille n'a pas confirmé la dernière synchro.";
            render();
        };
        tag.src = url + "?callback=" + name + "&t=" + Date.now();
        tag.onerror = function() { delete root[name]; tag.remove(); state.error = "Impossible de joindre la feuille (lien ou déploiement à vérifier)."; render(); };
        document.head.appendChild(tag);
    }

    function onData(data, force) {
        if (!data || !validUrl(getUrl())) return;
        var payload = buildPayload(data), key = JSON.stringify([payload.data, payload.bosses]);
        if (!force && key === lastKey) return;
        lastKey = key; pending = payload;
        var wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastSent));
        clearTimeout(timer);
        timer = setTimeout(function() { var p = pending; pending = null; if (p) send(p); }, force ? 0 : wait);
    }

    // ----------------------------------------------------------------- Interface
    function render() {
        var status = document.getElementById("run-sheets-status");
        if (!status) return;
        var url = getUrl();
        status.className = "run-sheets-status";
        if (!url) status.textContent = "Non configuré : colle l'URL de ton Apps Script (voir google-sheets/INSTALLATION.md).";
        else if (!validUrl(url)) { status.textContent = "URL invalide : elle doit commencer par https://script.google.com/macros/s/ et finir par /exec."; status.className += " run-sheets-status--error"; }
        else if (state.error) { status.textContent = state.error; status.className += " run-sheets-status--error"; }
        else if (state.confirmed) { status.textContent = "✔ Feuille à jour (confirmé à " + time(state.confirmed) + ")"; status.className += " run-sheets-status--ok"; }
        else if (state.sentAt) status.textContent = "Envoyé à " + time(state.sentAt) + ", confirmation en cours…";
        else status.textContent = "Prêt : la feuille se mettra à jour à la prochaine donnée reçue de mGBA.";
    }

    function buildPanel() {
        var bar = document.querySelector("#run-subpage .run-bar");
        if (!bar || document.getElementById("run-sheets")) return;
        var box = el("details", "run-sheets"); box.id = "run-sheets";
        box.appendChild(el("summary", "", "Google Sheets (mise à jour automatique)"));
        var row = el("div", "run-sheets-row"), input = el("input");
        input.type = "url"; input.id = "run-sheets-url"; input.placeholder = "https://script.google.com/macros/s/…/exec"; input.value = getUrl();
        var saveBtn = el("button", "btn btn-small", "Enregistrer"), sendBtn = el("button", "btn btn-small", "Envoyer maintenant");
        saveBtn.type = sendBtn.type = "button";
        saveBtn.addEventListener("click", function() {
            try { root.localStorage.setItem(KEY_URL, input.value.trim()); } catch (e) {}
            state = { sentAt: null, confirmed: null, error: "" }; lastKey = null; render();
            var latest = root.NullRunSync && root.NullRunSync.getLatest();
            if (latest && validUrl(input.value.trim())) onData(latest.data, true);
        });
        sendBtn.addEventListener("click", function() { var latest = root.NullRunSync && root.NullRunSync.getLatest(); if (latest) onData(latest.data, true); });
        row.appendChild(input); row.appendChild(saveBtn); row.appendChild(sendBtn);
        box.appendChild(row);
        box.appendChild(el("div", "run-sheets-status")).id = "run-sheets-status";
        box.open = !validUrl(getUrl());
        bar.appendChild(box);
        render();
    }

    root.NullRunSheets = { onData: onData, buildPayload: buildPayload, validUrl: validUrl, render: render };
    if (root.jQuery) root.jQuery(buildPanel);
})(window);
