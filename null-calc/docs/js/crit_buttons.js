// Bouton « Crit » à côté de chaque attaque en haut de la page : coche/décoche le coup critique de l'attaque
// (même case que « Crit » dans le panneau du Pokémon), le calcul se met à jour tout de suite.
(function() {
    "use strict";
    function sync(btn, box) { btn.classList.toggle("crit-on", box.checked); btn.setAttribute("aria-pressed", box.checked ? "true" : "false"); }
    function setup() {
        ["L", "R"].forEach(function(side) {
            for (var i = 1; i <= 4; i++) (function(i) {
                var box = document.getElementById("crit" + side + i), move = document.querySelector("label[for=resultMove" + side + i + "]");
                if (!box || !move || document.getElementById("critTop" + side + i)) return;
                var btn = document.createElement("button");
                btn.type = "button"; btn.id = "critTop" + side + i; btn.className = "crit-top"; btn.textContent = "Crit";
                btn.title = "Coup critique pour cette attaque";
                btn.addEventListener("click", function(e) { e.preventDefault(); box.checked = !box.checked; $(box).change(); sync(btn, box); });
                box.addEventListener("change", function() { sync(btn, box); });
                move.parentNode.insertBefore(btn, move.nextSibling);
                sync(btn, box);
                setInterval(function() { sync(btn, box); }, 1000);
            })(i);
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup); else setup();
})();
