/**
 * Local battle sprites: ../battleSprites/NNN_Y.png (3-digit national dex + form index, e.g. 003_1 Mega Venusaur).
 * Form index matches the base species formeOrder (by display name, or by toID vs template.id).
 * Optional: window.__BATTLE_SPRITES_BASE = absolute or relative URL ending in /
 * Disable: window.__USE_BATTLE_SPRITES = false
 */
(function () {
	function battleSpritesBase() {
		if (window.__USE_BATTLE_SPRITES === false) return null;
		if (typeof window.__BATTLE_SPRITES_BASE === 'string' && window.__BATTLE_SPRITES_BASE) {
			return window.__BATTLE_SPRITES_BASE.replace(/\/?$/, '/');
		}
		/* Sibling of the porydex folder: docs/battleSprites or dist/battleSprites (not ../../ which misses docs/). */
		return '../battleSprites/';
	}

	function formatDexNum(num) {
		if (num === undefined || num === null || num < 0) return null;
		if (num < 1000) return ('000' + num).slice(-3);
		return String(num);
	}

	/**
	 * @param {object} template — Dex.species.get(id) result
	 * @returns {string|null} filename stem NNN_Y or null
	 */
	window.getBattleSpriteStem = function (template) {
		if (!template || template.num === undefined || template.num === null || template.num < 1) {
			return null;
		}
		var numStr = formatDexNum(template.num);
		if (!numStr) return null;

		var formIndex = 0;
		var baseKey = template.baseSpecies ? toID(template.baseSpecies) : template.id;
		var base = typeof Dex !== 'undefined' && Dex.species && Dex.species.get
			? Dex.species.get(baseKey)
			: null;
		var order = base && base.formeOrder;
		if (order && order.length) {
			var matched = false;
			var j;
			if (template.name) {
				for (j = 0; j < order.length; j++) {
					if (order[j] === template.name) {
						formIndex = j;
						matched = true;
						break;
					}
				}
			}
			if (!matched && template.id) {
				for (j = 0; j < order.length; j++) {
					if (toID(order[j]) === template.id) {
						formIndex = j;
						break;
					}
				}
			}
		}
		// Fallback when formeOrder metadata is absent/incomplete (common in extracted dex data).
		// Matches battleSprites naming convention: base _0, Mega _1, split Megas usually X _1 / Y _2.
		if (formIndex === 0 && template && template.forme) {
			var f = String(template.forme).toLowerCase();
			if (f === 'mega' || f === 'mega-x' || f === 'primal') {
				formIndex = 1;
			} else if (f === 'mega-y') {
				formIndex = 2;
			}
		}
		return numStr + '_' + formIndex;
	};

	window.getBattleSpritePngUrl = function (template) {
		var base = battleSpritesBase();
		if (!base) return null;
		var stem = window.getBattleSpriteStem(template);
		if (!stem) return null;
		return base + stem + '.png';
	};

	window.getBattleSpriteImgSrc = function (template, fallbackUrl) {
		var u = window.getBattleSpritePngUrl(template);
		if (u) return u;
		return fallbackUrl || '';
	};
})();
