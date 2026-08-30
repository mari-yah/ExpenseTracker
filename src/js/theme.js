// Light/dark toggle. Without a stored choice, the app already follows the
// device's theme via CSS (prefers-color-scheme); this lets someone override
// that explicitly, remembered per browser via localStorage.
var THEME_KEY = 'ledger_theme'; // 'light' | 'dark' | absent = follow system

export function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY) || null; } catch (e) { return null; }
}

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export function initTheme() {
  applyTheme(getStoredTheme());
}

export function isDarkActive() {
  var stored = getStoredTheme();
  if (stored) return stored === 'dark';
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export function toggleTheme() {
  var next = isDarkActive() ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (e) {}
  applyTheme(next);
}
