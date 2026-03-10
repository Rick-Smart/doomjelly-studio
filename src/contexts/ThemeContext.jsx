import { createContext, useContext, useEffect, useState } from "react";

/**
 * Theme registry — add new themes here as objects of CSS custom property values.
 * ThemeContext applies them to document.documentElement so every component
 * picks them up via var(--token) without any component changes.
 *
 * Swatches use a diagonal split (bg | accent) so each card honestly previews
 * the theme's feel at a glance instead of just showing the accent colour.
 */
export const THEMES = {
  dark: {
    label: "Dark",
    swatch: "linear-gradient(135deg, #1a1a24 50%, #3b82f6 50%)",
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
    swatch: "linear-gradient(135deg, #f0f0f5 50%, #6366f1 50%)",
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
    swatch: "linear-gradient(135deg, #0d0221 50%, #f72585 50%)",
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
  custom: {
    label: "Custom",
    swatch: "custom", // rendered dynamically from customVars in SettingsPage
    vars: null,       // provided via localStorage; applied by ThemeProvider
  },
};

/** Fields the user can pick colors for in the Custom theme editor. */
export const CUSTOM_VAR_FIELDS = [
  { key: "--bg",         label: "Background"    },
  { key: "--surface",    label: "Panel Surface" },
  { key: "--surface2",   label: "Surface 2"     },
  { key: "--surface3",   label: "Surface 3"     },
  { key: "--accent",     label: "Accent"        },
  { key: "--text",       label: "Text"          },
  { key: "--text-muted", label: "Muted Text"    },
  { key: "--border",     label: "Border"        },
  { key: "--danger",     label: "Danger"        },
];

export const DEFAULT_CUSTOM_VARS = {
  "--bg":         "#1a1a24",
  "--surface":    "#22223a",
  "--surface2":   "#2a2a40",
  "--surface3":   "#32324e",
  "--accent":     "#3b82f6",
  "--text":       "#e2e2f0",
  "--text-muted": "#7878a0",
  "--border":     "#3a3a58",
  "--danger":     "#ef4444",
};

// Helpers

/** Darken a 6-digit hex color by 20%. */
function darken(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (v) => Math.max(0, Math.round(v * 0.8)).toString(16).padStart(2, "0");
  return `#${d(r)}${d(g)}${d(b)}`;
}

/** Returns true if the hex color is perceptually light. */
function isLightHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

// Constants

const DEFAULT_THEME        = "dark";
const STORAGE_KEY          = "dj-theme";
const CUSTOM_VARS_KEY      = "dj-theme-custom-vars";
const CUSTOM_BG_KEY        = "dj-theme-custom-bg";
const CUSTOM_BG_OPACITY_KEY = "dj-theme-custom-bg-opacity";

const ThemeContext = createContext(null);

// Provider

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && THEMES[stored] ? stored : DEFAULT_THEME;
  });

  const [customVars, setCustomVarsState] = useState(() => {
    try {
      return {
        ...DEFAULT_CUSTOM_VARS,
        ...JSON.parse(localStorage.getItem(CUSTOM_VARS_KEY) ?? "{}"),
      };
    } catch {
      return { ...DEFAULT_CUSTOM_VARS };
    }
  });

  const [customBgUrl, setCustomBgUrlState] = useState(
    () => localStorage.getItem(CUSTOM_BG_KEY) ?? null,
  );

  const [customBgOpacity, setCustomBgOpacityState] = useState(
    () => parseFloat(localStorage.getItem(CUSTOM_BG_OPACITY_KEY) ?? "0.15"),
  );

  function setTheme(name) {
    if (!THEMES[name]) return;
    setThemeState(name);
  }

  function setCustomVars(vars) {
    const merged = { ...DEFAULT_CUSTOM_VARS, ...vars };
    setCustomVarsState(merged);
    localStorage.setItem(CUSTOM_VARS_KEY, JSON.stringify(merged));
  }

  function setCustomBgDataUrl(dataUrl) {
    setCustomBgUrlState(dataUrl);
    if (dataUrl) {
      localStorage.setItem(CUSTOM_BG_KEY, dataUrl);
    } else {
      localStorage.removeItem(CUSTOM_BG_KEY);
    }
  }

  function setCustomBgOpacity(opacity) {
    setCustomBgOpacityState(opacity);
    localStorage.setItem(CUSTOM_BG_OPACITY_KEY, String(opacity));
  }

  // Apply CSS vars to :root whenever theme or customVars change.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);

    let vars;
    if (theme === "custom") {
      vars = {
        ...THEMES.dark.vars,
        ...Object.fromEntries(
          Object.entries(customVars).filter(([k]) => k.startsWith("--")),
        ),
        "--accent-hover": darken(customVars["--accent"] ?? "#3b82f6"),
        "--danger-hover": darken(customVars["--danger"] ?? "#ef4444"),
        "color-scheme": isLightHex(customVars["--bg"] ?? "#1a1a24") ? "light" : "dark",
      };
    } else {
      vars = THEMES[theme]?.vars ?? THEMES[DEFAULT_THEME].vars;
    }

    Object.entries(vars).forEach(([prop, value]) =>
      root.style.setProperty(prop, value),
    );
  }, [theme, customVars]);

  // Manage background image overlay on <html>.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "custom" && customBgUrl) {
      root.style.setProperty("--bg-image", `url('${customBgUrl}')`);
      root.style.setProperty("--bg-image-opacity", String(customBgOpacity));
      root.classList.add("has-bg-image");
    } else {
      root.classList.remove("has-bg-image");
      root.style.removeProperty("--bg-image");
      root.style.removeProperty("--bg-image-opacity");
    }
  }, [theme, customBgUrl, customBgOpacity]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        themes: Object.keys(THEMES),
        customVars,
        setCustomVars,
        customBgUrl,
        setCustomBgDataUrl,
        customBgOpacity,
        setCustomBgOpacity,
      }}
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
