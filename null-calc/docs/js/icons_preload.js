/**
 * Warms the browser cache for every file listed in icons_manifest.js (see generate-icons-manifest.mjs).
 * Runs after load + idle so the first paint stays responsive.
 */
function schedulePokemonIconCacheWarmup() {
	if (typeof window === "undefined" || window.__pokemonIconCacheWarmupScheduled) {
		return;
	}
	window.__pokemonIconCacheWarmupScheduled = true;

	var list = window.POKEMON_ICON_PRELOAD_URLS;
	if (!list || !list.length || typeof getPokemonIconsBase !== "function") {
		return;
	}

	var base = getPokemonIconsBase();
	var urls = [];
	for (var i = 0; i < list.length; i++) {
		urls.push(base + list[i]);
	}

	var idx = 0;
	var MAX_CONCURRENT = 10;
	var inFlight = 0;

	function pump() {
		while (inFlight < MAX_CONCURRENT && idx < urls.length) {
			inFlight++;
			var im = new Image();
			im.decoding = "async";
			im.onload = im.onerror = function () {
				inFlight--;
				pump();
			};
			im.src = urls[idx++];
		}
	}

	function start() {
		if (window.requestIdleCallback) {
			window.requestIdleCallback(
				function () {
					pump();
				},
				{ timeout: 4000 }
			);
		} else {
			setTimeout(pump, 0);
		}
	}

	if (document.readyState === "complete") {
		start();
	} else {
		window.addEventListener("load", start);
	}
}

schedulePokemonIconCacheWarmup();
