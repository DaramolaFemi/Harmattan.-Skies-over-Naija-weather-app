(() => {
  "use strict";

  try {
    const savedTheme = localStorage.getItem("harmattan-theme");
    if (savedTheme) return;

    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    localStorage.setItem("harmattan-theme", prefersLight ? "light" : "dark");
  } catch {
    // Storage can be unavailable in private or restricted contexts.
    // The existing app fallback remains dark in that case.
  }
})();
