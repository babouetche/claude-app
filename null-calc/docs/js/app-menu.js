(function () {
	var toggle = document.getElementById("app-menu-toggle");
	var panel = document.getElementById("app-menu-panel");
	if (!toggle || !panel) return;

	function closeMenu() {
		panel.hidden = true;
		toggle.setAttribute("aria-expanded", "false");
	}

	function openMenu() {
		panel.hidden = false;
		toggle.setAttribute("aria-expanded", "true");
	}

	function toggleMenu() {
		if (panel.hidden) openMenu();
		else closeMenu();
	}

	toggle.addEventListener("click", function (e) {
		e.stopPropagation();
		toggleMenu();
	});

	document.addEventListener("click", function (e) {
		if (!toggle.contains(e.target) && !panel.contains(e.target)) closeMenu();
	});

	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape") closeMenu();
	});
})();
