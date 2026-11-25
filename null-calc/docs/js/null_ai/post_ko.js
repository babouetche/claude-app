(function(root, factory) {
    "use strict";
    if (typeof module === "object" && module.exports) module.exports = factory(require("./switch.js"), require("./faint_context.js"));
    else root.NullPostKO = factory(root.NullSwitchAI, root.NullFaintContext);
})(typeof window !== "undefined" ? window : globalThis, function(switchAI, faintContext) {
    "use strict";
    // A preview of forced replacement, independent of the current turn's
    // switch scenario. The adapter supplies damage against the displayed player.
    function predict(state, options) {
        options = options || {};
        if (!state || !state.player || !state.opponent) return { status: "unavailable", reason: "incomplete", candidates: [] };
        var party = state.party || {};
        var preview = Object.assign({}, state, {
            opponent: Object.assign({}, state.opponent, { hp: 0 }),
            context: Object.assign({}, state.context, { switchScenario: "post-ko", playerAction: "stay", immediateSwitchDamage: !!options.immediateDamage })
        });
        preview = faintContext.afterKO(preview);
        var all = preview.party.candidates || [];
        if(state.field&&state.field.gameType==="Doubles"&&party.owner){
            preview.context.partyFirstIndex=Math.max(preview.context.partyFirstIndex===undefined?0:preview.context.partyFirstIndex,party.owner.partyFirstIndex);
            preview.context.partyLastIndex=Math.min(preview.context.partyLastIndex===undefined?Infinity:preview.context.partyLastIndex,party.owner.partyLastIndex);
        }
        var result = switchAI.getSwitchProbabilities(preview);
        // Reserve damage can use approximated multi-hit rolls. An apparently
        // decisive OHKO from that input still is not a certified game result.
        if (all.some(function(c) { return !c.active && c.alive !== false && (c.moves || []).some(function(m) { return m.damageEstimated; }); }) || (state.assumptions || []).length) {
            result.assumptions.push("Le classement utilise des dégâts ou un état approximatifs ; les chances d’entrée restent des estimations.");
            result.status = "estimated";
            result.candidates.forEach(function(c) {
                c.probabilityStatus = c.status = "estimated";
                if (preview.context.calculationMode === "strict") c.probability = c.switchActionProbability = null;
            });
        }
        var scored = result.candidates || [], byID = new Map(scored.map(function(c) { return [c.id, c]; }));
        function reserved(c) { return (c.aliases||[c.id]).some(function(id){return (preview.context.reservedPartyIds||[]).includes(id);})||(preview.context.reservedPartyIds||[]).includes(c.partyIndex)||preview.context.partyFirstIndex!==undefined&&c.partyIndex<preview.context.partyFirstIndex||preview.context.partyLastIndex!==undefined&&c.partyIndex>=preview.context.partyLastIndex; }
        var reason = state.field && state.field.gameType === "Doubles" && !(state.context&&state.context.doublesComplete) ? "doubles" : !party.complete ? "unknown-team" :
            !all.some(function(c) { return !c.active && c.alive !== false && c.hp > 0; }) ? "no-reserves" : !all.some(function(c) { return !c.active && c.alive!==false && c.hp>0 && !reserved(c); }) ? "no-eligible-reserves" : !scored.length ? "entry-ko" : "ranked";
        var candidates = all.map(function(c) {
            var prediction = byID.get(c.id);
            return Object.assign({}, c, prediction || {}, {
                eligibility: c.partnerActive ? c.alive === false || c.hp <= 0 ? "fainted" : "partner" : c.active ? "active" : c.alive === false || c.hp <= 0 ? "fainted" : reserved(c) ? "reserved" : c.hp <= (c.entryHazardDamage || 0) ? "entry-ko" : "candidate"
            });
        });
        return { status: reason === "ranked" ? result.status : reason === "no-reserves" ? "determined" : "unavailable",
            reason: reason, playerName: state.player.name, opponentName: state.opponent.name,
            trainerName: party.trainerName || "", reserveOwner:party.owner&&party.owner.name||"", candidates: candidates, switch: result, faintContext: party.faintContext,
            assumptions: Array.from(new Set((state.assumptions || []).concat(result.assumptions || []))) };
    }
    return { predict: predict };
});
