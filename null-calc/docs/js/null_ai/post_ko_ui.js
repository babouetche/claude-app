(function(root) {
    "use strict";
    var lastState, lastResult, lastCandidates = [], STORAGE_KEY = "nullcalc_postKO", enabled = true;
    try { enabled = root.localStorage.getItem(STORAGE_KEY) !== "off"; } catch (_) {}
    function ensure() {
        if ($("#null-post-ko").length) return;
        var panel = $("<fieldset>", { id: "null-post-ko", "class": "null-post-ko", "aria-label": "Prochain Pokémon après KO" });
        panel.append($("<legend>").text("Prochain Pokémon après KO"));
        panel.append($("<label>", { "class": "null-post-ko-toggle", for: "null-post-ko-enabled" })
            .append($("<input>", { id: "null-post-ko-enabled", type: "checkbox", checked: enabled }))
            .append(document.createTextNode(" Afficher les suggestions et colorer l’équipe")));
        var body = $("<div>", { id: "null-post-ko-body" });
        body.append($("<p>", { id: "null-post-ko-reference", "class": "null-ai-note" }));
        body.append($("<p>", { id: "null-post-ko-summary", "aria-live": "polite" }));
        body.append($("<p>", { id: "null-post-ko-colour-help", "class": "null-post-ko-legend" }).text("Vert : probabilité d’entrée la plus élevée dans le modèle (égalité possible). Bleu : autre entrant possible. Doré/orange : probabilité indéterminée. × rouge : Pokémon déjà KO, exclu. ≈ : estimation, même en vert. 0 % : non retenu dans ce scénario."));
        body.append($("<div>", { id: "null-post-ko-team" }));
        body.append($("<button>", { type: "button", id: "null-post-ko-reset" }).text("Effacer les KO de cette équipe"));
        body.append($("<p>", { "class": "null-ai-note" }).text("Cliquez sur KO pour marquer un Pokémon, ou faites un clic droit sur son icône. Restaurer retire le marquage ; les PV restent réglables dans les réserves du volet IA."));
        var details = $("<details>", { "class": "null-post-ko-details" }).append($("<summary>").text("Règles et réglages du remplacement"));
        details.append($("<label>", { for: "null-post-ko-immediate" }).append($("<input>", { id: "null-post-ko-immediate", type: "checkbox" }))
            .append(document.createTextNode(" Le remplaçant subit immédiatement une attaque (pivot rapide / Eject Pack)")));
        details.append($("<p>").text("Score maximal, puis ordre de l’équipe en cas d’égalité. Bonus Support : +2 avec 10 % de chance. ≈ indique une estimation ; le mode strict du volet IA masque les probabilités non établies."));
        details.append($("<p>", {id:"null-post-ko-faint-help"}).text("The preview includes the next turn after this KO: Retaliate is boosted to 140; Last Respects and Supreme Overlord include this faint once, plus earlier KO marks or the entered cumulative total. These bonuses do not imply an ordinary switch causes a KO. Other effects of the finishing move are not simulated."));
        details.append($("<p>").text("Le terrain, les hazards, les écrans, les vitesses, Distorsion, les attaques et les PV renseignés sont pris en compte dans le modèle. Les effets du coup qui provoquera le KO ne sont pas simulés : actualisez les PV et le terrain avant de lire la suggestion."));
        details.append($("<ul>", { id: "null-post-ko-assumptions" }));
        details.append($("<a>", { href: root.NullSwitchAI.source, target: "_blank", rel: "noopener noreferrer" }).text("Documentation IA Pokémon Null"));
        body.append(details); panel.append(body); $(".opposing-team-box").after(panel);
    }
    function rowFor(id) { return $("#null-ai-party .null-ai-party-row").filter(function() { return $(this).attr("data-id") === id; }); }
    function marked(candidate) {
        return (candidate.aliases || [candidate.id]).some(function(id) { return opposingMarkedSetIds.has(id); }) || rowFor(candidate.id).find(".null-ai-party-alive").prop("checked") === false;
    }
    function setMark(candidate, dead, preferredID) {
        var aliases = candidate.aliases || [candidate.id];
        aliases.forEach(function(id) { opposingMarkedSetIds.delete(id); });
        // One legacy mark per logical slot prevents a visible base/Mega pair
        // from increasing the old allies-fainted counter twice. Both icons
        // still receive the red cross through the separate decoration class.
        var shown = $(".trainer-pok.right-side").toArray().find(function(icon) { return aliases.indexOf(icon.getAttribute("data-id")) >= 0; });
        if (dead) opposingMarkedSetIds.add(preferredID || (shown && shown.getAttribute("data-id")) || candidate.id);
        rowFor(candidate.id).find(".null-ai-party-alive").prop("checked", !dead);
        candidate.alive = !dead && candidate.hp > 0;
    }
    function colour(candidate, prediction) {
        if (candidate.alive === false || candidate.hp <= 0) return "fainted";
        if (candidate.active || candidate.eligibility === "reserved" || !enabled || !prediction || lastResult.reason !== "ranked") return "";
        if (prediction.probability === null) return "uncertain";
        if (!(prediction.probability > 0)) return "";
        var highest = Math.max.apply(null, lastResult.switch.candidates.map(function(c) { return c.probability || 0; }));
        return prediction.probability === highest ? "likely" : "possible";
    }
    function paintIcons() {
        $(".trainer-pok.right-side").each(function() {
            var icon = $(this), id = icon.attr("data-id"), candidate = lastCandidates.find(function(c) { return (c.aliases || [c.id]).indexOf(id) >= 0; });
            icon.removeClass("null-post-ko-likely null-post-ko-possible null-post-ko-uncertain");
            if (!icon.parent().hasClass("null-post-ko-icon-wrap")) icon.wrap($("<span>", { "class": "null-post-ko-icon-wrap" }));
            if (!candidate) return;
            icon.toggleClass("opponent-marked", opposingMarkedSetIds.has(id));
            icon.toggleClass("null-post-ko-fainted", candidate.alive === false || candidate.hp <= 0);
            var status = colour(candidate, candidate);
            if (status && status !== "fainted") icon.addClass("null-post-ko-" + status);
        });
    }
    function percentage(p) { return (p * 100).toFixed(1).replace(/\.0$/, "") + " %"; }
    function render() {
        ensure(); $("#null-post-ko-body").toggle(enabled);
        if (!lastResult) return;
        lastCandidates = lastResult.candidates;
        var summaries = {
            "incomplete": "État du combat incomplet : suggestion indisponible.",
            "unknown-team": "Choisissez un set de trainer connu à droite pour suggérer le remplaçant.",
            "doubles": "Doubles : les deux créneaux adverses et vos deux Pokémon actifs sont nécessaires. Suggestion indisponible.",
            "no-reserves": "Aucune réserve vivante : aucun remplaçant dans cette équipe.",
            "no-eligible-reserves": "No eligible reserve: remaining Pokémon are reserved or outside this trainer's party slots.",
            "entry-ko": "Toutes les réserves restantes tombent KO sur les hazards : le modèle ne peut pas désigner l’entrant."
        };
        var summary = summaries[lastResult.reason];
        if (!summary) summary = "Après le KO de " + lastResult.opponentName + " — face à " + lastResult.playerName + " — " + lastResult.trainerName;
        $("#null-post-ko-summary").text(summary);
        if(lastResult.reserveOwner)$("#null-post-ko-summary").append($("<small>",{"class":"null-ai-note"}).text("Reserves belong to: "+lastResult.reserveOwner));
        var holder = $("#null-post-ko-team").empty();
        lastCandidates.forEach(function(c) {
            var status = colour(c, c), line = $("<div>", { "class": "null-post-ko-row" + (status ? " null-post-ko-" + status : ""), "data-id": c.id });
            line.append($("<span>", { "class": "null-post-ko-name" }).text((c.partyIndex + 1) + ". " + c.name));
            var description = c.eligibility === "reserved" ? (lastResult.reserveOwner?"Outside this trainer's reserve slots: excluded":"Reserved for the other slot: excluded") : c.eligibility === "partner" ? "Partenaire déjà actif : exclu" : c.eligibility === "active" ? "Actif : KO simulé" : c.eligibility === "fainted" ? "× Déjà KO : exclu" : c.eligibility === "entry-ko" ? "KO sur les hazards" : "Probabilité non établie";
            if (c.eligibility === "candidate" && lastResult.reason === "ranked") {
                description = typeof c.probability === "number" ? (c.probabilityStatus === "estimated" ? "≈ " : "") + percentage(c.probability) + " après KO" : "Probabilité non établie";
                description += " · Score " + (c.scoreStatus === "estimated" ? "≈ " : "") + c.score;
                if (c.scoreRange && c.scoreRange[0] !== c.scoreRange[1]) description += " [" + c.scoreRange[0] + "–" + c.scoreRange[1] + "]";
            }
            var text = $("<small>", { "class": "null-post-ko-score" }).text(description);
            if(c.evaluationForm&&c.evaluationForm!==c.name)line.append($("<small>",{"class":"null-ai-note"}).text("AI reserve form: "+c.evaluationForm));
            text.attr("title", "PV " + c.hp + "/" + c.maxHP + " · Speed " + c.speed + " · Hazards " + (c.entryHazardDamage || 0)); line.append(text);
            var dead = marked(c);
            line.append($("<button>", { type: "button", "class": "null-post-ko-mark", "aria-pressed": String(dead), "aria-label": (dead ? "Restaurer " : "Marquer KO : ") + c.name })
                .text(dead ? "Restaurer" : "KO")); holder.append(line);
        });
        $("#null-post-ko-reset").prop("disabled", !lastCandidates.some(marked));
        var assumptions = $("#null-post-ko-assumptions").empty();
        (lastResult.assumptions || []).forEach(function(a) { assumptions.append($("<li>").text(a)); });
        paintIcons(); if (root.NullAI18n) root.NullAI18n.refresh();
    }
    function refresh(state) {
        lastState = state; ensure();
        var slot=state&&state.context&&state.context.doublesOpponentSlot,playerSlot=state&&state.context&&state.context.doublesPlayerSlot;
        if(playerSlot===undefined)playerSlot=slot;
        $("#null-post-ko-reference").text(state&&state.field.gameType==="Doubles"&&state.context.doublesComplete
            ? "Doubles replacement: AI slot "+(slot+1)+" is evaluated against player slot "+(playerSlot+1)+" ("+state.player.name+"). The other active opponent is excluded. Battle HP stays unchanged."
            : state&&state.field.gameType==="Doubles" ? "Doubles: complete both active sides to identify the replacement's matching player slot."
            : "Simule le KO de l’adversaire affiché à droite face à votre Pokémon actuellement affiché à gauche. Les PV du combat restent inchangés.");
        lastResult = root.NullPostKO.predict(state, { immediateDamage: $("#null-post-ko-immediate").prop("checked") }); render();
    }
    function recalculate() {
        paintIcons();
        // Preserve the original calculator's count and damage mechanics.
        if (typeof syncAlliesFaintedFromOpponentMarks === "function") syncAlliesFaintedFromOpponentMarks();
        if (root.NullMoveAIUI) root.NullMoveAIUI.refresh();
    }
    $(document).on("click.nullPostKO", ".null-post-ko-mark", function() {
        var id = $(this).closest(".null-post-ko-row").attr("data-id"), c = lastCandidates.find(function(c) { return c.id === id; });
        if (!c) return; setMark(c, !marked(c)); recalculate();
    });
    $(document).on("click.nullPostKO", "#null-post-ko-reset", function() { lastCandidates.forEach(function(c) { setMark(c, false); }); recalculate(); });
    $(document).on("change.nullPostKO", "#null-post-ko-enabled", function() {
        enabled = this.checked; try { root.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off"); } catch (_) {} render();
    });
    $(document).on("change.nullPostKO", "#null-post-ko-immediate", function() { if (lastState) refresh(lastState); });
    // Prepare shared reserve controls before the unchanged legacy right-click
    // handler toggles the icon and triggers calculations. This makes restore
    // reversible even after the reserve checkbox was synchronized to a KO.
    document.addEventListener("contextmenu", function(event) {
        var icon = event.target.closest && event.target.closest(".trainer-pok.right-side"); if (!icon) return;
        var id = icon.getAttribute("data-id"), c = lastCandidates.find(function(c) { return (c.aliases || [c.id]).indexOf(id) >= 0; });
        if (c) {
            var wasDead = marked(c);
            setMark(c, !wasDead, id); paintIcons();
            icon.classList.toggle("opponent-marked", wasDead);
        }
    }, true);
    document.addEventListener("change", function(event) {
        if (!event.target.matches("#null-ai-party .null-ai-party-alive")) return;
        var id = event.target.closest(".null-ai-party-row").getAttribute("data-id"), c = lastCandidates.find(function(c) { return c.id === id; });
        if (c) setMark(c, !event.target.checked);
    }, true);
    $(document).on("change.nullPostKO", "#null-ai-party .null-ai-party-alive", recalculate);
    root.NullPostKOUI = { refresh: refresh, clear: function() { $("#null-post-ko").remove(); lastState = lastResult = null; lastCandidates = []; $(".trainer-pok.right-side").removeClass("null-post-ko-likely null-post-ko-possible null-post-ko-uncertain null-post-ko-fainted"); },
        getLastResult: function() { return lastResult; } };
})(window);
