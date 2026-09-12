import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "chhatralaya-theme";

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme | null) ?? "light";
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem(KEY, next);
    applyTheme(next);
  };

  return { theme, setTheme };
}
