export type ThemeMode = "dark" | "light" | "system";

const KEY = "albumku.theme";
const media = window.matchMedia("(prefers-color-scheme: light)");

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {
    /* penyimpanan tidak tersedia */
  }
  return "dark";
}

function apply(mode: ThemeMode) {
  const resolved = mode === "system" ? (media.matches ? "light" : "dark") : mode;
  document.documentElement.dataset.theme = resolved;
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* abaikan */
  }
  apply(mode);
}

/** Pasang tema saat start + ikuti perubahan tema Windows bila mode "system". */
export function initTheme() {
  apply(getThemeMode());
  media.addEventListener("change", () => getThemeMode() === "system" && apply("system"));
}
