function placeBsBtn() {
	var importBtn = "<button id='import' class='bs-btn bs-btn-default'>Import</button>";
	$("#import-1_wrapper").append(importBtn);

	$("#import.bs-btn").click(function () {
		var pokes = document.getElementsByClassName("import-team-text")[0].value;
		var name = document.getElementsByClassName("import-name-text")[0].value.trim() === "" ? "Custom Set" : document.getElementsByClassName("import-name-text")[0].value;
		addSets(pokes, name);
		//erase the import text area
		document.getElementsByClassName("import-team-text")[0].value="";
	});
}

function pokemonToExportText(pokemon) {
	var EV_counter = 0;
	var finalText = "";
	finalText = pokemon.name + (pokemon.item ? " @ " + pokemon.item : "") + "\n";
	finalText += "Level: " + pokemon.level + "\n";
	finalText += pokemon.nature && gen > 2 ? pokemon.nature + " Nature" + "\n" : "";
	finalText += pokemon.teraType && gen > 8 ? "Tera Type: " + pokemon.teraType : "";
	finalText += pokemon.ability ? "Ability: " + pokemon.ability + "\n" : "";
	if (gen > 2) {
		var EVs_Array = [];
		for (var stat in pokemon.evs) {
			var ev = pokemon.evs[stat] ? pokemon.evs[stat] : 0;
			if (ev > 0) {
				EVs_Array.push(ev + " " + calc.Stats.displayStat(stat));
			}
			EV_counter += ev;
			if (EV_counter > 510) break;
		}
		if (EVs_Array.length > 0) {
			finalText += "EVs: ";
			finalText += serialize(EVs_Array, " / ");
			finalText += "\n";
		}
	}

	var IVs_Array = [];
	for (var stat in pokemon.ivs) {
		var iv = pokemon.ivs[stat] ? pokemon.ivs[stat] : 0;
		if (iv < 31) {
			IVs_Array.push(iv + " " + calc.Stats.displayStat(stat));
		}
	}
	if (IVs_Array.length > 0) {
		finalText += "IVs: ";
		finalText += serialize(IVs_Array, " / ");
		finalText += "\n";
	}

	for (var i = 0; i < 4; i++) {
		var moveName = pokemon.moves[i].name;
		if (moveName !== "(No Move)") {
			finalText += "- " + moveName + "\n";
		}
	}
	return finalText.trim();
}

/** Species names from pokedex.otherFormes that are Mega formes (e.g. Aerodactyl-Mega). */
function getMegaOtherFormeSpeciesNames(baseSpeciesName) {
	if (!baseSpeciesName || typeof pokedex === "undefined") return [];
	if (baseSpeciesName.indexOf("-Mega") !== -1) return [];
	var spec = pokedex[baseSpeciesName];
	if (!spec || !spec.otherFormes || !spec.otherFormes.length) return [];
	var out = [];
	for (var i = 0; i < spec.otherFormes.length; i++) {
		var f = spec.otherFormes[i];
		if (f.indexOf("-Mega") !== -1) out.push(f);
	}
	return out;
}

function getMegaAbilityForSpecies(megaName) {
	if (!megaName || typeof pokedex === "undefined" || !pokedex[megaName]) return null;
	var ab = pokedex[megaName].abilities;
	if (!ab) return null;
	return ab[0] || ab["0"] || null;
}

/** Resolves the held item for an exported mega: mega stone when one exists (incl. X/Y), else base item (e.g. Rayquaza). */
function getMegaItemForExport(baseItem, megaSpeciesName) {
	var stone = getMegaStoneItemForMegaSpecies(megaSpeciesName);
	if (stone) return stone;
	return baseItem || "";
}

function getMegaStoneItemForMegaSpecies(megaName) {
	if (!megaName || typeof pokedex === "undefined" || !pokedex[megaName]) return null;
	var base = pokedex[megaName].baseSpecies;
	if (!base || typeof calc === "undefined" || !calc.MEGA_STONES) return null;
	var candidates = [];
	for (var stone in calc.MEGA_STONES) {
		if (!Object.prototype.hasOwnProperty.call(calc.MEGA_STONES, stone)) continue;
		if (calc.MEGA_STONES[stone] === base) candidates.push(stone);
	}
	if (candidates.length === 0) return null;
	if (candidates.length === 1) return candidates[0];
	if (megaName.indexOf("-Mega-X") !== -1) {
		for (var i = 0; i < candidates.length; i++) {
			if (candidates[i].indexOf(" X") !== -1) return candidates[i];
		}
	}
	if (megaName.indexOf("-Mega-Y") !== -1) {
		for (var j = 0; j < candidates.length; j++) {
			if (candidates[j].indexOf(" Y") !== -1) return candidates[j];
		}
	}
	return candidates[0];
}

/** Build a calc.Pokemon for mega export: same spread/moves as base, mega ability and stone (or base item if no stone). */
function buildMegaPokemonFromBasePokemon(basePokemon, megaSpeciesName) {
	if (!basePokemon || !megaSpeciesName || typeof pokedex === "undefined" || !pokedex[megaSpeciesName] || typeof calc === "undefined") return null;
	var megaAbility = getMegaAbilityForSpecies(megaSpeciesName);
	var megaItem = getMegaItemForExport(basePokemon.item, megaSpeciesName);
	var megaMoves = [];
	for (var i = 0; i < 4; i++) {
		var m = basePokemon.moves[i];
		if (!m || !m.name || m.name === "(No Move)") {
			megaMoves.push(new calc.Move(gen, "(No Move)", { ability: megaAbility, item: megaItem, species: megaSpeciesName }));
		} else {
			megaMoves.push(new calc.Move(gen, m.originalName || m.name, {
				ability: megaAbility,
				item: megaItem,
				species: megaSpeciesName,
				useZ: m.useZ,
				useMax: m.useMax,
				isCrit: m.isCrit,
				hits: m.hits,
				timesUsed: m.timesUsed,
				timesUsedWithMetronome: m.timesUsedWithMetronome,
				overrides: m.overrides
			}));
		}
	}
	return new calc.Pokemon(gen, megaSpeciesName, {
		level: basePokemon.level,
		ability: megaAbility,
		abilityOn: true,
		item: megaItem,
		nature: basePokemon.nature,
		ivs: basePokemon.ivs,
		evs: basePokemon.evs,
		boosts: basePokemon.boosts,
		gender: basePokemon.gender,
		teraType: basePokemon.teraType,
		moves: megaMoves,
		isDynamaxed: false
	});
}

/** Plain set object for dex/box: same fields as getSetFromForm, with mega ability and item. */
function buildMegaSetObjFromBasePoke(basePoke, megaName) {
	if (!basePoke || !megaName || typeof resolveSetdexKey !== "function" || typeof setdex === "undefined") return null;
	if (typeof pokedex === "undefined" || !pokedex[megaName]) return null;
	var megaAbility = getMegaAbilityForSpecies(megaName);
	var megaItem = getMegaStoneItemForMegaSpecies(megaName);
	if (!megaItem) megaItem = basePoke.item || undefined;
	var evs = {};
	var ivs = {};
	for (var i = 0; i < LEGACY_STATS[gen].length; i++) {
		var legacyStat = LEGACY_STATS[gen][i];
		evs[legacyStat] = (basePoke.evs && typeof basePoke.evs[legacyStat] !== "undefined") ? basePoke.evs[legacyStat] : 0;
		ivs[legacyStat] = (gen >= 3 && basePoke.ivs && typeof basePoke.ivs[legacyStat] !== "undefined") ? basePoke.ivs[legacyStat] : 31;
	}
	var moves = [];
	for (var j = 0; j < 4; j++) {
		var moveName = basePoke.moves[j];
		moves.push(moveName && moveName !== "(No Move)" ? moveName : "");
	}
	var setdexKey = resolveSetdexKey(megaName);
	var nameProp = basePoke.nameProp;
	var megaPoke = {
		name: megaName,
		nameProp: nameProp,
		level: basePoke.level,
		ability: megaAbility || undefined,
		item: megaItem || undefined,
		nature: basePoke.nature || undefined,
		evs: evs,
		ivs: ivs,
		moves: moves,
		isCustomSet: true
	};
	if (gen >= 9 && basePoke.teraType) megaPoke.teraType = basePoke.teraType;
	var existingSet = setdex[setdexKey] && setdex[setdexKey][nameProp] ? setdex[setdexKey][nameProp] : null;
	if (existingSet && existingSet.index !== undefined) megaPoke.index = existingSet.index;
	return megaPoke;
}

/** When Import Megas Automatically is on: append export blocks for each mega using the same spread as the exported Pokémon. */
function appendMegaExportsForPokemon(basePokemon) {
	if (typeof importMegasAutoIsOn !== "function" || !importMegasAutoIsOn()) return "";
	if (typeof createPokemon !== "function" || typeof calc === "undefined") return "";
	if ($("#randoms").prop("checked")) return "";
	var megas = getMegaOtherFormeSpeciesNames(basePokemon.name);
	if (megas.length === 0) return "";
	var parts = [];
	var baseLv = basePokemon && typeof basePokemon.level !== "undefined" ? basePokemon.level : 100;
	for (var m = 0; m < megas.length; m++) {
		var megaName = megas[m];
		if (typeof shouldImportMegaAtLevel === "function" && !shouldImportMegaAtLevel(megaName, baseLv)) continue;
		try {
			var megaMon = buildMegaPokemonFromBasePokemon(basePokemon, megaName);
			if (megaMon) parts.push(pokemonToExportText(megaMon));
		} catch (e) {
			/* skip malformed */
		}
	}
	return parts.length ? "\n\n" + parts.join("\n\n") : "";
}

/** When Import Megas Automatically is on: also save each mega form with the same spread as the base set. */
function appendMegaSavesForSpecies(basePoke) {
	if (typeof importMegasAutoIsOn !== "function" || !importMegasAutoIsOn()) return;
	if (typeof resolveSetdexKey !== "function" || typeof setdex === "undefined") return;
	if ($("#randoms").prop("checked")) return;
	if (!basePoke || !basePoke.name) return;
	var megas = getMegaOtherFormeSpeciesNames(basePoke.name);
	var baseLv = basePoke && typeof basePoke.level !== "undefined" ? basePoke.level : 100;
	for (var m = 0; m < megas.length; m++) {
		var megaName = megas[m];
		if (typeof shouldImportMegaAtLevel === "function" && !shouldImportMegaAtLevel(megaName, baseLv)) continue;
		var megaPoke = buildMegaSetObjFromBasePoke(basePoke, megaName);
		if (megaPoke) {
			addToDex(megaPoke);
		}
	}
}

function ExportPokemon(pokeInfo) {
	var pokemon = createPokemon(pokeInfo);
	var finalText = pokemonToExportText(pokemon);
	finalText += appendMegaExportsForPokemon(pokemon);
	$("textarea.import-team-text").val(finalText);
	var panelId = pokeInfo && pokeInfo.attr ? pokeInfo.attr("id") : null;
	if (panelId === "p1" || panelId === "p2") {
		if (typeof getSetFromForm === "function") {
			var poke = getSetFromForm(panelId);
			if (poke) {
				var customName = $(".import-name-text").val();
				if (customName !== undefined && customName !== null && String(customName).trim() !== "") {
					poke.nameProp = String(customName).trim();
				}
				appendMegaSavesForSpecies(poke);
			}
		}
	}
}

/** One export block: same format as single Export (including mega append blocks when enabled). */
function buildExportBlockFromStringOrPanel(idOrPanel) {
	var pokemon = createPokemon(idOrPanel);
	var finalText = pokemonToExportText(pokemon);
	finalText += appendMegaExportsForPokemon(pokemon);
	return finalText.trim();
}

/** Normalize a box/team icon data-id so Export All skips the same logical set once. */
function exportAllDedupeKey(dataId) {
	if (!dataId || typeof dataId !== "string") return "";
	var k = dataId.replace(/\s+/g, " ").trim();
	var open = k.indexOf(" (");
	if (open === -1) return k;
	var name = k.substring(0, open).trim();
	var setName = k.substring(open + 2, k.lastIndexOf(")")).trim();
	if (name === "Aegislash-Shield") {
		name = "Aegislash-Blade";
	}
	return name + "\0" + setName;
}

$("#exportL").click(function () {
	ExportPokemon($("#p1"));
});

$("#exportR").click(function () {
	ExportPokemon($("#p2"));
});

$("#exportAll").click(function () {
	if ($("#randoms").prop("checked")) {
		alert("Export All is not available in Random Battles mode.");
		return;
	}
	if (typeof createPokemon !== "function") {
		return;
	}
	var seen = Object.create(null);
	var blocks = [];
	function pushBlock(text) {
		if (text) {
			blocks.push(text);
		}
	}
	function tryMark(key) {
		if (!key || typeof key !== "string") {
			return false;
		}
		if (seen[key]) {
			return false;
		}
		seen[key] = true;
		return true;
	}
	$("#box-poke-list .trainer-pok, #box-poke-list2 .trainer-pok, #team-poke-list .trainer-pok").each(function () {
		var id = $(this).attr("data-id");
		var key = exportAllDedupeKey(id);
		if (!key || !tryMark(key)) {
			return;
		}
		try {
			pushBlock(buildExportBlockFromStringOrPanel(id));
		} catch (e) {
			/* skip malformed */
		}
	});
	if (!blocks.length) {
		alert("No Pok\u00e9mon sets to export.");
		return;
	}
	$("textarea.import-team-text").val(blocks.join("\n\n"));
});

$(document).on("click", ".save-to-box", function () {
	if ($("#randoms").prop("checked")) return;
	if (typeof getSetFromForm !== "function" || typeof addToDex !== "function") return;
	var panelId = $(this).data("panel") || "p1";
	var poke = getSetFromForm(panelId);
	if (poke) {
		var customName = $(".import-name-text").val();
		if (customName !== undefined && customName !== null && String(customName).trim() !== "") {
			poke.nameProp = String(customName).trim();
		}
		addToDex(poke);
		appendMegaSavesForSpecies(poke);
	}
});

function deleteMovesetFromAllSetdex(pokemonName, movesetName) {
	if (!pokemonName || typeof movesetName === "undefined") return;
	var tables = [
		SETDEX_SV, SETDEX_SS, SETDEX_SM, SETDEX_XY, SETDEX_BW, SETDEX_DPP,
		SETDEX_ADV, SETDEX_GSC, SETDEX_RBY
	];
	for (var t = 0; t < tables.length; t++) {
		var dex = tables[t];
		if (!dex || !dex[pokemonName]) continue;
		if (dex[pokemonName][movesetName] !== undefined) {
			delete dex[pokemonName][movesetName];
		}
		if (Object.keys(dex[pokemonName]).length === 0) {
			delete dex[pokemonName];
		}
	}
}

/** Remove the current panel's species + set name from custom box storage and UI (mirrors Save to box keys). */
function removeCurrentSetFromBox(panelId) {
	if ($("#randoms").prop("checked")) return false;
	if (typeof getSetFromForm !== "function") return false;
	var poke = getSetFromForm(panelId);
	if (!poke) return false;
	var customName = $(".import-name-text").val();
	if (customName !== undefined && customName !== null && String(customName).trim() !== "") {
		poke.nameProp = String(customName).trim();
	}
	if (!localStorage.customsets) return false;
	var customsets = JSON.parse(localStorage.customsets);
	if (!customsets[poke.name] || !customsets[poke.name][poke.nameProp]) return false;
	delete customsets[poke.name][poke.nameProp];
	if (Object.keys(customsets[poke.name]).length === 0) {
		delete customsets[poke.name];
	}
	if (poke.name === "Aegislash-Blade" && customsets["Aegislash-Shield"] && customsets["Aegislash-Shield"][poke.nameProp]) {
		delete customsets["Aegislash-Shield"][poke.nameProp];
		if (Object.keys(customsets["Aegislash-Shield"]).length === 0) {
			delete customsets["Aegislash-Shield"];
		}
	}
	deleteMovesetFromAllSetdex(poke.name, poke.nameProp);
	if (poke.name === "Aegislash-Blade") {
		deleteMovesetFromAllSetdex("Aegislash-Shield", poke.nameProp);
	}
	function removeSetDom(idSuffix) {
		var dataId = idSuffix;
		if (idSuffix && idSuffix.indexOf(" (") === -1) {
			var marker = idSuffix.indexOf("(");
			if (marker !== -1) dataId = idSuffix.slice(0, marker);
		}
		var el = document.getElementById(idSuffix);
		if (el && el.closest && (el.closest("#box-poke-list") || el.closest("#box-poke-list2") || el.closest("#team-poke-list"))) {
			el.remove();
		}
		el = document.getElementById("box-" + idSuffix);
		if (el) el.remove();
		if (dataId) {
			$("#box-poke-list .trainer-pok, #box-poke-list2 .trainer-pok, #team-poke-list .trainer-pok").each(function () {
				if (String($(this).attr("data-id") || "") === dataId) $(this).remove();
			});
		}
	}
	removeSetDom(poke.name + poke.nameProp);
	removeSetDom(poke.name + " (" + poke.nameProp + ")");
	if (poke.name === "Aegislash-Blade") {
		removeSetDom("Aegislash-Shield" + poke.nameProp);
		removeSetDom("Aegislash-Shield (" + poke.nameProp + ")");
	}
	localStorage.customsets = JSON.stringify(customsets);
	return true;
}

$(document).on("click", ".remove-from-box", function () {
	if ($("#randoms").prop("checked")) return;
	var panelId = $(this).data("panel") || "p1";
	if (!removeCurrentSetFromBox(panelId)) {
		alert("This set is not in the box (or no Pok\u00e9mon selected).");
	}
});

function serialize(array, separator) {
	var text = "";
	for (var i = 0; i < array.length; i++) {
		if (i < array.length - 1) {
			text += array[i] + separator;
		} else {
			text += array[i];
		}
	}
	return text;
}

function getAbility(row) {
	var ability = row[1] ? row[1].trim() : '';
	if (calc.ABILITIES[9].indexOf(ability) !== -1) return ability;
}

function getTeraType(row) {
	var teraType = row[1] ? row[1].trim() : '';
	if (Object.keys(calc.TYPE_CHART[9]).slice(1).indexOf(teraType) !== -1) return teraType;
}

function statToLegacyStat(stat) {
	switch (stat) {
	case 'hp':
		return "hp";
	case 'atk':
		return "at";
	case 'def':
		return "df";
	case 'spa':
		return "sa";
	case 'spd':
		return "sd";
	case 'spe':
		return "sp";
	}
}

function getStats(currentPoke, rows, offset) {
	currentPoke.nature = "Serious";
	var currentEV;
	var currentIV;
	var currentAbility;
	var currentTeraType;
	var currentNature;
	currentPoke.level = 100;
	for (var x = offset; x < offset + 9; x++) {
		var currentRow = rows[x] ? rows[x].split(/[/:]/) : '';
		var evs = {};
		var ivs = {};
		var ev;
		var j;

		switch (currentRow[0]) {
		case 'Level':
			currentPoke.level = parseInt(currentRow[1].trim());
			break;
		case 'EVs':
			for (j = 1; j < currentRow.length; j++) {
				currentEV = currentRow[j].trim().split(" ");
				currentEV[1] = statToLegacyStat(currentEV[1].toLowerCase());
				evs[currentEV[1]] = parseInt(currentEV[0]);
			}
			currentPoke.evs = evs;
			break;
		case 'IVs':
			for (j = 1; j < currentRow.length; j++) {
				currentIV = currentRow[j].trim().split(" ");
				currentIV[1] = statToLegacyStat(currentIV[1].toLowerCase());
				ivs[currentIV[1]] = parseInt(currentIV[0]);
			}
			currentPoke.ivs = ivs;
			break;

		}
		currentAbility = rows[x] ? rows[x].trim().split(":") : '';
		if (currentAbility[0] == "Ability") {
			currentPoke.ability = currentAbility[1].trim();
		}

		currentTeraType = rows[x] ? rows[x].trim().split(":") : '';
		if (currentTeraType[0] == "Tera Type") {
			currentPoke.teraType = currentTeraType[1].trim();
		}

		currentNature = rows[x] ? rows[x].trim().split(" ") : '';
		if (currentNature[1] == "Nature" && currentNature[2] != "Power") {
			currentPoke.nature = currentNature[0];
		}
	}
	return currentPoke;
}

function getItem(currentRow, j) {
	for (;j < currentRow.length; j++) {
		var item = currentRow[j].trim();
		if (calc.ITEMS[9].indexOf(item) != -1) {
			return item;
		}
	}
}

function getMoves(currentPoke, rows, offset) {
	var movesFound = false;
	var moves = [];
	for (var x = offset; x < offset + 12; x++) {
		if (rows[x]) {
			if (rows[x][0] == "-") {
				movesFound = true;
				var move = rows[x].substr(2, rows[x].length - 2).replace("[", "").replace("]", "").replace("  ", "");
				moves.push(move);
			} else {
				if (movesFound == true) {
					break;
				}
			}
		}
	}
	currentPoke.moves = moves;
	return currentPoke;
}

function addToDex(poke) {
	var dexObject = {};
	if ($("#randoms").prop("checked")) {
		if (GEN9RANDOMBATTLE[poke.name] == undefined) GEN9RANDOMBATTLE[poke.name] = {};
		if (GEN8RANDOMBATTLE[poke.name] == undefined) GEN8RANDOMBATTLE[poke.name] = {};
		if (GEN7RANDOMBATTLE[poke.name] == undefined) GEN7RANDOMBATTLE[poke.name] = {};
		if (GEN6RANDOMBATTLE[poke.name] == undefined) GEN6RANDOMBATTLE[poke.name] = {};
		if (GEN5RANDOMBATTLE[poke.name] == undefined) GEN5RANDOMBATTLE[poke.name] = {};
		if (GEN4RANDOMBATTLE[poke.name] == undefined) GEN4RANDOMBATTLE[poke.name] = {};
		if (GEN3RANDOMBATTLE[poke.name] == undefined) GEN3RANDOMBATTLE[poke.name] = {};
		if (GEN2RANDOMBATTLE[poke.name] == undefined) GEN2RANDOMBATTLE[poke.name] = {};
		if (GEN1RANDOMBATTLE[poke.name] == undefined) GEN1RANDOMBATTLE[poke.name] = {};
	} else {
		if (SETDEX_SV[poke.name] == undefined) SETDEX_SV[poke.name] = {};
		if (SETDEX_SS[poke.name] == undefined) SETDEX_SS[poke.name] = {};
		if (SETDEX_SM[poke.name] == undefined) SETDEX_SM[poke.name] = {};
		if (SETDEX_XY[poke.name] == undefined) SETDEX_XY[poke.name] = {};
		if (SETDEX_BW[poke.name] == undefined) SETDEX_BW[poke.name] = {};
		if (SETDEX_DPP[poke.name] == undefined) SETDEX_DPP[poke.name] = {};
		if (SETDEX_ADV[poke.name] == undefined) SETDEX_ADV[poke.name] = {};
		if (SETDEX_GSC[poke.name] == undefined) SETDEX_GSC[poke.name] = {};
		if (SETDEX_RBY[poke.name] == undefined) SETDEX_RBY[poke.name] = {};
	}
	if (poke.ability !== undefined) {
		dexObject.ability = poke.ability;
	}
	if (poke.teraType !== undefined) {
		dexObject.teraType = poke.teraType;
	}
	dexObject.level = poke.level;
	dexObject.evs = poke.evs;
	dexObject.ivs = poke.ivs;
	dexObject.moves = poke.moves;
	dexObject.nature = poke.nature;
	dexObject.item = poke.item;
	dexObject.isCustomSet = poke.isCustomSet;
	var customsets;
	if (localStorage.customsets) {
		customsets = JSON.parse(localStorage.customsets);
	} else {
		customsets = {};
	}
	if (!customsets[poke.name]) {
		customsets[poke.name] = {};
	}
	customsets[poke.name][poke.nameProp] = dexObject;
	if (poke.name === "Aegislash-Blade") {
		if (!customsets["Aegislash-Shield"]) {
			customsets["Aegislash-Shield"] = {};
		}
		customsets["Aegislash-Shield"][poke.nameProp] = dexObject;
	}
	updateDex(customsets);
}

function updateDex(customsets) {
	var box2Ids = (typeof readBox2SetIds === "function") ? readBox2SetIds() : {};
	for (var pokemon in customsets) {
		for (var moveset in customsets[pokemon]) {
			if (!SETDEX_SV[pokemon]) SETDEX_SV[pokemon] = {};
			SETDEX_SV[pokemon][moveset] = customsets[pokemon][moveset];
			if (!SETDEX_SS[pokemon]) SETDEX_SS[pokemon] = {};
			SETDEX_SS[pokemon][moveset] = customsets[pokemon][moveset];
			if (!SETDEX_SM[pokemon]) SETDEX_SM[pokemon] = {};
			SETDEX_SM[pokemon][moveset] = customsets[pokemon][moveset];
			if (!SETDEX_XY[pokemon]) SETDEX_XY[pokemon] = {};
			SETDEX_XY[pokemon][moveset] = customsets[pokemon][moveset];
			if (!SETDEX_BW[pokemon]) SETDEX_BW[pokemon] = {};
			SETDEX_BW[pokemon][moveset] = customsets[pokemon][moveset];
			if (!SETDEX_DPP[pokemon]) SETDEX_DPP[pokemon] = {};
			SETDEX_DPP[pokemon][moveset] = customsets[pokemon][moveset];
			if (!SETDEX_ADV[pokemon]) SETDEX_ADV[pokemon] = {};
			SETDEX_ADV[pokemon][moveset] = customsets[pokemon][moveset];
			if (!SETDEX_GSC[pokemon]) SETDEX_GSC[pokemon] = {};
			SETDEX_GSC[pokemon][moveset] = customsets[pokemon][moveset];
			if (!SETDEX_RBY[pokemon]) SETDEX_RBY[pokemon] = {};
			SETDEX_RBY[pokemon][moveset] = customsets[pokemon][moveset];
			var poke = {name: pokemon, nameProp: moveset};
			var domId = pokemon + moveset;
			var preserveInBox2 = !!box2Ids[String(domId)];
			var useBox2 =
				preserveInBox2 ||
				(typeof megasBox2IsOn === "function" &&
					megasBox2IsOn() &&
					pokemon.indexOf("-Mega") !== -1);
			addBoxed(poke, useBox2 ? "box-poke-list2" : undefined);
		}
	}
	localStorage.customsets = JSON.stringify(customsets);
	if (typeof queueBox2SetIdsSync === "function") queueBox2SetIdsSync();
}

function addSets(pokes, name) {
	var rows = pokes.split("\n");
	var currentRow;
	var currentPoke;
	var addedpokes = 0;
	for (var i = 0; i < rows.length; i++) {
		currentRow = rows[i].split(/[()@]/);
		for (var j = 0; j < currentRow.length; j++) {
			currentRow[j] = checkExeptions(currentRow[j].trim());
			if (calc.SPECIES[9][currentRow[j].trim()] !== undefined) {
				currentPoke = calc.SPECIES[9][currentRow[j].trim()];
				currentPoke.name = currentRow[j].trim();
				currentPoke.item = getItem(currentRow, j + 1);
				if (j === 1 && currentRow[0].trim()) {
					currentPoke.nameProp = currentRow[0].trim();
				} else {
					currentPoke.nameProp = name;
				}
				currentPoke.isCustomSet = true;
				currentPoke.ability = getAbility(rows[i + 1].split(":"));
				currentPoke.teraType = getTeraType(rows[i + 1].split(":"));
				currentPoke = getStats(currentPoke, rows, i + 1);
				currentPoke = getMoves(currentPoke, rows, i);
				addToDex(currentPoke);
				addBoxed(currentPoke);
				appendMegaSavesForSpecies(currentPoke);
				addedpokes++;
				break;
			}
		}
	}
	if (addedpokes > 0) {
		$(allPokemon("#importedSetsOptions")).css("display", "inline");
	} else {
		alert("No sets imported, please check your syntax and try again");
	}
}

function checkExeptions(poke) {
	switch (poke) {
	case 'Aegislash':
		poke = "Aegislash-Blade";
		break;
	case 'Basculin-Blue-Striped':
		poke = "Basculin";
		break;
	case 'Gastrodon-East':
		poke = "Gastrodon";
		break;
	case 'Mimikyu-Busted-Totem':
		poke = "Mimikyu-Totem";
		break;
	case 'Mimikyu-Busted':
		poke = "Mimikyu";
		break;
	case 'Pikachu-Belle':
	case 'Pikachu-Cosplay':
	case 'Pikachu-Libre':
	case 'Pikachu-Original':
	case 'Pikachu-Partner':
	case 'Pikachu-PhD':
	case 'Pikachu-Pop-Star':
	case 'Pikachu-Rock-Star':
		poke = "Pikachu";
		break;
	case 'Vivillon-Fancy':
	case 'Vivillon-Pokeball':
		poke = "Vivillon";
		break;
	case 'Florges-White':
	case 'Florges-Blue':
	case 'Florges-Orange':
	case 'Florges-Yellow':
		poke = "Florges";
		break;
	}
	return poke;

}

$("#clearSets").click(function () {
	var yes = confirm("Do you really wish to delete all your mons?")
	if (!yes){
		return
	}
	localStorage.removeItem("customsets");
	if (typeof STORAGE_BOX2_SET_IDS !== "undefined") {
		localStorage.removeItem(STORAGE_BOX2_SET_IDS);
	} else {
		localStorage.removeItem("nullcalc_box2SetIds");
	}
	$(allPokemon("#importedSetsOptions")).hide();
	loadDefaultLists();
	for (let zone of document.getElementsByClassName("dropzone")){
		zone.innerHTML="";
	}

});

$(allPokemon("#importedSets")).click(function () {
	var pokeID = $(this).parent().parent().prop("id");
	var showCustomSets = $(this).prop("checked");
	if (showCustomSets) {
		loadCustomList(pokeID);
	} else {
		loadDefaultLists();
	}
});

$(document).ready(function () {
	var customSets;
	placeBsBtn();
	if (localStorage.customsets) {
		customSets = JSON.parse(localStorage.customsets);
		updateDex(customSets);
		selectFirstMon();
		$(allPokemon("#importedSetsOptions")).css("display", "inline");
	} else {
		loadDefaultLists();
	}
	//adjust the side buttons that collapse the data wished to be hidden
	setupSideCollapsers();
});

