// Trainers that should auto-select Doubles when chosen in the set selector.
// Names are matched with trainerNamesMatch (from gauntlets.js) against the trainer
// portion of "Species (Trainer)" — use the same spelling as in gen9.js / the dropdown.
var TRAINERS_AUTO_DOUBLES = [
	// "Twins Gina&Mia",
	// "Hiker Clark & Youngster Johnson",
	// "Fisherman Elliot & Fisherman Ned",
	// "Picnicker Emi",
	// "Ranger Zoe",
	// "Sailor MSPaint",
	// "Triathlete Dylan & Triathlete Maria",
	// "Twins Anna&Meg",
	// "Guitarist Shawn & Guitarist Kirk",
	// "Leader Wattson",
	// "Triathlete Benjamin & Triathlete Alyssa",
	// "Triathlete Jasmine & Triathlete Jacob",
	// "Twins Amy&Liv",
	// "Team Magma Grunt & Team Aqua Grunt",
	// "Psychic Edward & Fisherman Dale",
	// "Parasol Lady Madeline & Youngster Jaylen",
	// "Picnicker Heidi & Ruin Maniac Bryan",
	// "Camper Johny & Camper Tarian",
	// "Twins Tori&Tia",
	// "Fisherman Nolan & Fisherman Kai",
	// "Sr.And Jr.Tyra&Ivy",
	// "Hiker Alphonse & Picnicker Winry",
	// "Battle Girl Danielle & Kindler Cole",
	// "Cooltrainer Carolina & Sailor Cory",
	// "Cooltrainer Garrison",
	// "Bird Keeper Chester & Youngster Deandre",
	// "Bird Keeper Phil & Parasol Lady Rachel",
	// "Ninja Boy Yasu & Guitarist Fabian",
	// "Camper Flint & Bird Keeper Edwardo",
	// "Leader Winona 2",
	// "Sr.And Jr.Kate&Joy",
	// "Lilycove Rival Chespin",
	// "Lilycove Rival Fennekin",
	// "Lilycove Rival Froakie",
	// "Hideout Magma Grunt #6 & #7",
	// "Swimmer Webe & Swimmer D.K",
	// "Psychic Preston & Psychic Maura",
	// "Pokémaniac Symes & Bug Maniac Connor",
	// "Psychic Virgil & Psychic Nate",
	// "Psychic Hannah & Hex Maniac Sylvia",
	// "Gentleman Andreas & Hex Maniac Tina",
	// "Gentleman Clifford & Psychic Macey",
	// "Leader Liza",
	// "Leader Tate",
	// "Space Center Team Magma Elite Grunt",
	// "Bird Keeper Halo & Ranger Jmash",
	// "Sis And Bro Reli&Ian",
	// "Triathlete Barron & Stephin",
	// "Swimmer Katie & Swimmer Santiago",
	// "Beauty Bridget & Lady Brianna",
	// "Twins Ame&Yuki",
	// "Adventurer Brandon 1 ",
	// "Adventurer Brandon 2",
	// "Natural Guru Spenser 1",
	// "Natural Guru Spenser 2",
	// "Trainer Maxie",
	// "Trainer Archie",
	// "Elite Four Sidney Doubles",
	// "Elite Four Phoebe Doubles",
	// "Elite Four Rival Doubles",
	// "Elite Four Drake Doubles",
];

function trainerShouldUseDoubles(trainerName) {
	if (!trainerName) return false;
	for (var i = 0; i < TRAINERS_AUTO_DOUBLES.length; i++) {
		var entry = TRAINERS_AUTO_DOUBLES[i];
		if (typeof trainerNamesMatch === "function") {
			if (trainerNamesMatch(entry, trainerName) || trainerNamesMatch(trainerName, entry)) return true;
		} else if (String(entry).trim() === String(trainerName).trim()) {
			return true;
		}
	}
	return false;
}

/** Called when the opposing set (or related UI) changes; must load after gauntlets.js */
function applyBattleSettings(trainerName) {
	if (trainerShouldUseDoubles(trainerName)) {
		$("#doubles-format").prop("checked", true);
		$("#doubles-format").change();
	}
	/* Do not force Singles when not listed — keep the user's manual Singles/Doubles choice */
}
