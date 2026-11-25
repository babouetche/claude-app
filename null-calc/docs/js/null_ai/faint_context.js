(function(root, factory) {
    "use strict";
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.NullFaintContext = factory();
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";
    function fainted(mon) { return mon.alive === false || mon.hp <= 0; }
    function counts(candidates, total) {
        var known = candidates.filter(fainted).length;
        if (total !== undefined) {
            if (!Number.isInteger(total) || total < 0 || total > 100) throw new Error("Total allied faints must be an integer from 0 to 100.");
            known = Math.max(known, total);
        }
        // The other active doubles slot is not the hypothetical KO target.
        var target = candidates.find(function(c) { return c.active && !c.partnerActive; });
        return { known: known, afterKO: known + (target && !fainted(target) ? 1 : 0) };
    }
    function basePower(move, alliesFainted, retaliate) {
        var name = move.originalName || move.name, power = move.bp;
        if (name === "Retaliate" && retaliate) return power * 2;
        if (name === "Last Respects") return power + 50 * Math.max(0, alliesFainted);
        return power;
    }
    function afterKO(state) {
        var party = state.party || {};
        return Object.assign({}, state, { party: Object.assign({}, party, {
            candidates: (party.candidates || []).map(function(c) {
                // Profiles are recalculated with the real engine by the adapter.
                // Never multiply final damage rolls: rounding and Technician,
                // gems, Analytic, etc. have to run at the proper formula stage.
                return c.postKOMoves ? Object.assign({}, c, { moves: c.postKOMoves }) : c;
            })
        }) });
    }
    function historyKey(state) {
        return ((state && state.party && state.party.candidates) || []).filter(function(c) {
            return c.ability === "Supreme Overlord" || (c.moves || []).some(function(m) { return m.name === "Last Respects"; });
        }).map(function(c) { return [c.id,c.alliesFainted,c.alliesFaintedAfterKO].join(":"); }).join("|");
    }
    return { counts: counts, basePower: basePower, afterKO: afterKO, historyKey: historyKey };
});
