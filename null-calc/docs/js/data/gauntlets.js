// Gauntlet config
// Define which trainers are part of back-to-back fights or gauntlets.
// Names are put next to the next trainer button.

var GAUNTLET_LIST = [
	{ name: "Gauntlet", trainers: ["Youngster Swede", "Fisherman Darian", "Lady Cindy"] },
	{ name: "B2B", trainers: ["Hiker Clark & Youngster Johnson", "Hiker Devan"] },
	{ name: "Gauntlet", trainers: ["Tuber Hailey", "Tuber Ricky", "Tuber Lola", "Sailor Edmond", "Tuber Chandler", "Sailor MSPaint"] },
	{ name: "B2B", trainers: ["Museum Team Aqua Grunt", "Museum Team Aqua Elite Grunt"] },
	{ name: "Gauntlet", trainers: ["Lass Janice", "School Kid Mewttins", "Rich Boy Dawson", "Lady Sarah", "Youngster Timmy", "Team Magma Grunt & Team Aqua Grunt"] },
	{ name: "B2B", trainers: ["Parasol Lady Madeline & Youngster Jaylen", "Battle Girl Lilith"] },
	{ name: "B2B2B2B", trainers: ["Winstrate Victor", "Winstrate Victoria", "Winstrate Vivi", "Winstrate Vicky"] },
	{ name: "B2B", trainers: ["Picnicker Heidi & Ruin Maniac Bryan", "Picnicker Celia"] },
	{ name: "Gauntlet", trainers: ["Pokémaniac Shikamaru", "Kindler Bakugo", "Hiker Alphonse & Picnicker Winry", "Hiker Jotaro", "Blackbelt Nob", "Collector Tully", "Psychic Marlene"] },
	{ name: "Gauntlet", trainers: ["Jagged Pass Team Magma Grunt", "Picnicker Diana", "Triathlete Julio"] },
	{ name: "B2B", trainers: ["Bird Keeper Chester & Youngster Deandre", "Bird Keeper Perry"] },
	{ name: "Gauntlet", trainers: ["Psychic Kayla", "Psychic William", "Hex Maniac Tasha", "Hex Maniac Valerie", "Pokemaniac Mark", "Breeder Gabrielle", "Psychic Cedric", "Wandering Spirit"] },
	{ name: "6v8 Doubles", trainers: ["Leader Liza", "Leader Tate"] },
	{ name: "B2B2B", trainers: ["Space Center Team Magma Grunt #4", "Space Center Team Magma Grunt #5", "Space Center Team Magma Grunt #6"] },
	{ name: "B2B", trainers: ["Bird Keeper Halo & Ranger Jmash", "Cooltrainer Puffy"] },
	{ name: "Random Stats & Nature", trainers: ["Sky Pillar Rayquaza"] },
	{ name: "B2B2B", trainers: ["Team Rocket Grunt #1", "Team Rocket Grunt #2", "Team Rocket Grunt #3"] },
	{ name: "6v8 Doubles", trainers: ["Trainer Maxie", "Trainer Archie"] },
	{ name: "B2B", trainers: ["Teacher Anabel", "Frontier Head Noland"] },
	{ name: "B2B", trainers: ["Pokéfan Isabel", "Pokéfan Kaleb"] },
	{ name: "Random Team", trainers: ["Rival Wally 1", "Rival Wally 2", "Rival Wally 3"] },
	{ name: "Random Team", trainers: ["Adventurer Brandon 1", "Adventurer Brandon 2"] },
	{ name: "Random Team", trainers: ["Naturalist Greta 1", "Naturalist Greta 2"] },
	{ name: "Random Team", trainers: ["Natural Guru Spenser 1", "Natural Guru Spenser 2"] },
	{ name: "Random Team", trainers: ["Battle Queen Lucy 1", "Battle Queen Lucy 2"] },
	{ name: "Random Team", trainers: ["Superstar Tucker 1", "Superstar Tucker 2"] },

];

function trainerNamesMatch(gauntletName, setNameTrainer) {
	if (!gauntletName || !setNameTrainer) return false;
	var a = String(gauntletName).trim().replace(/\s+/g, " ");
	var b = String(setNameTrainer).trim().replace(/\s+/g, " ");
	if (a === b) return true;
	if (b.indexOf(a) === 0 && (b.length === a.length || b.charAt(a.length) === " ")) return true;
	if (a.indexOf(b) === 0 && (a.length === b.length || a.charAt(b.length) === " ")) return true;
	return false;
}

function getGauntletForTrainer(trainerName) {
	for (var g = 0; g < GAUNTLET_LIST.length; g++) {
		var entry = GAUNTLET_LIST[g];
		var trainers = entry.trainers;
		for (var i = 0; i < trainers.length; i++) {
			if (trainerNamesMatch(trainers[i], trainerName)) {
				return { name: entry.name, trainers: trainers };
			}
		}
	}
	return null;
}

function getGauntletTrainers(trainerName) {
	var gauntlet = getGauntletForTrainer(trainerName);
	if (gauntlet) {
		return gauntlet.trainers;
	}
	return [trainerName];
}
