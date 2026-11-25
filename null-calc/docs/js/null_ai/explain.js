// Explications en français des probabilités de l'IA (« Pourquoi ces % ? »).
// N'invente aucune règle : affiche les scores calculés par core.js
// (getTargetScoreDistributions) et les traces des règles réellement appliquées.
(function(root, factory) {
    "use strict";
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.NullAIExplain = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";

    var FAMILIES = {
        "Damaging Moves": "Attaque offensive", "Summary": "Règle générale", "Offensive Setup": "Boost offensif",
        "Defensive Setup": "Boost défensif", "Speed Setup": "Boost de Vitesse", "Evasion Setup": "Boost d'esquive",
        "Risky setup": "Boost risqué", "Priority": "Attaque prioritaire", "Protection": "Protection", "Recovery": "Soin",
        "Paralysis": "Paralysie", "Sleep": "Sommeil", "Poison": "Poison", "Burn/Frostbite": "Brûlure/Gelure",
        "Confusion": "Confusion", "Stat lowering": "Baisse de stat", "Speed lowering": "Baisse de Vitesse",
        "Accuracy lowering": "Baisse de précision", "Hazards": "Pièges d'entrée", "Pivot": "Pivot (U-turn, Volt Switch…)",
        "Choice AI": "Objet Choice", "Useless move": "Attaque inutile", "Weather/Terrain": "Climat/Terrain",
        "Two-turn move": "Attaque en deux tours", "Drain-Moves": "Attaque drainante", "Binding": "Piège à dégâts",
        "Trapping": "Piège (empêche la fuite)", "Screens": "Écrans", "OHKO moves": "Attaque OHKO",
        "Field move": "Attaque de terrain", "Copied move": "Attaque copiée", "Semi-invulnerable target": "Cible semi-invulnérable",
        "Damaging hazard": "Attaque qui pose un piège", "Ineffective attack": "Attaque sans effet", "Repeated-use move": "Attaque répétée",
        "Critical setup": "Boost de critique", "Trick Room/Tailwind": "Distorsion/Vent Arrière", "Stat boosts": "Boosts",
        "Doubles": "Combat double", "Damaging phazing": "Attaque qui force le switch", "Speed control": "Contrôle de la Vitesse"
    };
    // Remplacements appliqués dans l'ordre : expressions longues d'abord.
    var PHRASES = [
        [/\(document's usual penalty\)/g, "(malus habituel du document)"],
        [/requires snow\/hail/g, "nécessite neige/grêle"],
        [/^already active /g, "effet déjà actif : "],
        [/^blocked secondary effect of /g, "effet secondaire bloqué : "],
        [/^blocked /g, "bloquée : "],
        [/^ineffective /g, "sans effet sur la cible : "],
        [/\(threshold-order estimate\)/g, "(estimation selon l'ordre des seuils)"],
        [/fast\/priority KO \+6, slow KO \+3/g, "K.O. en étant plus rapide ou avec priorité +6, K.O. en étant plus lente +3"],
        [/faster KO ability \+1/g, "talent activé par un K.O. (Moxie…) et IA plus rapide +1"],
        [/HDM \+2 \(25%\)/g, "bonus aléatoire de l'attaque la plus forte (HDM) +2 (25 % des cas)"],
        [/HDM \+6/g, "attaque qui fait le plus de dégâts (HDM) +6"],
        [/status base \+6/g, "base des attaques de statut +6"],
        [/guaranteed secondary base \+6 outside HDM/g, "effet secondaire garanti : base +6 si ce n'est pas l'attaque la plus forte"],
        [/slower and threatened \+5 HDM \/ \+11 otherwise/g, "IA plus lente et menacée de K.O. : +5 si HDM, sinon +11"],
        [/reset\/Unaware\/phazing/g, "le joueur a Haze, Clear Smog, Topsy-Turvy, Unaware ou une attaque qui force le switch"],
        [/Unaware\/reset/g, "le joueur a Unaware, Haze, Clear Smog ou Topsy-Turvy"],
        [/player fast 2HKO/g, "le joueur met l'IA K.O. en 2 coups en étant plus rapide"],
        [/player OHKO/g, "le joueur met l'IA K.O. en 1 coup"],
        [/player can KO AI/g, "le joueur peut mettre l'IA K.O."],
        [/player KO/g, "le joueur peut mettre l'IA K.O."],
        [/AI needs more than 3 hits/g, "l'IA a besoin de plus de 3 coups pour gagner"],
        [/more than 3 hits/g, "plus de 3 coups nécessaires à l'IA"],
        [/4\+ hits/g, "le joueur a besoin de 4 coups ou plus"],
        [/3\+ hits/g, "3 coups ou plus"],
        [/incapacitated/g, "joueur incapable d'agir (sommeil/gel)"],
        [/documented counterplay/g, "le joueur a une parade documentée"],
        [/boosted stat >=\+2/g, "stat déjà à +2 ou plus"],
        [/protection last turn/g, "protection utilisée au tour précédent"],
        [/two successful consecutive protections/g, "deux protections réussies d'affilée"],
        [/AI faints at end of turn/g, "l'IA tombe K.O. en fin de tour"],
        [/first turn default/g, "premier tour, valeur par défaut"],
        [/first turn/g, "premier tour"],
        [/last AI Pokemon/g, "dernier Pokémon de l'IA"],
        [/player last Pokemon/g, "dernier Pokémon du joueur"],
        [/already faster/g, "IA déjà plus rapide"],
        [/threatened/g, "menacée de K.O."],
        [/faster/g, "IA plus rapide"],
        [/slower/g, "IA plus lente"],
        [/phazing/g, "attaque qui force le switch"],
        [/status move/g, "attaque de statut"],
        [/otherwise/g, "sinon"],
        [/default/g, "par défaut"],
        [/already/g, "déjà"],
        [/below (\d+)% HP/g, "sous $1 % des PV"],
        [/HP above (\d+)%/g, "PV au-dessus de $1 %"],
        [/above (\d+)% HP/g, "au-dessus de $1 % des PV"],
        [/below (\d+)%/g, "sous $1 % des PV"],
        [/above (\d+)%/g, "au-dessus de $1 % des PV"],
        [/cannot KO/g, "ne peut pas mettre K.O."],
        [/can KO/g, "peut mettre K.O."],
        [/\bKO\b/g, "K.O."],
        [/Pokemon/g, "Pokémon"],
        [/\((\d+(?:\.\d+)?)%\)/g, "($1 % des cas)"]
    ];

    function translateRule(rule) {
        var text = String(rule || ""), i = text.indexOf(": "), family = "", detail = text;
        if (i > 0 && i < 40) { family = text.slice(0, i); detail = text.slice(i + 2); }
        PHRASES.forEach(function(p) { detail = detail.replace(p[0], p[1]); });
        var fr = FAMILIES[family];
        return (fr ? fr + " : " : family ? family + " : " : "") + detail;
    }

    function pct(p) { return (Math.round(p * 1000) / 10).toString().replace(".", ",") + " %"; }
    function signed(n) { return (n > 0 ? "+" : "") + n; }

    // Distribution des scores, triée du plus haut au plus bas.
    function scoreText(distribution) {
        if (!distribution || !distribution.length) return "";
        return distribution.slice().sort(function(a, b) { return b.score - a.score; })
            .map(function(d) { return signed(d.score) + (d.probability < 1 ? " (" + pct(d.probability) + ")" : ""); }).join(" · ");
    }

    // Phrase de lecture pour une attaque, à partir de sa probabilité finale.
    function reading(probability, legal, tied) {
        if (legal === false) return "Non utilisable : PP épuisés, attaque bloquée ou absente.";
        if (typeof probability !== "number") return "Probabilité non chiffrable avec les informations saisies (voir les hypothèses).";
        if (probability >= 0.9995) return "Choix certain : aucune autre attaque n'atteint son score.";
        if (probability <= 0.0005) return "Jamais choisie : une autre attaque a toujours un score plus haut.";
        if (tied) return "Score à égalité avec une autre attaque dans certains cas : l'IA tire alors au sort entre elles.";
        return "Choisie seulement dans les cas où son score est le plus haut (les bonus aléatoires font varier le résultat).";
    }

    // Calcule tout ce qui est affiché, sans DOM (testable).
    function build(state, moveResult, action, core) {
        var out = { moves: [], notes: [], available: false };
        if (!moveResult) return out;
        var dist = null;
        if (state && core && typeof core.getTargetScoreDistributions === "function" && !(state.field && state.field.gameType === "Doubles")) {
            dist = core.getTargetScoreDistributions(Object.assign({}, state, { context: Object.assign({}, state.context || {}, { scoreOnly: true }) }));
            if (dist.status === "unavailable") dist = null;
        }
        var finals = (action && action.moves) || moveResult.moves || [];
        (moveResult.moves || []).forEach(function(m, i) {
            if (!m || m.move === "(No Move)") return;
            var d = dist && dist.distributions[i], legal = dist ? dist.legal[i] : m.probability !== 0 || (m.rules || []).length > 0;
            var best = d && d.length ? Math.max.apply(null, d.map(function(x) { return x.score; })) : null;
            var tied = !!(dist && d && dist.distributions.some(function(other, j) {
                return j !== i && dist.legal[j] && other.some(function(o) { return d.some(function(x) { return x.score === o.score && x.score === best; }); });
            }));
            var rules = (m.rules || []).map(translateRule);
            var sm = state && state.opponent && state.opponent.moves && state.opponent.moves[i];
            if (!rules.length && sm && sm.category !== "Status" && best === 0)
                rules.push("Aucun bonus : ce n'est ni l'attaque qui fait le plus de dégâts (HDM), ni un K.O.");
            out.moves.push({
                slot: i, move: m.move, estimated: moveResult.status === "estimated" || !!(action && action.status === "estimated"), probability: finals[i] ? finals[i].probability : m.probability,
                moveOnlyProbability: m.probability, scores: d ? scoreText(d) : "", bestScore: best,
                rules: rules, rulesOriginal: m.rules || [], reading: reading(finals[i] ? finals[i].probability : m.probability, legal, tied)
            });
        });
        out.available = true;
        if (action && action.scope === "all-actions") out.notes.push("Les % incluent le risque de switch de l'IA (équipe adverse connue).");
        if (moveResult.status === "estimated") out.notes.push("≈ Estimation : certaines informations du combat ne sont pas renseignées, des hypothèses documentées sont utilisées (liste dans « Règles appliquées et hypothèses »).");
        if (moveResult.status === "unavailable") out.notes.push("Calcul impossible : " + (moveResult.reasons || []).join(" "));
        if (state && state.field && state.field.gameType === "Doubles") out.notes.push("Combat double : le détail des scores par cible n'est pas affiché ici.");
        return out;
    }

    var HOW = [
        "L'IA donne un score à chacune de ses attaques et prend la plus haute. En cas d'égalité, elle tire au sort.",
        "Attaque qui fait le plus de dégâts (HDM) : +6, ou +8 une fois sur 4.",
        "Si l'attaque met K.O. : K.O. en étant plus lente = +9 (+11 une fois sur 4) ; plus rapide ou prioritaire = +12 (+14 une fois sur 4). L'IA considère qu'elle gagne les égalités de Vitesse.",
        "Attaques de statut : +6 de base, puis bonus/malus selon leur règle (Boost, Soin, Protection…).",
        "L'IA connaît toute ton équipe (stats, attaques, objets, talents) dès le début du combat.",
        "Les dégâts utilisés par l'IA sont tirés au hasard parmi les 16 jets possibles : c'est pour ça qu'une attaque peut être HDM ou K.O. seulement une partie du temps."
    ];

    // ------------------------------------------------------------------ DOM
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

    function container() {
        var holder = document.getElementById("null-ai-explain");
        if (holder) return holder;
        // Pleine largeur sous les deux colonnes d'attaques : les cartes s'affichent côte à côte.
        var group = document.querySelector(".move-result-group");
        if (!group || !document.getElementById("null-ai-switch-destination")) return null;
        holder = el("details", "null-ai-explain"); holder.id = "null-ai-explain";
        var stored = null; try { stored = root.localStorage.getItem("nullcalc_aiExplainOpen"); } catch (e) {}
        holder.open = stored !== "false";
        holder.addEventListener("toggle", function() { try { root.localStorage.setItem("nullcalc_aiExplainOpen", String(holder.open)); } catch (e) {} });
        holder.appendChild(el("summary", "", "Pourquoi ces % ? — explication de l'IA"));
        holder.appendChild(el("div", "null-ai-explain-body"));
        holder.classList.add("null-ai-explain--wide");
        group.appendChild(holder);
        return holder;
    }

    var root = typeof window !== "undefined" ? window : globalThis;

    function update(state, moveResult, action) {
        if (typeof document === "undefined") return;
        var holder = container();
        if (!holder) return;
        var body = holder.querySelector(".null-ai-explain-body");
        body.innerHTML = "";
        var data = build(state, moveResult, action, root.NullMoveAI);
        data.moves.forEach(function(m) {
            var card = el("div", "null-ai-explain-move");
            var head = el("div", "null-ai-explain-head");
            head.appendChild(el("strong", "", m.move));
            head.appendChild(el("span", "null-ai-explain-pct", typeof m.probability === "number" ? (m.estimated && m.probability > 0 ? "≈ " : "") + pct(m.probability) : "indéterminé"));
            card.appendChild(head);
            if (m.scores) card.appendChild(el("div", "null-ai-explain-scores", "Score possible : " + m.scores));
            card.appendChild(el("div", "null-ai-explain-reading", m.reading));
            if (m.rules.length) {
                var list = el("ul", "null-ai-explain-rules");
                m.rules.forEach(function(r, i) { var li = el("li", "", r); if (m.rulesOriginal[i]) li.title = m.rulesOriginal[i]; list.appendChild(li); });
                card.appendChild(list);
            }
            body.appendChild(card);
        });
        data.notes.forEach(function(n) { body.appendChild(el("p", "null-ai-note", n)); });
        var how = el("details", "null-ai-explain-how"); how.appendChild(el("summary", "", "Comment l'IA de Null choisit son attaque"));
        var ul = el("ul"); HOW.forEach(function(t) { ul.appendChild(el("li", "", t)); }); how.appendChild(ul);
        body.appendChild(how);
    }

    function clear() { var h = typeof document !== "undefined" && document.getElementById("null-ai-explain"); if (h) h.remove(); }

    return { translateRule: translateRule, build: build, update: update, clear: clear, reading: reading, scoreText: scoreText };
});
