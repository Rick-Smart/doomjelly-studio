import { createContext, useContext, useEffect, useState } from "react";

/**
 * Theme registry — add new themes here as objects of CSS custom property values.
 * ThemeContext applies them to document.documentElement so every component
 * picks them up via var(--token) without any component changes.
 */
export const THEMES = {
  dark: {
    "--bg": "#1a1a24",
    "--surface": "#22223a",
    "--surface2": "#2a2a40",
    "--surface3": "#32324e",
    "--accent": "#3b82f6",
    "--accent-hover": "#2563eb",
    "--text": "#e2e2f0",
    "--text-muted": "#7878a0",
    "--border": "#3a3a58",
    "--danger": "#ef4444",
    "--danger-hover": "#dc2626",
  },
  // Stub entries — flesh out tokens when adding themes
  // light: { '--bg': '#f5f5f0', '--surface': '#ffffff', ... },
  // synthwave: { '--bg': '#1a0033', '--surface': '#2a0055', ... },
};

const DEFAULT_THEME = "dark";
const STORAGE_KEY = "dj-theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME,
  );

  function setTheme(name) {
    if (!THEMES[name]) return;
    setThemeState(name);
  }

  useEffect(() => {
    const vars = THEMES[theme] ?? THEMES[DEFAULT_THEME];
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    Object.entries(vars).forEach(([prop, value]) =>
      root.style.setProperty(prop, value),
    );
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, themes: Object.keys(THEMES) }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
