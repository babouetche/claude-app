/**
 * After battledata.js: point Dex at vendored Showdown UI assets under vendor/play-ps/
 * (types, icon sheets, TM/tutor icons). Omits reliance on play.pokemonshowdown.com for those URLs.
 */
(function () {
	if (typeof Dex === 'undefined') return;
	var base = new URL('vendor/play-ps/', window.location.href).href;
	Dex.resourcePrefix = base;
	var p = Dex.resourcePrefix;
	if (p.indexOf('http:') === 0 && window.location && window.location.protocol === 'https:') {
		Dex.resourcePrefix = p.replace(/^http:/, 'https:');
	}
	Dex.fxPrefix = Dex.resourcePrefix + 'fx/';
	window.__DEX_VENDOR_ASSETS_ONLY = true;
})();
