if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function (searchElement, fromIndex) { // eslint-disable-line no-extend-native
		var k;
		if (this == null) {
			throw new TypeError('"this" equals null or n is undefined');
		}
		var O = Object(this);
		var len = O.length >>> 0;
		if (len === 0) {
			return -1;
		}
		var n = +fromIndex || 0;
		if (Math.abs(n) === Infinity) {
			n = 0;
		}
		if (n >= len) {
			return -1;
		}
		k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
		while (k < len) {
			if (k in O && O[k] === searchElement) {
				return k;
			}
			k++;
		}
		return -1;
	};
}

function startsWith(string, target) {
	return (string || '').slice(0, target.length) === target;
}

var LEGACY_STATS_RBY = ["hp", "at", "df", "sl", "sp"];
var LEGACY_STATS_GSC = ["hp", "at", "df", "sa", "sd", "sp"];
var LEGACY_STATS = [[], LEGACY_STATS_RBY, LEGACY_STATS_GSC, LEGACY_STATS_GSC, LEGACY_STATS_GSC, LEGACY_STATS_GSC, LEGACY_STATS_GSC, LEGACY_STATS_GSC, LEGACY_STATS_GSC, LEGACY_STATS_GSC];
var HIDDEN_POWER_REGEX = /Hidden Power (\w*)/;

var CALC_STATUS = {
	'Healthy': '',
	'Paralyzed': 'par',
	'Poisoned': 'psn',
	'Badly Poisoned': 'tox',
	'Burned': 'brn',
	'Frostbite': 'frb',
	'Asleep': 'slp',
	'Frozen': 'frz'
};

var SET_STATUS_ALIASES = {
	'': 'Healthy',
	'None': 'Healthy',
	'none': 'Healthy',
	'healthy': 'Healthy',
	'brn': 'Burned',
	'burn': 'Burned',
	'Burn': 'Burned',
	'par': 'Paralyzed',
	'paralysis': 'Paralyzed',
	'Paralysis': 'Paralyzed',
	'psn': 'Poisoned',
	'poison': 'Poisoned',
	'Poison': 'Poisoned',
	'tox': 'Badly Poisoned',
	'toxic': 'Badly Poisoned',
	'Toxic': 'Badly Poisoned',
	'frz': 'Frozen',
	'freeze': 'Frozen',
	'slp': 'Asleep',
	'sleep': 'Asleep',
	'Sleep': 'Asleep',
	'frb': 'Frostbite'
};

function normalizeSetStatus(status) {
	if (!status) {
		return 'Healthy';
	}
	var trimmed = String(status).trim();
	if (trimmed in CALC_STATUS) {
		return trimmed;
	}
	if (trimmed in SET_STATUS_ALIASES) {
		return SET_STATUS_ALIASES[trimmed];
	}
	var lower = trimmed.toLowerCase();
	var key;
	for (key in CALC_STATUS) {
		if (key.toLowerCase() === lower) {
			return key;
		}
	}
	return 'Healthy';
}

function legacyStatToStat(st) {
	switch (st) {
		case 'hp':
			return "hp";
		case 'at':
			return "atk";
		case 'df':
			return "def";
		case 'sa':
			return "spa";
		case 'sd':
			return "spd";
		case 'sp':
			return "spe";
		case 'sl':
			return "spc";
	}
}

// input field validation
var bounds = {
	"level": [0, 100],
	"base": [1, 255],
	"evs": [0, 252],
	"ivs": [0, 31],
	"dvs": [0, 15],
	"move-bp": [0, 65535]
};
for (var bounded in bounds) {
	attachValidation(bounded, bounds[bounded][0], bounds[bounded][1]);
}
function attachValidation(clazz, min, max) {
	$("." + clazz).keyup(function () {
		validate($(this), min, max);
	});
}
function validate(obj, min, max) {
	obj.val(Math.max(min, Math.min(max, ~~obj.val())));
}

$("input:radio[name='format']").change(function () {
	var gameType = $("input:radio[name='format']:checked").val();
	if (gameType === 'Singles') {
		$("input:checkbox[name='ruin']:checked").prop("checked", false);
		$("#field-fairy-aura, #field-dark-aura, #field-aura-break").prop("checked", false);
	}
	$(".format-specific." + gameType.toLowerCase()).each(function () {
		if ($(this).hasClass("gen-specific") && !$(this).hasClass("g" + gen)) {
			return;
		}
		$(this).show();
	});
	$(".format-specific").not("." + gameType.toLowerCase()).hide();
});

// auto-calc stats and current HP on change (keyboard + number input spinners)
$(".level").bind("keyup change input", function () {
	var poke = $(this).closest(".poke-info");
	calcHP(poke);
	calcStats(poke);
});
$(".stat-changer").on("click", function () {
	var $row = $(this).closest("tr");
	var $boost = $row.find("select.boost");
	if (!$boost.length) return;
	var delta = $(this).text().trim() === "+" ? 1 : -1;
	var v = parseInt($boost.val(), 10) + delta;
	v = Math.max(-6, Math.min(6, v));
	$boost.val(v).change();
});
$(document).on("change", ".commanderDondozoToggle", function () {
	if (window._commanderProgrammatic) return;
	var pokeInfo = $(this).closest(".poke-info");
	if (!isDondozoSpeciesUi(pokeInfo)) {
		window._commanderProgrammatic = true;
		$(this).prop("checked", false);
		window._commanderProgrammatic = false;
		return;
	}
	if ($(this).prop("checked")) {
		applyCommanderDondozoStatDelta(pokeInfo, 2);
	} else {
		applyCommanderDondozoStatDelta(pokeInfo, -2);
	}
});
$(".nature").bind("keyup change", function () {
	calcStats($(this).closest(".poke-info"));
});
$(".hp .base, .hp .evs, .hp .ivs").bind("keyup change", function () {
	calcHP($(this).closest(".poke-info"));
});
$(".at .base, .at .evs, .at .ivs").bind("keyup change", function () {
	calcStat($(this).closest(".poke-info"), 'at');
});
$(".df .base, .df .evs, .df .ivs").bind("keyup change", function () {
	calcStat($(this).closest(".poke-info"), 'df');
});
$(".sa .base, .sa .evs, .sa .ivs").bind("keyup change", function () {
	calcStat($(this).closest(".poke-info"), 'sa');
});
$(".sd .base, .sd .evs, .sd .ivs").bind("keyup change", function () {
	calcStat($(this).closest(".poke-info"), 'sd');
});
$(".sp .base, .sp .evs, .sp .ivs").bind("keyup change", function () {
	calcStat($(this).closest(".poke-info"), 'sp');
});
$(".sl .base").keyup(function () {
	calcStat($(this).closest(".poke-info"), 'sl');
});
$(".at .dvs").keyup(function () {
	var poke = $(this).closest(".poke-info");
	calcStat(poke, 'at');
	poke.find(".hp .dvs").val(getHPDVs(poke));
	calcHP(poke);
});
$(".df .dvs").keyup(function () {
	var poke = $(this).closest(".poke-info");
	calcStat(poke, 'df');
	poke.find(".hp .dvs").val(getHPDVs(poke));
	calcHP(poke);
});
$(".sa .dvs").keyup(function () {
	var poke = $(this).closest(".poke-info");
	calcStat(poke, 'sa');
	poke.find(".sd .dvs").val($(this).val());
	calcStat(poke, 'sd');
	poke.find(".hp .dvs").val(getHPDVs(poke));
	calcHP(poke);
});
$(".sp .dvs").keyup(function () {
	var poke = $(this).closest(".poke-info");
	calcStat(poke, 'sp');
	poke.find(".hp .dvs").val(getHPDVs(poke));
	calcHP(poke);
});
$(".sl .dvs").keyup(function () {
	var poke = $(this).closest(".poke-info");
	calcStat(poke, 'sl');
	poke.find(".hp .dvs").val(getHPDVs(poke));
	calcHP(poke);
});

function getHPDVs(poke) {
	return (~~poke.find(".at .dvs").val() % 2) * 8 +
		(~~poke.find(".df .dvs").val() % 2) * 4 +
		(~~poke.find(".sp .dvs").val() % 2) * 2 +
		(~~poke.find(gen === 1 ? ".sl .dvs" : ".sa .dvs").val() % 2);
}

function updateSpTotalMod(poke) {
	var $mod = poke.find(".sp .totalMod");
	if (!$mod.length) return;
	try {
		var pokemon = createPokemon(poke);
		$mod.text(pokemon.stats.spe);
	} catch (e) {
		$mod.text("---");
	}
}

function calcStats(poke) {
	for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
		calcStat(poke, LEGACY_STATS[gen][i]);
	}
	updateSpTotalMod(poke);
}

function calcCurrentHP(poke, max, percent, skipDraw) {
	var current = Math.round(Number(percent) * Number(max) / 100);
	poke.find(".current-hp").val(current);
	if (!skipDraw) drawHealthBar(poke, max, current);
	return current;
}
function calcPercentHP(poke, max, current, skipDraw) {
	var percent = Math.round(100 * Number(current) / Number(max));
	if (percent === 0 && current > 0) {
		percent = 1;
	} else if (percent === 100 & current < max) {
		percent = 99;
	}

	poke.find(".percent-hp").val(percent);
	if (!skipDraw) drawHealthBar(poke, max, current);
	return percent;
}
function drawHealthBar(poke, max, current) {
	var fillPercent = 100 * current / max;
	var fillColor = fillPercent > 50 ? "green" : fillPercent > 20 ? "yellow" : "red";

	var healthbar = poke.find(".hpbar");
	healthbar.addClass("hp-" + fillColor);
	var unwantedColors = ["green", "yellow", "red"];
	unwantedColors.splice(unwantedColors.indexOf(fillColor), 1);
	for (var i = 0; i < unwantedColors.length; i++) {
		healthbar.removeClass("hp-" + unwantedColors[i]);
	}
	healthbar.css("background", "linear-gradient(to right, " + fillColor + " " + fillPercent + "%, white 0%");
}
// TODO: these HP inputs should really be input type=number with min=0, step=1, constrained by max=maxHP or 100
$(".current-hp").keyup(function () {
	var max = $(this).parent().children(".max-hp").text();
	validate($(this), 0, max);
	var current = $(this).val();
	calcPercentHP($(this).parent(), max, current);
});
$(".percent-hp").keyup(function () {
	var max = $(this).parent().children(".max-hp").text();
	validate($(this), 0, 100);
	var percent = $(this).val();
	calcCurrentHP($(this).parent(), max, percent);
});

$(".ability").bind("keyup change", function () {
	applyMultiHitDropdownsForPokeInfo($(this).closest(".poke-info"));

	var ability = $(this).closest(".poke-info").find(".ability").val();

	var TOGGLE_ABILITIES = ['Protean', 'Flash Fire', 'Intimidate', 'Illuminate', 'Minus', 'Plus', 'Slow Start', 'Unburden', 'Stakeout', 'Teraform Zero', 'Electromorphosis'];

	if (TOGGLE_ABILITIES.indexOf(ability) >= 0) {
		$(this).closest(".poke-info").find(".abilityToggle").show();
	} else {
		$(this).closest(".poke-info").find(".abilityToggle").hide();
	}

	var boostedStat = $(this).closest(".poke-info").find(".boostedStat");

	if (ability === "Protosynthesis" || ability === "Quark Drive") {
		boostedStat.show();
		autosetQP($(this).closest(".poke-info"));
	} else {
		boostedStat.hide();
	}

	if (ability === "Supreme Overlord") {
		$(this).closest(".poke-info").find(".alliesFainted").show();
	} else {
		$(this).closest(".poke-info").find(".alliesFainted").val('0');
		$(this).closest(".poke-info").find(".alliesFainted").hide();

	}

	if ($(this).closest("#p2").length) {
		var fs = getFullSetNameFromPokeInfo($("#p2"));
		// Avoid re-rendering the opposing team grid during set-selector load; wrong fs breaks Wandering Spirit mirror.
		if (fs && !window.NO_CALC) renderAllTrainerTeams(fs);
	}

	var pokeInfo = $(this).closest(".poke-info");
	if (!window._syncingTraceAbility) {
		var traceCb = pokeInfo.find(".traceCopyOpponent");
		if (traceCb.prop("checked")) {
			var oppAb = getOpponentPokeInfo(pokeInfo).find(".ability").val();
			var cur = $(this).val();
			if (cur === "Trace" || cur !== oppAb) {
				traceCb.prop("checked", false);
			}
		}
		var oppPane = getOpponentPokeInfo(pokeInfo);
		if (oppPane.find(".traceCopyOpponent").prop("checked")) {
			applyTraceAbilityFromOpponent(oppPane);
		}
	}
	updateTraceCopyVisibility(pokeInfo);
	updateTraceCopyVisibility(getOpponentPokeInfo(pokeInfo));
});

$(document).on("change", ".traceCopyOpponent", function () {
	var pokeInfo = $(this).closest(".poke-info");
	if (!pokeInfo.find(".trace-copy-label").length) return;
	if ($(this).prop("checked")) {
		applyTraceAbilityFromOpponent(pokeInfo);
	} else {
		restoreTraceAbilitySelection(pokeInfo);
	}
	updateTraceCopyVisibility(pokeInfo);
});

function autosetQP(pokemon) {
	var currentWeather = $("input:radio[name='weather']:checked").val();
	var currentTerrain = $("input:checkbox[name='terrain']:checked").val() || "No terrain";

	var item = pokemon.find(".item").val();
	var ability = pokemon.find(".ability").val();
	var boostedStat = pokemon.find(".boostedStat").val();

	if (!boostedStat || boostedStat === "auto") {
		if (
			(item === "Booster Energy") ||
			(ability === "Protosynthesis" && (currentWeather === "Sun" || currentWeather === "Harsh Sunshine")) ||
			(ability === "Quark Drive" && currentTerrain === "Electric")
		) {
			pokemon.find(".boostedStat").val("auto");
		} else {
			pokemon.find(".boostedStat").val("");
		}
	}
}

$("#p1 .ability").bind("keyup change", function () {
	autosetWeather($(this).val(), 0);
	autosetTerrain($(this).val(), 0);
	autosetQP($(this).closest(".poke-info"));
});

$("input[name='weather']").change(function () {
	var allPokemon = $('.poke-info');
	allPokemon.each(function () {
		autosetQP($(this));
	});
});

var lastManualWeather = "";
var lastAutoWeather = ["", ""];
function autosetWeather(ability, i) {
	var currentWeather = $("input:radio[name='weather']:checked").val();
	if (lastAutoWeather.indexOf(currentWeather) === -1) {
		lastManualWeather = currentWeather;
		lastAutoWeather[1 - i] = "";
	}
	switch (ability) {
		case "Drought":
		case "Orichalcum Pulse":
			lastAutoWeather[i] = "Sun";
			$("#sun").prop("checked", true);
			break;
		case "Drizzle":
			lastAutoWeather[i] = "Rain";
			$("#rain").prop("checked", true);
			break;
		case "Sand Stream":
			lastAutoWeather[i] = "Sand";
			$("#sand").prop("checked", true);
			break;
		case "Snow Warning":
			if (gen >= 9) {
				lastAutoWeather[i] = "Snow";
				$("#snow").prop("checked", true);
			} else {
				lastAutoWeather[i] = "Hail";
				$("#hail").prop("checked", true);
			}
			break;
		case "Desolate Land":
			lastAutoWeather[i] = "Harsh Sunshine";
			$("#harsh-sunshine").prop("checked", true);
			break;
		case "Primordial Sea":
			lastAutoWeather[i] = "Heavy Rain";
			$("#heavy-rain").prop("checked", true);
			break;
		case "Delta Stream":
			lastAutoWeather[i] = "Strong Winds";
			$("#strong-winds").prop("checked", true);
			break;
		default:
			break;
	}
}

$("input[name='terrain']").change(function () {
	var allPokemon = $('.poke-info');
	allPokemon.each(function () {
		autosetQP($(this));
	});
});

var lastManualTerrain = "";
var lastAutoTerrain = ["", ""];
function autosetTerrain(ability, i) {
	var currentTerrain = $("input:checkbox[name='terrain']:checked").val() || "No terrain";
	if (lastAutoTerrain.indexOf(currentTerrain) === -1) {
		lastManualTerrain = currentTerrain;
		lastAutoTerrain[1 - i] = "";
	}
	// terrain input uses checkbox instead of radio, need to uncheck all first
	$("input:checkbox[name='terrain']:checked").prop("checked", false);
	switch (ability) {
		case "Electric Surge":
		case "Hadron Engine":
			lastAutoTerrain[i] = "Electric";
			$("#electric").prop("checked", true);
			break;
		case "Grassy Surge":
			lastAutoTerrain[i] = "Grassy";
			$("#grassy").prop("checked", true);
			break;
		case "Misty Surge":
			lastAutoTerrain[i] = "Misty";
			$("#misty").prop("checked", true);
			break;
		case "Psychic Surge":
			lastAutoTerrain[i] = "Psychic";
			$("#psychic").prop("checked", true);
			break;
		default:
			lastAutoTerrain[i] = "";
			var newTerrain = lastAutoTerrain[1 - i] !== "" ? lastAutoTerrain[1 - i] : lastManualTerrain;
			if ("No terrain" !== newTerrain) {
				$("input:checkbox[name='terrain'][value='" + newTerrain + "']").prop("checked", true);
			}
			break;
	}
}

$("#p1 .item").bind("keyup change", function () {
	autosetStatus("#p1", $(this).val());
});

var lastManualStatus = { "#p1": "Healthy" };
var lastAutoStatus = { "#p1": "Healthy" };
function autosetStatus(p, item) {
	var currentStatus = $(p + " .status").val();
	if (item === "Flame Orb") {
		lastAutoStatus[p] = "Burned";
		$(p + " .status").val("Burned");
		$(p + " .status").change();
	} else if (item === "Toxic Orb") {
		lastAutoStatus[p] = "Badly Poisoned";
		$(p + " .status").val("Badly Poisoned");
		$(p + " .status").change();
	}
}

$(".status").bind("keyup change", function () {
	if ($(this).val() === 'Badly Poisoned') {
		$(this).parent().children(".toxic-counter").show();
	} else {
		$(this).parent().children(".toxic-counter").hide();
	}
});

var lockerMove = "";
// auto-update move details on select
$(".move-selector").change(function () {
	var moveName = $(this).val();
	var move = moves[moveName] || moves['(No Move)'];
	var moveGroupObj = $(this).parent();
	moveGroupObj.children(".move-bp").val(moveName === 'Present' ? 40 : move.bp);
	var m = moveName.match(HIDDEN_POWER_REGEX);
	if (m) {
		var pokeObj = $(this).closest(".poke-info");
		var pokemon = createPokemon(pokeObj);
		var actual = calc.Stats.getHiddenPower(GENERATION, pokemon.ivs);
		if (actual.type !== m[1]) {
			var hpIVs = calc.Stats.getHiddenPowerIVs(GENERATION, m[1]);
			if (hpIVs && gen < 7) {
				for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
					var legacyStat = LEGACY_STATS[gen][i];
					var stat = legacyStatToStat(legacyStat);
					pokeObj.find("." + legacyStat + " .ivs").val(hpIVs[stat] !== undefined ? hpIVs[stat] : 31);
					pokeObj.find("." + legacyStat + " .dvs").val(hpIVs[stat] !== undefined ? calc.Stats.IVToDV(hpIVs[stat]) : 15);
				}
				if (gen < 3) {
					var hpDV = calc.Stats.getHPDV({
						atk: pokeObj.find(".at .ivs").val(),
						def: pokeObj.find(".df .ivs").val(),
						spe: pokeObj.find(".sp .ivs").val(),
						spc: pokeObj.find(".sa .ivs").val()
					});
					pokeObj.find(".hp .ivs").val(calc.Stats.DVToIV(hpDV));
					pokeObj.find(".hp .dvs").val(hpDV);
				}
				pokeObj.change();
				moveGroupObj.children(".move-bp").val(gen >= 6 ? 60 : 70);
			}
		} else {
			moveGroupObj.children(".move-bp").val(actual.power);
		}
	} else if (gen >= 2 && gen <= 6 && HIDDEN_POWER_REGEX.test($(this).attr('data-prev'))) {
		// If this selector was previously Hidden Power but now isn't, reset all IVs/DVs to max.
		var pokeObj = $(this).closest(".poke-info");
		for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
			var legacyStat = LEGACY_STATS[gen][i];
			pokeObj.find("." + legacyStat + " .ivs").val(31);
			pokeObj.find("." + legacyStat + " .dvs").val(15);
		}
	}
	$(this).attr('data-prev', moveName);
	moveGroupObj.children(".move-type").val(move.type);
	moveGroupObj.children(".move-cat").val(move.category);
	moveGroupObj.children(".move-crit").prop("checked", move.willCrit === true);

	if (Array.isArray(move.multihit)) {
		moveGroupObj.children(".stat-drops").hide();
		moveGroupObj.children(".move-hits").show();
		var pokemon = $(this).closest(".poke-info");
		moveGroupObj.children(".move-hits").val(getMultiHitCountForMove(pokemon, moveName));
	} else {
		moveGroupObj.children(".move-hits").hide();
		moveGroupObj.children(".stat-drops").hide();
	}
	moveGroupObj.children(".move-z").prop("checked", false);
});

$(".item").change(function () {
	var itemName = $(this).val();
	var $metronomeControl = $(this).closest('.poke-info').find('.metronome');
	if (itemName === "Metronome") {
		$metronomeControl.show();
	} else {
		$metronomeControl.hide();
	}
	autosetQP($(this).closest(".poke-info"));
	applyMultiHitDropdownsForPokeInfo($(this).closest(".poke-info"));
});

function sortmons(a, b) {
	return parseInt(a.split("[")[1].split("]")[0]) - parseInt(b.split("[")[1].split("]")[0])
}

var STORAGE_SHOW_MEGA_BASE_SEPARATE = "nullcalc_showMegaBaseSeparate";

function getShowMegaBaseSeparate() {
	try {
		var v = localStorage.getItem(STORAGE_SHOW_MEGA_BASE_SEPARATE);
		if (v === null) return true;
		return v === "true" || v === "1";
	} catch (e) {
		return true;
	}
}

function setShowMegaBaseSeparate(on) {
	try {
		localStorage.setItem(STORAGE_SHOW_MEGA_BASE_SEPARATE, on ? "true" : "false");
	} catch (e) {}
}

var STORAGE_IMPORT_MEGAS_AUTO = "nullcalc_importMegasAuto";

function getImportMegasAuto() {
	try {
		var v = localStorage.getItem(STORAGE_IMPORT_MEGAS_AUTO);
		if (v === null) return true;
		return v === "true" || v === "1";
	} catch (e) {
		return true;
	}
}

function setImportMegasAuto(on) {
	try {
		localStorage.setItem(STORAGE_IMPORT_MEGAS_AUTO, on ? "true" : "false");
	} catch (e) {}
}

/** Prefer the visible menu toggle when present so Import Megas works even if localStorage is blocked or out of sync. */
function importMegasAutoIsOn() {
	var el = document.getElementById("import-megas-auto");
	if (el) return !!el.checked;
	return typeof getImportMegasAuto === "function" && getImportMegasAuto();
}

var STORAGE_ONLY_IMPORT_AVAILABLE_MEGAS = "nullcalc_onlyImportAvailableMegas";

function getOnlyImportAvailableMegas() {
	try {
		var v = localStorage.getItem(STORAGE_ONLY_IMPORT_AVAILABLE_MEGAS);
		if (v === null) return true;
		return v === "true" || v === "1";
	} catch (e) {
		return true;
	}
}

function setOnlyImportAvailableMegas(on) {
	try {
		localStorage.setItem(STORAGE_ONLY_IMPORT_AVAILABLE_MEGAS, on ? "true" : "false");
	} catch (e) {}
}

function onlyImportAvailableMegasIsOn() {
	var el = document.getElementById("only-import-available-megas");
	if (el) return !!el.checked;
	return typeof getOnlyImportAvailableMegas === "function" && getOnlyImportAvailableMegas();
}

/** Hardcoded map: js/data/mega_availability_levels.js (MEGA_AVAILABILITY_MIN_LEVELS). */
function getMegaAvailabilityMinLevels() {
	if (typeof MEGA_AVAILABILITY_MIN_LEVELS !== "undefined" && MEGA_AVAILABILITY_MIN_LEVELS && typeof MEGA_AVAILABILITY_MIN_LEVELS === "object") {
		return MEGA_AVAILABILITY_MIN_LEVELS;
	}
	return {};
}

/**
 * When "Only Import Available Megas" is on, listed megas require base level >= threshold.
 * Megas not listed are still imported (no extra level gate).
 */
function shouldImportMegaAtLevel(megaSpeciesName, baseLevel) {
	if (!onlyImportAvailableMegasIsOn()) return true;
	var map = getMegaAvailabilityMinLevels();
	if (!map || !megaSpeciesName || !Object.prototype.hasOwnProperty.call(map, megaSpeciesName)) return true;
	var min = map[megaSpeciesName];
	if (typeof min !== "number" || isNaN(min)) return true;
	var lv = typeof baseLevel === "number" ? baseLevel : parseInt(baseLevel, 10);
	if (isNaN(lv)) return false;
	return lv >= min;
}

var STORAGE_MEGAS_BOX2 = "nullcalc_megasBox2";

function getMegasBox2() {
	try {
		var v = localStorage.getItem(STORAGE_MEGAS_BOX2);
		if (v === null) return true;
		return v === "true" || v === "1";
	} catch (e) {
		return true;
	}
}

function setMegasBox2(on) {
	try {
		localStorage.setItem(STORAGE_MEGAS_BOX2, on ? "true" : "false");
	} catch (e) {}
}

/** Prefer the settings menu toggle when present. */
function megasBox2IsOn() {
	var el = document.getElementById("megas-box2-toggle");
	if (el) return !!el.checked;
	return typeof getMegasBox2 === "function" && getMegasBox2();
}

/** When "show separately" is off, drop base-form team rows if a mega of the same line is also on the team. */
function filterTrainerPoksHideBaseWhenMegaPresent(trainerPoks) {
	if (!trainerPoks || !trainerPoks.length) return trainerPoks;
	if (getShowMegaBaseSeparate()) return trainerPoks.slice();
	if (typeof pokedex === "undefined") return trainerPoks.slice();
	var basesWithMegaOnTeam = {};
	var i;
	for (i = 0; i < trainerPoks.length; i++) {
		var sp = speciesFromTrainerTeamEntry(trainerPoks[i]);
		if (sp.indexOf("-Mega") !== -1) {
			var megaP = pokedex[sp];
			var base = megaP && megaP.baseSpecies ? megaP.baseSpecies : null;
			if (base) basesWithMegaOnTeam[base] = true;
		}
	}
	return trainerPoks.filter(function (entry) {
		var species = speciesFromTrainerTeamEntry(entry);
		if (species.indexOf("-Mega") !== -1) return true;
		return !basesWithMegaOnTeam[species];
	});
}

function getTrainerNameFromSet(fullSetName) {
	if (!fullSetName || !fullSetName.includes("(")) {
		return String(fullSetName || "").trim();
	}
	// Prefer "Species (Trainer)" boundary so trainer names with nested parens (e.g. "(Defense Room)") parse correctly.
	var sep = fullSetName.indexOf(" (");
	if (sep !== -1) {
		return fullSetName.substring(sep + 2, fullSetName.lastIndexOf(")")).trim();
	}
	return fullSetName.substring(fullSetName.indexOf("(") + 1, fullSetName.lastIndexOf(")")).trim();
}

function normalizeTrainerKeyForIndex(s) {
	if (!s) return "";
	return String(s).trim().toLowerCase().replace(/\s+/g, " ").replace(/＆/g, "&");
}

function getTrainerIndex(trainerName) {
	if (!trainerName) return null;
	var all_poks = SETDEX_SV;
	for (const [pok_name, poks] of Object.entries(all_poks)) {
		if (poks[trainerName] && poks[trainerName]["index"] !== undefined) {
			return Number(poks[trainerName]["index"]);
		}
	}
	if (typeof trainerNamesMatch === "function") {
		for (const [pok_name, poks] of Object.entries(all_poks)) {
			for (const key of Object.keys(poks)) {
				var entry = poks[key];
				if (!entry || entry["index"] === undefined) continue;
				if (trainerNamesMatch(key, trainerName) || trainerNamesMatch(trainerName, key)) {
					return Number(entry["index"]);
				}
			}
		}
	}
	var want = normalizeTrainerKeyForIndex(trainerName);
	if (want) {
		for (const [pok_name, poks] of Object.entries(all_poks)) {
			for (const key of Object.keys(poks)) {
				var entry = poks[key];
				if (!entry || entry["index"] === undefined) continue;
				if (normalizeTrainerKeyForIndex(key) === want) {
					return Number(entry["index"]);
				}
			}
		}
	}
	return null;
}

/** Prefer the set-selector's Select2 display (not the first #p2 .select2-chosen — moves can contain " ("). */
function getOpposingSetStringForTrainerNav() {
	var $input = $("#p2 input.set-selector").first();
	if (!$input.length) return "";
	var $container = $input.next(".select2-container");
	if (!$container.length) {
		$container = $input.siblings(".select2-container").first();
	}
	var chosen = $container.find(".select2-chosen").first().text().trim();
	var val = ($input.val() || "").trim();
	if (chosen && chosen.indexOf(" (") !== -1) return chosen;
	if (val && val.indexOf(" (") !== -1) return val;
	if (chosen) return chosen;
	return val;
}

/** Trainer index for the exact species + trainer row (avoids wrong index when one name appears on multiple species). */
function getTrainerIndexFromSet(fullSetName) {
	if (!fullSetName || fullSetName.indexOf(" (") === -1) return null;
	var pokemonName = fullSetName.substring(0, fullSetName.indexOf(" (")).trim();
	var trainerName = getTrainerNameFromSet(fullSetName);
	var keysToTry = [pokemonName];
	if (typeof resolveSetdexKey === "function") {
		var alt = resolveSetdexKey(pokemonName);
		if (alt && alt !== pokemonName) keysToTry.push(alt);
	}
	for (var ki = 0; ki < keysToTry.length; ki++) {
		var poks = SETDEX_SV[keysToTry[ki]];
		if (!poks) continue;
		var entry = poks[trainerName];
		if (entry && entry.index !== undefined) return Number(entry.index);
		if (typeof trainerNamesMatch === "function") {
			for (var key of Object.keys(poks)) {
				var e = poks[key];
				if (!e || e.index === undefined) continue;
				if (trainerNamesMatch(key, trainerName) || trainerNamesMatch(trainerName, key)) {
					return Number(e.index);
				}
			}
		}
		var want = normalizeTrainerKeyForIndex(trainerName);
		for (var key2 of Object.keys(poks)) {
			var e2 = poks[key2];
			if (!e2 || e2.index === undefined) continue;
			if (normalizeTrainerKeyForIndex(key2) === want) return Number(e2.index);
		}
	}
	return getTrainerIndex(trainerName);
}

/** Min/max SETDEX index for every row matching this trainer (one trainer spans multiple indices). */
function getTrainerIndexBoundsForName(trainerName) {
	if (!trainerName) return null;
	var min = null;
	var max = null;
	var all_poks = SETDEX_SV;
	for (const [pok_name, poks] of Object.entries(all_poks)) {
		for (const key of Object.keys(poks)) {
			var entry = poks[key];
			if (!entry || entry.index === undefined) continue;
			var match = false;
			if (key === trainerName) match = true;
			else if (typeof trainerNamesMatch === "function" && (trainerNamesMatch(key, trainerName) || trainerNamesMatch(trainerName, key))) match = true;
			else if (normalizeTrainerKeyForIndex(key) === normalizeTrainerKeyForIndex(trainerName)) match = true;
			if (!match) continue;
			var ix = Number(entry.index);
			if (isNaN(ix)) continue;
			if (min === null || ix < min) min = ix;
			if (max === null || ix > max) max = ix;
		}
	}
	if (min === null) return null;
	return { min: min, max: max };
}

/** Route index from a TR_NAMES entry like "[123]Species (Trainer)". */
function parseRouteIndexFromTrainerTeamEntry(entry) {
	if (!entry || entry.indexOf("[") !== 0) return null;
	var close = entry.indexOf("]");
	if (close <= 1) return null;
	var n = parseInt(entry.substring(1, close), 10);
	return isNaN(n) ? null : n;
}

/**
 * Bounds for Next/Previous trainer from the full opposing team list (not filtered DOM).
 * When mega/base filter hides the lead slot, visible icons alone gave an inflated min and broke Previous.
 */
function getOpposingTeamIndexBoundsFromDom() {
	// Wandering Spirit mirror shows the player's team; those data-ids map to unrelated SETDEX indices.
	// Use getTrainerIndexBoundsForName("Wandering Spirit") instead so Next/Previous stay on route order.
	if ($('.trainer-pok-list-opposing[data-trainer-name="Wandering Spirit"]').length) {
		return null;
	}
	var fs = getOpposingSetStringForTrainerNav();
	if (!fs) fs = getFullSetNameFromPokeInfo($("#p2"));
	if (!fs) return null;
	var trainerPoks = get_trainer_poks(fs);
	if (!trainerPoks || !trainerPoks.length) return null;
	var min = null;
	var max = null;
	for (var i = 0; i < trainerPoks.length; i++) {
		var ix = parseRouteIndexFromTrainerTeamEntry(trainerPoks[i]);
		if (ix === null || ix === undefined) continue;
		if (min === null || ix < min) min = ix;
		if (max === null || ix > max) max = ix;
	}
	if (min === null) return null;
	return { min: min, max: max };
}

function getSortedUniqueTrainerIndices() {
	var seen = {};
	var all_poks = SETDEX_SV;
	for (const [pok_name, poks] of Object.entries(all_poks)) {
		for (const key of Object.keys(poks)) {
			var entry = poks[key];
			if (entry && entry["index"] !== undefined && entry["index"] !== null) {
				var ix = Number(entry["index"]);
				if (!isNaN(ix)) seen[ix] = true;
			}
		}
	}
	return Object.keys(seen).map(function (k) { return parseInt(k, 10); }).sort(function (a, b) { return a - b; });
}

function getNextTrainerIndexAfter(curIndex) {
	if (curIndex === null || curIndex === undefined || isNaN(Number(curIndex))) return undefined;
	var cur = Number(curIndex);
	var sorted = getSortedUniqueTrainerIndices();
	for (var i = 0; i < sorted.length; i++) {
		if (sorted[i] > cur) return sorted[i];
	}
	return undefined;
}

function getPreviousTrainerIndexBefore(curIndex) {
	if (curIndex === null || curIndex === undefined || isNaN(Number(curIndex))) return undefined;
	var cur = Number(curIndex);
	var sorted = getSortedUniqueTrainerIndices();
	for (var i = sorted.length - 1; i >= 0; i--) {
		if (sorted[i] < cur) return sorted[i];
	}
	return undefined;
}

function getGauntletForTrainerSafe(trainerName) {
	if (typeof getGauntletForTrainer === "function") {
		return getGauntletForTrainer(trainerName);
	}
	return null;
}

/** First/last SETDEX index for the gauntlet (first trainer's min … last trainer's max). Used so Next/Previous leave the gauntlet from the correct route endpoints. */
function getGauntletEndpointIndexBounds(trainerName) {
	var gauntlet = getGauntletForTrainerSafe(trainerName);
	if (!gauntlet || !gauntlet.trainers || gauntlet.trainers.length === 0) return null;
	var firstBounds = getTrainerIndexBoundsForName(gauntlet.trainers[0]);
	var lastBounds = getTrainerIndexBoundsForName(gauntlet.trainers[gauntlet.trainers.length - 1]);
	if (!firstBounds || !lastBounds) return null;
	return { min: firstBounds.min, max: lastBounds.max };
}

/** Match SETDEX set name keys to the current opponent trainer (avoids parsing bugs on "[idx]Species (key)" and lists every row). */
function trainerSetKeyMatchesTrainer(setKey, trueName) {
	if (!trueName || setKey == null || setKey === undefined) return false;
	if (typeof trainerNamesMatch === "function") {
		return trainerNamesMatch(trueName, setKey) || trainerNamesMatch(setKey, trueName);
	}
	return String(setKey).trim() === String(trueName).trim();
}

/**
 * True when #p2's trainer is Wandering Spirit or shares a gauntlet with Wandering Spirit
 * (so the Wandering Spirit team slot mirrors the player's Team box).
 */
function isOpponentInWanderingSpiritGauntletContext(oppTrainerFromSet) {
	if (!oppTrainerFromSet) return false;
	if (oppTrainerFromSet === "Wandering Spirit") return true;
	if (typeof trainerNamesMatch === "function" && trainerNamesMatch("Wandering Spirit", oppTrainerFromSet)) return true;
	if (typeof getGauntletForTrainer !== "function") return false;
	var gWs = getGauntletForTrainer("Wandering Spirit");
	var gCur = getGauntletForTrainer(oppTrainerFromSet);
	return !!(gWs && gCur && gWs.trainers === gCur.trainers);
}

function get_trainer_poks(trainer_name) {
	var true_name;
	if (trainer_name.includes("(")) {
		true_name = getTrainerNameFromSet(trainer_name);
	} else {
		true_name = trainer_name;
	}
	window.CURRENT_TRAINER = true_name;
	// SETDEX placeholder species "None" for Wandering Spirit — use the player's Team box instead
	// (do not require $("#p2 .ability"): it is still old when set-selector.change runs get_trainer_poks first)
	if ($("#p2").length && true_name === "Wandering Spirit") {
		var oppSet = getFullSetNameFromPokeInfo($("#p2"));
		if (!oppSet && typeof getOpposingSetStringForTrainerNav === "function") {
			oppSet = getOpposingSetStringForTrainerNav();
		}
		var oppTrainer = oppSet ? getTrainerNameFromSet(oppSet) : "";
		var wsNameOk = oppTrainer && (
			true_name === oppTrainer ||
			(typeof trainerNamesMatch === "function" && trainerNamesMatch(true_name, oppTrainer)) ||
			(true_name === "Wandering Spirit" && isOpponentInWanderingSpiritGauntletContext(oppTrainer))
		);
		if (oppSet && wsNameOk) {
			var ws = [];
			var slot = 0;
			$("#team-poke-list .trainer-pok.left-side").each(function () {
				var id = $(this).attr("data-id");
				if (!id) return;
				ws.push("[" + (10000 + slot) + "]" + id);
				slot++;
			});
			if (ws.length > 0) {
				return ws;
			}
			// Empty team: do not return [] — fall through so SETDEX shows [None (Wandering Spirit)] only
		}
	}
	var matches = [];
	if (typeof SETDEX_SV === "undefined" || !SETDEX_SV) {
		return matches;
	}
	for (var pok_name in SETDEX_SV) {
		if (!Object.prototype.hasOwnProperty.call(SETDEX_SV, pok_name)) continue;
		var poks = SETDEX_SV[pok_name];
		if (!poks || typeof poks !== "object") continue;
		for (var setKey in poks) {
			if (!Object.prototype.hasOwnProperty.call(poks, setKey)) continue;
			var entry = poks[setKey];
			if (!entry || entry.index === undefined) continue;
			if (trainerSetKeyMatchesTrainer(setKey, true_name)) {
				matches.push("[" + entry.index + "]" + pok_name + " (" + setKey + ")");
			}
		}
	}
	return matches;
}

/** Opponent doubles fight: show ally Pokémon under the player team for reference (setdex trainer key varies). */
var TAG_PARTNER_OPPONENT_TRAINER = "Team Aqua Grunt & Team Aqua Steve";
var TAG_PARTNER_OPPONENT_TRAINER_MAGMA = "Magma Leader Maxie & Tabitha";

function isTagPartnerOpponentTrainer(trainerName) {
	if (!trainerName) return false;
	if (trainerName === TAG_PARTNER_OPPONENT_TRAINER || trainerName === TAG_PARTNER_OPPONENT_TRAINER_MAGMA) return true;
	if (typeof trainerNamesMatch === "function") {
		return (
			trainerNamesMatch(TAG_PARTNER_OPPONENT_TRAINER, trainerName) ||
			trainerNamesMatch(trainerName, TAG_PARTNER_OPPONENT_TRAINER) ||
			trainerNamesMatch(TAG_PARTNER_OPPONENT_TRAINER_MAGMA, trainerName) ||
			trainerNamesMatch(trainerName, TAG_PARTNER_OPPONENT_TRAINER_MAGMA)
		);
	}
	return false;
}

/** Which setdex trainer key to use for the Tag Partner row (Partner Rival vs Partner Steven). */
function getTagPartnerSetTrainerKey(opponentTrainerName) {
	if (!opponentTrainerName) return "Partner Rival";
	if (opponentTrainerName === TAG_PARTNER_OPPONENT_TRAINER_MAGMA) return "Partner Steven";
	if (typeof trainerNamesMatch === "function") {
		if (
			trainerNamesMatch(TAG_PARTNER_OPPONENT_TRAINER_MAGMA, opponentTrainerName) ||
			trainerNamesMatch(opponentTrainerName, TAG_PARTNER_OPPONENT_TRAINER_MAGMA)
		) {
			return "Partner Steven";
		}
	}
	return "Partner Rival";
}

function buildTagPartnerTeamHtml(sortedPoks) {
	var trpok_html = "";
	for (var i in sortedPoks) {
		var pok_name_raw = sortedPoks[i].split("]")[1].split(" (")[0];
		try {
			pok_name_raw = decodeURIComponent(pok_name_raw);
		} catch (e) {}
		var pok_name = normalizeTrainerIconSpeciesName(pok_name_raw);
		var poke = { name: pok_name };
		var idAttr = sortedPoks[i].split("]")[1];
		var pok =
			`<img class="trainer-pok tag-partner-pok" ${pokemonIconImgSrcAttributes(poke, false)} alt="" data-id="${idAttr}" title="${sortedPoks[i]}, ${sortedPoks[i]} BP">`;
		trpok_html += pok;
	}
	return trpok_html;
}

function updateTagPartnerBox() {
	var section = document.getElementById("tag-partner-team-section");
	var list = document.getElementById("tag-partner-poke-list");
	if (!section || !list) return;

	var fs = getFullSetNameFromPokeInfo($("#p2"));
	var trainerName = fs ? getTrainerNameFromSet(fs) : "";
	if (!isTagPartnerOpponentTrainer(trainerName)) {
		section.setAttribute("hidden", "hidden");
		list.innerHTML = "";
		syncAlliesFaintedFromOpponentMarks();
		return;
	}

	var prevCT = window.CURRENT_TRAINER;
	var partnerEntries;
	try {
		partnerEntries = get_trainer_poks(getTagPartnerSetTrainerKey(trainerName));
	} finally {
		window.CURRENT_TRAINER = prevCT;
	}

	if (!partnerEntries || !partnerEntries.length) {
		section.setAttribute("hidden", "hidden");
		list.innerHTML = "";
		syncAlliesFaintedFromOpponentMarks();
		return;
	}

	partnerEntries = partnerEntries.slice().sort(sortmons);
	partnerEntries = filterTrainerPoksHideBaseWhenMegaPresent(partnerEntries);
	list.innerHTML = buildTagPartnerTeamHtml(partnerEntries);
	section.removeAttribute("hidden");
	$("#tag-partner-poke-list .tag-partner-pok").each(function () {
		var id = $(this).attr("data-id");
		if (id && tagPartnerDeadSetIds.has(id)) {
			$(this).addClass("tag-partner-dead");
		}
	});
	syncAlliesFaintedFromOpponentMarks();
}

function escapeAttr(s) {
	if (s == null || s === undefined) return "";
	return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Strip SETDEX None (Wandering Spirit) when the mirrored team has at least one mon (no ? placeholder in the grid).
 * With 0 team mons, leave sortedPoks unchanged so SETDEX can still show None alone.
 */
function ensureWanderingSpiritPlaceholderAtEnd(sortedPoks) {
	if (!sortedPoks || typeof SETDEX_SV === "undefined" || !SETDEX_SV.None || !SETDEX_SV.None["Wandering Spirit"]) {
		return sortedPoks;
	}
	var teamCount = $("#team-poke-list .trainer-pok.left-side").length;
	if (teamCount < 1) {
		return sortedPoks;
	}
	var out = [];
	for (var i = 0; i < sortedPoks.length; i++) {
		var full = fullSetFromTrainerTeamEntry(sortedPoks[i]);
		if (full === "None (Wandering Spirit)") continue;
		out.push(sortedPoks[i]);
	}
	return out;
}

function renderTrainerTeamBox(trainerNameOrFullSet, boxIndex, displayTrainerName) {
	// Pass full "Species (Trainer)" when available so get_trainer_poks does not mangle nested parens in trainer-only strings.
	var trainerPoks = get_trainer_poks(trainerNameOrFullSet);
	var sortedPoks = trainerPoks.sort(sortmons);
	sortedPoks = filterTrainerPoksHideBaseWhenMegaPresent(sortedPoks);
	if (displayTrainerName === "Wandering Spirit") {
		sortedPoks = ensureWanderingSpiritPlaceholderAtEnd(sortedPoks);
	}
	var safeTrainer = escapeAttr(displayTrainerName);
	var trpok_html = "";
	for (var i in sortedPoks) {
		var pok_name_raw = sortedPoks[i].split("]")[1].split(" (")[0];
		try {
			pok_name_raw = decodeURIComponent(pok_name_raw);
		} catch (e) {}
		var pok_name = normalizeTrainerIconSpeciesName(pok_name_raw);
		var poke = { name: pok_name };
		var pok =
			`<img class="trainer-pok right-side" ${pokemonIconImgSrcAttributes(poke, false)} data-id="${sortedPoks[i].split("]")[1]}" data-trainer-name="${safeTrainer}" data-trainer-index="${boxIndex}" title="${sortedPoks[i]}, ${sortedPoks[i]} BP">`;
		trpok_html += pok;
	}
	return {
		trainerName: displayTrainerName,
		html: trpok_html,
		boxIndex: boxIndex
	};
}

var opposingMarkedSetIds = new Set();
var tagPartnerDeadSetIds = new Set();
var lastRenderedTrainerKey = null;
/** When false, do not write lasttimetrainer from #p2 set-selector (avoids clobbering before restore on load). */
var lastOpposingTrainerPersistEnabled = false;

function persistLastOpposingTrainerIndexFromFullSetName(fullSetName) {
	if (!lastOpposingTrainerPersistEnabled || !fullSetName || fullSetName.indexOf(" (") === -1) return;
	var idx = getTrainerIndexFromSet(fullSetName);
	if (idx !== null && idx !== undefined && !isNaN(idx)) {
		localStorage.setItem("lasttimetrainer", String(idx));
	}
}

function syncAlliesFaintedFromOpponentMarks() {
	var n;
	var tagSection = document.getElementById("tag-partner-team-section");
	if (tagSection && !tagSection.hasAttribute("hidden")) {
		n = $(".tag-partner-pok.tag-partner-dead").length;
	} else {
		n = $(".trainer-pok.right-side.opponent-marked").length;
	}
	if (n > 5) n = 5;
	var v = String(n);
	$('.poke-info .alliesFainted').val(v);
	var $p1 = $('#p1 .alliesFainted');
	if ($p1.length) {
		$p1.trigger('change');
	} else {
		$('.poke-info .alliesFainted').first().trigger('change');
	}
}

/** Opposing Pokémon with Wandering Spirit mirrors the player's Team box (#team-poke-list). */
function renderTrainerTeamMirrorFromPlayer() {
	var firstContainer = $("#trainer-poks-first");
	var remainingContainer = $("#trainer-poks-remaining");
	if (firstContainer.length === 0 || remainingContainer.length === 0) {
		var container = $(".trainer-poks").first();
		if (container.length) {
			container.empty();
			firstContainer = container;
			remainingContainer = container;
		}
	} else {
		firstContainer.empty();
		remainingContainer.empty();
	}
	var $mons = $("#team-poke-list .trainer-pok.left-side");
	var $box = $('<div class="trainer-pok-list-opposing" data-trainer-index="0" data-trainer-name="Wandering Spirit"></div>');
	var entryIds = [];
	$mons.each(function () {
		var id = $(this).attr("data-id");
		if (!id) return;
		entryIds.push({ id: id, el: this });
	});
	var synthetic = entryIds.map(function (e, i) {
		return "[" + (10000 + i) + "]" + e.id;
	});
	var filteredSynthetic = filterTrainerPoksHideBaseWhenMegaPresent(synthetic);
	var kept = {};
	for (var fi = 0; fi < filteredSynthetic.length; fi++) {
		kept[fullSetFromTrainerTeamEntry(filteredSynthetic[fi])] = true;
	}
	var slot = 0;
	for (var ei = 0; ei < entryIds.length; ei++) {
		var id = entryIds[ei].id;
		if (!kept[id]) continue;
		var trTitle = "[" + (10000 + slot) + "]" + id;
		var $img = $(entryIds[ei].el).clone(false);
		$img.removeClass("left-side").addClass("right-side");
		$img.attr("title", trTitle + ", " + trTitle + " BP");
		$box.append($img);
		slot++;
	}
	firstContainer.append($box);
	$(".trainer-pok.right-side").each(function () {
		var id = $(this).attr("data-id");
		if (id && opposingMarkedSetIds.has(id)) {
			$(this).addClass("opponent-marked");
		}
	});
	syncAlliesFaintedFromOpponentMarks();
}

function updateGauntletNavLabel(gauntlet) {
	var $el = $("#gauntlet-name-label");
	if ($el.length === 0) return;
	if (gauntlet && gauntlet.name) {
		$el.text(gauntlet.name).removeAttr("hidden");
	} else {
		$el.text("").attr("hidden", "hidden");
	}
}

/** Display string for the set selector when a Team-box mon is loaded into #p2 via Wandering Spirit mirror (not a SETDEX row). */
function formatWanderingSpiritMirrorDisplayLabel(mirroredTeamSetFullName) {
	if (!mirroredTeamSetFullName || typeof mirroredTeamSetFullName !== "string") {
		return "None (Wandering Spirit)";
	}
	var idx = mirroredTeamSetFullName.indexOf(" (");
	if (idx === -1) {
		var sp = mirroredTeamSetFullName.trim();
		return sp ? sp + " (Wandering Spirit)" : "None (Wandering Spirit)";
	}
	var species = mirroredTeamSetFullName.substring(0, idx).trim();
	return (species || "None") + " (Wandering Spirit)";
}

function syncOpposingHeaderLabel(gauntlet) {
	updateGauntletNavLabel(gauntlet);
}

function renderAllTrainerTeams(fullSetName) {
	var trainerName = getTrainerNameFromSet(fullSetName);
	var gauntlet = getGauntletForTrainerSafe(trainerName);
	var trainerKey = gauntlet ? gauntlet.name || gauntlet.trainers.join(",") : trainerName;
	if (lastRenderedTrainerKey !== null && lastRenderedTrainerKey !== trainerKey) {
		opposingMarkedSetIds.clear();
	}
	lastRenderedTrainerKey = trainerKey;

	// Solo Wandering Spirit: mirror only. In a gauntlet, render all trainers (WS slot still mirrors via get_trainer_poks).
	if (trainerName === "Wandering Spirit" && !gauntlet) {
		syncOpposingHeaderLabel(null);
		renderTrainerTeamMirrorFromPlayer();
		return;
	}

	var firstContainer = $("#trainer-poks-first");
	var remainingContainer = $("#trainer-poks-remaining");
	if (firstContainer.length === 0 || remainingContainer.length === 0) {
		var container = $(".trainer-poks").first();
		if (container.length) {
			container.empty();
			firstContainer = container;
			remainingContainer = container;
		}
	} else {
		firstContainer.empty();
		remainingContainer.empty();
	}

	var trainersToRender = gauntlet ? gauntlet.trainers : [fullSetName];

	for (var j = 0; j < trainersToRender.length; j++) {
		var tm = trainersToRender[j];
		var teamBox = gauntlet
			? renderTrainerTeamBox(tm, j, tm)
			: renderTrainerTeamBox(fullSetName, j, trainerName);
		var boxHtml = `<div class="trainer-pok-list-opposing" data-trainer-index="${j}" data-trainer-name="${escapeAttr(teamBox.trainerName)}">`;
		boxHtml += teamBox.html;
		boxHtml += "</div>";
		if (j === 0) {
			firstContainer.append(boxHtml);
		} else {
			remainingContainer.append(boxHtml);
		}
	}
	$(".trainer-pok.right-side").each(function () {
		var id = $(this).attr("data-id");
		if (id && opposingMarkedSetIds.has(id)) {
			$(this).addClass("opponent-marked");
		}
	});
	syncAlliesFaintedFromOpponentMarks();
	syncOpposingHeaderLabel(gauntlet);
	updateTagPartnerBox();
}

function getFullSetNameFromPokeInfo(container) {
	if (container.is("#p2") && window._wsMirrorHeaderActive && window._wsMirrorDisplayLabel) {
		return window._wsMirrorDisplayLabel;
	}
	var setSelectorEl = container.find("input.set-selector").first();
	var fullSetName = setSelectorEl.length ? setSelectorEl.val() : "";
	if (!fullSetName) fullSetName = container.find(".set-selector").val();
	if (!fullSetName && container.find(".select2-chosen").length) {
		fullSetName = container.find(".select2-chosen").first().text().trim();
	}
	if (!fullSetName && container.find(".select2-container").length) {
		fullSetName = container.find(".select2-container .select2-chosen").first().text().trim();
	}
	if (!fullSetName && setSelectorEl.length && setSelectorEl.data("select2")) {
		try { fullSetName = setSelectorEl.select2("val"); } catch (e) {}
	}
	if (!fullSetName) fullSetName = container.find(".select2-chosen").first().text().trim();
	// Opposing Select2 can show "None (Wandering Spirit)" while input .val() is still empty.
	if (!fullSetName && container.is("#p2") && typeof getOpposingSetStringForTrainerNav === "function") {
		fullSetName = getOpposingSetStringForTrainerNav();
	}
	return fullSetName || "";
}

function getActiveSpeciesNameFromPokeInfo(pokeInfo) {
	var setName = getFullSetNameFromPokeInfo(pokeInfo);
	var name;
	if (!setName || setName.indexOf("(") === -1) {
		name = (setName || "").trim();
	} else {
		var pokemonName = setName.substring(0, setName.indexOf(" (")).trim();
		var species = pokedex[pokemonName];
		if (species) {
			name = (species.otherFormes || (species.baseSpecies && species.baseSpecies !== pokemonName)) ?
				(pokeInfo.find(".forme").val() || pokemonName) : pokemonName;
		} else {
			name = pokemonName;
		}
	}
	return name;
}

/** Strip "[n] " prefix and " (set)" suffix from species fragment (set-selector / getActiveSpecies quirks). */
function normalizeSetSpeciesFragment(name) {
	if (!name) return "";
	var n = String(name).trim();
	if (n.indexOf("]") !== -1) n = n.split("]").pop().trim();
	if (n.indexOf(" (") !== -1) n = n.split(" (")[0].trim();
	return n;
}

/** Multi-hit dropdown default hits (3 = average for 2–5). Water Shuriken uses normal multihit rules for all users. */
function getMultiHitCountForMove(pokeInfo, moveName) {
	if (!moveName || moveName === "(No Move)") return 3;
	var move = moves[moveName] || moves["(No Move)"];
	if (!move || !Array.isArray(move.multihit)) return 3;
	var ability = pokeInfo.find(".ability").val();
	var item = pokeInfo.find(".item").val();
	if (ability === "Skill Link") return 5;
	if (item === "Loaded Dice") return 4;
	if ((ability === "Protean" || ability === "Libero") && !moveName.match(/Water Shuriken/)) return 5;
	return 3;
}

function applyMultiHitDropdownsForPokeInfo(pokeInfo) {
	pokeInfo.find(".move-selector").each(function () {
		var mn = $(this).val();
		var mv = moves[mn] || moves["(No Move)"];
		if (!mv || !Array.isArray(mv.multihit)) return;
		$(this).parent().children(".move-hits").val(getMultiHitCountForMove(pokeInfo, mn));
	});
}

function isDondozoSpeciesUi(pokeInfo) {
	if (typeof gen === "undefined" || gen < 9) return false;
	if (typeof pokedex === "undefined" || !pokedex.Dondozo) return false;
	var full = getFullSetNameFromPokeInfo(pokeInfo);
	if (!full) return false;
	var baseFromSet = full.indexOf(" (") !== -1
		? full.substring(0, full.indexOf(" (")).trim()
		: full.trim();
	if (baseFromSet !== "Dondozo") return false;
	var n = getActiveSpeciesNameFromPokeInfo(pokeInfo);
	return (n || "").trim() === "Dondozo";
}

function applyCommanderDondozoStatDelta(pokeInfo, delta) {
	for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
		var legacy = LEGACY_STATS[gen][i];
		if (legacy === "hp") continue;
		var $boost = pokeInfo.find("." + legacy + " .boost");
		if (!$boost.length) continue;
		var v = parseInt($boost.val(), 10);
		if (isNaN(v)) v = 0;
		v = Math.max(-6, Math.min(6, v + delta));
		$boost.val(v);
	}
	var $trigger = pokeInfo.find(".boost").first();
	if ($trigger.length) $trigger.change();
}

function updateCommanderDondozoButton(pokeInfo) {
	var $mount = pokeInfo.find(".commander-dondozo-mount");
	if (!$mount.length) return;
	if (!isDondozoSpeciesUi(pokeInfo)) {
		$mount.empty();
		return;
	}
	var idSuffix = pokeInfo.prop("id") === "p2" ? "R1" : "L1";
	if (!$mount.find(".commanderDondozoToggle").length) {
		var cmdTitle = "Commander: +2 stages to Atk, Def, SpA, SpD, Spe";
		$mount.html(
			"<span class=\"commander-dondozo-wrap\">" +
			"<input type=\"checkbox\" id=\"commanderDondozo" + idSuffix + "\" class=\"commanderDondozoToggle calc-trigger visually-hidden\" title=\"" + cmdTitle + "\" />" +
			"<label class=\"btn commander-dondozo-btn\" for=\"commanderDondozo" + idSuffix + "\" title=\"" + cmdTitle + "\">Commander</label>" +
			"</span>"
		);
	}
	window._commanderProgrammatic = true;
	$mount.find(".commanderDondozoToggle").prop("checked", false);
	window._commanderProgrammatic = false;
}

function refreshOpposingTeamIfWanderingSpirit() {
	var fs = getFullSetNameFromPokeInfo($("#p2"));
	if (!fs) return;
	var oppTrainer = getTrainerNameFromSet(fs);
	if (!isOpponentInWanderingSpiritGauntletContext(oppTrainer)) return;
	renderAllTrainerTeams(fs);
}

/** Re-run Wandering Spirit mirror when #team-poke-list changes (drag/drop, clear, import reset, etc.). */
function initTeamPokeListObserver() {
	var el = document.getElementById("team-poke-list");
	if (!el || typeof MutationObserver === "undefined") return;
	var obs = new MutationObserver(function () {
		refreshOpposingTeamIfWanderingSpirit();
	});
	obs.observe(el, { childList: true, subtree: false });
}

function resolveSetdexKey(pokemonName) {
	if (!pokemonName || typeof setdex === "undefined") return pokemonName;
	// Per-plate formes often have their own setdex bucket (e.g. Arceus-Grass); must win over legacy "Arceus"
	if (setdex[pokemonName]) return pokemonName;
	if (pokemonName.indexOf("Arceus-") === 0 && setdex["Arceus"]) return "Arceus";
	var spec = pokedex[pokemonName];
	if (spec && spec.baseSpecies && setdex[spec.baseSpecies]) return spec.baseSpecies;
	return pokemonName;
}

// auto-update set details on select
$(".set-selector").change(function () {
	window.NO_CALC = true;
	var $sel = $(this);
	var fullSetName = $sel.val();
	var pokemon;
	try {
	if ($sel.hasClass('opposing')) {
		if (!window._wsMirrorP2Load) {
			window._wsMirrorHeaderActive = false;
			window._wsMirrorDisplayLabel = "";
		}
		if (!fullSetName && typeof getOpposingSetStringForTrainerNav === "function") {
			fullSetName = getOpposingSetStringForTrainerNav();
		}
		if (fullSetName && String($sel.val() || "").trim() === "") {
			$sel.val(fullSetName);
		}
		topPokemonIcon(fullSetName, $("#p2mon")[0])
		// Wandering Spirit mirror click loads a team member's set into #p2 but keeps None (Wandering Spirit) in the selector.
		if (!window._wsMirrorP2Load) {
			CURRENT_TRAINER_POKS = get_trainer_poks(fullSetName);
			renderAllTrainerTeams(fullSetName);
			if (typeof applyBattleSettings === "function") {
				applyBattleSettings(getTrainerNameFromSet(fullSetName));
			}
			persistLastOpposingTrainerIndexFromFullSetName(fullSetName);
		}
	} else {
		topPokemonIcon(fullSetName, $("#p1mon")[0])
	}

	if (fullSetName && fullSetName.indexOf(" (") !== -1) {
		var pokemonName = fullSetName.substring(0, fullSetName.indexOf(" ("));
		var setName = fullSetName.substring(fullSetName.indexOf("(") + 1, fullSetName.lastIndexOf(")"));
		var setdexKey = resolveSetdexKey(pokemonName);
		pokemon = pokedex[pokemonName];
	if (pokemon) {
		var pokeObj = $sel.closest(".poke-info");
		if (stickyMoves.getSelectedSide() === pokeObj.prop("id")) {
			stickyMoves.clearStickyMove();
		}
		pokeObj.find(".teraToggle").prop("checked", false);
		pokeObj.find(".boostedStat").val("");
		pokeObj.find(".type1").val(pokemon.types[0]);
		pokeObj.find(".type2").val(pokemon.types[1]);
		pokeObj.find(".hp .base").val(pokemon.bs.hp);
		var i;
		for (i = 0; i < LEGACY_STATS[gen].length; i++) {
			pokeObj.find("." + LEGACY_STATS[gen][i] + " .base").val(pokemon.bs[LEGACY_STATS[gen][i]]);
		}
		pokeObj.find(".boost").val(0);
		pokeObj.find(".percent-hp").val(100);
		pokeObj.find(".status").val("Healthy");
		pokeObj.find(".status").change();
		var moveObj;
		var abilityObj = pokeObj.find(".ability");
		var itemObj = pokeObj.find(".item");
		var randset = $("#randoms").prop("checked") ? randdex[pokemonName] : undefined;
		var regSets = setdexKey in setdex && setName in setdex[setdexKey];
		var regSetForStatus = null;

		if (randset) {
			var listItems = randdex[pokemonName].items ? randdex[pokemonName].items : [];
			var listAbilities = randdex[pokemonName].abilities ? randdex[pokemonName].abilities : [];
			if (gen >= 3) $sel.closest('.poke-info').find(".ability-pool").show();
			$sel.closest('.poke-info').find(".extraSetAbilities").text(listAbilities.join(', '));
			if (gen >= 2) $sel.closest('.poke-info').find(".item-pool").show();
			$sel.closest('.poke-info').find(".extraSetItems").text(listItems.join(', '));
			if (gen >= 9) {
				$sel.closest('.poke-info').find(".role-pool").show();
				$sel.closest('.poke-info').find(".tera-type-pool").show();
			}
			var listRoles = randdex[pokemonName].roles ? Object.keys(randdex[pokemonName].roles) : [];
			$sel.closest('.poke-info').find(".extraSetRoles").text(listRoles.join(', '));
			var listTeraTypes = [];
			if (randdex[pokemonName].roles) {
				for (var roleName in randdex[pokemonName].roles) {
					var role = randdex[pokemonName].roles[roleName];
					for (var q = 0; q < role.teraTypes.length; q++) {
						if (listTeraTypes.indexOf(role.teraTypes[q]) === -1) {
							listTeraTypes.push(role.teraTypes[q]);
						}
					}
				}
			}
			pokeObj.find(".teraType").val(listTeraTypes[0] || pokemon.types[0]);
			$sel.closest('.poke-info').find(".extraSetTeraTypes").text(listTeraTypes.join(', '));
		} else {
			$sel.closest('.poke-info').find(".ability-pool").hide();
			$sel.closest('.poke-info').find(".item-pool").hide();
			$sel.closest('.poke-info').find(".role-pool").hide();
			$sel.closest('.poke-info').find(".tera-type-pool").hide();
		}
		if (regSets || randset) {
			var set = regSets ? correctHiddenPower(setdex[setdexKey][setName]) : randset;
			if (regSets) {
				regSetForStatus = set;
				pokeObj.find(".teraType").val(set.teraType || pokemon.types[0]);
			}
			pokeObj.find(".level").val(set.level);
			pokeObj.find(".hp .evs").val((set.evs && set.evs.hp !== undefined) ? set.evs.hp : 0);
			pokeObj.find(".hp .ivs").val((set.ivs && set.ivs.hp !== undefined) ? set.ivs.hp : 31);
			pokeObj.find(".hp .dvs").val((set.dvs && set.dvs.hp !== undefined) ? set.dvs.hp : 15);
			for (i = 0; i < LEGACY_STATS[gen].length; i++) {
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .evs").val(
					(set.evs && set.evs[LEGACY_STATS[gen][i]] !== undefined) ?
						set.evs[LEGACY_STATS[gen][i]] : ($("#randoms").prop("checked") ? 84 : 0));
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .ivs").val(
					(set.ivs && set.ivs[LEGACY_STATS[gen][i]] !== undefined) ? set.ivs[LEGACY_STATS[gen][i]] : 31);
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .dvs").val(
					(set.dvs && set.dvs[LEGACY_STATS[gen][i]] !== undefined) ? set.dvs[LEGACY_STATS[gen][i]] : 15);
			}
			setSelectValueIfValid(pokeObj.find(".nature"), set.nature, "Hardy");
			var abilityFallback = (typeof pokemon.abilities !== "undefined") ? pokemon.abilities[0] : "";
			if ($("#randoms").prop("checked")) {
				setSelectValueIfValid(abilityObj, randset.abilities && randset.abilities[0], abilityFallback);
				setSelectValueIfValid(itemObj, randset.items && randset.items[0], "");
			} else {
				setSelectValueIfValid(abilityObj, set.ability, abilityFallback);
				setSelectValueIfValid(itemObj, set.item, "");
			}
			var setMoves = set.moves;
			if (randset) {
				if (gen < 9) {
					setMoves = randset.moves;
				} else {
					setMoves = [];
					for (var role in randset.roles) {
						for (var q = 0; q < randset.roles[role].moves.length; q++) {
							var moveName = randset.roles[role].moves[q];
							if (setMoves.indexOf(moveName) === -1) setMoves.push(moveName);
						}
					}
				}
			}
			var moves = selectMovesFromRandomOptions(setMoves);
			for (i = 0; i < 4; i++) {
				moveObj = pokeObj.find(".move" + (i + 1) + " select.move-selector");
				moveObj.attr('data-prev', moveObj.val());
				setSelectValueIfValid(moveObj, moves[i], "(No Move)");
				moveObj.change();
			}
			if (randset) {
				$sel.closest('.poke-info').find(".move-pool").show();
				$sel.closest('.poke-info').find(".extraSetMoves").html(formatMovePool(setMoves));
			}
		} else {
			pokeObj.find(".teraType").val(pokemon.types[0]);
			pokeObj.find(".level").val(100);
			pokeObj.find(".hp .evs").val(0);
			pokeObj.find(".hp .ivs").val(31);
			pokeObj.find(".hp .dvs").val(15);
			for (i = 0; i < LEGACY_STATS[gen].length; i++) {
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .evs").val(0);
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .ivs").val(31);
				pokeObj.find("." + LEGACY_STATS[gen][i] + " .dvs").val(15);
			}
			pokeObj.find(".nature").val("Hardy");
			setSelectValueIfValid(abilityObj, pokemon.ab, "");
			itemObj.val("");
			for (i = 0; i < 4; i++) {
				moveObj = pokeObj.find(".move" + (i + 1) + " select.move-selector");
				moveObj.attr('data-prev', moveObj.val());
				moveObj.val("(No Move)");
				moveObj.change();
			}
			if ($("#randoms").prop("checked")) {
				$sel.closest('.poke-info').find(".move-pool").hide();
			}
		}
		if (typeof getSelectedTiers === "function") { // doesn't exist when in 1vs1 mode
			var format = getSelectedTiers()[0];
			var is50lvl = startsWith(format, "VGC") || startsWith(format, "Battle Spot");
			//var isDoubles = format === 'Doubles' || has50lvl; *TODO*
			if (format === "LC") pokeObj.find(".level").val(5);
			if (is50lvl) pokeObj.find(".level").val(50);
			//if (isDoubles) field.gameType = 'Doubles'; *TODO*
		}
		var formeObj = pokeObj.find(".forme").parent();
		itemObj.prop("disabled", false);
		var baseForme;
		if (pokemon.baseSpecies && pokemon.baseSpecies !== pokemon.name) {
			baseForme = pokedex[pokemon.baseSpecies];
		}
		if (pokemon.otherFormes) {
			formeObj.removeClass("forme-empty");
			showFormes(formeObj, pokemonName, pokemon, pokemonName);
		} else if (baseForme && baseForme.otherFormes) {
			formeObj.removeClass("forme-empty");
			showFormes(formeObj, pokemonName, baseForme, pokemon.baseSpecies);
		} else {
			formeObj.addClass("forme-empty").show();
			formeObj.children("select").empty();
		}
		calcHP(pokeObj);
		calcStats(pokeObj);
		pokeObj.find(".traceCopyOpponent").prop("checked", false);
		abilityObj.change();
		itemObj.change();
		if (regSetForStatus && regSetForStatus.status) {
			var loadedItem = itemObj.val();
			if (loadedItem !== "Flame Orb" && loadedItem !== "Toxic Orb") {
				setSelectValueIfValid(pokeObj.find(".status"), normalizeSetStatus(regSetForStatus.status), "Healthy");
				pokeObj.find(".status").change();
			}
		}
		if (pokemon.gender === "N") {
			pokeObj.find(".gender").parent().addClass("gender-empty").show();
			pokeObj.find(".gender").val("");
		} else {
			pokeObj.find(".gender").parent().removeClass("gender-empty").show();
		}
	}
	}
	} finally {
		window.NO_CALC = false;
	}
	if (pokemon && typeof applyAutoStatBoosts === "function") {
		applyAutoStatBoosts($sel.closest(".poke-info"), fullSetName);
	}
	updateCommanderDondozoButton($sel.closest(".poke-info"));
	if ($sel.hasClass("opposing")) {
		var p1Set = getFullSetNameFromPokeInfo($("#p1"));
		if (p1Set) {
			var p1sprite = document.getElementById("p1mon");
			if (p1sprite) topPokemonIcon(p1Set, p1sprite);
		}
	}
});

function formatMovePool(moves) {
	var formatted = [];
	for (var i = 0; i < moves.length; i++) {
		formatted.push(isKnownDamagingMove(moves[i]) ? moves[i] : '<i>' + moves[i] + '</i>');
	}
	return formatted.join(', ');
}

function isKnownDamagingMove(move) {
	var m = GENERATION.moves.get(calc.toID(move));
	return m && m.basePower;
}

function selectMovesFromRandomOptions(moves) {
	var selected = [];

	var nonDamaging = [];
	for (var i = 0; i < moves.length; i++) {
		if (isKnownDamagingMove(moves[i])) {
			selected.push(moves[i]);
			if (selected.length >= 4) break;
		} else {
			nonDamaging.push(moves[i]);
		}
	}

	while (selected.length < 4 && nonDamaging.length) {
		selected.push(nonDamaging.pop());
	}

	return selected;
}

function showFormes(formeObj, pokemonName, pokemon, baseFormeName) {
	formeObj.removeClass("forme-empty");
	var formes = pokemon.otherFormes.slice();
	formes.unshift(baseFormeName);

	var defaultForme = formes.indexOf(pokemonName);
	if (defaultForme < 0) defaultForme = 0;

	var formeOptions = getSelectOptions(formes, false, defaultForme);
	var $formeSel = formeObj.children("select");
	$formeSel.find("option").remove().end().append(formeOptions);
	if (window._skipShowFormesFormeChange) {
		window._skipShowFormesFormeChange = false;
	} else {
		$formeSel.change();
	}
	formeObj.show();
}

function setSelectValueIfValid(select, value, fallback) {
	select.val(!value ? fallback : select.children("option[value='" + value + "']").length ? value : fallback);
}

function normalizeAbilityKey(name) {
	return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function setAbilityValue(select, value, fallback) {
	if (!value) {
		select.val(fallback || "");
		return;
	}
	if (select.children("option[value='" + value + "']").length) {
		select.val(value);
		return;
	}
	var wanted = normalizeAbilityKey(value);
	var matched = "";
	select.children("option").each(function () {
		var optionVal = $(this).val();
		if (normalizeAbilityKey(optionVal) === wanted) {
			matched = optionVal;
			return false;
		}
	});
	select.val(matched || fallback || "");
}

function getOpponentPokeInfo($pokeInfo) {
	return $pokeInfo.attr("id") === "p1" ? $("#p2") : $("#p1");
}

function applyTraceAbilityFromOpponent($pokeInfo) {
	var oppAbility = getOpponentPokeInfo($pokeInfo).find(".ability").val();
	var abilitySelect = $pokeInfo.find(".ability");
	window._syncingTraceAbility = true;
	try {
		setAbilityValue(abilitySelect, oppAbility, "Trace");
		abilitySelect.trigger("change");
	} finally {
		window._syncingTraceAbility = false;
	}
}

function restoreTraceAbilitySelection($pokeInfo) {
	var abilitySelect = $pokeInfo.find(".ability");
	window._syncingTraceAbility = true;
	try {
		setAbilityValue(abilitySelect, "Trace", "");
		abilitySelect.trigger("change");
	} finally {
		window._syncingTraceAbility = false;
	}
}

function updateTraceCopyVisibility($pokeInfo) {
	var label = $pokeInfo.find(".trace-copy-label");
	if (!label.length) return;
	var ability = $pokeInfo.find(".ability").val();
	var cb = $pokeInfo.find(".traceCopyOpponent");
	var tracing = cb.prop("checked");
	if (ability === "Trace" || tracing) {
		label.removeAttr("hidden");
	} else {
		label.attr("hidden", "hidden");
		cb.prop("checked", false);
	}
}

function speciesFromSetSelectorName(fullSetName) {
	if (!fullSetName || fullSetName.indexOf(" (") === -1) return "";
	return fullSetName.substring(0, fullSetName.indexOf(" (")).trim();
}

function fullSetFromTrainerTeamEntry(entry) {
	if (!entry) return "";
	return entry.indexOf("]") !== -1 ? entry.split("]")[1] : entry;
}

function speciesFromTrainerTeamEntry(entry) {
	var s = fullSetFromTrainerTeamEntry(entry);
	if (!s || s.indexOf(" (") === -1) return s ? s.trim() : "";
	return s.substring(0, s.indexOf(" (")).trim();
}

function snapshotOpposingBattleState(container) {
	var boosts = [];
	container.find(".boost").each(function () {
		boosts.push($(this).val());
	});
	return {
		boosts: boosts,
		percentHp: container.find(".percent-hp").val(),
		status: container.find(".status").val(),
		boostedStat: container.find(".boostedStat").val(),
		teraToggle: container.find(".teraToggle").prop("checked"),
		teraType: container.find(".teraType").val(),
		alliesFainted: container.find(".alliesFainted").length ? container.find(".alliesFainted").val() : undefined
	};
}

function restoreOpposingBattleState(container, snap) {
	if (!snap) return;
	container.find(".boost").each(function (i) {
		if (snap.boosts[i] !== undefined) $(this).val(snap.boosts[i]);
	});
	if (snap.percentHp !== undefined) container.find(".percent-hp").val(snap.percentHp);
	if (snap.status !== undefined) container.find(".status").val(snap.status).trigger("change");
	if (snap.boostedStat !== undefined) container.find(".boostedStat").val(snap.boostedStat);
	if (snap.teraToggle !== undefined) container.find(".teraToggle").prop("checked", snap.teraToggle);
	if (snap.teraType !== undefined) container.find(".teraType").val(snap.teraType);
	if (snap.alliesFainted !== undefined && container.find(".alliesFainted").length) {
		container.find(".alliesFainted").val(snap.alliesFainted);
	}
}

/** When switching mega ↔ base on the opponent, use the matching species row from the trainer team if present. */
function trySwapOpposingSetForTeamMegaForme(formeSelect, newFormeSpecies) {
	var container = formeSelect.closest(".poke-info");
	if (!container.is("#p2") || !container.find(".set-selector").hasClass("opposing")) return false;
	var prevForme = formeSelect.data("prevFormeBeforeChange");
	if (prevForme === undefined) return false;
	var prevMega = prevForme.indexOf("-Mega") !== -1;
	var newMega = newFormeSpecies.indexOf("-Mega") !== -1;
	if (prevMega === newMega) return false;
	var fullSet = getFullSetNameFromPokeInfo(container);
	var speciesInSet = speciesFromSetSelectorName(fullSet);
	if (speciesInSet === newFormeSpecies) return false;
	var trainerPoks = get_trainer_poks(fullSet);
	var candidateFull = null;
	for (var i = 0; i < trainerPoks.length; i++) {
		if (speciesFromTrainerTeamEntry(trainerPoks[i]) === newFormeSpecies) {
			candidateFull = fullSetFromTrainerTeamEntry(trainerPoks[i]);
			break;
		}
	}
	if (!candidateFull || candidateFull === fullSet) return false;
	var snap = snapshotOpposingBattleState(container);
	var $opp = container.find("input.set-selector.opposing");
	window._skipShowFormesFormeChange = true;
	$opp.val(candidateFull);
	$opp.trigger("change");
	$(".opposing .select2-chosen").text(candidateFull);
	if (window._skipShowFormesFormeChange) {
		window._skipShowFormesFormeChange = false;
	}
	restoreOpposingBattleState(container, snap);
	formeSelect.val(newFormeSpecies);
	return true;
}

$(document).on("focus", "#p2 select.forme", function () {
	$(this).data("prevFormeBeforeChange", $(this).val());
});

$(".forme").change(function () {
	var formeSelect = $(this);
	var newFormeSpecies = formeSelect.val();
	var altForme = pokedex[newFormeSpecies];
	if (!altForme) return;
	var container = formeSelect.closest(".poke-info");
	container.find(".traceCopyOpponent").prop("checked", false);
	trySwapOpposingSetForTeamMegaForme(formeSelect, newFormeSpecies);
	var fullSetName = getFullSetNameFromPokeInfo(container);
	var pokemonName = fullSetName.indexOf(" (") !== -1 ? fullSetName.substring(0, fullSetName.indexOf(" (")).trim() : "";
	var setName = fullSetName.indexOf(" (") !== -1 ? fullSetName.substring(fullSetName.indexOf("(") + 1, fullSetName.lastIndexOf(")")) : "";

	container.find(".type1").val(altForme.types[0]);
	container.find(".type2").val(altForme.types[1] ? altForme.types[1] : "");
	for (var i = 0; i < LEGACY_STATS[9].length; i++) {
		var baseStat = container.find("." + LEGACY_STATS[9][i]).find(".base");
		baseStat.val(altForme.bs[LEGACY_STATS[9][i]]);
		baseStat.keyup();
	}
	calcHP(container);
	calcStats(container);
	var isRandoms = $("#randoms").prop("checked");
	var pokemonSets = isRandoms ? randdex[pokemonName] : setdex[resolveSetdexKey(pokemonName)];
	var chosenSet = pokemonSets && pokemonSets[setName];
	var abilitySelect = container.find(".ability");
	var abilityFallback = (typeof altForme.abilities !== "undefined" && altForme.abilities[0]) ? altForme.abilities[0] : (altForme.ab || "");
	var greninjaSet = $(this).val().indexOf("Greninja") !== -1;
	var isAltForme = $(this).val() !== pokemonName;
	var isMegaForme = $(this).val().indexOf("-Mega") !== -1;
	var formeAbility = altForme.ab || (altForme.abilities && (altForme.abilities[0] || altForme.abilities["0"])) || "";
	if (isAltForme && !greninjaSet) {
		if (isMegaForme) {
			/* Prefer set megaAbility, else pokedex ability for the mega species (not base set ability). */
			if (chosenSet && !isRandoms && chosenSet.megaAbility) {
				setAbilityValue(abilitySelect, chosenSet.megaAbility, abilityFallback);
			} else if (formeAbility) {
				setAbilityValue(abilitySelect, formeAbility, abilityFallback);
			} else if (chosenSet && isRandoms && chosenSet.abilities && chosenSet.abilities[0]) {
				setAbilityValue(abilitySelect, chosenSet.abilities[0], abilityFallback);
			} else if (chosenSet && !isRandoms && chosenSet.ability) {
				setAbilityValue(abilitySelect, chosenSet.ability, abilityFallback);
			}
		} else if (!isMegaForme && chosenSet && !isRandoms && chosenSet.baseAbility) {
			setAbilityValue(abilitySelect, chosenSet.baseAbility, abilityFallback);
		} else if (formeAbility) {
			setAbilityValue(abilitySelect, formeAbility, abilityFallback);
		} else if (chosenSet) {
			if (!isRandoms) {
				setAbilityValue(abilitySelect, chosenSet.ability, abilityFallback);
			} else {
				setAbilityValue(abilitySelect, chosenSet.abilities[0], abilityFallback);
			}
		}
	} else if (greninjaSet) {
		$(this).parent().find(".ability");
	} else if (chosenSet) {
		if (!isRandoms) {
			setAbilityValue(abilitySelect, chosenSet.ability, abilityFallback);
		} else {
			setAbilityValue(abilitySelect, chosenSet.abilities[0], abilityFallback);
		}
	}
	container.find(".ability").keyup();

	if ($(this).val().indexOf("-Mega") !== -1 && $(this).val() !== "Rayquaza-Mega") {
		var itemSel = container.find(".item");
		if (chosenSet && chosenSet.item) {
			var hasOption = itemSel.find("option").filter(function () { return $(this).val() === chosenSet.item; }).length > 0;
			if (!hasOption) {
				itemSel.append($("<option></option>").val(chosenSet.item).text(chosenSet.item));
			}
			itemSel.val(chosenSet.item).trigger("change");
		} else {
			itemSel.val("").keyup();
		}
	} else {
		container.find(".item").prop("disabled", false);
	}
	var spriteNode = container.find(".poke-panel-sprite")[0];
	if (spriteNode) {
		var currentForme = formeSelect.val();
		var displayName = setName ? (currentForme + " (" + setName + ")") : currentForme;
		topPokemonIcon(displayName, spriteNode);
	}
	formeSelect.data("prevFormeBeforeChange", newFormeSpecies);
	updateCommanderDondozoButton(container);
	applyMultiHitDropdownsForPokeInfo(container);
});

$(document).on("click", ".poke-panel-sprite", function () {
	var container = $(this).closest(".poke-info");
	var formeSelect = container.find("select.forme");
	if (!formeSelect.length) return;
	var options = formeSelect.find("option").map(function () { return $(this).val(); }).get();
	var megaOptions = options.filter(function (v) { return v.indexOf("-Mega") !== -1; });
	/* Non-mega, non–Gigantamax formes only (skip Gmax in sprite cycle). */
	var baseOptions = options.filter(function (v) {
		return v.indexOf("-Mega") === -1 && v.indexOf("-Gmax") === -1;
	});
	var cycleOrder;
	if (megaOptions.length > 0) {
		if (baseOptions.length === 0) return;
		/* Base forme(s) first, then every mega in order — cycle for multi-mega (e.g. Charizard X/Y). */
		cycleOrder = baseOptions.concat(megaOptions);
	} else if (baseOptions.length >= 2) {
		/* Alternate formes without megas (e.g. Wishiwashi-School). */
		cycleOrder = baseOptions.slice();
	} else {
		return;
	}
	var current = formeSelect.val();
	var idx = cycleOrder.indexOf(current);
	formeSelect.data("prevFormeBeforeChange", current);
	if (idx === -1) {
		formeSelect.val(cycleOrder[0]).change();
		return;
	}
	var nextForme = cycleOrder[(idx + 1) % cycleOrder.length];
	formeSelect.val(nextForme).change();
});

function correctHiddenPower(pokemon) {
	// After Gen 7 bottlecaps means you can have a HP without perfect IVs
	if (gen >= 7) return pokemon;

	// Convert the legacy stats table to a useful one, and also figure out if all are maxed
	var ivs = {};
	var maxed = true;
	for (var i = 0; i <= LEGACY_STATS[9].length; i++) {
		var s = LEGACY_STATS[9][i];
		var iv = ivs[legacyStatToStat(s)] = (pokemon.ivs && pokemon.ivs[s]) || 31;
		if (iv !== 31) maxed = false;
	}

	var expected = calc.Stats.getHiddenPower(GENERATION, ivs);
	for (var i = 0; i < pokemon.moves.length; i++) {
		var m = pokemon.moves[i].match(HIDDEN_POWER_REGEX);
		if (!m) continue;
		// The Pokemon has Hidden Power and is not maxed but the types don't match we don't
		// want to attempt to reconcile the user's IVs so instead just correct the HP type
		if (!maxed && expected.type !== m[1]) {
			pokemon.moves[i] = "Hidden Power " + expected.type;
		} else {
			// Otherwise, use the default preset hidden power IVs that PS would use
			var hpIVs = calc.Stats.getHiddenPowerIVs(GENERATION, m[1]);
			if (!hpIVs) continue; // some impossible type was specified, ignore

			pokemon.ivs = pokemon.ivs || { hp: 31, at: 31, df: 31, sa: 31, sd: 31, sp: 31 };
			pokemon.dvs = pokemon.dvs || { hp: 15, at: 15, df: 15, sa: 15, sd: 15, sp: 15 };
			for (var stat in hpIVs) {
				pokemon.ivs[calc.Stats.shortForm(stat)] = hpIVs[stat];
				pokemon.dvs[calc.Stats.shortForm(stat)] = calc.Stats.IVToDV(hpIVs[stat]);
			}
			if (gen < 3) {
				pokemon.dvs.hp = calc.Stats.getHPDV({
					atk: pokemon.ivs.at,
					def: pokemon.ivs.df,
					spe: pokemon.ivs.sp,
					spc: pokemon.ivs.sa
				});
				pokemon.ivs.hp = calc.Stats.DVToIV(pokemon.dvs.hp);
			}
		}
	}
	return pokemon;
}

function createPokemon(pokeInfo) {
	if (typeof pokeInfo === "string") { // in this case, pokeInfo is the id of an individual setOptions value whose moveset's tier matches the selected tier(s)
		var name = pokeInfo.substring(0, pokeInfo.indexOf(" ("));
		var setName = pokeInfo.substring(pokeInfo.indexOf("(") + 1, pokeInfo.lastIndexOf(")"));
		var isRandoms = $("#randoms").prop("checked");
		var set = isRandoms ? randdex[name] : setdex[name][setName];

		var ivs = {};
		var evs = {};
		for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
			var legacyStat = LEGACY_STATS[gen][i];
			var stat = legacyStatToStat(legacyStat);

			ivs[stat] = (gen >= 3 && set.ivs && typeof set.ivs[legacyStat] !== "undefined") ? set.ivs[legacyStat] : 31;
			evs[stat] = (set.evs && typeof set.evs[legacyStat] !== "undefined") ? set.evs[legacyStat] : 0;
		}
		var moveNames = set.moves;
		if (isRandoms && gen >= 9) {
			moveNames = [];
			for (var role in set.roles) {
				for (var q = 0; q < set.roles[role].moves.length; q++) {
					var moveName = set.roles[role].moves[q];
					if (moveNames.indexOf(moveName) === -1) moveNames.push(moveName);
				}
			}
		}

		var pokemonMoves = [];
		for (var i = 0; i < 4; i++) {
			var moveName = moveNames[i];
			var isCrit = $('.move-crit')[i].checked;
			pokemonMoves.push(new calc.Move(gen, moves[moveName] ? moveName : "(No Move)", { ability: ability, item: item, isCrit: isCrit, }));
		}

		if (isRandoms) {
			pokemonMoves = pokemonMoves.filter(function (move) {
				return move.category !== "Status";
			});
		}

		return new calc.Pokemon(gen, name, {
			level: set.level,
			ability: set.ability,
			abilityOn: true,
			item: set.item && typeof set.item !== "undefined" && (set.item === "Eviolite" || set.item.indexOf("ite") < 0) ? set.item : "",
			nature: set.nature,
			ivs: ivs,
			evs: evs,
			moves: pokemonMoves
		});
	} else {
		var setName = getFullSetNameFromPokeInfo(pokeInfo);
		var name;
		if (!setName || setName.indexOf("(") === -1) {
			name = (setName || "").trim();
		} else {
			var pokemonName = setName.substring(0, setName.indexOf(" (")).trim();
			var species = pokedex[pokemonName];
			if (species) {
				name = (species.otherFormes || (species.baseSpecies && species.baseSpecies !== pokemonName)) ?
					(pokeInfo.find(".forme").val() || pokemonName) : pokemonName;
			} else {
				name = pokemonName;
			}
		}

		var baseStats = {};
		var ivs = {};
		var evs = {};
		var boosts = {};
		for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
			var stat = legacyStatToStat(LEGACY_STATS[gen][i]);
			baseStats[stat === 'spc' ? 'spa' : stat] = ~~pokeInfo.find("." + LEGACY_STATS[gen][i] + " .base").val();
			ivs[stat] = gen > 2 ? ~~pokeInfo.find("." + LEGACY_STATS[gen][i] + " .ivs").val() : ~~pokeInfo.find("." + LEGACY_STATS[gen][i] + " .dvs").val() * 2 + 1;
			evs[stat] = ~~pokeInfo.find("." + LEGACY_STATS[gen][i] + " .evs").val();
			boosts[stat] = ~~pokeInfo.find("." + LEGACY_STATS[gen][i] + " .boost").val();
		}
		if (gen === 1) baseStats.spd = baseStats.spa;

		var ability = pokeInfo.find(".ability").val();
		var item = pokeInfo.find(".item").val();
		var isDynamaxed = pokeInfo.find(".max").prop("checked");
		var teraType = pokeInfo.find(".teraToggle").is(":checked") ? pokeInfo.find(".teraType").val() : undefined;
		pokeInfo.isDynamaxed = isDynamaxed;
		calcHP(pokeInfo);
		var curHP = ~~pokeInfo.find(".current-hp").val();
		// FIXME the Pokemon constructor expects non-dynamaxed HP
		if (isDynamaxed) curHP = Math.floor(curHP / 2);
		var types = [pokeInfo.find(".type1").val(), pokeInfo.find(".type2").val()];
		return new calc.Pokemon(gen, name, {
			level: ~~pokeInfo.find(".level").val(),
			ability: ability,
			abilityOn: pokeInfo.find(".abilityToggle").is(":checked"),
			item: item,
			gender: pokeInfo.find(".gender").is(":visible") ? getGender(pokeInfo.find(".gender").val()) : "N",
			nature: pokeInfo.find(".nature").val(),
			ivs: ivs,
			evs: evs,
			isDynamaxed: isDynamaxed,
			isSaltCure: pokeInfo.find(".saltcure").is(":checked"),
			alliesFainted: parseInt(pokeInfo.find(".alliesFainted").val()),
			boostedStat: pokeInfo.find(".boostedStat").val() || undefined,
			teraType: teraType,
			boosts: boosts,
			curHP: curHP,
			status: CALC_STATUS[pokeInfo.find(".status").val()],
			toxicCounter: status === 'Badly Poisoned' ? ~~pokeInfo.find(".toxic-counter").val() : 0,
			moves: [
				getMoveDetails(pokeInfo.find(".move1"), name, ability, item, isDynamaxed),
				getMoveDetails(pokeInfo.find(".move2"), name, ability, item, isDynamaxed),
				getMoveDetails(pokeInfo.find(".move3"), name, ability, item, isDynamaxed),
				getMoveDetails(pokeInfo.find(".move4"), name, ability, item, isDynamaxed)
			],
			overrides: {
				baseStats: baseStats,
				types: types
			}
		});
	}
}

function getGender(gender) {
	if (!gender || gender === 'genderless' || gender === 'N') return 'N';
	if (gender.toLowerCase() === 'male' || gender === 'M') return 'M';
	return 'F';
}

function getMoveDetails(moveInfo, species, ability, item, useMax) {
	var moveName = moveInfo.find("select.move-selector").val();
	var isZMove = gen > 6 && moveInfo.find("input.move-z").prop("checked");
	var isCrit = moveInfo.find(".move-crit").prop("checked");
	var hits = +moveInfo.find(".move-hits").val();
	var timesUsed = +moveInfo.find(".stat-drops").val();
	if (isNaN(timesUsed)) timesUsed = 1;
	var timesUsedWithMetronome = moveInfo.find(".metronome").is(':visible') ? +moveInfo.find(".metronome").val() : 1;
	var overrides = {
		basePower: +moveInfo.find(".move-bp").val(),
		type: moveInfo.find(".move-type").val()
	};
	if (gen >= 4) overrides.category = moveInfo.find(".move-cat").val();
	return new calc.Move(gen, moveName, {
		ability: ability, item: item, useZ: isZMove, species: species, isCrit: isCrit, hits: hits,
		timesUsed: timesUsed, timesUsedWithMetronome: timesUsedWithMetronome, overrides: overrides, useMax: useMax
	});
}

// Build a set object from a panel (#p1 or #p2) form for saving to the box (calc-master).
function getSetFromForm(panelId) {
	var pokeInfo = $("#" + panelId);
	if (!pokeInfo.length) return null;
	var setSelectorEl = pokeInfo.find("input.set-selector");
	var fullSetName = setSelectorEl.val();
	if (!fullSetName && pokeInfo.find(".select2-chosen").length) {
		fullSetName = pokeInfo.find(".select2-chosen").first().text().trim();
	}
	if (!fullSetName && pokeInfo.find(".select2-container").length) {
		fullSetName = pokeInfo.find(".select2-container .select2-chosen").first().text().trim();
	}
	if (!fullSetName && setSelectorEl.data("select2")) {
		try { fullSetName = setSelectorEl.select2("val"); } catch (e) {}
	}
	if (!fullSetName) fullSetName = $("#" + panelId + " .select2-chosen").first().text().trim();
	if (!fullSetName) return null;
	var name, nameProp;
	if (fullSetName.indexOf(" (") !== -1 && fullSetName.indexOf(")") !== -1) {
		var pokemonName = fullSetName.substring(0, fullSetName.indexOf(" (")).trim();
		nameProp = fullSetName.substring(fullSetName.indexOf("(") + 1, fullSetName.lastIndexOf(")"));
		var species = pokedex[pokemonName];
		if (species) {
			name = (species.otherFormes || (species.baseSpecies && species.baseSpecies !== pokemonName)) ?
				(pokeInfo.find(".forme").val() || pokemonName) : pokemonName;
		} else {
			name = pokemonName;
		}
	} else {
		name = fullSetName.trim();
		nameProp = "Custom Set";
	}
	if (!name) return null;
	var evs = {};
	var ivs = {};
	for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
		var leg = LEGACY_STATS[gen][i];
		evs[leg] = ~~pokeInfo.find("." + leg + " .evs").val();
		ivs[leg] = gen > 2 ? ~~pokeInfo.find("." + leg + " .ivs").val() : ~~pokeInfo.find("." + leg + " .dvs").val() * 2 + 1;
	}
	var moves = [];
	for (var j = 0; j < 4; j++) {
		var moveName = pokeInfo.find(".move" + (j + 1) + " select.move-selector").val();
		moves.push(moveName && moveName !== "(No Move)" ? moveName : "");
	}
	var setdexKey = resolveSetdexKey(name);
	var existingSet = typeof setdex !== "undefined" && setdex[setdexKey] && setdex[setdexKey][nameProp] ? setdex[setdexKey][nameProp] : null;
	var poke = {
		name: name,
		nameProp: nameProp,
		level: ~~pokeInfo.find(".level").val(),
		ability: pokeInfo.find(".ability").val() || undefined,
		item: pokeInfo.find(".item").val() || undefined,
		nature: pokeInfo.find(".nature").val() || undefined,
		evs: evs,
		ivs: ivs,
		moves: moves,
		isCustomSet: true
	};
	if (existingSet && existingSet.index !== undefined) poke.index = existingSet.index;
	if (gen >= 9) {
		var teraVal = pokeInfo.find(".teraToggle").is(":checked") ? pokeInfo.find(".teraType").val() : undefined;
		if (teraVal) poke.teraType = teraVal;
	}
	return poke;
}

function createField() {
	var gameType = $("input:radio[name='format']:checked").val();
	var isBeadsOfRuin = $("#beads").prop("checked");
	var isTabletsOfRuin = $("#tablets").prop("checked");
	var isSwordOfRuin = $("#sword").prop("checked");
	var isVesselOfRuin = $("#vessel").prop("checked");
	var isFairyAura = $("#field-fairy-aura").prop("checked");
	var isDarkAura = $("#field-dark-aura").prop("checked");
	var isAuraBreak = $("#field-aura-break").prop("checked");
	var isMagicRoom = $("#magicroom").prop("checked");
	var isWonderRoom = $("#wonderroom").prop("checked");
	var isGravity = $("#gravity").prop("checked");
	var isInverse = $("#inverse").prop("checked");
	var isSR = [$("#srL").prop("checked"), $("#srR").prop("checked")];
	var weather;
	var spikes;
	if (gen === 2) {
		spikes = [$("#gscSpikesL").prop("checked") ? 1 : 0, $("#gscSpikesR").prop("checked") ? 1 : 0];
		weather = $("input:radio[name='gscWeather']:checked").val();
	} else {
		weather = $("input:radio[name='weather']:checked").val();
		spikes = [~~$("input:radio[name='spikesL']:checked").val(), ~~$("input:radio[name='spikesR']:checked").val()];
	}
	var steelsurge = [$("#steelsurgeL").prop("checked"), $("#steelsurgeR").prop("checked")];
	var vinelash = [$("#vinelashL").prop("checked"), $("#vinelashR").prop("checked")];
	var wildfire = [$("#wildfireL").prop("checked"), $("#wildfireR").prop("checked")];
	var cannonade = [$("#cannonadeL").prop("checked"), $("#cannonadeR").prop("checked")];
	var volcalith = [$("#volcalithL").prop("checked"), $("#volcalithR").prop("checked")];
	var terrain = ($("input:checkbox[name='terrain']:checked").val()) ? $("input:checkbox[name='terrain']:checked").val() : "";
	var isReflect = [$("#reflectL").prop("checked"), $("#reflectR").prop("checked")];
	var isLightScreen = [$("#lightScreenL").prop("checked"), $("#lightScreenR").prop("checked")];
	var isProtected = [$("#protectL").prop("checked"), $("#protectR").prop("checked")];
	var isSeeded = [$("#leechSeedL").prop("checked"), $("#leechSeedR").prop("checked")];
	var isForesight = [$("#foresightL").prop("checked"), $("#foresightR").prop("checked")];
	var isHelpingHand = [$("#helpingHandL").prop("checked"), $("#helpingHandR").prop("checked")];
	var isTailwind = [$("#tailwindL").prop("checked"), $("#tailwindR").prop("checked")];
	var isFlowerGift = [$("#flowerGiftL").prop("checked"), $("#flowerGiftR").prop("checked")];
	var isPowerTrick = [$("#powerTrickL").prop("checked"), $("#powerTrickR").prop("checked")];
	var isFriendGuard = [$("#friendGuardL").prop("checked"), $("#friendGuardR").prop("checked")];
	var isAuroraVeil = [$("#auroraVeilL").prop("checked"), $("#auroraVeilR").prop("checked")];
	var isBattery = [$("#batteryL").prop("checked"), $("#batteryR").prop("checked")];
	var isPowerSpot = [$("#powerSpotL").prop("checked"), $("#powerSpotR").prop("checked")];
	// TODO: support switching in as well!
	var isSwitchingOut = [$("#switchingL").prop("checked"), $("#switchingR").prop("checked")];

	var createSide = function (i) {
		return new calc.Side({
			spikes: spikes[i], isSR: isSR[i], steelsurge: steelsurge[i],
			vinelash: vinelash[i], wildfire: wildfire[i], cannonade: cannonade[i], volcalith: volcalith[i],
			isReflect: isReflect[i], isLightScreen: isLightScreen[i],
			isProtected: isProtected[i], isSeeded: isSeeded[i], isForesight: isForesight[i],
			isTailwind: isTailwind[i], isHelpingHand: isHelpingHand[i], isFlowerGift: isFlowerGift[i], isPowerTrick: isPowerTrick[i], isFriendGuard: isFriendGuard[i],
			isAuroraVeil: isAuroraVeil[i], isBattery: isBattery[i], isPowerSpot: isPowerSpot[i], isSwitching: isSwitchingOut[i] ? 'out' : undefined
		});
	};
	return new calc.Field({
		gameType: gameType, weather: weather, terrain: terrain,
		isMagicRoom: isMagicRoom, isWonderRoom: isWonderRoom, isGravity: isGravity, isInverse: isInverse,
		isBeadsOfRuin: isBeadsOfRuin, isTabletsOfRuin: isTabletsOfRuin,
		isSwordOfRuin: isSwordOfRuin, isVesselOfRuin: isVesselOfRuin,
		isFairyAura: isFairyAura, isDarkAura: isDarkAura, isAuraBreak: isAuraBreak,
		attackerSide: createSide(0), defenderSide: createSide(1)
	});
}

function calcHP(poke) {
	var total = calcStat(poke, "hp");
	var $maxHP = poke.find(".max-hp");

	var prevMaxHP = Number($maxHP.attr('data-prev')) || total;
	var $currentHP = poke.find(".current-hp");
	var prevCurrentHP = $currentHP.attr('data-set') ? Math.min(Number($currentHP.val()), prevMaxHP) : prevMaxHP;
	// NOTE: poke.find(".percent-hp").val() is a rounded value!
	var prevPercentHP = 100 * prevCurrentHP / prevMaxHP;

	$maxHP.text(total);
	$maxHP.attr('data-prev', total);

	var newCurrentHP = calcCurrentHP(poke, total, prevPercentHP);
	calcPercentHP(poke, total, newCurrentHP);

	$currentHP.attr('data-set', true);
}

function calcStat(poke, StatID) {
	var stat = poke.find("." + StatID);
	var base = ~~stat.find(".base").val();
	var level = ~~poke.find(".level").val();
	var nature, ivs, evs;
	if (gen < 3) {
		ivs = ~~stat.find(".dvs").val() * 2;
		evs = 252;
	} else {
		ivs = ~~stat.find(".ivs").val();
		evs = ~~stat.find(".evs").val();
		if (StatID !== "hp") nature = poke.find(".nature").val();
	}
	// Shedinja still has 1 max HP during the effect even if its Dynamax Level is maxed (DaWoblefet)
	var total = calc.calcStat(gen, legacyStatToStat(StatID), base, ivs, evs, level, nature);
	if (gen > 7 && StatID === "hp" && poke.isDynamaxed && total !== 1) {
		total *= 2;
	}
	stat.find(".total").text(total);
	return total;
}

var GENERATION = {
	'1': 1, 'rb': 1, 'rby': 1,
	'2': 2, 'gs': 2, 'gsc': 2,
	'3': 3, 'rs': 3, 'rse': 3, 'frlg': 3, 'adv': 3,
	'4': 4, 'dp': 4, 'dpp': 4, 'hgss': 4,
	'5': 5, 'bw': 5, 'bw2': 5, 'b2w2': 5,
	'6': 6, 'xy': 6, 'oras': 6,
	'7': 7, 'sm': 7, 'usm': 7, 'usum': 7,
	'8': 8, 'ss': 8,
	'9': 9, 'sv': 9
};

var SETDEX = [
	{},
	typeof SETDEX_RBY === 'undefined' ? {} : SETDEX_RBY,
	typeof SETDEX_GSC === 'undefined' ? {} : SETDEX_GSC,
	typeof SETDEX_ADV === 'undefined' ? {} : SETDEX_ADV,
	typeof SETDEX_DPP === 'undefined' ? {} : SETDEX_DPP,
	typeof SETDEX_BW === 'undefined' ? {} : SETDEX_BW,
	typeof SETDEX_XY === 'undefined' ? {} : SETDEX_XY,
	typeof SETDEX_SM === 'undefined' ? {} : SETDEX_SM,
	typeof SETDEX_SS === 'undefined' ? {} : SETDEX_SS,
	typeof SETDEX_SV === 'undefined' ? {} : SETDEX_SV,
];
var RANDDEX = [
	{},
	typeof GEN1RANDOMBATTLE === 'undefined' ? {} : GEN1RANDOMBATTLE,
	typeof GEN2RANDOMBATTLE === 'undefined' ? {} : GEN2RANDOMBATTLE,
	typeof GEN3RANDOMBATTLE === 'undefined' ? {} : GEN3RANDOMBATTLE,
	typeof GEN4RANDOMBATTLE === 'undefined' ? {} : GEN4RANDOMBATTLE,
	typeof GEN5RANDOMBATTLE === 'undefined' ? {} : GEN5RANDOMBATTLE,
	typeof GEN6RANDOMBATTLE === 'undefined' ? {} : GEN6RANDOMBATTLE,
	typeof GEN7RANDOMBATTLE === 'undefined' ? {} : GEN7RANDOMBATTLE,
	typeof GEN8RANDOMBATTLE === 'undefined' ? {} : GEN8RANDOMBATTLE,
	typeof GEN9RANDOMBATTLE === 'undefined' ? {} : GEN9RANDOMBATTLE,
];
var gen, genWasChanged, notation, pokedex, setdex, randdex, typeChart, moves, abilities, items, calcHP, calcStat, GENERATION;

TR_NAMES = get_trainer_names()

$(".gen").change(function () {
	/*eslint-disable */
	gen = ~~$(this).val() || 9;
	GENERATION = calc.Generations.get(gen);
	var params = new URLSearchParams(window.location.search);
	if (gen === 9) {
		params.delete('gen');
		params = '' + params;
		if (window.history && window.history.replaceState) {
			window.history.replaceState({}, document.title, window.location.pathname + (params.length ? '?' + params : ''));
		}
	} else {
		//params.set('gen', gen);
		if (window.history && window.history.pushState) {
			params.sort();
			var path = window.location.pathname + params; //removed questionmark here
			window.history.pushState({}, document.title, path);
			gtag('config', 'UA-26211653-3', { 'page_path': path });
		}
	}
	genWasChanged = true;
	/* eslint-enable */
	// declaring these variables with var here makes z moves not work; TODO
	pokedex = calc.SPECIES[gen];
	setdex = SETDEX[gen];
	randdex = RANDDEX[gen];
	typeChart = calc.TYPE_CHART[gen];
	moves = calc.MOVES[gen];
	items = calc.ITEMS[gen];
	abilities = calc.ABILITIES[gen];
	clearField();
	$("#importedSets").prop("checked", false);
	loadDefaultLists();
	$(".gen-specific.g" + gen).show();
	$(".gen-specific").not(".g" + gen).hide();
	var typeOptions = getSelectOptions(Object.keys(typeChart));
	$("select.type1, select.move-type").find("option").remove().end().append(typeOptions);
	$("select.teraType").find("option").remove().end().append(getSelectOptions(Object.keys(typeChart).slice(1)));
	$("select.type2").find("option").remove().end().append("<option value=\"\">(none)</option>" + typeOptions);
	var moveOptions = getSelectOptions(Object.keys(moves), true);
	$("select.move-selector").find("option").remove().end().append(moveOptions);
	var abilityOptions = getSelectOptions(abilities, true);
	$("select.ability").find("option").remove().end().append("<option value=\"\">(other)</option>" + abilityOptions);
	var itemOptions = getSelectOptions(items, true);
	$("select.item").find("option").remove().end().append("<option value=\"\">(none)</option>" + itemOptions);

	$(".set-selector").val(getFirstValidSetOption().id);
	$(".set-selector").change();
	$("#p1, #p2").each(function () {
		updateTraceCopyVisibility($(this));
	});
});

function getFirstValidSetOption() {
	var sets = getSetOptions();
	// NB: The first set is never valid, so we start searching after it.
	for (var i = 1; i < sets.length; i++) {
		if (sets[i].id && sets[i].id.indexOf('(Blank Set)') === -1) return sets[i];
	}
	return undefined;
}

$(".notation").change(function () {
	notation = $(this).val();
});

function clearField() {
	$("#singles-format").prop("checked", true);
	$("#clear").prop("checked", true);
	$("#gscClear").prop("checked", true);
	$("#gravity").prop("checked", false);
	$("#srL").prop("checked", false);
	$("#srR").prop("checked", false);
	$("#spikesL0").prop("checked", true);
	$("#spikesR0").prop("checked", true);
	$("#gscSpikesL").prop("checked", false);
	$("#gscSpikesR").prop("checked", false);
	$("#steelsurgeL").prop("checked", false);
	$("#steelsurgeR").prop("checked", false);
	$("#vinelashL").prop("checked", false);
	$("#vinelashR").prop("checked", false);
	$("#wildfireL").prop("checked", false);
	$("#wildfireR").prop("checked", false);
	$("#cannonadeL").prop("checked", false);
	$("#cannonadeR").prop("checked", false);
	$("#volcalithL").prop("checked", false);
	$("#volcalithR").prop("checked", false);
	$("#reflectL").prop("checked", false);
	$("#reflectR").prop("checked", false);
	$("#lightScreenL").prop("checked", false);
	$("#lightScreenR").prop("checked", false);
	$("#protectL").prop("checked", false);
	$("#protectR").prop("checked", false);
	$("#leechSeedL").prop("checked", false);
	$("#leechSeedR").prop("checked", false);
	$("#foresightL").prop("checked", false);
	$("#foresightR").prop("checked", false);
	$("#helpingHandL").prop("checked", false);
	$("#helpingHandR").prop("checked", false);
	$("#tailwindL").prop("checked", false);
	$("#tailwindR").prop("checked", false);
	$("#friendGuardL").prop("checked", false);
	$("#friendGuardR").prop("checked", false);
	$("#auroraVeilL").prop("checked", false);
	$("#auroraVeilR").prop("checked", false);
	$("#batteryL").prop("checked", false);
	$("#batteryR").prop("checked", false);
	$("#switchingL").prop("checked", false);
	$("#switchingR").prop("checked", false);
	$("input:checkbox[name='terrain']").prop("checked", false);
}

function getSetOptions(sets) {
	var setsHolder = sets;
	if (setsHolder === undefined) {
		setsHolder = pokedex;
	}
	var pokeNames = Object.keys(setsHolder);
	pokeNames.sort();
	var setOptions = [];
	for (var i = 0; i < pokeNames.length; i++) {
		var pokeName = pokeNames[i];
		setOptions.push({
			pokemon: pokeName,
			text: pokeName
		});
		if ($("#randoms").prop("checked")) {
			if (pokeName in randdex) {
				setOptions.push({
					pokemon: pokeName,
					set: 'Randoms Set',
					text: pokeName + " (Randoms)",
					id: pokeName + " (Randoms)"
				});
			}
		} else {
			if (pokeName in setdex) {
				var setNames = Object.keys(setdex[pokeName]);
				for (var j = 0; j < setNames.length; j++) {
					var setName = setNames[j];
					setOptions.push({
						pokemon: pokeName,
						set: setName,
						text: pokeName + " (" + setName + ")",
						id: pokeName + " (" + setName + ")",
						isCustom: setdex[pokeName][setName].isCustomSet,
						nickname: setdex[pokeName][setName].nickname || ""
					});
				}
			}
			setOptions.push({
				pokemon: pokeName,
				set: "Blank Set",
				text: pokeName + " (Blank Set)",
				id: pokeName + " (Blank Set)"
			});
		}
	}
	return setOptions;
}

/** Match one search token against species (prefix / word-start rules) or trainer / nickname (substring). */
function termMatchesSetOption(termUpper, option) {
	if (!termUpper) return true;
	var pokeName = option.pokemon.toUpperCase();
	if (pokeName.indexOf(termUpper) === 0 || pokeName.indexOf("-" + termUpper) >= 0 || pokeName.indexOf(" " + termUpper) >= 0) {
		return true;
	}
	if (option.set && option.set.toUpperCase().indexOf(termUpper) >= 0) {
		return true;
	}
	if (option.nickname && option.nickname.toUpperCase().indexOf(termUpper) >= 0) {
		return true;
	}
	return false;
}

function getSelectOptions(arr, sort, defaultOption) {
	if (sort) {
		arr.sort();
	}
	var r = '';
	for (var i = 0; i < arr.length; i++) {
		r += '<option value="' + arr[i] + '" ' + (defaultOption === i ? 'selected' : '') + '>' + arr[i] + '</option>';
	}
	return r;
}
var stickyMoves = (function () {
	var lastClicked = 'resultMoveL1';
	$(".result-move").click(function () {
		if (this.id === lastClicked) {
			$(this).toggleClass("locked-move");
		} else {
			$('.locked-move').removeClass('locked-move');
		}
		lastClicked = this.id;
	});

	return {
		clearStickyMove: function () {
			lastClicked = null;
			$('.locked-move').removeClass('locked-move');
		},
		setSelectedMove: function (slot) {
			lastClicked = slot;
		},
		getSelectedSide: function () {
			if (lastClicked) {
				if (lastClicked.indexOf('resultMoveL') !== -1) {
					return 'p1';
				} else if (lastClicked.indexOf('resultMoveR') !== -1) {
					return 'p2';
				}
			}
			return null;
		}
	};
})();

function isPokeInfoGrounded(pokeInfo) {
	var teraType = pokeInfo.find(".teraToggle").is(":checked") ? pokeInfo.find(".teraType").val() : undefined;
	return $("#gravity").prop("checked") || (
		teraType ? teraType !== "Flying" : pokeInfo.find(".type1").val() !== "Flying" &&
			teraType ? teraType !== "Flying" : pokeInfo.find(".type2").val() !== "Flying" &&
			pokeInfo.find(".ability").val() !== "Levitate" &&
		pokeInfo.find(".item").val() !== "Air Balloon"
	);
}

function getTerrainEffects() {
	var className = $(this).prop("className");
	className = className.substring(0, className.indexOf(" "));
	switch (className) {
		case "type1":
		case "type2":
		case "teraType":
		case "teraToggle":
		case "item":
			var id = $(this).closest(".poke-info").prop("id");
			var terrainValue = $("input:checkbox[name='terrain']:checked").val();
			if (terrainValue === "Electric") {
				$("#" + id).find("[value='Asleep']").prop("disabled", isPokeInfoGrounded($("#" + id)));
			} else if (terrainValue === "Misty") {
				$("#" + id).find(".status").prop("disabled", isPokeInfoGrounded($("#" + id)));
			}
			break;
		case "ability":
			// with autoset, ability change may cause terrain change, need to consider both sides
			var terrainValue = $("input:checkbox[name='terrain']:checked").val();
			if (terrainValue === "Electric") {
				$("#p1").find(".status").prop("disabled", false);
				$("#p2").find(".status").prop("disabled", false);
				$("#p1").find("[value='Asleep']").prop("disabled", isPokeInfoGrounded($("#p1")));
				$("#p2").find("[value='Asleep']").prop("disabled", isPokeInfoGrounded($("#p2")));
			} else if (terrainValue === "Misty") {
				$("#p1").find(".status").prop("disabled", isPokeInfoGrounded($("#p1")));
				$("#p2").find(".status").prop("disabled", isPokeInfoGrounded($("#p2")));
			} else {
				$("#p1").find("[value='Asleep']").prop("disabled", false);
				$("#p1").find(".status").prop("disabled", false);
				$("#p2").find("[value='Asleep']").prop("disabled", false);
				$("#p2").find(".status").prop("disabled", false);
			}
			break;
		default:
			$("input:checkbox[name='terrain']").not(this).prop("checked", false);
			if ($(this).prop("checked") && $(this).val() === "Electric") {
				// need to enable status because it may be disabled by Misty Terrain before.
				$("#p1").find(".status").prop("disabled", false);
				$("#p2").find(".status").prop("disabled", false);
				$("#p1").find("[value='Asleep']").prop("disabled", isPokeInfoGrounded($("#p1")));
				$("#p2").find("[value='Asleep']").prop("disabled", isPokeInfoGrounded($("#p2")));
			} else if ($(this).prop("checked") && $(this).val() === "Misty") {
				$("#p1").find(".status").prop("disabled", isPokeInfoGrounded($("#p1")));
				$("#p2").find(".status").prop("disabled", isPokeInfoGrounded($("#p2")));
			} else {
				$("#p1").find("[value='Asleep']").prop("disabled", false);
				$("#p1").find(".status").prop("disabled", false);
				$("#p2").find("[value='Asleep']").prop("disabled", false);
				$("#p2").find(".status").prop("disabled", false);
			}
			break;
	}
}

function loadDefaultLists() {
	$(".set-selector").select2({
		width: "100%",
		containerCssClass: "set-selector-select2",
		formatResult: function (object) {
			if ($("#randoms").prop("checked")) {
				return object.pokemon;
			} else {
				return object.set ? (object.pokemon + " (" + object.set + ")") : ("<b>" + object.text + "</b>");
			}
		},
		query: function (query) {
			var pageSize = 30;
			var results = [];
			var options = getSetOptions();
			for (var i = 0; i < options.length; i++) {
				var option = options[i];
				var terms = query.term ? query.term.toUpperCase().split(/\s+/).filter(function (w) { return w.length; }) : [];
				if (!query.term || terms.every(function (term) { return termMatchesSetOption(term, option); })) {
					if ($("#randoms").prop("checked")) {
						if (option.id) results.push(option);
					} else {
						results.push(option);
					}
				}
			}
			query.callback({
				results: results.slice((query.page - 1) * pageSize, query.page * pageSize),
				more: results.length >= query.page * pageSize
			});
		},
		initSelection: function (element, callback) {
			var v = $(element).val();
			if (v) {
				var options = getSetOptions();
				for (var i = 0; i < options.length; i++) {
					if (options[i].id === v) {
						callback(options[i]);
						return;
					}
				}
			}
			callback(getFirstValidSetOption());
		}
	});
}

function allPokemon(selector) {
	var allSelector = "";
	for (var i = 0; i < $(".poke-info").length; i++) {
		if (i > 0) {
			allSelector += ", ";
		}
		allSelector += "#p" + (i + 1) + " " + selector;
	}
	return allSelector;
}

function loadCustomList(id) {
	$("#" + id + " .set-selector").select2({
		width: "100%",
		containerCssClass: "set-selector-select2",
		formatResult: function (set) {
			return (set.nickname ? set.pokemon + " (" + set.nickname + ")" : set.id);
		},
		query: function (query) {
			var pageSize = 30;
			var results = [];
			var options = getSetOptions();
			for (var i = 0; i < options.length; i++) {
				var option = options[i];
				var terms = query.term ? query.term.toUpperCase().split(/\s+/).filter(function (w) { return w.length; }) : [];
				if (option.isCustom && option.set && (!query.term || terms.every(function (term) { return termMatchesSetOption(term, option); }))) {
					results.push(option);
				}
			}
			query.callback({
				results: results.slice((query.page - 1) * pageSize, query.page * pageSize),
				more: results.length >= query.page * pageSize
			});
		},
		initSelection: function (element, callback) {
			var data = "";
			callback(data);
		}
	});
}

function get_trainer_names() {
	var all_poks = SETDEX_SV;
	var trainer_names = [];

	for (const [pok_name, poks] of Object.entries(all_poks)) {
		var pok_tr_names = Object.keys(poks);
		for (var ti = 0; ti < pok_tr_names.length; ti++) {
			var index = poks[pok_tr_names[ti]]["index"];
			var trainer_name = pok_tr_names[ti];
			trainer_names.push(`[${index}]${pok_name} (${trainer_name})`);
		}
	}
	return trainer_names;
}

function teamHasTrainerIconWithDataId(dataIdStr) {
	var team = document.getElementById("team-poke-list");
	if (!team || !dataIdStr) return false;
	var nodes = team.getElementsByClassName("trainer-pok");
	for (var i = 0; i < nodes.length; i++) {
		if (nodes[i].getAttribute("data-id") === dataIdStr) return true;
	}
	return false;
}

function removeTrainerIconsWithDataIdFromBoxLists(dataIdStr) {
	if (!dataIdStr) return;
	var lists = ["box-poke-list", "box-poke-list2"];
	for (var L = 0; L < lists.length; L++) {
		var box = document.getElementById(lists[L]);
		if (!box) continue;
		var nodes = box.getElementsByClassName("trainer-pok");
		for (var i = nodes.length - 1; i >= 0; i--) {
			if (nodes[i].getAttribute("data-id") === dataIdStr) {
				nodes[i].remove();
			}
		}
	}
}

var STORAGE_BOX2_SET_IDS = "nullcalc_box2SetIds";
var __box2SyncHandle = null;

function readBox2SetIds() {
	try {
		var raw = localStorage.getItem(STORAGE_BOX2_SET_IDS);
		if (!raw) return {};
		var arr = JSON.parse(raw);
		if (!Array.isArray(arr)) return {};
		var map = {};
		for (var i = 0; i < arr.length; i++) {
			if (arr[i]) map[String(arr[i])] = true;
		}
		return map;
	} catch (e) {
		return {};
	}
}

function writeBox2SetIdsFromDom() {
	try {
		var box2 = document.getElementById("box-poke-list2");
		if (!box2) return;
		var nodes = box2.getElementsByClassName("trainer-pok");
		var ids = [];
		for (var i = 0; i < nodes.length; i++) {
			if (nodes[i] && nodes[i].id) ids.push(String(nodes[i].id));
		}
		localStorage.setItem(STORAGE_BOX2_SET_IDS, JSON.stringify(ids));
	} catch (e) {}
}

function queueBox2SetIdsSync() {
	if (__box2SyncHandle !== null) return;
	var run = function () {
		__box2SyncHandle = null;
		writeBox2SetIdsFromDom();
	};
	if (typeof requestAnimationFrame !== "undefined") {
		__box2SyncHandle = requestAnimationFrame(run);
	} else {
		__box2SyncHandle = setTimeout(run, 0);
	}
}

/** @param {string} [boxListId] - e.g. "box-poke-list2" for box 2; defaults to "box-poke-list". */
function addBoxed(poke, boxListId) {
	var listId = boxListId || "box-poke-list";
	var listEl = document.getElementById(listId);
	if (!listEl) return;
	var id = "" + poke.name + poke.nameProp;
	var dataIdStr = poke.name + " (" + poke.nameProp + ")";
	if (teamHasTrainerIconWithDataId(dataIdStr)) {
		removeTrainerIconsWithDataIdFromBoxLists(dataIdStr);
		return;
	}
	var boxId = "box-" + id;
	var existingBox = document.getElementById(boxId);
	if (existingBox && existingBox.parentNode === listEl) return;

	var existing = document.getElementById(id);
	if (existing) {
		if (existing.parentNode === listEl) return;
		if (existing.closest && existing.closest("#team-poke-list")) {
			return;
		}
		listEl.appendChild(existing);
		queueBox2SetIdsSync();
		return;
	}
	var newPoke = document.createElement("img");
	newPoke.id = id;
	newPoke.className = "trainer-pok left-side";
	setPokemonIconImgSrc(newPoke, poke, false);
	newPoke.dataset.id = `${poke.name} (${poke.nameProp})`
	newPoke.addEventListener("dragstart", dragstart_handler);
	listEl.appendChild(newPoke)
	queueBox2SetIdsSync();
}

// Arceus: show as Arceus-Fire, Arceus-Fairy, etc. based on plate item
var ARCEUS_PLATE_TO_FORM = {
	'Draco Plate': 'Arceus-Dragon', 'Dread Plate': 'Arceus-Dark', 'Earth Plate': 'Arceus-Ground',
	'Fist Plate': 'Arceus-Fighting', 'Flame Plate': 'Arceus-Fire', 'Icicle Plate': 'Arceus-Ice',
	'Insect Plate': 'Arceus-Bug', 'Iron Plate': 'Arceus-Steel', 'Meadow Plate': 'Arceus-Grass',
	'Mind Plate': 'Arceus-Psychic', 'Sky Plate': 'Arceus-Flying', 'Splash Plate': 'Arceus-Water',
	'Spooky Plate': 'Arceus-Ghost', 'Stone Plate': 'Arceus-Rock', 'Toxic Plate': 'Arceus-Poison',
	'Zap Plate': 'Arceus-Electric', 'Pixie Plate': 'Arceus-Fairy'
};
function getArceusFormeFromItem(item) {
	return (item && ARCEUS_PLATE_TO_FORM[item]) || null;
}

/** SETDEX species string → filename stem (matches getSrcImgPokemon rules). */
function normalizeTrainerIconSpeciesName(pok_name) {
	if (pok_name == "Zygarde-10%") pok_name = "Zygarde-10%25";
	else if (pok_name == "Tauros-Paldea-Water") pok_name = "Tauros-Paldea-Aqua";
	else if (pok_name == "Tauros-Paldea-Fire") pok_name = "Tauros-Paldea-Blaze";
	else if (pok_name == "Tauros-Paldea") pok_name = "Tauros-Paldea-Combat";
	else if (pok_name == "Pumpkaboo-Super") pok_name = "Pumpkaboo";
	else if (pok_name == "Mime Jr.") pok_name = "Mime%20Jr";
	else if (pok_name == "Aegislash-Shield") pok_name = "Aegislash";
	else if (/^genesect/i.test(String(pok_name || "").replace(/ /g, "-"))) pok_name = "Genesect";
	// Gourgeist: all size formes use Gourgeist.png
	else if (/^gourgeist-/i.test(String(pok_name || "").replace(/ /g, "-"))) pok_name = "Gourgeist";
	return pok_name;
}

/**
 * Icon folder next to the served HTML (./icons/). Repo layout: docs/icons/; GitHub Pages serves docs/ at site root
 * so the URL has no /docs/ segment — must use ./icons/, not ../docs/icons/.
 * Override with window.POKEMON_ICONS_BASE if needed.
 */
function getPokemonIconsBase() {
	if (typeof window !== "undefined" && window.POKEMON_ICONS_BASE) {
		var b = String(window.POKEMON_ICONS_BASE);
		return b.charAt(b.length - 1) === "/" ? b : b + "/";
	}
	var p = (typeof window !== "undefined" && window.location && window.location.pathname) ? window.location.pathname : "";
	// Local file or path containing .../docs/... (e.g. file:///.../docs/index.html)
	if (/\/docs(\/|$)/.test(p)) {
		return "./icons/";
	}
	// Local dev: opened from dist/ sibling to docs/ in the repo
	if (/\/dist(\/|$)/.test(p)) {
		return "../docs/icons/";
	}
	// GitHub Pages (docs as site root), root hosting, etc. — icons folder is next to index.html
	return "./icons/";
}

/** @param {boolean} [alwaysFullSizeIcon] If true, use full-size sprites (same as big icon mode); used for top-of-panel previews. */
function getSrcImgPokemon(poke, alwaysFullSizeIcon) {
	if (!poke) {
		return;
	}
	var iconName = poke.name === "Aegislash-Shield" ? "Aegislash" : poke.name;
	// Icons match species name Wooper-Paldea.png, not WooperPaldea.png
	if (poke.name === "WooperPaldea") {
		iconName = "Wooper-Paldea";
	}
	// Icon file is Type-Null.png (not Type:-Null.png from space/colon rules)
	if (poke.name === "Type: Null") {
		iconName = "Type-Null";
	}
	// All Genesect drive forms share Genesect.png (PascalCase — Linux / GitHub Pages is case-sensitive)
	if (/^genesect/i.test(String(poke.name || "").replace(/ /g, "-"))) {
		iconName = "Genesect";
	}
	// Gourgeist: all size formes use Gourgeist.png (case-insensitive species string)
	if (/^gourgeist-/i.test(String(poke.name || "").replace(/ /g, "-"))) {
		iconName = "Gourgeist";
	}
	if (poke.name === "Arceus" && poke.item && getArceusFormeFromItem(poke.item)) {
		iconName = getArceusFormeFromItem(poke.item);
	}
	if (iconName.indexOf("Farfetch") === 0 || iconName.indexOf("Sirfetch") === 0) {
		iconName = iconName.replace(/\u2019|'/g, "");
	}
	if (iconName.indexOf("Mr. Mime") === 0) {
		iconName = iconName.replace(/Mr\. Mime/g, "Mr-Mime");
	}
	if (iconName.indexOf("Mr. Rime") === 0) {
		iconName = iconName.replace(/Mr\. Rime/g, "Mr-Rime");
	}
	iconName = iconName.replace(/ /g, "-");
	var base = getPokemonIconsBase();
	var useSmall =
		!alwaysFullSizeIcon &&
		typeof localStorage !== "undefined" &&
		localStorage.getItem("icon-size-mode") === "small";
	// Must match export_small_icons.py / build_icons_small_canvas.py (*-Small.png). Linux (GitHub Pages) is case-sensitive.
	return useSmall ? base + iconName + "-Small.png" : base + iconName + ".png";
}

/** If *-Small.png fails, try *-small.png (scripts/generate-small-icons.py); then full *.png. */
function pokemonIconListImgOnError(el) {
	var full = el.dataset.iconFallback;
	var primary = el.dataset.iconPrimary;
	if (!el.dataset.iconTriedAlt && primary && full && primary !== full) {
		var alt =
			primary.indexOf("-Small.png") !== -1
				? primary.replace("-Small.png", "-small.png")
				: primary.indexOf("-small.png") !== -1
					? primary.replace("-small.png", "-Small.png")
					: null;
		if (alt && alt !== primary) {
			el.dataset.iconTriedAlt = "1";
			el.src = alt;
			return;
		}
	}
	el.onerror = null;
	if (full) el.src = full;
}

/** Appended to team / trainer / box icon <img> tags: defer offscreen loads + decode off main thread (many parallel requests on GitHub Pages). */
var POKEMON_LIST_ICON_HTML_ATTRS = ' loading="lazy" decoding="async"';

/** For <img> attributes: `*-Small.png` in small mode, then alternate casing, then full PNG. */
function pokemonIconImgSrcAttributes(poke, alwaysFullForThisImg) {
	var primary = getSrcImgPokemon(poke, alwaysFullForThisImg);
	var full = getSrcImgPokemon(poke, true);
	if (!primary) return "";
	if (primary === full) {
		return 'src="' + escapeAttr(primary) + '"' + POKEMON_LIST_ICON_HTML_ATTRS;
	}
	return (
		'src="' +
		escapeAttr(primary) +
		'" data-icon-primary="' +
		escapeAttr(primary) +
		'" data-icon-fallback="' +
		escapeAttr(full) +
		'" onerror="pokemonIconListImgOnError(this)"' +
		POKEMON_LIST_ICON_HTML_ATTRS
	);
}

function setPokemonIconImgSrc(img, poke, alwaysFullSizeIcon) {
	if (!img || !poke) return;
	var primary = getSrcImgPokemon(poke, alwaysFullSizeIcon);
	var full = getSrcImgPokemon(poke, true);
	if (primary) {
		try {
			if (new URL(primary, window.location.href).href === img.src) {
				img.decoding = "async";
				if (alwaysFullSizeIcon) {
					img.loading = "eager";
					img.setAttribute("fetchpriority", "high");
				} else {
					img.loading = "lazy";
					img.removeAttribute("fetchpriority");
				}
				return;
			}
		} catch (e) {}
	}
	img.decoding = "async";
	if (alwaysFullSizeIcon) {
		img.loading = "eager";
		img.setAttribute("fetchpriority", "high");
	} else {
		img.loading = "lazy";
		img.removeAttribute("fetchpriority");
	}
	delete img.dataset.iconPrimary;
	delete img.dataset.iconFallback;
	delete img.dataset.iconTriedAlt;
	if (primary && full && primary !== full) {
		img.dataset.iconPrimary = primary;
		img.dataset.iconFallback = full;
		img.onerror = function () {
			pokemonIconListImgOnError(img);
		};
	} else {
		img.onerror = null;
	}
	img.src = primary || "";
}

function topPokemonIcon(fullname, node) {
	var mon = { name: fullname.split(" (")[0] };
	var $panel = $(node).closest(".poke-info");
	if ($panel.length && mon.name === "Arceus") {
		var it = $panel.find(".item").val();
		if (it) mon.item = it;
	}
	setPokemonIconImgSrc(node, mon, true);
}

/** Batched so switching to big icons does not decode hundreds of PNGs on one frame (small sprites stay snappy). */
var __teamIconRefreshSeq = 0;
var TEAM_ICON_REFRESH_BATCH = 24;

function refreshTeamGridPokemonIconSrcs() {
	__teamIconRefreshSeq++;
	var seq = __teamIconRefreshSeq;
	var sel =
		"#team-poke-list .trainer-pok, #trainer-poks-first .trainer-pok, #trainer-poks-remaining .trainer-pok, #tag-partner-poke-list .trainer-pok, #box-poke-list .trainer-pok, #box-poke-list2 .trainer-pok, #trash-box .trainer-pok";
	var nodes = document.querySelectorAll(sel);
	var list = [];
	for (var j = 0; j < nodes.length; j++) list.push(nodes[j]);
	var vh = typeof window.innerHeight === "number" ? window.innerHeight : 800;
	list.sort(function (a, b) {
		var ar = a.getBoundingClientRect();
		var br = b.getBoundingClientRect();
		var av = ar.bottom > 0 && ar.top < vh;
		var bv = br.bottom > 0 && br.top < vh;
		if (av !== bv) return av ? -1 : 1;
		return 0;
	});
	var i = 0;
	function step() {
		if (seq !== __teamIconRefreshSeq) return;
		var end = Math.min(i + TEAM_ICON_REFRESH_BATCH, list.length);
		for (; i < end; i++) {
			var el = list[i];
			var dataId = el.getAttribute("data-id");
			if (!dataId) continue;
			var raw = dataId.indexOf("]") >= 0 ? dataId.slice(dataId.indexOf("]") + 1) : dataId;
			var pok_name = raw.split(" (")[0];
			try {
				pok_name = decodeURIComponent(pok_name);
			} catch (e) {}
			var pok_norm = normalizeTrainerIconSpeciesName(pok_name);
			setPokemonIconImgSrc(el, { name: pok_norm }, false);
		}
		if (i < list.length) requestAnimationFrame(step);
	}
	if (list.length) requestAnimationFrame(step);
}

function refreshPanelPokemonSpritesForIconMode() {
	var el1 = document.getElementById("p1mon");
	if (el1) {
		var f1 = getFullSetNameFromPokeInfo($("#p1"));
		if (f1) topPokemonIcon(f1, el1);
	}
	var el2 = document.getElementById("p2mon");
	if (el2) {
		var f2 = getFullSetNameFromPokeInfo($("#p2"));
		if (f2) topPokemonIcon(f2, el2);
	}
}

$(document).on('click', '.right-side', function () {
	var set = $(this).attr('data-id');
	var $list = $(this).closest('.trainer-pok-list-opposing');
	var trainerNameForWs =
		$(this).attr("data-trainer-name") || ($list.length ? $list.attr("data-trainer-name") : null);
	var wsMirror = trainerNameForWs === "Wandering Spirit";
	if (!wsMirror) {
		window._wsMirrorHeaderActive = false;
		window._wsMirrorDisplayLabel = "";
	}
	// Raw Select2 value for gauntlet/nav (not the mirror display label — that may differ from the underlying SETDEX row).
	var wsNavSet = "";
	if (wsMirror) {
		var $oppIn = $("#p2 input.set-selector").first();
		wsNavSet = ($oppIn.val() || "").trim();
		if (!wsNavSet) {
			wsNavSet = getFullSetNameFromPokeInfo($("#p2"));
		}
	}
	// Keep the gauntlet's opposing set in the selector (e.g. Psychic Cedric or None (Wandering Spirit)), not the mirrored mon's index.
	if (wsMirror && wsNavSet && isOpponentInWanderingSpiritGauntletContext(getTrainerNameFromSet(wsNavSet))) {
		window._wsMirrorDisplayLabel = formatWanderingSpiritMirrorDisplayLabel(set);
		window._wsMirrorP2Load = true;
		try {
			$('.opposing').val(set);
			$('.opposing').change();
		} finally {
			window._wsMirrorP2Load = false;
		}
		window._wsMirrorHeaderActive = true;
		$('.opposing').val(wsNavSet);
		$('.opposing .select2-chosen').text(window._wsMirrorDisplayLabel);
		CURRENT_TRAINER_POKS = get_trainer_poks(wsNavSet);
		renderAllTrainerTeams(wsNavSet);
		if (typeof applyBattleSettings === 'function') {
			applyBattleSettings(getTrainerNameFromSet(wsNavSet));
		}
		return;
	}
	topPokemonIcon(set, $("#p2mon")[0])
	$('.opposing').val(set);
	$('.opposing').change();
	$('.opposing .select2-chosen').text(set);
	renderAllTrainerTeams(set);
	if (typeof applyBattleSettings === "function") {
		applyBattleSettings(getTrainerNameFromSet(set));
	}
})

$(document).on('contextmenu', '.trainer-pok.right-side', function (e) {
	e.preventDefault();
	var id = $(this).attr('data-id');
	if (id) {
		if ($(this).hasClass('opponent-marked')) {
			opposingMarkedSetIds.delete(id);
		} else {
			opposingMarkedSetIds.add(id);
		}
		$(this).toggleClass('opponent-marked');
		syncAlliesFaintedFromOpponentMarks();
	}
});

$(document).on('click', '.left-side', function () {
	var set = $(this).attr('data-id');
	topPokemonIcon(set, $("#p1mon")[0])
	$('.player').val(set);
	$('.player').change();
	$('.player .select2-chosen').text(set);
})

/** Tag Partner row (Partner Rival / Partner Steven): load set into player side for calculations. */
$(document).on("click", ".tag-partner-pok", function () {
	var set = $(this).attr("data-id");
	if (!set) return;
	topPokemonIcon(set, $("#p1mon")[0]);
	$(".player").val(set);
	$(".player").change();
	$(".player .select2-chosen").text(set);
});

$(document).on("contextmenu", ".tag-partner-pok", function (e) {
	e.preventDefault();
	var id = $(this).attr("data-id");
	if (!id) return;
	if ($(this).hasClass("tag-partner-dead")) {
		tagPartnerDeadSetIds.delete(id);
	} else {
		tagPartnerDeadSetIds.add(id);
	}
	$(this).toggleClass("tag-partner-dead");
	syncAlliesFaintedFromOpponentMarks();
});

// Right-click: box → team, team → box (same as calc-master)
$(document).on('contextmenu', '.trainer-pok.left-side', function (e) {
	e.preventDefault();
	var el = e.currentTarget;
	var parentId = el.parentNode && el.parentNode.id;
	if (parentId === 'team-poke-list') {
		document.getElementById('box-poke-list').appendChild(el);
	} else if (parentId === 'box-poke-list' || parentId === 'box-poke-list2') {
		document.getElementById('team-poke-list').appendChild(el);
	}
})


//select first mon of the box when loading
function selectFirstMon() {
	var pMons = document.getElementsByClassName("trainer-pok left-side");
	if (pMons.length === 0) return;
	var set = pMons[0].getAttribute("data-id");
	$('.player').val(set);
	$('.player').change();
	$('.player .select2-chosen').text(set);
}

function selectTrainer(value) {
	localStorage.setItem("lasttimetrainer", value);
	all_poks = SETDEX_SV
	for (const [pok_name, poks] of Object.entries(all_poks)) {
		var pok_tr_names = Object.keys(poks)
		for (var ti in pok_tr_names) {
			var index = (poks[pok_tr_names[ti]]["index"])
			if (index == value) {
				var set = `${pok_name} (${pok_tr_names[ti]})`;
				$('.opposing').val(set);
				$('.opposing').change();
				$('.opposing .select2-chosen').text(set);
				renderAllTrainerTeams(set);
				if (typeof applyBattleSettings === "function") {
					applyBattleSettings(getTrainerNameFromSet(set));
				}
				return;
			}

		}
	}
}

function nextTrainer() {
	var currentSet = getOpposingSetStringForTrainerNav();
	if (!currentSet) {
		return;
	}
	var currentTrainerName = getTrainerNameFromSet(currentSet);
	var bounds = getGauntletEndpointIndexBounds(currentTrainerName);
	if (!bounds) {
		bounds = getOpposingTeamIndexBoundsFromDom();
	}
	if (!bounds) {
		bounds = getTrainerIndexBoundsForName(currentTrainerName);
	}
	var nextIndex;
	if (bounds) {
		nextIndex = getNextTrainerIndexAfter(bounds.max);
	}
	if (nextIndex === undefined) {
		var firstBox = $(".trainer-pok-list-opposing").first();
		if (firstBox.length > 0) {
			var string = firstBox.html();
			var initialSplit = string.split("[");
			if (initialSplit.length > 1) {
				var parsed = parseInt(initialSplit[initialSplit.length - 2].split("]")[0], 10);
				if (!isNaN(parsed)) {
					nextIndex = getNextTrainerIndexAfter(parsed);
				}
			}
		}
	}

	if (nextIndex !== undefined) {
		selectTrainer(nextIndex);
	}
}

function previousTrainer() {
	var currentSet = getOpposingSetStringForTrainerNav();
	if (!currentSet) {
		return;
	}
	var currentTrainerName = getTrainerNameFromSet(currentSet);
	var bounds = getGauntletEndpointIndexBounds(currentTrainerName);
	if (!bounds) {
		bounds = getOpposingTeamIndexBoundsFromDom();
	}
	if (!bounds) {
		bounds = getTrainerIndexBoundsForName(currentTrainerName);
	}
	if (!bounds) {
		return;
	}
	var prevIndex = getPreviousTrainerIndexBefore(bounds.min);
	if (prevIndex !== undefined) {
		selectTrainer(prevIndex);
	}
}

function resetTrainer() {
	if (confirm(`Are you sure you want to reset? This will clear all imported sets and change your current trainer back to Younger Calvin. This cannot be undone.`)){
		selectTrainer(1);
		localStorage.removeItem("customsets");
		localStorage.removeItem(STORAGE_BOX2_SET_IDS);
		$(allPokemon("#importedSetsOptions")).hide();
		loadDefaultLists();
		for (let zone of document.getElementsByClassName("dropzone")){
			zone.innerHTML="";
		}
	}
	
}


function HideShowCCSettings(){
	$('#show-cc')[0].toggleAttribute("hidden");
	$('#hide-cc')[0].toggleAttribute("hidden");
	$('#refr-cc')[0].toggleAttribute("hidden");
	$('#info-cc')[0].toggleAttribute("hidden");
	$('#cc-sets')[0].toggleAttribute("hidden");
}

// Defer + batch color-code recalcs to avoid UI hitching on selection changes.
var __ccRefreshSeq = 0;
var __ccRefreshIdleHandle = null;
var CC_REFRESH_BATCH = 20;

function scheduleColorCodeUpdate() {
	__ccRefreshSeq++;
	var seq = __ccRefreshSeq;

	if (__ccRefreshIdleHandle !== null) {
		try {
			if (typeof cancelIdleCallback !== "undefined") cancelIdleCallback(__ccRefreshIdleHandle);
			else clearTimeout(__ccRefreshIdleHandle);
		} catch (e) {}
		__ccRefreshIdleHandle = null;
	}

	function run() {
		if (seq !== __ccRefreshSeq) return;
		colorCodeUpdate(seq);
	}

	// Start quickly (next frame) so updates feel immediate.
	// colorCodeUpdate itself batches work over frames, so this stays responsive.
	if (typeof requestAnimationFrame !== "undefined") {
		__ccRefreshIdleHandle = requestAnimationFrame(run);
		return;
	}

	// Fallback: microtask-ish
	__ccRefreshIdleHandle = setTimeout(run, 0);
}

function colorCodeUpdate(seq){
	var speCheck = document.getElementById("cc-spe-border").checked;
	var ohkoCheck = document.getElementById("cc-ohko-color").checked;
	if (!speCheck && !ohkoCheck){
		return
	}
	var pMons = document.getElementsByClassName("trainer-pok left-side");
	// i calc here to alleviate some calculation
	var p2info = $("#p2");
	var p2 = createPokemon(p2info);
	// Batch DOM/class updates over multiple frames so selection stays responsive.
	var i = 0;
	var vh = typeof window.innerHeight === "number" ? window.innerHeight : 800;
	var list = [];
	for (var j = 0; j < pMons.length; j++) list.push(pMons[j]);
	list.sort(function (a, b) {
		var ar = a.getBoundingClientRect();
		var br = b.getBoundingClientRect();
		var av = ar.bottom > 0 && ar.top < vh;
		var bv = br.bottom > 0 && br.top < vh;
		if (av !== bv) return av ? -1 : 1;
		return 0;
	});

	function step() {
		if (seq && seq !== __ccRefreshSeq) return;
		var end = Math.min(i + CC_REFRESH_BATCH, list.length);
		for (; i < end; i++) {
			var el = list[i];
			var set = el.getAttribute("data-id");
			var idColor = calculationsColors(set, p2);
			if (speCheck && ohkoCheck){
				el.className = `trainer-pok left-side mon-speed-${idColor.speed} mon-dmg-${idColor.code}`;
			}
			else if (speCheck){
				el.className = `trainer-pok left-side mon-speed-${idColor.speed}`;
			}
			else if (ohkoCheck){
				el.className = `trainer-pok left-side mon-dmg-${idColor.code}`;
			}
		}
		if (i < list.length) requestAnimationFrame(step);
	}
	if (list.length) requestAnimationFrame(step);
}
function showColorCodes(){
	scheduleColorCodeUpdate();
	HideShowCCSettings();
}

function refreshColorCode(){
	scheduleColorCodeUpdate();
}

function hideColorCodes(){
	var pMons = document.getElementsByClassName("trainer-pok left-side");
	for (let i = 0; i < pMons.length; i++) {
		pMons[i].className = "trainer-pok left-side";
	}
	document.getElementById("cc-auto-refr").checked = false;
	HideShowCCSettings();
}

function toggleInfoColorCode(){
	document.getElementById("info-cc-field").toggleAttribute("hidden");
}

function TrashPokemon() {
	var maybeMultiple = document.getElementById("trash-box").getElementsByClassName("trainer-pok");
	if (maybeMultiple.length == 0){
		return; //nothing to delete
	}
	var numberPKM = maybeMultiple.length > 1 ? `${maybeMultiple.length} Pokemon(s)` : "this Pokemon"; 
	var yes = confirm(`do you really want to remove ${numberPKM}?`);
	if (!yes) {
		return;
	}
	var customSets = JSON.parse(localStorage.customsets);
	var length= maybeMultiple.length;
	for( let i = 0; i<length; i++){
		var pokeTrashed = maybeMultiple[i];
		var name = pokeTrashed.getAttribute("data-id").split(" (")[0];
		delete customSets[name];
	}
	document.getElementById("trash-box").innerHTML="";
	localStorage.setItem("customsets", JSON.stringify(customSets));
	$('#box-poke-list')[0].click();
	//switch to the next pokemon automatically
	
}
function RemoveAllPokemon() {
	document.getEle
}
function allowDrop(ev) {
	ev.preventDefault();
}

var pokeDragged = null;
function dragstart_handler(ev) {
	pokeDragged = ev.target;
}

function drop(ev) {
	ev.preventDefault();
	if (ev.target.classList.contains("dropzone")) {
		pokeDragged.parentNode.removeChild(pokeDragged);
		ev.target.appendChild(pokeDragged);	
	}
	// if it's a pokemon
	else if(ev.target.classList.contains("left-side")) {
		//And if a sibling switch them
		if(ev.target.parentNode == pokeDragged.parentNode){
			let prev1 = ev.target.previousSibling || ev.target;
			let prev2 = pokeDragged.previousSibling || pokeDragged;

			prev1.after(pokeDragged);
			prev2.after(ev.target);
		}
		//if not just append to the box it belongs
		else{
			let prev1 = ev.target.previousSibling || ev.target;
			prev1.after(pokeDragged);
		}
	}
	ev.target.classList.remove('over');
	queueBox2SetIdsSync();
	if (typeof MutationObserver === "undefined") {
		refreshOpposingTeamIfWanderingSpirit();
	}
}

function handleDragEnter(ev) {
	ev.target.classList.add('over');
}

function handleDragLeave(ev) {
	ev.target.classList.remove('over');
}

function SpeedBorderSetsChange(ev){
	var monImgs = document.getElementsByClassName("left-side");
	if (ev.target.checked){
		for (let monImg of monImgs){
			monImg.classList.remove("mon-speed-none")
		}
	}else{
		for (let monImg of monImgs){
			monImg.classList.add("mon-speed-none")
		}
	}
}

function ColorCodeSetsChange(ev){
	var monImgs = document.getElementsByClassName("left-side");
	if (ev.target.checked){
		for (let monImg of monImgs){
			monImg.classList.remove("mon-dmg-none")
		}
	}else{
		for (let monImg of monImgs){
			monImg.classList.add("mon-dmg-none")
		}
	}
}
function setupSideCollapsers(){
	var applyF = (btns) => {
		for (var i = 0; i < btns.length; i++) {
			let btn = btns[i];
			btn.cum = btn.offsetHeight;
			btn.sisterEl = document.getElementsByClassName(btn.getAttribute("data-set"))[0];
			btn.prevEl = btns[i-1] || null;
			if (btn.prevEl){
				btn.cum += btn.prevEl.cum
			}else{
				btn.cum = 0;
			}
			btn.nextEl = btns[i+1] || null;
			btn.onclick = sideCollapsersCorrection
		}
	}
	var leftBtns = document.getElementsByClassName("l-side-button");
	var rigtBtns = document.getElementsByClassName("r-side-button");
	applyF(leftBtns);
	applyF(rigtBtns);
	/*
		readjust the left buttons
		Because i couldn't find a proper way to do it with css
	*/
	for(let btn of leftBtns){
		btn.style.left = "-" + btn.offsetWidth + "px";
	}
	leftBtns[0].onclick();
	rigtBtns[0].onclick();
}
function sideCollapsersCorrection(ev){
	if (ev){
		var arrow = ev.target.children[0] || ev.target.parentNode.children[0];
		collapseArrow(arrow);
	}
	var node = this;
	if (node.tagName != "BUTTON"){
		node = this.target.parentNode;
	}
	var prev = node.prevEl;
	var offset = node.sisterEl.offsetTop;
	var relativeHeight = node.parentNode.offsetTop;
	if(prev){
		//since the position is absolute, this will prevent from eating fellows.
		var prevLowPos = prev.offsetTop + prev.offsetHeight; - relativeHeight ;
		if(offset==0){// collapsed
			offset = prevLowPos;
		}else{// standing
			offset = offset - relativeHeight;
			if (offset < prevLowPos){
				offset = prevLowPos;
			}
		}
	}else{
		if(offset==0){// collapsed
			offset = node.offsetTop;
		}else{// standing
			offset = offset - relativeHeight;
		}
	}
	node.style.top = offset + "px"
	//propagate to next buttons
	if(node.nextEl){
		node.nextEl.onclick()
	}
}
function collapseArrow(arrow){
	var arrBtn = arrow.parentNode;
	var target = arrBtn.getAttribute("data-set");
	for (let div of document.getElementsByClassName(target)){
		div.toggleAttribute("hidden");
	}
	if (arrBtn.classList.contains("l-side-button")){
		if (arrow.classList.contains("arrowdown")){
			arrow.classList.remove("arrowdown");
			arrow.classList.add("arrowright");
		}else{
			arrow.classList.remove("arrowright");
			arrow.classList.add("arrowdown");
		}
	}
	else if (arrBtn.classList.contains("r-side-button")){
		if (arrow.classList.contains("arrowdown")){
			arrow.classList.remove("arrowdown");
			arrow.classList.add("arrowleft");
		}else{
			arrow.classList.remove("arrowleft");
			arrow.classList.add("arrowdown");
		}
	}
}

$(document).ready(function () {
	var params = new URLSearchParams(window.location.search);
	var g = GENERATION[params.get('gen')] || 9;
	$("#gen" + g).prop("checked", true);
	$("#gen" + g).change();
	$("#percentage").prop("checked", true);
	$("#percentage").change();
	$("#singles-format").prop("checked", true);
	$("#singles-format").change();
	loadDefaultLists();
	$(".move-selector").select2({
		dropdownAutoWidth: true,
		matcher: function (term, text) {
			// 2nd condition is for Hidden Power
			return text.toUpperCase().indexOf(term.toUpperCase()) === 0 || text.toUpperCase().indexOf(" " + term.toUpperCase()) >= 0;
		}
	});
	$(".set-selector").val(getFirstValidSetOption().id);
	$(".set-selector").change();
	$("#p1, #p2").each(function () {
		updateTraceCopyVisibility($(this));
	});
	$(".terrain-trigger").bind("change keyup", getTerrainEffects);
	$("#previous-trainer").click(previousTrainer);
	$("#next-trainer").click(nextTrainer);
	$("#reset-trainer").click(resetTrainer);
	$('#show-cc').click(showColorCodes);
	$('#hide-cc').click(hideColorCodes);
	$('#refr-cc').click(refreshColorCode);
	$('#info-cc').click(toggleInfoColorCode);
	$('#trash-pok').click(TrashPokemon);
	$('#cc-spe-border').change(SpeedBorderSetsChange);
	$('#cc-ohko-color').change(ColorCodeSetsChange);
	$('#cc-spe-border')[0].checked=true;
	$('#cc-ohko-color')[0].checked=true;
	for (let dropzone of document.getElementsByClassName("dropzone")){
		dropzone.ondragenter=handleDragEnter;
		dropzone.ondragleave=handleDragLeave;
		dropzone.ondrop=drop;
		dropzone.ondragover=allowDrop;
	}
	initTeamPokeListObserver();
	// Small: flex row + docs/icons/*-Small.png (alt *-small.png; fallback *.png). Big: 64×64 + full PNG.
	var ICON_SIZE_BIG_PX = 64;
	var ICON_ORIGINAL_ROW_PX = 30;
	var iconSizeSmallBtn = document.getElementById("icon-size-small");
	var iconSizeBigBtn = document.getElementById("icon-size-big");
	function applyIconSizeVars(pxSize, w, h, rowPx) {
		document.documentElement.style.setProperty("--box-icon-size", pxSize + "px");
		document.documentElement.style.setProperty("--box-icon-w", w + "px");
		document.documentElement.style.setProperty("--box-icon-h", h + "px");
		document.documentElement.style.setProperty("--box-icon-row", rowPx + "px");
	}
	function setIconSizeMode(mode) {
		if (mode === "medium") mode = "small";
		if (mode === "compact") mode = "big";
		document.documentElement.classList.toggle("icon-size-small", mode === "small");
		document.documentElement.classList.remove("icon-size-compact");
		if (mode === "small") {
			applyIconSizeVars(ICON_ORIGINAL_ROW_PX, ICON_ORIGINAL_ROW_PX, ICON_ORIGINAL_ROW_PX, ICON_ORIGINAL_ROW_PX);
		} else {
			var b = ICON_SIZE_BIG_PX;
			applyIconSizeVars(b, b, b, b);
		}
		if (iconSizeSmallBtn && iconSizeBigBtn) {
			var isBig = mode === "big";
			iconSizeSmallBtn.setAttribute("aria-pressed", !isBig ? "true" : "false");
			iconSizeBigBtn.setAttribute("aria-pressed", isBig ? "true" : "false");
		}
		localStorage.setItem("icon-size-mode", mode);
		if (typeof refreshPanelPokemonSpritesForIconMode === "function") {
			refreshPanelPokemonSpritesForIconMode();
		}
		if (typeof refreshTeamGridPokemonIconSrcs === "function") {
			refreshTeamGridPokemonIconSrcs();
		}
	}
	if (iconSizeSmallBtn && iconSizeBigBtn) {
		var savedMode = localStorage.getItem("icon-size-mode");
		if (savedMode === "medium") savedMode = "small";
		if (savedMode === "compact") savedMode = "big";
		if (savedMode === "small" || savedMode === "big") {
			setIconSizeMode(savedMode);
		} else {
			var oldSlider = localStorage.getItem("icon-size-slider");
			if (oldSlider !== null) {
				var sv = parseInt(oldSlider, 10);
				if (isNaN(sv)) setIconSizeMode("small");
				else if (sv < 50) setIconSizeMode("small");
				else setIconSizeMode("big");
			} else {
				setIconSizeMode("small");
			}
		}
		iconSizeSmallBtn.addEventListener("click", function () {
			setIconSizeMode("small");
		});
		iconSizeBigBtn.addEventListener("click", function () {
			setIconSizeMode("big");
		});
	}
	var megaSepCb = document.getElementById("trainer-team-mega-base-separate");
	if (megaSepCb) {
		megaSepCb.checked = getShowMegaBaseSeparate();
		megaSepCb.addEventListener("change", function () {
			setShowMegaBaseSeparate(megaSepCb.checked);
			var fs = getFullSetNameFromPokeInfo($("#p2"));
			if (fs) renderAllTrainerTeams(fs);
		});
	}
	var BATTLE_NOTES_VISIBLE_KEY = "battle-notes-visible";
	var BATTLE_NOTES_TEXT_KEY = "battle-notes-text";
	var battleNotesToggle = document.getElementById("battle-notes-toggle");
	var battleNotesPanel = document.getElementById("battle-notes-panel");
	var battleNotesTextarea = document.getElementById("battle-notes-textarea");
	function syncBattleNotesVisibility() {
		if (!battleNotesToggle || !battleNotesPanel) return;
		var on = battleNotesToggle.checked;
		battleNotesPanel.hidden = !on;
		battleNotesPanel.setAttribute("aria-hidden", on ? "false" : "true");
		localStorage.setItem(BATTLE_NOTES_VISIBLE_KEY, on ? "1" : "0");
	}
	if (battleNotesToggle && battleNotesPanel) {
		battleNotesToggle.checked = localStorage.getItem(BATTLE_NOTES_VISIBLE_KEY) === "1";
		syncBattleNotesVisibility();
		battleNotesToggle.addEventListener("change", syncBattleNotesVisibility);
	}
	if (battleNotesTextarea) {
		var savedNotes = localStorage.getItem(BATTLE_NOTES_TEXT_KEY);
		if (savedNotes !== null && savedNotes !== "") {
			battleNotesTextarea.value = savedNotes;
		}
		battleNotesTextarea.addEventListener(
			"input",
			function () {
				localStorage.setItem(BATTLE_NOTES_TEXT_KEY, battleNotesTextarea.value);
			},
			{ passive: true }
		);
	}
	var importMegasAutoCb = document.getElementById("import-megas-auto");
	var megaAvailabilitySection = document.getElementById("mega-availability-section");
	var onlyImportAvailMegasCb = document.getElementById("only-import-available-megas");
	function syncMegaAvailabilitySectionVisibility() {
		if (!megaAvailabilitySection || !importMegasAutoCb) return;
		megaAvailabilitySection.hidden = !importMegasAutoCb.checked;
	}
	if (importMegasAutoCb) {
		importMegasAutoCb.checked = getImportMegasAuto();
		importMegasAutoCb.addEventListener("change", function () {
			setImportMegasAuto(importMegasAutoCb.checked);
			syncMegaAvailabilitySectionVisibility();
		});
	}
	if (onlyImportAvailMegasCb) {
		onlyImportAvailMegasCb.checked = getOnlyImportAvailableMegas();
		onlyImportAvailMegasCb.addEventListener("change", function () {
			setOnlyImportAvailableMegas(onlyImportAvailMegasCb.checked);
		});
	}
	syncMegaAvailabilitySectionVisibility();
	var megasBox2Cb = document.getElementById("megas-box2-toggle");
	if (megasBox2Cb) {
		megasBox2Cb.checked = getMegasBox2();
		megasBox2Cb.addEventListener("change", function () {
			setMegasBox2(megasBox2Cb.checked);
			if (typeof updateDex === "function" && localStorage.customsets) {
				try {
					updateDex(JSON.parse(localStorage.customsets));
				} catch (e) {}
			}
		});
	}
	//select last trainer (after icon size so --box-icon-size matches buttons)
	var last = localStorage.getItem("lasttimetrainer");
	if (last != null && last !== "") {
		var t = parseInt(last, 10);
		if (!isNaN(t)) selectTrainer(t);
	}
	lastOpposingTrainerPersistEnabled = true;
});

/* Click-to-copy function */
$("#mainResult").click(function () {
	navigator.clipboard.writeText($("#mainResult").text()).then(function () {
		document.getElementById('tooltipText').style.visibility = 'visible';
		setTimeout(function () {
			document.getElementById('tooltipText').style.visibility = 'hidden';
		}, 2000);
	});
});
