/*
 * Theme: Light | Dark | Original (original fork dark palette)
 * localStorage key: theme = 'light' | 'dark' | 'original'
 * Migrates legacy darkTheme 'true'/'false'.
 */

var THEME_STORAGE_KEY = 'theme';
var LEGACY_DARK_KEY = 'darkTheme';

function getInitialTheme() {
	var theme = localStorage.getItem(THEME_STORAGE_KEY);
	if (theme === 'light' || theme === 'dark' || theme === 'original') {
		return theme;
	}
	var legacy = localStorage.getItem(LEGACY_DARK_KEY);
	if (legacy === 'true') {
		return 'dark';
	}
	if (legacy === 'false') {
		return 'light';
	}
	return 'original';
}

var currentTheme = getInitialTheme();

function applyTheme(theme, skipStorage) {
	if (theme !== 'light' && theme !== 'dark' && theme !== 'original') {
		return;
	}
	currentTheme = theme;
	var darkStyles = document.getElementById('dark-theme-styles');
	var root = document.documentElement;
	if (!darkStyles) {
		return;
	}

	if (theme === 'light') {
		darkStyles.disabled = true;
		root.classList.remove('theme-original-dark');
		root.style.setProperty('--fieldset-color', 'white');
	} else {
		darkStyles.disabled = false;
		root.style.removeProperty('--fieldset-color');
		if (theme === 'original') {
			root.classList.add('theme-original-dark');
		} else {
			root.classList.remove('theme-original-dark');
		}
	}
	root.setAttribute('data-theme', theme);

	if (!skipStorage) {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
	}

	document.querySelectorAll('button[data-theme]').forEach(function (btn) {
		var t = btn.getAttribute('data-theme');
		btn.setAttribute('aria-pressed', t === currentTheme ? 'true' : 'false');
	});
}

applyTheme(getInitialTheme(), true);

document.querySelectorAll('button[data-theme]').forEach(function (btn) {
	btn.addEventListener('click', function () {
		applyTheme(btn.getAttribute('data-theme'), false);
	});
});
