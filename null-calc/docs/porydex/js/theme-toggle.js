(function () {
	var storageKey = 'nulldex-theme';

	function normalizeTheme(theme) {
		return theme === 'dark' ? 'dark' : 'light';
	}

	function applyTheme(theme) {
		var resolvedTheme = normalizeTheme(theme);
		document.documentElement.setAttribute('data-theme', resolvedTheme);
		try {
			localStorage.setItem(storageKey, resolvedTheme);
		} catch (e) {}
		return resolvedTheme;
	}

	function initThemeSelect() {
		var select = document.getElementById('theme-select');
		if (!select) return;

		var currentTheme = normalizeTheme(document.documentElement.getAttribute('data-theme'));
		select.value = currentTheme;
		select.addEventListener('change', function () {
			applyTheme(select.value);
		});
	}

	document.addEventListener('DOMContentLoaded', initThemeSelect);
})();
