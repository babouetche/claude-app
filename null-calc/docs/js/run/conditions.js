// Conditions de combat du dresseur adverse (gauntlet, B2B, météo/terrain permanents, PV de départ…),
// lues dans le doc des dresseurs par la feuille Google Sheets (onglet 🎯 Dresseurs).
(function(root) {
    "use strict";
    var KEY = "nullcalc_trainerConditions", URL_KEY = "nullcalc_sheetsUrl";
    var map = {}, lastName = null, fetched = false;
    try { map = JSON.parse(root.localStorage.getItem(KEY) || "{}") || {}; } catch (e) { map = {}; }

    function k(s) { return String(s || "").toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/[^a-z0-9&]/g, ""); }
    /** Conditions d'un dresseur du calculateur (doubles « A & B [Double] » acceptés dans les deux sens). */
    function conditionsFor(name, source) {
        source = source || map;
        var want = k(name).replace(/slot\d+$/, "");
        if (!want) return [];
        var hits = [];
        Object.keys(source).forEach(function(n) {
            var parts = [k(n)].concat(n.split("&").map(k));
            if (parts.indexOf(want) >= 0 || want.split("&").some(function(w) { return w && parts.indexOf(w) >= 0; })) hits.push(source[n]);
        });
        var out = [];
        hits.join(" · ").split(" · ").forEach(function(c) { c = c.trim(); if (c && out.indexOf(c) < 0) out.push(c); });
        return out;
    }

    function fetchMap() {
        var url = ""; try { url = root.localStorage.getItem(URL_KEY) || ""; } catch (e) {}
        if (fetched || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.trim())) return;
        fetched = true;
        var cb = "NullTrainerConditionsCb", tag = document.createElement("script");
        root[cb] = function(res) {
            delete root[cb]; tag.remove();
            if (res && res.conditions && Object.keys(res.conditions).length) {
                map = res.conditions;
                try { root.localStorage.setItem(KEY, JSON.stringify(map)); } catch (e) {}
                lastName = null; tick();
            }
        };
        tag.onerror = function() { delete root[cb]; tag.remove(); };
        tag.src = url.trim() + "?conditions=1&callback=" + cb + "&t=" + Date.now();
        document.head.appendChild(tag);
    }

    function currentTrainer() {
        if (typeof root.getOpposingSetStringForTrainerNav !== "function" || typeof root.getTrainerNameFromSet !== "function") return "";
        try { return root.getTrainerNameFromSet(root.getOpposingSetStringForTrainerNav()); } catch (e) { return ""; }
    }

    function render(name, list) {
        var box = document.getElementById("null-trainer-conditions");
        var group = document.querySelector(".move-result-group");
        if (!list.length) { if (box) box.remove(); return; }
        if (!group) return;
        if (!box) {
            box = document.createElement("div"); box.id = "null-trainer-conditions"; box.className = "null-trainer-conditions";
            group.parentNode.insertBefore(box, group);
        }
        box.innerHTML = "";
        var head = document.createElement("div"), b = document.createElement("b");
        b.textContent = "⚠ Combat particulier"; head.appendChild(b); head.appendChild(document.createTextNode(name));
        var ul = document.createElement("ul");
        list.forEach(function(c) { var li = document.createElement("li"); li.textContent = c; ul.appendChild(li); });
        box.appendChild(head); box.appendChild(ul);
    }

    function tick() {
        var name = currentTrainer();
        if (name === lastName) return;
        lastName = name;
        render(name, conditionsFor(name));
    }

    root.NullTrainerConditions = { conditionsFor: conditionsFor, refresh: function() { lastName = null; tick(); } };
    if (typeof document !== "undefined") {
        setTimeout(fetchMap, 1500);
        setInterval(tick, 800);
    }
})(typeof window !== "undefined" ? window : globalThis);
