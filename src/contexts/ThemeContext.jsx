import { createContext, useContext, useEffect, useState } from "react";

/**
 * Theme registry — add new themes here as objects of CSS custom property values.
 * ThemeContext applies them to document.documentElement so every component
 * picks them up via var(--token) without any component changes.
 */
export const THEMES = {
  dark: {
    label: "Dark",
    swatch: "#3b82f6",
    vars: {
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
      "color-scheme": "dark",
    },
  },
  light: {
    label: "Light",
    swatch: "#6366f1",
    vars: {
      "--bg": "#f0f0f5",
      "--surface": "#ffffff",
      "--surface2": "#e8e8f0",
      "--surface3": "#d8d8e8",
      "--accent": "#6366f1",
      "--accent-hover": "#4f46e5",
      "--text": "#1a1a2e",
      "--text-muted": "#6060a0",
      "--border": "#c8c8dc",
      "--danger": "#ef4444",
      "--danger-hover": "#dc2626",
      "color-scheme": "light",
    },
  },
  synthwave: {
    label: "Synthwave",
    swatch: "#f72585",
    vars: {
      "--bg": "#0d0221",
      "--surface": "#1a0533",
      "--surface2": "#240a45",
      "--surface3": "#2e1058",
      "--accent": "#f72585",
      "--accent-hover": "#c71a6f",
      "--text": "#f0e6ff",
      "--text-muted": "#9060c0",
      "--border": "#4a1080",
      "--danger": "#ff4d4d",
      "--danger-hover": "#cc0000",
      "color-scheme": "dark",
    },
  },
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
    const entry = THEMES[theme] ?? THEMES[DEFAULT_THEME];
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    Object.entries(entry.vars).forEach(([prop, value]) =>
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
