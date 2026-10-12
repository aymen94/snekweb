(() => {
  const root = document.documentElement;
  const storageKey = "snekweb-docs-theme";

  try {
    root.dataset.theme = localStorage.getItem(storageKey) === "dark" ? "dark" : "color";
  } catch {
    root.dataset.theme = "color";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector("[data-theme-toggle]");
    if (!button) return;

    const icon = button.querySelector("[data-theme-icon]");
    const updateButton = () => {
      const isDark = root.dataset.theme === "dark";
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", `Switch to ${isDark ? "color" : "dark"} theme`);
      if (icon) icon.textContent = isDark ? "☀" : "☾";
    };

    updateButton();
    button.addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "dark" ? "color" : "dark";
      try {
        localStorage.setItem(storageKey, root.dataset.theme);
      } catch {
        // Keep the selected theme for this page even when storage is unavailable.
      }
      updateButton();
    });
  });
})();
