(function(root, factory) {
    "use strict";
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else { root.NullTrickRoom = api; api.installEngine(root); api.installUI(root); }
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";
    // -1: first, 0: unresolved speed tie, +1: last. Speed itself never changes.
    function order(a, b, active, priorityA, priorityB) {
        if (priorityA !== undefined && priorityB !== undefined && priorityA !== priorityB) return priorityA > priorityB ? -1 : 1;
        if (a === b) return 0;
        return (active ? a < b : a > b) ? -1 : 1;
    }
    function installEngine(env) {
        var calc = env.calc;
        if (calc.nullTrickRoomInstalled) return;
        calc.nullTrickRoomInstalled = true;
        var clone = calc.Field.prototype.clone;
        calc.Field.prototype.clone = function() { var copy = clone.call(this); copy.isTrickRoom = !!this.isTrickRoom; return copy; };
        // The browser loads the original mechanics as global functions. These
        // two narrow hooks retain every original formula and all real speeds.
        var basePower = env.calculateBasePowerSMSSSV;
        env.calculateBasePowerSMSSSV = function(gen, attacker, defender, move, field, ate, desc) {
            if (!field.isTrickRoom || attacker.stats.spe === defender.stats.spe || !["Payback","Bolt Beak","Fishious Rend"].includes(move.name) || move.isZ || move.isMax)
                return basePower.apply(this, arguments);
            var oldFirst = attacker.stats.spe > defender.stats.spe, newFirst = !oldFirst;
            var oldFactor = move.name === "Payback" ? (oldFirst ? 1 : 2) : (oldFirst ? 2 : 1);
            var newFactor = move.name === "Payback" ? (newFirst ? 1 : 2) : (newFirst ? 2 : 1);
            var adjusted = move.clone(); adjusted.bp = move.bp * newFactor / oldFactor;
            return basePower(gen, attacker, defender, adjusted, field, ate, desc);
        };
        calc.calculateBasePowerSMSSSV = env.calculateBasePowerSMSSSV;
        var mods = env.calculateBPModsSMSSSV;
        env.calculateBPModsSMSSSV = function(gen, attacker, defender, move, field, desc, power, ate, turnOrder) {
            if (field.isTrickRoom && attacker.stats.spe !== defender.stats.spe) turnOrder = attacker.stats.spe < defender.stats.spe ? "first" : "last";
            return mods(gen, attacker, defender, move, field, desc, power, ate, turnOrder);
        };
        calc.calculateBPModsSMSSSV = env.calculateBPModsSMSSSV;
    }
    function installUI(env) {
        var $ = env.$, create = env.createField;
        env.createField = function() { var field = create.apply(this, arguments); field.isTrickRoom = env.gen >= 7 && !!$("#trickroom").prop("checked"); return field; };
        function changed() {
            var active = !!$(this).prop("checked");
            $("#trickroom, #null-ai-trick-room").prop("checked",active);
            $("#trick-room-note").toggle(active);
            // A changed field invalidates the memorized pre-switch matchup.
            // Return to the visible active reference rather than using stale
            // order-dependent damage from the previous field.
            var reset = $("#null-ai-player-action").val() === "switch-in";
            if (reset) $("#null-ai-player-action").val("stay");
            $("#trick-room-snapshot-note").toggle(reset);
            if (this.id === "null-ai-trick-room" || reset) env.performCalculations();
            // Refresh speed borders even when automatic colour refresh is off.
            if (env.scheduleColorCodeUpdate) env.scheduleColorCodeUpdate();
        }
        $(env.document).on("change.nullTrickRoom", "#trickroom, #null-ai-trick-room", changed);
    }
    return { order:order, installEngine:installEngine, installUI:installUI };
});
