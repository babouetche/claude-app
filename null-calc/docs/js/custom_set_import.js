(function(root, factory) {
    "use strict";
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else {
        root.NullCustomSetImport = api;
        // Loaded after the preserved legacy importer, before its ready handler runs.
        root.addSets = function(text, name) { return api.importSets(text, name, root); };
        root.TrashPokemon = function() { return api.emptyTrash(root); };
        // Capture shipped records before the legacy ready handler merges saved imports.
        var originalSets = api.captureOriginalSets(root);
        root.RemoveAllPokemon = function() {
            if (!root.confirm("Delete all saved custom sets from every box and selection list? This cannot be undone.")) return false;
            var panels = [], partners = [];
            root.$(".poke-info input.set-selector").each(function() { panels.push({element:this,id:root.$(this).val()}); });
            root.$("#null-double-context [data-double-field=setID]").each(function() { partners.push({element:this,id:root.$(this).val()}); });
            var removed = new Set(api.clearSavedSets(root, originalSets));
            root.$("#box-poke-list, #box-poke-list2, #team-poke-list, #trash-box").empty();
            root.$(root.allPokemon("#importedSets")).prop("checked",false);
            root.$(root.allPokemon("#importedSetsOptions")).hide();
            root.$("#null-double-player-imported").prop("checked",false);
            root.loadDefaultLists();
            var available = root.getSetOptions();
            panels.forEach(function(panel) {
                var id = panel.id, deleted = removed.has(id), next = id;
                if (deleted) {
                    var restored = available.some(function(o) { return o.id === id && !o.isCustom; });
                    var species = id.slice(0,id.indexOf(" ("));
                    next = restored ? id : species + " (Blank Set)";
                }
                root.$(panel.element).select2("val",next);
                // Select2 copies the input class onto its container; legacy readers
                // query that class too. Keep the copied selector value consistent.
                root.$(panel.element).closest(".poke-info").find(".set-selector").val(next);
                if (deleted) root.$(panel.element).trigger("change");
            });
            partners.forEach(function(partner) {
                if (removed.has(partner.id)) {
                    if (available.some(function(o) { return o.id === partner.id && !o.isCustom; })) {
                        root.$(partner.element).val(partner.id).trigger("change");return;
                    }
                    // Loading an empty slot resets its old stats/history as well as its selector.
                    root.$(partner.element).val("__empty__").trigger("change").val("").trigger("change");
                }
            });
            if (root.queueBox2SetIdsSync) root.queueBox2SetIdsSync();
            if (root.NullMoveAIUI) root.NullMoveAIUI.refresh();
            return true;
        };
        root.$("#clearSets").off("click").on("click.nullCustomSetImport", root.RemoveAllPokemon);
        // The legacy checkbox assumes exactly two parents; the current panel has more wrappers.
        root.$(root.allPokemon("#importedSets")).off("click").on("click.nullCustomSetImport", function() {
            var panel = root.$(this).closest(".poke-info").attr("id");
            if (!panel) return;
            if (this.checked) root.loadCustomList(panel);
            else root.loadDefaultLists();
        });
    }
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";
    var TABLES = ["SETDEX_SV", "SETDEX_SS", "SETDEX_SM", "SETDEX_XY", "SETDEX_BW",
        "SETDEX_DPP", "SETDEX_ADV", "SETDEX_GSC", "SETDEX_RBY"];
    function own(object, key) { return !!object && Object.prototype.hasOwnProperty.call(object, key); }
    function aliases(species) {
        return species === "Aegislash-Blade" || species === "Aegislash-Shield"
            ? ["Aegislash-Blade", "Aegislash-Shield"] : [species];
    }
    function captureOriginalSets(env) {
        var original = Object.create(null);
        TABLES.forEach(function(table) {
            original[table] = Object.create(null);
            Object.keys(env[table] || {}).forEach(function(species) {
                var records = Object.create(null);
                Object.keys(env[table][species]).forEach(function(name) {
                    if (!env[table][species][name].isCustomSet) records[name] = env[table][species][name];
                });
                original[table][species] = records;
            });
        });
        return original;
    }
    function clearSavedSets(env, original) {
        var saved = {}, removed = new Set();
        // Corrupted storage must not prevent removal of imports still present in memory.
        try { saved = JSON.parse(env.localStorage.customsets || "{}"); } catch (error) {}
        if (!saved || typeof saved !== "object") saved = {};
        Object.keys(saved).forEach(function(species) {
            Object.keys(saved[species] || {}).forEach(function(name) { removed.add(species + " (" + name + ")"); });
        });
        TABLES.forEach(function(table) {
            var dex = env[table] || {};
            Object.keys(dex).forEach(function(species) {
                Object.keys(dex[species]).forEach(function(name) {
                    var entry = dex[species][name], id = species + " (" + name + ")";
                    if (!entry.isCustomSet && !own(saved[species],name)) return;
                    removed.add(id);
                    var shipped = original && original[table] && original[table][species];
                    if (own(shipped,name)) dex[species][name] = shipped[name];
                    else if (entry.isCustomSet || entry.index === undefined) delete dex[species][name];
                });
                if (!Object.keys(dex[species]).length) delete dex[species];
            });
        });
        env.localStorage.removeItem("customsets");
        env.localStorage.removeItem(env.STORAGE_BOX2_SET_IDS || "nullcalc_box2SetIds");
        return Array.from(removed);
    }
    function uniqueName(species, requested, env) {
        var base = String(requested || "Custom Set").trim() || "Custom Set";
        var saved = env.localStorage.customsets ? JSON.parse(env.localStorage.customsets) : {};
        var speciesNames = aliases(species);
        if (env.importMegasAutoIsOn && env.importMegasAutoIsOn() && env.getMegaOtherFormeSpeciesNames)
            speciesNames = speciesNames.concat(env.getMegaOtherFormeSpeciesNames(species));
        function occupied(name) {
            // Blank Set is a generated selector entry; prototype names cannot be object keys here.
            return name === "Blank Set" || name in Object.prototype || speciesNames.some(function(n) {
                return own(saved[n], name) || TABLES.some(function(table) { return own(env[table] && env[table][n], name); });
            });
        }
        var result = base, number = 2;
        while (occupied(result)) result = base + " " + number++;
        return result;
    }
    function header(row, env) {
        var parts = row.split(/[()@]/);
        for (var i = 0; i < parts.length; i++) {
            parts[i] = env.checkExeptions(parts[i].trim());
            if (own(env.calc.SPECIES[9], parts[i]))
                return {name:parts[i], item:env.getItem(parts, i + 1), nickname:i === 1 ? parts[0].trim() : ""};
        }
        return null;
    }
    function importSets(text, name, env) {
        var rows = String(text).replace(/\r/g, "").split("\n"), ids = [];
        for (var i = 0; i < rows.length;) {
            var parsed = header(rows[i], env);
            if (!parsed) { i++; continue; }
            var end = i + 1;
            while (end < rows.length && !header(rows[end], env)) end++;
            var block = rows.slice(i, end);
            // Each individual owns its stats and moves. Never use the species data as scratch storage.
            var poke = {name:parsed.name, item:parsed.item, evs:{}, ivs:{}, isCustomSet:true};
            poke.nameProp = uniqueName(poke.name, parsed.nickname || name, env);
            poke = env.getStats(poke, block, 1);
            poke = env.getMoves(poke, block, 0);
            env.addToDex(poke);
            env.addBoxed(poke);
            env.appendMegaSavesForSpecies(poke);
            ids.push(poke.name + " (" + poke.nameProp + ")");
            i = end;
        }
        if (ids.length) env.$(env.allPokemon("#importedSetsOptions")).css("display", "inline");
        else env.alert("No sets imported, please check your syntax and try again");
        return ids;
    }
    function emptyTrash(env) {
        var trash = env.document.getElementById("trash-box");
        var icons = trash ? Array.from(trash.getElementsByClassName("trainer-pok")) : [];
        if (!icons.length) return;
        if (!env.confirm("Do you really want to remove " + (icons.length > 1 ? icons.length + " Pokémon sets?" : "this Pokémon set?"))) return;
        var saved = env.localStorage.customsets ? JSON.parse(env.localStorage.customsets) : {};
        icons.forEach(function(icon) {
            var id = icon.getAttribute("data-id") || "", marker = id.indexOf(" (");
            if (marker < 0 || !id.endsWith(")")) return;
            var species = id.slice(0, marker), name = id.slice(marker + 2, -1);
            aliases(species).forEach(function(n) {
                if (!own(saved[n], name)) return;
                delete saved[n][name];
                if (!Object.keys(saved[n]).length) delete saved[n];
                env.deleteMovesetFromAllSetdex(n, name);
                var full = n + " (" + name + ")";
                env.document.querySelectorAll("#box-poke-list .trainer-pok, #box-poke-list2 .trainer-pok, #team-poke-list .trainer-pok").forEach(function(el) {
                    if (el.getAttribute("data-id") === full) el.remove();
                });
            });
        });
        trash.innerHTML = "";
        env.localStorage.customsets = JSON.stringify(saved);
        if (env.queueBox2SetIdsSync) env.queueBox2SetIdsSync();
    }
    return {uniqueName:uniqueName, importSets:importSets, emptyTrash:emptyTrash,
        captureOriginalSets:captureOriginalSets, clearSavedSets:clearSavedSets};
});
