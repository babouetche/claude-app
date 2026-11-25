/**
 * Pokédex list icons: same files as the damage calculator (shared_controls.js getSrcImgPokemon).
 * Icons live next to the calc root: ../icons/ from dist/index.html, ../../icons/ from dist/porydex/.
 */
(function () {
	function getCalcPokemonIconFilename(name) {
		if (!name) return '';
		var iconName = name;
		if (name === 'Aegislash-Shield') iconName = 'Aegislash';
		if (iconName.indexOf('Farfetch') === 0 || iconName.indexOf('Sirfetch') === 0) {
			iconName = iconName.replace(/\u2019|'/g, '');
		}
		if (iconName.indexOf('Mr. Mime') === 0) {
			iconName = iconName.replace(/Mr\. Mime/g, 'Mr-Mime');
		}
		if (iconName.indexOf('Mr. Rime') === 0) {
			iconName = iconName.replace(/Mr\. Rime/g, 'Mr-Rime');
		}
		iconName = iconName.replace(/ /g, '-');
		return iconName + '.png';
	}

	function getCalcIconsBase() {
		if (typeof window.__CALC_ICONS_BASE === 'string' && window.__CALC_ICONS_BASE) {
			return window.__CALC_ICONS_BASE.replace(/\/?$/, '/');
		}
		try {
			/* From docs/porydex/index.html this resolves to docs/icons/. */
			return new URL('../icons/', window.location.href).pathname;
		} catch (e) {
			return '../icons/';
		}
	}

	window.getCalcPokemonIconSrc = function (name) {
		var fn = getCalcPokemonIconFilename(name);
		if (!fn) return '';
		return getCalcIconsBase() + fn;
	};

	/**
	 * HTML for the search result list: calculator PNGs, or Showdown sprite sheet if disabled.
	 */
	window.renderPokedexPokemonListIconHtml = function (name) {
		if (window.__USE_CALC_ICONS_FOR_DEX_LIST === false) {
			return '<span class="picon" style="' + Dex.getPokemonIcon(name) + '"></span>';
		}
		var src = window.getCalcPokemonIconSrc(name);
		/* Display size is half of calculator team icons (--box-icon-size, default 64px); dimensions come from CSS */
		return '<img class="calc-picon pixelated" src="' + BattleLog.escapeHTML(src) + '" alt="" loading="lazy" />';
	};
})();
