import { useState, useRef } from "react";
import {
  useTheme,
  THEMES,
  CUSTOM_VAR_FIELDS,
  DEFAULT_CUSTOM_VARS,
} from "../../../contexts/ThemeContext";
import { EXPORT_FORMATS } from "../../../services/exportService";
import { Page } from "../../../ui/Page";
import { Panel } from "../../../ui/Panel";
import { NumberInput } from "../../../ui/NumberInput";
import "./SettingsPage.css";

const PREFS_KEY = "dj-prefs";
const DEFAULT_PREFS = { frameW: 32, frameH: 32, exportFormat: "generic" };

// Custom theme editor

function CustomThemeEditor() {
  const {
    customVars,
    setCustomVars,
    customBgUrl,
    setCustomBgDataUrl,
    customBgOpacity,
    setCustomBgOpacity,
  } = useTheme();
  const bgInputRef = useRef(null);

  function handleVarChange(key, value) {
    setCustomVars({ ...customVars, [key]: value });
  }

  function copyFrom(themeId) {
    const srcVars = THEMES[themeId]?.vars;
    if (!srcVars) return;
    const picked = Object.fromEntries(
      CUSTOM_VAR_FIELDS.map(({ key }) => [
        key,
        srcVars[key] ?? customVars[key],
      ]),
    );
    setCustomVars(picked);
  }

  function handleBgUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image too large — please use an image under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setCustomBgDataUrl(ev.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <div className="custom-theme-editor">
      {/* Color pickers */}
      <div className="custom-theme-editor__header">
        <span className="settings-label">Customize Colors</span>
        <div className="custom-theme-editor__copy-row">
          <span className="custom-theme-editor__copy-label">Copy from:</span>
          {["dark", "light", "synthwave"].map((id) => (
            <button
              key={id}
              className="custom-theme-editor__copy-btn"
              onClick={() => copyFrom(id)}
            >
              {THEMES[id].label}
            </button>
          ))}
        </div>
      </div>
      <div className="custom-theme-editor__grid">
        {CUSTOM_VAR_FIELDS.map(({ key, label }) => (
          <div key={key} className="custom-theme-editor__field">
            <input
              type="color"
              id={`ctv-${key}`}
              value={customVars[key] ?? DEFAULT_CUSTOM_VARS[key] ?? "#000000"}
              onChange={(e) => handleVarChange(key, e.target.value)}
              className="custom-theme-editor__color-input"
            />
            <label
              htmlFor={`ctv-${key}`}
              className="custom-theme-editor__field-label"
            >
              {label}
            </label>
          </div>
        ))}
      </div>

      {/* Background image */}
      <div className="custom-theme-editor__bg-section">
        <span className="settings-label">Background / Overlay Image</span>
        <p className="settings-helper">
          Applied as a full-screen overlay behind the app UI. Max 2 MB.
        </p>
        <div className="custom-theme-editor__bg-row">
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            onChange={handleBgUpload}
            style={{ display: "none" }}
          />
          <button
            className="custom-theme-editor__upload-btn"
            onClick={() => bgInputRef.current?.click()}
          >
            {customBgUrl ? "Replace Image" : "Upload Image"}
          </button>
          {customBgUrl && (
            <button
              className="custom-theme-editor__clear-btn"
              onClick={() => setCustomBgDataUrl(null)}
            >
              Remove
            </button>
          )}
          {customBgUrl && (
            <img
              src={customBgUrl}
              className="custom-theme-editor__bg-preview"
              alt="Background preview"
            />
          )}
        </div>
        {customBgUrl && (
          <div className="custom-theme-editor__opacity-row">
            <label className="custom-theme-editor__field-label">
              Opacity: {Math.round(customBgOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={customBgOpacity}
              onChange={(e) => setCustomBgOpacity(parseFloat(e.target.value))}
              className="custom-theme-editor__opacity-slider"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function loadPrefs() {
  try {
    return {
      ...DEFAULT_PREFS,
      ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}"),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const SHORTCUTS = [
  {
    section: "Playback",
    items: [
      { keys: ["Space"], desc: "Play / Pause" },
      { keys: ["←"], desc: "Previous frame" },
      { keys: ["→"], desc: "Next frame" },
    ],
  },
  {
    section: "Edit",
    items: [
      { keys: ["Ctrl", "Z"], desc: "Undo" },
      { keys: ["Ctrl", "Y"], desc: "Redo" },
      { keys: ["Ctrl", "Shift", "Z"], desc: "Redo (alternate)" },
    ],
  },
  {
    section: "Project",
    items: [{ keys: ["Ctrl", "S"], desc: "Save project" }],
  },
  {
    section: "Help",
    items: [{ keys: ["?"], desc: "Toggle keyboard shortcuts overlay" }],
  },
];

export function SettingsPage() {
  const { theme, setTheme, customVars } = useTheme();
  const [prefs, setPrefs] = useState(loadPrefs);

  function updatePref(key, value) {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
  }

  return (
    <Page title="Settings">
      <div className="settings-stack">
        {/* ── Appearance ── */}
        <Panel title="Appearance">
          <div className="settings-section">
            <p className="settings-label">Theme</p>
            <div className="settings-theme-grid">
              {Object.entries(THEMES).map(([id, def]) => (
                <button
                  key={id}
                  className={`settings-theme-card${theme === id ? " settings-theme-card--active" : ""}`}
                  onClick={() => setTheme(id)}
                  aria-pressed={theme === id}
                >
                  <span
                    className="settings-theme-swatch"
                    style={{
                      background:
                        id === "custom"
                          ? `linear-gradient(135deg, ${customVars["--bg"]} 50%, ${customVars["--accent"]} 50%)`
                          : def.swatch,
                    }}
                  />
                  <span className="settings-theme-name">{def.label}</span>
                </button>
              ))}
            </div>
            {theme === "custom" && <CustomThemeEditor />}
          </div>
        </Panel>

        {/* ── Editor Defaults ── */}
        <Panel title="Editor Defaults">
          <div className="settings-section">
            <p className="settings-helper">
              Applied when creating a new project. Open projects are not
              affected.
            </p>
            <div className="settings-row">
              <NumberInput
                label="Default Frame Width"
                value={prefs.frameW}
                min={1}
                max={512}
                step={1}
                onChange={(v) => updatePref("frameW", v)}
              />
              <NumberInput
                label="Default Frame Height"
                value={prefs.frameH}
                min={1}
                max={512}
                step={1}
                onChange={(v) => updatePref("frameH", v)}
              />
            </div>
            <p className="settings-label settings-label--mt">
              Default Export Format
            </p>
            <div className="settings-format-row">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f.id}
                  className={`settings-format-btn${prefs.exportFormat === f.id ? " settings-format-btn--active" : ""}`}
                  onClick={() => updatePref("exportFormat", f.id)}
                  aria-pressed={prefs.exportFormat === f.id}
                >
                  <span className="settings-format-name">{f.label}</span>
                  <span className="settings-format-desc">{f.description}</span>
                </button>
              ))}
            </div>
          </div>
        </Panel>

        {/* ── Keyboard Shortcuts ── */}
        <Panel title="Keyboard Shortcuts">
          <div className="settings-section">
            <div className="settings-shortcuts">
              {SHORTCUTS.map(({ section, items }) => (
                <div key={section} className="settings-shortcut-group">
                  <p className="settings-shortcut-section">{section}</p>
                  <ul className="settings-shortcut-list">
                    {items.map(({ keys, desc }) => (
                      <li key={desc} className="settings-shortcut-row">
                        <span className="settings-shortcut-desc">{desc}</span>
                        <span className="settings-shortcut-keys">
                          {keys.map((k, i) => (
                            <span key={i}>
                              <kbd className="settings-kbd">{k}</kbd>
                              {i < keys.length - 1 && (
                                <span className="settings-kbd-plus">+</span>
                              )}
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="settings-helper">
                Shortcuts are disabled when a text input is focused.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </Page>
  );
}
