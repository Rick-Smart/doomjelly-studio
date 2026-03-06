import { useState } from "react";
import { useTheme, THEMES } from "../../../contexts/ThemeContext";
import { EXPORT_FORMATS } from "../../../services/exportService";
import { Page } from "../../../ui/Page";
import { Panel } from "../../../ui/Panel";
import { NumberInput } from "../../../ui/NumberInput";
import "./SettingsPage.css";

const PREFS_KEY = "dj-prefs";
const DEFAULT_PREFS = { frameW: 32, frameH: 32, exportFormat: "generic" };

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
  const { theme, setTheme } = useTheme();
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
                    style={{ background: def.swatch }}
                  />
                  <span className="settings-theme-name">{def.label}</span>
                </button>
              ))}
            </div>
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
