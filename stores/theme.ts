import { atom } from "jotai";

export type Theme = "light" | "dark" | "system";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem("theme") as Theme | null;
  return stored || "system";
}

const themeAtom = atom<Theme>(getInitialTheme());

export const themeAtomWithPersistence = atom(
  (get) => get(themeAtom),
  (get, set, newTheme: Theme) => {
    set(themeAtom, newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newTheme);
      applyTheme(newTheme);
    }
  }
);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// 초기 테마 적용
if (typeof window !== "undefined") {
  const stored = localStorage.getItem("theme") as Theme | null;
  const theme = stored || "system";
  applyTheme(theme);

  // 시스템 테마 변경 감지
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (theme === "system") {
        applyTheme("system");
      }
    });
}

