// Applies the saved or system theme before first paint, so pre-rendered pages
// don't flash light for dark-mode users. Mirrors ThemeContext (key, values).
(function () {
  try {
    var stored = localStorage.getItem('theme-preference');
    var dark = stored === 'dark' ||
      (stored !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) { /* storage blocked: keep the light default */ }
})();
