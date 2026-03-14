import { useState, useRef } from "react";
import "./PaletteManager.css";
import { hexToRgb, rgbToHex } from "../ColorPicker";

// Built-in palette presets
export const BUILTIN_PALETTES = {
  "DoomJelly 32": [
    "#000000",
    "#ffffff",
    "#808080",
    "#c0c0c0",
    "#800000",
    "#ff0000",
    "#ff8080",
    "#ffc0c0",
    "#808000",
    "#c8c800",
    "#ffff00",
    "#ffffc0",
    "#008000",
    "#00c800",
    "#00ff00",
    "#c0ffc0",
    "#000080",
    "#0000ff",
    "#8080ff",
    "#c0c0ff",
    "#800080",
    "#c800c8",
    "#ff00ff",
    "#ffc0ff",
    "#008080",
    "#00c8c8",
    "#00ffff",
    "#c0ffff",
    "#804000",
    "#ff8000",
    "#ffc080",
    "#ffe0c0",
  ],
  CGA: [
    "#000000",
    "#555555",
    "#aaaaaa",
    "#ffffff",
    "#0000aa",
    "#5555ff",
    "#00aa00",
    "#55ff55",
    "#00aaaa",
    "#55ffff",
    "#aa0000",
    "#ff5555",
    "#aa00aa",
    "#ff55ff",
    "#aa5500",
    "#ffff55",
  ],
  "Pico-8": [
    "#000000",
    "#1d2b53",
    "#7e2553",
    "#008751",
    "#ab5236",
    "#5f574f",
    "#c2c3c7",
    "#fff1e8",
    "#ff004d",
    "#ffa300",
    "#ffec27",
    "#00e436",
    "#29adff",
    "#83769c",
    "#ff77a8",
    "#ffccaa",
  ],
  Nes: [
    "#7c7c7c",
    "#0000fc",
    "#0000bc",
    "#4428bc",
    "#940084",
    "#a80020",
    "#a81000",
    "#881400",
    "#503000",
    "#007800",
    "#006800",
    "#005800",
    "#004058",
    "#000000",
    "#bcbcbc",
    "#0078f8",
    "#0058f8",
    "#6844fc",
    "#d800cc",
    "#e40058",
    "#f83800",
    "#e45c10",
    "#ac7c00",
    "#00b800",
    "#00a800",
    "#00a844",
    "#008888",
    "#000000",
    "#f8f8f8",
    "#3cbcfc",
    "#6888fc",
    "#9878f8",
    "#f878f8",
    "#f85898",
    "#f87858",
    "#fca044",
    "#f8b800",
    "#b8f818",
    "#58d854",
    "#58f898",
    "#00e8d8",
    "#787878",
    "#000000",
    "#000000",
  ],
};

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function generateRamp(hexA, hexB, steps) {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return Array.from({ length: steps }, (_, i) => {
    const t = steps <= 1 ? 0 : i / (steps - 1);
    return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
  });
}

// Component

/**
 * props:
 *   activeColor  – current foreground colour hex
 *   palettes     – { name: [hex, ...], ... }
 *   activePalette – string — name of selected palette
 *   onSelectColor – (hex) => void
 *   onAddColor    – (hex) => void — add fg colour to active palette
 *   onRemoveColor – (index) => void
 *   onAddPalette  – (name) => void
 *   onDeletePalette – (name) => void
 *   onRenamePalette – (oldName, newName) => void
 *   onSetActivePalette – (name) => void
 *   onSetColors   – (colors[]) => void — replace whole palette (for ramp / Lospec import)
 */
export function PaletteManager({
  activeColor,
  palettes,
  activePalette,
  onSelectColor,
  onAddColor,
  onRemoveColor,
  onAddPalette,
  onDeletePalette,
  onRenamePalette,
  onSetActivePalette,
  onSetColors,
  // Shading ink props (optional)
  shadingMode = false,
  shadingRamp = [],
  onShadingRampChange,
}) {
  const [showRamp, setShowRamp] = useState(false);
  const [rampSteps, setRampSteps] = useState(5);
  const [rampA, setRampA] = useState("#000000");
  const [rampB, setRampB] = useState("#ffffff");
  const [renamingPalette, setRenamingPalette] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const lospecInputRef = useRef(null);

  const colors = palettes[activePalette] ?? [];
  const paletteNames = Object.keys(palettes);

  function handleLospecImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      // Lospec .hex format: one hex colour per line (no #)
      const imported = text
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/^#/, ""))
        .filter((l) => /^[0-9a-fA-F]{6}$/.test(l))
        .map((l) => "#" + l.toLowerCase());
      if (imported.length > 0) onSetColors(imported);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function insertRamp() {
    const ramp = generateRamp(rampA, rampB, rampSteps);
    onSetColors([...colors, ...ramp]);
    setShowRamp(false);
  }

  function startRename() {
    setRenameValue(activePalette);
    setRenamingPalette(true);
  }

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== activePalette) {
      onRenamePalette(activePalette, trimmed);
    }
    setRenamingPalette(false);
  }

  return (
    <div className="pm">
      {/* ── Palette selector + actions ── */}
      <div className="pm-header">
        {renamingPalette ? (
          <input
            className="pm-rename-input"
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenamingPalette(false);
            }}
          />
        ) : (
          <select
            className="pm-select"
            value={activePalette}
            onChange={(e) => onSetActivePalette(e.target.value)}
          >
            {paletteNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}

        <div className="pm-actions">
          <button
            className="pm-btn"
            title="Rename palette"
            onClick={startRename}
          >
            ✎
          </button>
          <button
            className="pm-btn"
            title="New palette"
            onClick={() => {
              let n = "Palette";
              let i = 2;
              while (palettes[n]) n = `Palette ${i++}`;
              onAddPalette(n);
            }}
          >
            +
          </button>
          <button
            className="pm-btn pm-btn--danger"
            title="Delete palette"
            disabled={paletteNames.length <= 1}
            onClick={() => {
              if (window.confirm(`Delete "${activePalette}"?`))
                onDeletePalette(activePalette);
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Colour swatches ── */}
      <div className="pm-swatches">
        {colors.map((hex, i) => {
          const inRamp = shadingMode && shadingRamp.includes(hex.toLowerCase());
          return (
            <button
              key={i}
              className={`pm-swatch${activeColor === hex ? " pm-swatch--active" : ""}${inRamp ? " pm-swatch--ramp" : ""}`}
              style={{ background: hex }}
              title={
                shadingMode
                  ? `${hex} — Shift+click to ${inRamp ? "remove from" : "add to"} shading ramp`
                  : hex
              }
              onClick={(e) => {
                if (shadingMode && e.shiftKey && onShadingRampChange) {
                  const norm = hex.toLowerCase();
                  if (inRamp) {
                    onShadingRampChange(shadingRamp.filter((c) => c !== norm));
                  } else {
                    onShadingRampChange([...shadingRamp, norm]);
                  }
                } else {
                  onSelectColor(hex);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onRemoveColor(i);
              }}
            />
          );
        })}
        <button
          className="pm-swatch pm-swatch--add"
          title="Add current colour to palette"
          onClick={() => onAddColor(activeColor)}
        >
          +
        </button>
      </div>

      {/* ── Tools row ── */}
      <div className="pm-tools">
        <button
          className="pm-tool-btn"
          title="Import Lospec .hex palette"
          onClick={() => lospecInputRef.current.click()}
        >
          ↑ Import .hex
        </button>
        <input
          ref={lospecInputRef}
          type="file"
          accept=".hex,.txt"
          style={{ display: "none" }}
          onChange={handleLospecImport}
        />
        <button
          className={`pm-tool-btn${showRamp ? " pm-tool-btn--active" : ""}`}
          title="Generate colour ramp"
          onClick={() => setShowRamp((v) => !v)}
        >
          ◑ Ramp
        </button>
      </div>

      {/* ── Preset palettes ── */}
      <div className="pm-tools">
        <span className="pm-label">Load preset:</span>
        {Object.keys(BUILTIN_PALETTES).map((name) => (
          <button
            key={name}
            className="pm-tool-btn"
            title={`Load ${name} palette`}
            onClick={() => onSetColors(BUILTIN_PALETTES[name])}
          >
            {name}
          </button>
        ))}
      </div>

      {/* ── Shading ramp (visible when shading ink active) ── */}
      {shadingMode && (
        <div className="pm-shading-ramp">
          <div className="pm-shading-ramp-label">
            Shading Ramp
            <span className="pm-shading-ramp-hint">
              {" "}
              (Shift+click swatches)
            </span>
          </div>
          {shadingRamp.length === 0 ? (
            <div className="pm-shading-ramp-empty">
              No colors — Shift+click palette swatches to build ramp (lightest →
              darkest)
            </div>
          ) : (
            <div className="pm-shading-ramp-strip">
              {shadingRamp.map((hex, i) => (
                <button
                  key={i}
                  className="pm-swatch pm-swatch--ramp-strip"
                  style={{ background: hex }}
                  title={`${hex} — click to remove`}
                  onClick={() =>
                    onShadingRampChange &&
                    onShadingRampChange(shadingRamp.filter((_, j) => j !== i))
                  }
                />
              ))}
            </div>
          )}
          {shadingRamp.length > 0 && (
            <button
              className="pm-tool-btn pm-tool-btn--danger"
              onClick={() => onShadingRampChange && onShadingRampChange([])}
            >
              Clear ramp
            </button>
          )}
        </div>
      )}

      {/* ── Colour ramp panel ── */}
      {showRamp && (
        <div className="pm-ramp">
          <div className="pm-ramp-row">
            <label>From</label>
            <input
              type="color"
              value={rampA}
              onChange={(e) => setRampA(e.target.value)}
            />
            <label>To</label>
            <input
              type="color"
              value={rampB}
              onChange={(e) => setRampB(e.target.value)}
            />
            <label>Steps</label>
            <input
              type="number"
              className="pm-ramp-steps"
              value={rampSteps}
              min={2}
              max={16}
              onChange={(e) => setRampSteps(Number(e.target.value))}
            />
          </div>
          <div className="pm-ramp-preview">
            {generateRamp(rampA, rampB, rampSteps).map((c, i) => (
              <div
                key={i}
                className="pm-ramp-cell"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <button className="pm-ramp-apply" onClick={insertRamp}>
            Add ramp to palette
          </button>
        </div>
      )}
    </div>
  );
}
