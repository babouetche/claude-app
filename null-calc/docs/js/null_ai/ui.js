(function(root) {
    "use strict";
    var lastEnemyKey, lastEnemyIdentity, lastPlayerKey, lastPartyKey, lastFaintTrainer, lastResult;
    var FACTS = [
        ["playerConfused", "Joueur confus", "null-ai-player-confused"], ["playerInfatuated", "Joueur sous Attraction", "null-ai-player-infatuated"],
        ["playerIncapacitated", "Joueur incapable d’attaquer ce tour"], ["playerSubstitute", "Joueur derrière un Clonage"],
        ["opponentSubstitute", "IA derrière un Clonage"], ["opponentInfatuated", "IA sous Attraction"], ["opponentTransformed", "IA déjà transformée (Zen / Power Construct)"],
        ["opponentPositivePass", "IA peut relayer un effet favorable"], ["opponentWakeupTurn", "IA se réveille ce tour"], ["futureSightActive", "Prescience / Vœu Destructeur déjà en attente"], ["playerSaltCured", "Joueur sous Salaison"],
        ["opponentTypeChanged", "IA a déjà changé de type"], ["resistsPlayerLastMove", "IA résiste à la dernière attaque du joueur"],
        ["opponentLeechSeeded", "IA sous Vampigraine"], ["playerLeechSeeded", "Joueur sous Vampigraine"],
        ["opponentWrapped", "IA sous piège à dégâts"], ["playerWrapped", "Joueur sous piège à dégâts"],
        ["opponentTrapped", "IA incapable de changer de Pokémon"], ["opponentRooted", "IA enracinée (Ingrain)"],
        ["abilityPreventsEscape", "Un talent empêche la fuite de l’IA"], ["commanderActive", "Commander actif : switch interdit"], ["playerSemiInvulnerable", "Cible dans un tour semi-invulnérable"],
        ["opponentCursed", "IA sous Malédiction spectre"], ["playerCursed", "Joueur sous Malédiction spectre"],
        ["opponentPerishSong", "IA sous Requiem"], ["playerPerishSong", "Joueur sous Requiem"],
        ["opponentYawn", "IA sous Bâillement"], ["playerYawn", "Joueur sous Bâillement"],
        ["playerTrapped", "Joueur incapable de changer de Pokémon"], ["opponentEndTurnFaint", "IA condamnée au KO en fin de tour"],
        ["opponentDefenseCurl", "IA a utilisé Boul’Armure"], ["protectionLastTurn", "IA a réussi une protection au tour précédent"],
        ["lockOn", "IA a verrouillé sa cible"], ["moveImmediate", "L’attaque retardée frappe immédiatement"]
    ];
    function active() { return gen === 9; }
    function group() { return $("[aria-labelledby=resultHeaderR]"); }
    function row(parent, label, id, element) {
        var line = $("<div>", { "class": "null-ai-control-row" });
        line.append($("<label>", { for: id }).text(label)); line.append(element.attr("id", id)); parent.append(line); return element;
    }
    function select(parent, label, id, options) {
        var element = $("<select>"); options.forEach(function(option) { element.append($("<option>", { value: option[0] }).text(option[1])); });
        return row(parent, label, id, element);
    }
    function check(parent, key, label, id) {
        var line = $("<label>", { "class": "null-ai-condition", for: id || "null-ai-fact-" + key });
        line.append($("<input>", { type: "checkbox", id: id || "null-ai-fact-" + key, "data-fact": key }));
        line.append(document.createTextNode(" " + label)); parent.append(line);
    }
    function triState(parent, label, id) { return select(parent, label, id, [["", "Automatique"], ["true", "Oui"], ["false", "Non"]]); }
    function section(label, open) { var details = $("<details>", { "class": "null-ai-subsection", open: !!open }); details.append($("<summary>").text(label)); return details; }
    function note(parent, text) { parent.append($("<p>", { "class": "null-ai-note" }).text(text)); }
    function ensureElements() {
        group().parent().addClass("null-ai-enabled");
        for (var i = 1; i <= 4; i++) {
            var move = $("#resultMoveR" + i), moveRow = move.parent(); moveRow.addClass("null-ai-row");
            if (!$("#nullAiPickR" + i).length) moveRow.append($("<small>", { id: "nullAiPickR" + i, "class": "null-ai-probability", tabindex: 0 }));
            move.attr("aria-describedby", "resultDamageR" + i + " nullAiPickR" + i);
        }
        if ($("#null-ai-context").length) return;
        group().append($("<p>", { id: "null-ai-action-summary", "class": "null-ai-action-summary", "aria-live": "polite" }));
        group().append($("<div>", { id: "null-ai-switch-destination", "class": "null-ai-switch-destination", "aria-live": "polite" }));
        var details = $("<details>", { id: "null-ai-context", "class": "null-ai-context" });
        details.append($("<summary>").text("IA : probabilités, switch et état du combat"));
        details.append($("<p>", { id: "null-ai-colour-help", "class": "null-ai-note" }).text("Probabilités IA : bleu = probabilité établie dans le modèle ; doré = estimation (≈) ou probabilité indéterminée, selon le texte affiché. « Indéterminé » signifie que le calculateur ne peut pas chiffrer le choix, pas 0 %. La couleur indique le niveau de certitude du modèle."));
        note(details, "≈ indique une estimation avec les hypothèses affichées ci-dessous. Le mode strict affiche uniquement les probabilités établies. Si l’équipe adverse est connue, les probabilités des attaques incluent le risque de switch.");
        select(details, "Calcul des probabilités", "null-ai-mode", [["estimate", "Estimation documentée (recommandé)"], ["strict", "Strict : probabilités établies uniquement"]]);
        var switches = section("Switch : scénario et Pokémon entrant", true);
        select(switches, "Action de l’IA", "null-ai-switch-scenario", [["auto", "Automatique : règles du trainer"], ["no-switch", "No switch : l’IA reste"], ["guaranteed", "Guaranteed switch-in : switch imposé"], ["post-ko", "Post-KO : remplacement forcé"], ["probably", "Probably switch : probabilité personnalisée"]]);
        row(switches, "Probabilité supposée de switch (%)", "null-ai-switch-percent", $("<input>", { type: "number", min: 0, max: 100, step: 1, value: 50 })).parent().attr("id", "null-ai-custom-switch-row").hide();
        select(switches, "Pokémon du joueur affiché à gauche", "null-ai-player-action", [["stay", "Pokémon déjà actif"], ["switch-in", "Switch into : Pokémon que je fais entrer"]]);
        switches.append($("<p>", { id: "null-ai-switch-into-note", "class": "null-ai-note" }).text("Sélectionnez Switch into AVANT de choisir votre Pokémon entrant à gauche. Les dégâts se recalculent sur l’entrant ; les probabilités IA restent basées sur le Pokémon actif mémorisé.").hide());
        row(switches, "Tours consécutifs de l’IA en jeu", "null-ai-turns-active", $("<input>", { type: "number", min: 1, max: 999, value: 1 }));
        check(switches, "perishNextTurn", "L’IA tombe KO par Requiem ce tour"); check(switches, "immediateSwitchDamage", "Le candidat subit immédiatement une attaque en entrant (pivot rapide / Eject Pack)");
        triState(switches, "Toutes les attaques de l’IA sont inutiles", "null-ai-all-useless"); triState(switches, "Climat / terrain de l’IA expiré", "null-ai-weather-faded");
        select(switches, "Routine Immunity AI applicable", "null-ai-immunity-trigger", [["", "Automatic: last move and reserve abilities"], ["true", "Verify the entered immunity scenario"], ["false", "Non"]]);
        note(switches, "Immunity switches use the reserve's ability and the player's last move, after the other switch attempts. The active Pokémon already having that immunity prevents this routine.");
        select(switches, "Reserve already chosen for the other opposing slot", "null-ai-reserved-party", [["", "None"]]);
        row(switches, "Total allied faints (optional, includes revivals)", "null-ai-faint-count", $("<input>", {type:"number",min:0,max:100,step:1,placeholder:"Auto"}));
        note(switches, "Leave empty to count KO marks and 0 HP. After revivals, enter the cumulative total for Last Respects and Supreme Overlord. The post-KO preview adds the simulated KO once.");
        switches.append($("<p>", {id:"null-ai-faint-snapshot-note","class":"null-ai-note"}).text("Faint history changed: the displayed Pokémon is now the active reference. Choose Switch into again to capture a new scenario.").hide());
        switches.append($("<div>", { id: "null-ai-party" })); switches.append($("<p>", { id: "null-ai-switch-reason", "aria-live": "polite" })); details.append(switches);
        note(switches,"Reserve scores use the form stored in the trainer's party before entry transformations, including most Mega Evolutions. The active Pokémon keeps its selected form.");
        var moveDetails = section("Attaques disponibles et PP", true);
        for (var j = 1; j <= 4; j++) {
            var line = $("<p>", { "class": "null-ai-state-row" }); line.append($("<label>", { for: "null-ai-pp-" + j }).text("Attaque " + j + " — PP "));
            line.append($("<input>", { id: "null-ai-pp-" + j, type: "number", min: 0, max: 64, placeholder: "?", "aria-label": "PP restants de l’attaque " + j }));
            var usable = $("<label>", { "class": "null-ai-usable-label" }).text(" Disponible "); usable.append($("<input>", { id: "null-ai-usable-" + j, type: "checkbox", checked: true })); line.append(usable);
            var used = $("<label>", { "class": "null-ai-used-label" }).text(" Tentée depuis l’entrée "); used.append($("<input>", { id: "null-ai-used-" + j, type: "checkbox" })); line.append(used); moveDetails.append(line);
        }
        moveDetails.append($("<p>", {id:"null-ai-last-resort-help","class":"null-ai-note"}).text("Last Resort : cochez chaque autre attaque réellement tentée depuis l’entrée en jeu, même si elle a échoué. Un switch réinitialise cet historique. Les dégâts affichés supposent Last Resort débloqué ; les probabilités tiennent compte de cet historique."));
        moveDetails.append($("<button>", {id:"null-ai-reset-attempts",type:"button"}).text("Réinitialiser les tentatives : nouvelle entrée"));
        var lockOptions = [["", "Aucune"]]; for (var k = 0; k < 4; k++) lockOptions.push([k, "Attaque " + (k + 1)]);
        select(moveDetails, "Attaque imposée (Choice / Encore)", "null-ai-lock", lockOptions); details.append(moveDetails);
        var history = section("Historique et effets temporaires");
        note(history, "For Rage Fist, Stomping Tantrum and consecutive-use attacks, enter the appropriate move power manually. KO marks do not record hits taken, failed moves or consecutive turns. Retaliate on the active Pokémon also needs its current power entered manually.");
        var room = $("<label>", { "class": "null-ai-condition", for: "null-ai-trick-room" }); room.append($("<input>", { id: "null-ai-trick-room", type: "checkbox", checked:!!$("#trickroom").prop("checked") })); room.append(document.createTextNode(" Distorsion active")); history.append(room);
        note(history,"Trick Room is synchronized with the Field panel. Lower Speed moves first at equal priority; speed ties and move priorities are unchanged.");
        select(history, "Pics Toxik côté joueur", "null-ai-player-toxic-spikes", [[0, "Aucun"], [1, "1 couche"], [2, "2 couches"]]);
        select(history, "Pics Toxik côté IA", "null-ai-opponent-toxic-spikes", [[0, "Aucun"], [1, "1 couche"], [2, "2 couches"]]);
        check(history, "playerStickyWeb", "Toile Gluante côté joueur"); check(history, "opponentStickyWeb", "Toile Gluante côté IA");
        note(history, "Par défaut : premier tour, aucun effet temporaire coché, aucune protection précédente, attaques disponibles et réserves vivantes à 100 %. Renseignez ce qui a changé ; ces réglages ne modifient pas les données des trainers.");
        var grid = $("<div>", { "class": "null-ai-facts-grid" }); FACTS.forEach(function(fact) { check(grid, fact[0], fact[1], fact[2]); }); history.append(grid);
        row(history, "Protections réussies d’affilée", "null-ai-protection-streak", $("<input>", { type: "number", min: 0, max: 10, value: 0 }));
        row(history, "Stockpile : charges de l’IA", "null-ai-stockpile", $("<input>", { type: "number", min: 0, max: 3, value: 0 }));
        row(history, "Dernière attaque du joueur", "null-ai-last-player-move", $("<input>", { type: "text", placeholder: "ex. Surf", autocomplete: "off" }));
        row(history, "Dernière attaque de l’IA", "null-ai-last-opponent-move", $("<input>", { type: "text", placeholder: "ex. Protect", autocomplete: "off" }));
        row(history, "Player move predicted by the AI (copy moves)", "null-ai-predicted-player-move", $("<input>", { type: "text", placeholder: "Auto / ex. Bubble Beam", autocomplete: "off" }));
        select(history, "Can this predicted move be copied?", "null-ai-copy-eligibility", [["", "Automatic estimate"], ["allowed", "Confirmed allowed"], ["banned", "Confirmed banned"]]);
        note(history, "Mirror Move, Copycat and Me First evaluate the predicted move, not the last move used. Auto assumes the target's strongest available move; unverified prediction and copy restrictions are marked as estimates.");
        select(history, "Trainer item for this turn", "null-ai-trainer-item", [["unknown", "Unknown inventory (assume no item)"], ["none", "No usable trainer item"], ["confirmed", "Confirmed item use this turn"]]);
        triState(history, "Joueur : dernier Pokémon vivant", "null-ai-player-last-mon"); triState(history, "IA : dernier Pokémon vivant", "null-ai-opponent-last-mon"); details.append(history);
        var assumptions = section("Règles appliquées et hypothèses"); assumptions.append($("<p>", { id: "null-ai-reason", "aria-live": "polite" })); assumptions.append($("<ul>", { id: "null-ai-assumptions" }));
        assumptions.append($("<a>", { href: root.NullMoveAI.source, target: "_blank", rel: "noopener noreferrer" }).text("Documentation IA Pokémon Null")); details.append(assumptions); group().append(details);
    }
    function clear() {
        if (root.NullDoubleUI) root.NullDoubleUI.clear();
        if (root.NullPostKOUI) root.NullPostKOUI.clear();
        group().parent().removeClass("null-ai-enabled"); $(".null-ai-probability, #null-ai-context, #null-ai-action-summary, #null-ai-switch-destination").remove(); $(".null-ai-row").removeClass("null-ai-row");
        for (var i = 1; i <= 4; i++) $("#resultMoveR" + i).attr("aria-describedby", "resultDamageR" + i);
        lastEnemyKey = lastPlayerKey = lastEnemyIdentity = lastPartyKey = lastFaintTrainer = lastResult = null;
        root.NullBattleStore.resetReference("single"); root.NullBattleStore.cancel("ui"); root.NullBattleStore.invalidate();
    }
    function booleanChoice(id) { var value = $(id).val(); return value === "" ? undefined : value === "true"; }
    function overrides(results) {
        var faintTrainer = getTrainerNameFromSet($("#p2 .set-selector").val() || "");
        if (faintTrainer !== lastFaintTrainer) { $("#null-ai-faint-count").val(""); $("#null-ai-faint-snapshot-note").hide(); lastFaintTrainer = faintTrainer; }
        var playerKey = $("#p1 .set-selector").val() + ":" + results[0][0].attacker.name;
        if (playerKey !== lastPlayerKey) { if ($("#null-ai-player-action").val() !== "switch-in") { $("#null-ai-context [data-fact^=player]").prop("checked", false); $("#null-ai-predicted-player-move, #null-ai-copy-eligibility").val(""); } lastPlayerKey = playerKey; }
        var identity = $("#p2 .set-selector").val() + ":" + results[1][0].attacker.name, key = identity + ":" + results[1].map(function(r) { return r.move.originalName; }).join("|");
        if (identity !== lastEnemyIdentity) {
            root.NullBattleStore.resetReference("single");
            $("#null-ai-player-action").val("stay"); $("#null-ai-all-useless, #null-ai-weather-faded, #null-ai-immunity-trigger, #null-ai-opponent-last-mon").val("");
            $("#null-ai-turns-active").val(1); $("#null-ai-protection-streak, #null-ai-stockpile").val(0);
            $("#null-ai-context [data-fact^=opponent], #null-ai-context [data-fact=perishNextTurn], #null-ai-context [data-fact=protectionLastTurn]").prop("checked", false);
            $("#null-ai-last-opponent-move, #null-ai-reserved-party").val(""); $("#null-ai-trainer-item").val("unknown"); lastEnemyIdentity = identity;
            $("#null-ai-context input[id^=null-ai-used-]").prop("checked",false);
        }
        if (key !== lastEnemyKey) { $("#null-ai-context input[id^=null-ai-pp-], #null-ai-lock").val(""); $(".null-ai-usable-label input").prop("checked", true); $("#null-ai-context input[id^=null-ai-used-]").prop("checked",false); lastEnemyKey = key; }
        var hasLastResort = results[1].some(function(r) { return (r.move.originalName || r.move.name) === "Last Resort"; });
        $(".null-ai-used-label, #null-ai-last-resort-help, #null-ai-reset-attempts").toggle(hasLastResort);
        var moves = [], context = {}, party = {};
        for (var i = 1; i <= 4; i++) { var value = $("#null-ai-pp-" + i).val(), moveName = results[1][i-1].move.originalName || results[1][i-1].move.name;
            if ($("#null-ai-last-opponent-move").val().trim() === moveName && moveName !== "(No Move)") $("#null-ai-used-"+i).prop("checked",true);
            $("#null-ai-used-"+i).prop("disabled",moveName === "(No Move)");
            moves.push({ usable: $("#null-ai-usable-" + i).prop("checked"), pp: value === "" ? undefined : Number(value), usedSinceEntry: $("#null-ai-used-"+i).prop("checked") }); }
        $("#null-ai-context [data-fact]").each(function() { context[$(this).attr("data-fact")] = $(this).prop("checked"); });
        ["playerLeechSeeded", "opponentLeechSeeded", "playerSaltCured"].forEach(function(key) { if (!context[key]) delete context[key]; });
        var lock = $("#null-ai-lock").val(), turns = Math.max(1, Number($("#null-ai-turns-active").val()) || 1);
        if (turns === 1 && moves.some(function(m) { return m.usedSinceEntry; })) { turns = 2; $("#null-ai-turns-active").val(2); }
        Object.assign(context, { forcedMoveSlot: lock === "" ? undefined : Number(lock), calculationMode: $("#null-ai-mode").val(), switchScenario: $("#null-ai-switch-scenario").val(),
            assumedSwitchProbability: Math.max(0, Math.min(100, Number($("#null-ai-switch-percent").val()))) / 100, playerAction: $("#null-ai-player-action").val(), opponentTurnsActive: turns, turnInBattle: turns, opponentFirstTurn: turns === 1,
            allMovesUseless: booleanChoice("#null-ai-all-useless"), weatherFaded: booleanChoice("#null-ai-weather-faded"), immunitySwitchTrigger: booleanChoice("#null-ai-immunity-trigger"),
            opponentLastMon: booleanChoice("#null-ai-opponent-last-mon"), playerLastMon: booleanChoice("#null-ai-player-last-mon"), protectionStreak: Number($("#null-ai-protection-streak").val()) || 0,
            opponentStockpile: Number($("#null-ai-stockpile").val()) || 0, playerLastMove: $("#null-ai-last-player-move").val().trim(), opponentLastMove: $("#null-ai-last-opponent-move").val().trim(),
            predictedPlayerMove: $("#null-ai-predicted-player-move").val().trim(), copyEligibility: $("#null-ai-copy-eligibility").val(),
            trainerItemScenario: $("#null-ai-trainer-item").val(), reservedPartyIds: $("#null-ai-reserved-party").val() ? [$("#null-ai-reserved-party").val()] : [] });
        context.playerToxicSpikes = Number($("#null-ai-player-toxic-spikes").val()); context.opponentToxicSpikes = Number($("#null-ai-opponent-toxic-spikes").val());
        var faintCount = $("#null-ai-faint-count").val();
        if (faintCount !== "") context.opponentFaintCount = Number(faintCount);
        $("#null-ai-party .null-ai-party-row").each(function() {
            var hpInput = $(this).find(".null-ai-party-hp"), value = Math.max(0, Math.min(100, Number(hpInput.val())));
            var entry = { alive: $(this).find(".null-ai-party-alive").prop("checked") };
            if (hpInput.attr("data-actual-hp") !== undefined && Number(hpInput.attr("data-displayed-percent")) === value) entry.hp = Number(hpInput.attr("data-actual-hp"));
            else entry.hpPercent = value;
            party[$(this).attr("data-id")] = entry;
        });
        $("#null-ai-custom-switch-row").toggle(context.switchScenario === "probably"); $("#null-ai-switch-into-note").toggle(context.playerAction === "switch-in");
        return { moves: moves, context: context, party: party };
    }
    function renderParty(party) {
        var holder = $("#null-ai-party"), candidates = party && party.candidates || [], key = candidates.map(function(c) { return c.id; }).join("|");
        if (!party || !party.complete) { holder.empty(); note(holder, "Équipe inconnue : sélectionnez un set de trainer à droite pour identifier les réserves et leur ordre."); (party && party.assumptions || []).forEach(function(a) { note(holder, a); }); lastPartyKey = null; return; }
        if (key !== lastPartyKey) {
            var reserved=$("#null-ai-reserved-party").empty().append($("<option>",{value:""}).text("None"));
            candidates.forEach(function(c) { reserved.append($("<option>",{value:c.id}).text(c.name)); });
            holder.empty().append($("<p>", { "class": "null-ai-party-title" }).text("Réserves : " + (party.trainerName || "équipe sélectionnée")));
            candidates.forEach(function(c, i) {
                var line = $("<div>", { "class": "null-ai-party-row", "data-id": c.id }), alive = $("<input>", { id: "null-ai-party-alive-" + i, "class": "null-ai-party-alive", type: "checkbox", checked: c.alive !== false });
                line.append($("<label>", { for: alive.attr("id") }).append(alive).append(document.createTextNode(" " + (i + 1) + ". " + c.name)));
                line.append($("<label>", { for: "null-ai-party-hp-" + i }).text(" PV % ")); line.append($("<input>", { id: "null-ai-party-hp-" + i, "class": "null-ai-party-hp", type: "number", min: 0, max: 100, value: 100, "aria-label": "PV restants en pourcentage de " + c.name }));
                line.append($("<small>", { "class": "null-ai-party-score" })); holder.append(line);
            }); lastPartyKey = key;
        }
        candidates.forEach(function(c) { holder.find(".null-ai-party-row").filter(function() { return $(this).attr("data-id") === c.id; }).attr("data-active", String(!!c.active)).each(function() {
            $(this).find("input").prop("disabled", !!c.active); $(this).find(".null-ai-party-alive").prop("checked", c.alive !== false);
            if (c.active) {
                var percent = Math.round(c.hp * 1000 / c.maxHP) / 10;
                $(this).find(".null-ai-party-hp").val(percent).attr("data-actual-hp", c.hp).attr("data-displayed-percent", percent);
                $(this).find(".null-ai-party-score").text("Actif");
            } else $(this).find(".null-ai-party-score").text($("#null-ai-reserved-party").val()===c.id?"Reserved for the other slot: excluded":"");
        }); });
    }
    function percentage(p) { return (p * 100).toFixed(1).replace(/\.0$/, "") + " %"; }
    function renderDestination(switchResult) {
        var holder = $("#null-ai-switch-destination").empty();
        if (switchResult && switchResult.probability === 0) { holder.text("Aucun switch prévu."); return; }
        if (!switchResult || !switchResult.partyComplete) { holder.text("Destination inconnue : équipe de trainer à sélectionner."); return; }
        var trainer = switchResult.trainerName ? " — " + switchResult.trainerName : "";
        var candidates = (switchResult.candidates || []).filter(function(c) { return c.probability === null || c.probability > 0; }).sort(function(a, b) {
            return (typeof b.probability === "number" ? b.probability : -1) - (typeof a.probability === "number" ? a.probability : -1) || a.partyIndex - b.partyIndex;
        });
        if (!candidates.length) { holder.text(switchResult.status === "unavailable" && switchResult.reasons && switchResult.reasons.length ? switchResult.reasons.join(" ") : "Aucune destination disponible" + trainer + "."); return; }
        if (candidates.some(function(c) { return typeof c.probability !== "number"; })) {
            holder.append($("<p>").text("Destinations possibles" + trainer + " : probabilités non établies."));
            var possible = $("<ul>"); candidates.forEach(function(c) {
                possible.append($("<li>").text(c.name + " — score possible " + c.scoreRange[0] + " à " + c.scoreRange[1]));
            }); holder.append(possible); return;
        }
        var heading = switchResult.probability === null ? "Destinations si switch" : candidates.length === 1 ? "Destination prévue" : "Destinations prévues";
        holder.append($("<p>").text(heading + trainer + " :"));
        var list = $("<ul>"); candidates.forEach(function(c) {
            var estimated = (c.probabilityStatus || c.status) === "estimated", line = c.name + " — " + (estimated ? "≈ " : "") + percentage(c.probability) + " si switch";
            if (typeof switchResult.probability === "number" && switchResult.probability > 0 && switchResult.probability < 1 && typeof c.switchActionProbability === "number") {
                line += " (" + (estimated || switchResult.probabilityStatus === "estimated" ? "≈ " : "") + percentage(c.switchActionProbability) + " du tour)";
            }
            list.append($("<li>").text(line));
        }); holder.append(list);
    }
    function render(moveResult, switchResult) {
        var action = root.NullSwitchAI && switchResult ? root.NullSwitchAI.composeActionProbabilities(moveResult, switchResult) : moveResult;
        lastResult = Object.assign({}, moveResult, { status: action.status, moves: action.moves, scope: action.scope || moveResult.scope, switch: switchResult, itemProbability:action.itemProbability,
            assumptions:Array.from(new Set((moveResult.assumptions||[]).concat(action.assumptions||[]))) });
        var estimated = action.status === "estimated", explanation = (moveResult.reasons || []).join(" ");
        action.moves.forEach(function(m, i) {
            var known = typeof m.probability === "number", pct = known ? (estimated && m.probability > 0 ? "≈ " : "") + percentage(m.probability) : "indéterminé";
            var scope = action.scope === "conditional-no-item" ? "Probability assuming no trainer item is used, switching included when known. " : action.scope === "all-actions" ? "Probabilité de cette action, switch compris. " : "Probabilité parmi les attaques, si l’IA attaque. ";
            $("#nullAiPickR" + (i + 1)).text("IA: " + pct).toggleClass("null-ai-unavailable", !known).toggleClass("null-ai-estimated", estimated && known).attr("title", scope + (known ? (m.rules || []).join("; ") : explanation)).attr("aria-label", m.move + " : " + scope + pct);
        });
        var p = switchResult && switchResult.probability, text = "Switch : contexte à compléter. Probabilités affichées parmi les attaques.";
        if (typeof p === "number") text = (p === 1 ? "Guaranteed switch-in" : p === 0 ? "No switch" : "Probably switch") + " : " + (switchResult.probabilityStatus === "estimated" ? "≈ " : "") + percentage(p) + " — " + switchResult.rule;
        if(action.itemProbability>0) text+=" · Trainer item: "+percentage(action.itemProbability);
        $("#null-ai-action-summary").text(text).toggleClass("null-ai-estimated", switchResult && switchResult.status === "estimated"); $("#null-ai-switch-reason").text(switchResult ? (switchResult.reasons || []).join(" ") : "");
        renderDestination(switchResult);
        (switchResult && switchResult.candidates || []).forEach(function(c) { $("#null-ai-party .null-ai-party-row").filter(function() { return $(this).attr("data-id") === c.id; }).find(".null-ai-party-score").text("Score " + ((c.scoreStatus || c.status) === "estimated" ? "≈ " : "") + c.score + "; switch into : " + (typeof c.probability === "number" ? ((c.probabilityStatus || c.status) === "estimated" ? "≈ " : "") + percentage(c.probability) : "indéterminé") + " si switch"); });
        $("#null-ai-reason").text(explanation || "Les pourcentages de dégâts restent indépendants des probabilités de choix. Les égalités de choix d’attaque sont départagées uniformément.");
        var assumptions = Array.from(new Set((moveResult.assumptions || []).concat(switchResult && switchResult.assumptions || [],action.assumptions||[]))); $("#null-ai-assumptions").empty(); assumptions.forEach(function(a) { $("#null-ai-assumptions").append($("<li>").text(a)); });
    }
    function refresh(results) {
        root.NullBattleStore.cancel("ui");
        if (!active()) { clear(); return; } ensureElements(); results = results || (typeof damageResults !== "undefined" ? damageResults : null); if (!results || !results[0] || !results[1]) { if (root.NullAI18n) root.NullAI18n.refresh(); return; }
        var controls = overrides(results);
        try {
            var state = root.NullMoveAIState.readBattleState(results, controls);
            if (state.field.gameType === "Doubles" && root.NullDoubleUI) {
                var doubles = root.NullDoubleUI.refresh(results, controls, state);
                renderParty(doubles.party);
                if (root.NullPostKOUI) root.NullPostKOUI.refresh(doubles.postKOState);
                render(doubles.moves, doubles.switchResult);
                if (root.NullAI18n) root.NullAI18n.refresh();
                return;
            }
            if (root.NullDoubleUI) root.NullDoubleUI.hide();
            renderParty(state.party);
            // Post-KO replacement evaluates the Pokémon currently displayed on
            // the left, before the optional mid-turn Switch into snapshot.
            if (root.NullPostKOUI) root.NullPostKOUI.refresh(state);
            var reference = root.NullBattleStore.reference("single", lastEnemyIdentity, root.NullFaintContext.historyKey(state), state, controls.context.playerAction === "switch-in");
            if (reference.reason === "history") {
                controls.context.playerAction = state.context.playerAction = "stay";
                $("#null-ai-player-action").val("stay"); $("#null-ai-faint-snapshot-note").show();
            }
            if (controls.context.playerAction === "switch-in") {
                if (reference.frozen) {
                    state = reference.state; state.context = Object.assign({}, state.context, controls.context);
                    state.opponent.moves.forEach(function(move, i) { Object.assign(move, controls.moves[i]); });
                    var rebuiltParty=state.rebuildFrozenParty&&state.rebuildFrozenParty(controls);
                    if(rebuiltParty)state.party=rebuiltParty;
                    $("#null-ai-switch-into-note").text("Pokémon actif mémorisé : " + state.player.name + ". Dégâts sur l’entrant affiché à gauche ; décisions IA basées sur " + state.player.name + ". Revenez à Pokémon déjà actif pour actualiser la référence.");
                }
            } else { $("#null-ai-switch-into-note").text("Sélectionnez Switch into AVANT de choisir votre Pokémon entrant à gauche. Les dégâts se recalculent sur l’entrant ; les probabilités IA restent basées sur le Pokémon actif mémorisé."); }
            render(root.NullMoveAI.getNullAIMoveProbabilities(state), root.NullSwitchAI && root.NullSwitchAI.getSwitchProbabilities(state));
        }
        catch (err) { if (root.NullDoubleUI) root.NullDoubleUI.invalidate(); if (root.NullPostKOUI) root.NullPostKOUI.refresh(null); render({ status: "unavailable", reasons: [err.message], moves: results[1].map(function(r, i) { var name = r.move.originalName || r.move.name; return { move: name, probability: name === "(No Move)" || controls.moves[i].pp === 0 || controls.moves[i].usable === false || (controls.context.forcedMoveSlot !== undefined && controls.context.forcedMoveSlot !== i) ? 0 : null }; }) }); }
        if (root.NullAI18n) root.NullAI18n.refresh();
    }
    function requestRefresh() { root.NullBattleStore.schedule("ui", function() { refresh(); }); }
    root.NullMoveAIUI = { refresh: refresh, requestRefresh:requestRefresh, getLastResult: function() { return lastResult; } };
    $(document).on("click.nullMoveAI", "#null-ai-reset-attempts", function() { $("#null-ai-context input[id^=null-ai-used-]").prop("checked",false); $("#null-ai-last-opponent-move").val(""); $("#null-ai-turns-active").val(1); refresh(); });
    $(document).on("change.nullMoveAI", "#null-ai-context input[id^=null-ai-used-]", function() { if (this.checked && Number($("#null-ai-turns-active").val()) === 1) $("#null-ai-turns-active").val(2); });
    $(document).on("input.nullMoveAI change.nullMoveAI", "#null-ai-context input, #null-ai-context select", requestRefresh);
    $(document).on("input.nullMoveAI", "#p1 .current-hp, #p2 .current-hp, #p1 .percent-hp, #p2 .percent-hp", function() { if (active()) $(this).trigger("keyup"); });
})(window);
