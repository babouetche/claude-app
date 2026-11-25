// Display aliases for sprites already present in the supplied archive.
// Trainer species, set IDs and battle data keep their original names.
(function(root) {
    "use strict";
    var original = root.getSrcImgPokemon;
    var aliases = {
        "Minior-Meteor": "Minior-Form-7",
        "Mime Jr.": "Mime Jr.",
        "Mime%20Jr": "Mime Jr.",
        "Pumpkaboo-Super": "Pumpkaboo",
        "Zygarde-10%": "Zygarde-10%",
        "Zygarde-10%25": "Zygarde-10%",
        "Darmanitan-Galar-Zen": "Darmanitan-Zen-Mode-Galar",
        "Darmanitan-Zen-Mode": "Darmanitan-Zen",
        "Jangmo-o": "Jangmo-O",
        "Hakamo-o": "Hakamo-O"
    };
    root.getSrcImgPokemon = function(poke, alwaysFullSizeIcon) {
        if (!poke || !Object.prototype.hasOwnProperty.call(aliases, poke.name)) return original(poke, alwaysFullSizeIcon);
        var small = !alwaysFullSizeIcon && root.localStorage.getItem("icon-size-mode") === "small";
        return root.getPokemonIconsBase() + encodeURIComponent(aliases[poke.name]) + (small ? "-Small" : "") + ".png";
    };
})(window);
