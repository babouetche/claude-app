(function(root, factory) {
    "use strict";
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.NullBattleStore = factory();
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";
    // Battle snapshots are graphs, not JSON: doubles arrays also own `.ally`,
    // and rule state can contain Infinity. Retain aliases and prototypes too.
    function clone(value, keepGeneration, seen) {
        if (value === null || typeof value !== "object") return value;
        seen = seen || new Map();
        if (seen.has(value)) return seen.get(value);
        var copy;
        if (value instanceof Date) return new Date(value.getTime());
        if (value instanceof Set) { copy = new Set(); seen.set(value, copy); value.forEach(function(v) { copy.add(clone(v, keepGeneration, seen)); }); return copy; }
        if (value instanceof Map) { copy = new Map(); seen.set(value, copy); value.forEach(function(v, k) { copy.set(clone(k, keepGeneration, seen), clone(v, keepGeneration, seen)); }); return copy; }
        copy = Array.isArray(value) ? new Array(value.length) : Object.create(Object.getPrototypeOf(value));
        seen.set(value, copy);
        Object.keys(value).forEach(function(key) {
            // Generation dex tables are immutable application data. Sharing
            // this handle avoids copying the entire dex per cached result.
            Object.defineProperty(copy, key, {value:keepGeneration && key === "gen" ? value[key] : clone(value[key], keepGeneration, seen), writable:true, configurable:true, enumerable:true});
        });
        return copy;
    }
    function create(options) {
        options = options || {};
        var limit = Math.max(1, options.limit || 32), cache = new Map(), references = new Map(), objects = new WeakMap(), nextID = 1;
        var pending = new Map(), epoch = 0;
        var metrics = { calls:0, hits:0, misses:0, evictions:0, computeMs:0, engineCalls:0, keyMs:0, cloneMs:0, referenceResets:0, scheduled:0, coalesced:0 };
        function now() { return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now(); }
        function objectID(value) {
            if (!value || (typeof value !== "object" && typeof value !== "function")) return value;
            if (!objects.has(value)) objects.set(value, nextID++);
            return objects.get(value);
        }
        function key(value) {
            var seen = new Map();
            function encode(v, name) {
                if (v === undefined) return ["undefined"];
                if (typeof v === "number" && !Number.isFinite(v)) return ["number", String(v)];
                if (typeof v === "number" && Object.is(v, -0)) return ["number", "-0"];
                if (typeof v === "function") return ["function", objectID(v)];
                if (v === null || typeof v !== "object") return v;
                // All actual Pokémon/Move properties (including species,
                // overrides, stats and current HP) remain in the key.
                // The engine creates a fresh Generation wrapper for each new
                // Pokémon. Its small own properties and data-reader prototype
                // identify its semantics; object identity alone would defeat
                // reuse of every reserve profile on every refresh.
                if (seen.has(v)) return ["ref", seen.get(v)];
                seen.set(v, seen.size);
                if (v instanceof Set) return ["set", Array.from(v).map(function(x) { return encode(x); })];
                if (v instanceof Map) return ["map", Array.from(v).map(function(x) { return [encode(x[0]), encode(x[1])]; })];
                return [Array.isArray(v) ? "array:" + v.length : "object", objectID(Object.getPrototypeOf(v)), Object.keys(v).sort().map(function(k) { return [k, encode(v[k], k)]; })];
            }
            return JSON.stringify(encode(value));
        }
        function memo(namespace, input, compute) {
            var started = now(), id = namespace + ":" + epoch + ":" + key(input); metrics.keyMs += now() - started; metrics.calls++;
            var value;
            if (cache.has(id)) { value = cache.get(id); cache.delete(id); cache.set(id, value); metrics.hits++; }
            else {
                metrics.misses++; started = now(); value = compute(); metrics.computeMs += now() - started;
                started = now(); cache.set(id, clone(value, true)); metrics.cloneMs += now() - started;
                if (cache.size > limit) { cache.delete(cache.keys().next().value); metrics.evictions++; }
                // The first caller owns the engine result; the store owns a
                // distinct graph. Later callers receive distinct graphs too.
                return value;
            }
            started = now(); var result = clone(value, true); metrics.cloneMs += now() - started; return result;
        }
        function reference(channel, identity, history, state, switchIn) {
            var current = references.get(channel), reason = null;
            if (!current || current.identity !== identity) {
                if (current) reason = "identity";
                current = { identity:identity, history:history, stay:null, frozen:null }; references.set(channel, current);
            }
            if (current.frozen && current.history !== history) { current.stay = current.frozen = null; reason = "history"; }
            current.history = history;
            if (reason) metrics.referenceResets++;
            if (reason === "history") switchIn = false;
            if (!switchIn) { current.frozen = null; current.stay = clone(state); }
            else if (!current.frozen && current.stay) current.frozen = clone(current.stay);
            return { state: current.frozen ? clone(current.frozen) : state, frozen:!!current.frozen, reason:reason };
        }
        function resetReference(channel) { if (channel === undefined) references.clear(); else references.delete(channel); }
        function schedule(channel, fn) {
            metrics.scheduled++;
            if (pending.has(channel)) { pending.set(channel, fn); metrics.coalesced++; return; }
            pending.set(channel, fn);
            Promise.resolve().then(function() { var callback = pending.get(channel); pending.delete(channel); if (callback) callback(); });
        }
        function cancel(channel) { pending.delete(channel); }
        function invalidate() { cache.clear(); epoch++; }
        function stats(reset) {
            var result = Object.assign({ size:cache.size, limit:limit, epoch:epoch, references:references.size }, metrics);
            if (reset) Object.keys(metrics).forEach(function(k) { metrics[k] = 0; });
            return result;
        }
        return { clone:clone, key:key, memo:memo, reference:reference, resetReference:resetReference, schedule:schedule, cancel:cancel, invalidate:invalidate, stats:stats,
            recordEngineCall:function() { metrics.engineCalls++; } };
    }
    var shared = create(); shared.create = create; return shared;
});
