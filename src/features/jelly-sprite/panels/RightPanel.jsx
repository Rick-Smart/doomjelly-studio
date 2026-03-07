import { ColorPicker } from "../../../ui/ColorPicker";
import { PaletteManager } from "../../../ui/PaletteManager";
import { useJellySprite } from "../JellySpriteContext";
import {
  PANEL_TABS,
  BRUSH_TYPES,
  BLEND_MODES,
  CANVAS_SIZES,
} from "../jellySprite.constants";
import { hexToRgba } from "../jellySprite.utils";
import { BrushThumb } from "../BrushThumb";

// ── Right panel container ─────────────────────────────────────────────────────
export function RightPanel() {
  const {
    fgColor,
    setFgColor,
    bgColor,
    setBgColor,
    fgAlpha,
    setFgAlpha,
    colorHistory,
    pickColor,
    panelTab,
    setPanelTab,
    selection,
    palettes,
    activePalette,
    setActivePalette,
    paletteAddColor,
    paletteRemoveColor,
    paletteAddNew,
    paletteDelete,
    paletteRename,
    paletteSetColors,
  } = useJellySprite();

  return (
    <div className="jelly-sprite__panel">
      <div className="jelly-sprite__panel-top">
        <div className="jelly-sprite__section">
          <div className="jelly-sprite__section-label">
            Color <span className="jelly-sprite__key-hint">X=swap</span>
          </div>
          <div className="jelly-sprite__fg-bg">
            <div
              className="jelly-sprite__fg-bg-bg"
              style={{ background: bgColor }}
              title="Background colour (click to edit)"
              onClick={() => {
                const tmp = fgColor;
                setFgColor(bgColor);
                setBgColor(tmp);
              }}
            />
            <div
              className="jelly-sprite__fg-bg-fg"
              style={{
                background: `rgba(${hexToRgba(
                  fgColor,
                  Math.round(fgAlpha * 255),
                )
                  .slice(0, 3)
                  .join(",")},${fgAlpha})`,
              }}
              title="Foreground colour (active)"
            />
            <button
              className="jelly-sprite__swap-btn"
              title="Swap colours (X)"
              onClick={() => {
                const tmp = fgColor;
                setFgColor(bgColor);
                setBgColor(tmp);
              }}
            >
              ⇄
            </button>
          </div>
        </div>

        <div className="jelly-sprite__section">
          <ColorPicker
            hex={fgColor}
            alpha={fgAlpha}
            onChange={(hex, alpha) => {
              pickColor(hex);
              setFgAlpha(alpha);
            }}
          />
        </div>

        {colorHistory.length > 0 && (
          <div className="jelly-sprite__section">
            <div className="jelly-sprite__section-label">Recent</div>
            <div className="jelly-sprite__history">
              {colorHistory.map((c, i) => (
                <button
                  key={i}
                  className={`jelly-sprite__history-cell${fgColor === c ? " jelly-sprite__palette-cell--active" : ""}`}
                  style={{ background: c }}
                  title={c}
                  onClick={() => pickColor(c)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="jelly-sprite__panel-tabs">
        {PANEL_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`jelly-sprite__panel-tab${panelTab === tab.id ? " jelly-sprite__panel-tab--active" : ""}${tab.id === "brush" && selection ? " jelly-sprite__panel-tab--badge" : ""}`}
            onClick={() => setPanelTab(tab.id)}
            title={tab.label}
          >
            <span className="jelly-sprite__panel-tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="jelly-sprite__panel-body">
        {panelTab === "palette" && (
          <div className="jelly-sprite__section">
            <PaletteManager
              activeColor={fgColor}
              palettes={palettes}
              activePalette={activePalette}
              onSelectColor={pickColor}
              onAddColor={paletteAddColor}
              onRemoveColor={paletteRemoveColor}
              onAddPalette={paletteAddNew}
              onDeletePalette={paletteDelete}
              onRenamePalette={paletteRename}
              onSetActivePalette={setActivePalette}
              onSetColors={paletteSetColors}
            />
          </div>
        )}
        {panelTab === "brush" && <BrushTabBody />}
        {panelTab === "layers" && <LayersTabBody />}
        {panelTab === "canvas" && <CanvasTabBody />}
        {panelTab === "view" && <ViewTabBody />}
        {panelTab === "more" && <MoreTabBody />}
      </div>
    </div>
  );
}

// ── Brush tab ─────────────────────────────────────────────────────────────────
function BrushTabBody() {
  const {
    brushType,
    setBrushType,
    brushSize,
    setBrushSize,
    brushOpacity,
    setBrushOpacity,
    fillShapes,
    setFillShapes,
    tool,
    selection,
    setSelection,
    selectionRef,
    lassoMaskRef,
    clipboardRef,
    copySelection,
    pasteSelection,
    cropToSelection,
    deleteSelectionContents,
  } = useJellySprite();

  return (
    <>
      <div className="jelly-sprite__section">
        <div className="jelly-sprite__section-label">Shape</div>
        <div className="jelly-sprite__brush-grid">
          {BRUSH_TYPES.map((b) => {
            const isActive = brushType === b.id;
            return (
              <button
                key={b.id}
                className={`jelly-sprite__brush-cell${isActive ? " jelly-sprite__brush-cell--active" : ""}`}
                onClick={() => setBrushType(b.id)}
                title={b.title}
              >
                <BrushThumb brushId={b.id} active={isActive} />
                <span className="jelly-sprite__brush-cell-label">
                  {b.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="jelly-sprite__section">
        <div className="jelly-sprite__section-label">Size &amp; Opacity</div>
        <div className="jelly-sprite__brush-prop-row">
          <span className="jelly-sprite__brush-prop-key">Size</span>
          <input
            type="range"
            min={1}
            max={32}
            value={brushType === "pixel" ? 1 : brushSize}
            disabled={brushType === "pixel"}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="jelly-sprite__brush-slider"
          />
          <span className="jelly-sprite__brush-prop-val">
            {brushType === "pixel" ? "1" : brushSize}px
          </span>
        </div>
        <div className="jelly-sprite__brush-prop-row">
          <span className="jelly-sprite__brush-prop-key">Opacity</span>
          <input
            type="range"
            min={1}
            max={100}
            value={brushOpacity}
            onChange={(e) => setBrushOpacity(Number(e.target.value))}
            className="jelly-sprite__brush-slider"
          />
          <span className="jelly-sprite__brush-prop-val">{brushOpacity}%</span>
        </div>
      </div>

      {["rect", "ellipse"].includes(tool) && (
        <div className="jelly-sprite__section">
          <div className="jelly-sprite__section-label">Shape Mode</div>
          <div className="jelly-sprite__brush-shape-opts">
            <button
              className={`jelly-sprite__brush-shape-btn${!fillShapes ? " jelly-sprite__brush-shape-btn--active" : ""}`}
              onClick={() => setFillShapes(false)}
              title="Outline shape"
            >
              <span className="jelly-sprite__brush-shape-icon">□</span>Outline
            </button>
            <button
              className={`jelly-sprite__brush-shape-btn${fillShapes ? " jelly-sprite__brush-shape-btn--active" : ""}`}
              onClick={() => setFillShapes(true)}
              title="Filled shape"
            >
              <span className="jelly-sprite__brush-shape-icon">■</span>Filled
            </button>
          </div>
        </div>
      )}

      {selection && (
        <div className="jelly-sprite__section">
          <div className="jelly-sprite__section-label">
            Selection
            <button
              className="jelly-sprite__deselect-btn"
              onClick={() => {
                setSelection(null);
                selectionRef.current = null;
                lassoMaskRef.current = null;
              }}
              title="Deselect (Esc / Ctrl+D)"
            >
              ✕
            </button>
          </div>
          <div className="jelly-sprite__selection-info">
            {selection.x},{selection.y} — {selection.w}×{selection.h}px
          </div>
          <div className="jelly-sprite__selection-actions">
            <button
              className="jelly-sprite__size-btn"
              title="Copy (Ctrl+C)"
              onClick={copySelection}
            >
              Copy
            </button>
            <button
              className="jelly-sprite__size-btn"
              title="Paste (Ctrl+V)"
              onClick={pasteSelection}
              disabled={!clipboardRef.current}
            >
              Paste
            </button>
            <button
              className="jelly-sprite__size-btn"
              title="Crop to selection"
              onClick={cropToSelection}
            >
              Crop
            </button>
            <button
              className="jelly-sprite__size-btn jelly-sprite__size-btn--danger"
              title="Delete contents (Del)"
              onClick={deleteSelectionContents}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Layers tab ────────────────────────────────────────────────────────────────
// ── LayerRow card ─────────────────────────────────────────────────────────────
function LayerRow({ layer, isActive }) {
  const {
    activeLayerId,
    setActiveLayerId,
    editingMaskId,
    setEditingMaskId,
    deleteLayer,
    duplicateLayer,
    moveLayerUp,
    moveLayerDown,
    updateLayer,
    addLayerMask,
    removeLayerMask,
    redraw,
  } = useJellySprite();

  return (
    <>
      <div
        className={`jelly-sprite__layer-row${isActive ? " jelly-sprite__layer-row--active" : ""}`}
        onClick={() => setActiveLayerId(layer.id)}
      >
        <button
          className="jelly-sprite__layer-vis-btn"
          title={layer.visible ? "Hide layer" : "Show layer"}
          onClick={(e) => {
            e.stopPropagation();
            updateLayer(layer.id, { visible: !layer.visible });
            redraw();
          }}
        >
          {layer.visible ? "👁" : "⊘"}
        </button>
        <span className="jelly-sprite__layer-name">{layer.name}</span>
        {layer.hasMask && (
          <button
            className={`jelly-sprite__mask-chip${editingMaskId === layer.id ? " jelly-sprite__mask-chip--editing" : ""}`}
            title={
              editingMaskId === layer.id ? "Stop editing mask" : "Edit mask"
            }
            onClick={(e) => {
              e.stopPropagation();
              setActiveLayerId(layer.id);
              setEditingMaskId((prev) => (prev === layer.id ? null : layer.id));
            }}
          >
            ⬡
          </button>
        )}
        <div className="jelly-sprite__layer-actions">
          <button
            className="jelly-sprite__layer-icon-btn"
            title="Move up"
            onClick={(e) => {
              e.stopPropagation();
              moveLayerUp(layer.id);
            }}
          >
            ↑
          </button>
          <button
            className="jelly-sprite__layer-icon-btn"
            title="Move down"
            onClick={(e) => {
              e.stopPropagation();
              moveLayerDown(layer.id);
            }}
          >
            ↓
          </button>
          <button
            className="jelly-sprite__layer-icon-btn"
            title="Duplicate"
            onClick={(e) => {
              e.stopPropagation();
              duplicateLayer(layer.id);
            }}
          >
            ⎘
          </button>
          <button
            className="jelly-sprite__layer-icon-btn jelly-sprite__layer-icon-btn--danger"
            title="Delete layer"
            onClick={(e) => {
              e.stopPropagation();
              deleteLayer(layer.id);
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {isActive && (
        <>
          <div className="jelly-sprite__layer-opacity-row">
            <select
              className="jelly-sprite__blend-select"
              value={layer.blendMode ?? "normal"}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                updateLayer(layer.id, { blendMode: e.target.value });
                redraw();
              }}
              title="Blend mode"
            >
              {BLEND_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="jelly-sprite__brush-size-label">
              {Math.round(layer.opacity * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(layer.opacity * 100)}
              onChange={(e) => {
                updateLayer(layer.id, {
                  opacity: Number(e.target.value) / 100,
                });
                redraw();
              }}
              className="jelly-sprite__brush-slider"
              style={{ flex: 1 }}
            />
          </div>
          <div className="jelly-sprite__layer-mask-row">
            {layer.hasMask ? (
              <>
                <button
                  className={`jelly-sprite__size-btn${editingMaskId === layer.id ? " jelly-sprite__size-btn--active" : ""}`}
                  onClick={() =>
                    setEditingMaskId((p) => (p === layer.id ? null : layer.id))
                  }
                  title="Toggle mask editing"
                >
                  {editingMaskId === layer.id ? "✦ Editing Mask" : "Edit Mask"}
                </button>
                <button
                  className="jelly-sprite__size-btn jelly-sprite__size-btn--danger"
                  onClick={() => removeLayerMask(layer.id)}
                  title="Delete layer mask"
                >
                  Del Mask
                </button>
              </>
            ) : (
              <button
                className="jelly-sprite__size-btn"
                onClick={() => addLayerMask(layer.id)}
                title="Add layer mask (white = fully revealed)"
              >
                + Add Mask
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ── Layers tab ────────────────────────────────────────────────────────────────
function LayersTabBody() {
  const { layers, activeLayerId, addLayer, mergeLayerDown, flattenAll } =
    useJellySprite();

  return (
    <div className="jelly-sprite__section">
      <div className="jelly-sprite__section-label">
        Layers
        <button
          className="jelly-sprite__layer-add-btn"
          onClick={addLayer}
          title="Add layer"
        >
          +
        </button>
      </div>
      <div className="jelly-sprite__layers-list">
        {[...layers].reverse().map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            isActive={layer.id === activeLayerId}
          />
        ))}
      </div>
      <div className="jelly-sprite__layer-merge-row">
        <button
          className="jelly-sprite__size-btn"
          onClick={() => mergeLayerDown(activeLayerId)}
          disabled={layers.findIndex((l) => l.id === activeLayerId) <= 0}
          title="Merge active layer down"
        >
          Merge Down
        </button>
        <button
          className="jelly-sprite__size-btn"
          onClick={flattenAll}
          disabled={layers.length <= 1}
          title="Flatten all layers"
        >
          Flatten All
        </button>
      </div>
    </div>
  );
}

// ── Canvas settings tab ───────────────────────────────────────────────────────
function CanvasTabBody() {
  const {
    canvasW,
    canvasH,
    resizeAnchor,
    setResizeAnchor,
    customW,
    setCustomW,
    customH,
    setCustomH,
    changeSize,
  } = useJellySprite();

  return (
    <div className="jelly-sprite__section">
      <div className="jelly-sprite__section-label">Canvas size</div>
      <div
        className="jelly-sprite__section-label"
        style={{ fontSize: 9, marginTop: -2 }}
      >
        Anchor
      </div>
      <div className="jelly-sprite__anchor-picker">
        {["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"].map((a) => (
          <button
            key={a}
            className={`jelly-sprite__anchor-btn${resizeAnchor === a ? " jelly-sprite__anchor-btn--active" : ""}`}
            onClick={() => setResizeAnchor(a)}
            title={a}
          />
        ))}
      </div>
      <div className="jelly-sprite__size-btns">
        {CANVAS_SIZES.map((s) => (
          <button
            key={s.label}
            className={`jelly-sprite__size-btn${canvasW === s.w && canvasH === s.h ? " jelly-sprite__size-btn--active" : ""}`}
            onClick={() => {
              setCustomW(s.w);
              setCustomH(s.h);
              changeSize(s.w, s.h);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="jelly-sprite__custom-size-row">
        <input
          type="number"
          className="jelly-sprite__custom-size-input"
          min={1}
          max={1024}
          value={customW}
          onChange={(e) =>
            setCustomW(Math.max(1, Math.min(1024, Number(e.target.value) || 1)))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") changeSize(customW, customH);
          }}
          title="Width (px)"
        />
        <span className="jelly-sprite__custom-size-sep">×</span>
        <input
          type="number"
          className="jelly-sprite__custom-size-input"
          min={1}
          max={1024}
          value={customH}
          onChange={(e) =>
            setCustomH(Math.max(1, Math.min(1024, Number(e.target.value) || 1)))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") changeSize(customW, customH);
          }}
          title="Height (px)"
        />
        <button
          className="jelly-sprite__custom-size-apply"
          onClick={() => changeSize(customW, customH)}
          title="Apply custom size"
        >
          ↵
        </button>
      </div>
    </div>
  );
}

// ── View tab ──────────────────────────────────────────────────────────────────
function ViewTabBody() {
  const {
    refImage,
    clearRefImage,
    loadRefImage,
    refVisible,
    setRefVisible,
    refVisibleRef,
    refOpacity,
    setRefOpacity,
    refOpacityRef,
    tileVisible,
    setTileVisible,
    tileCount,
    setTileCount,
    tileCanvasRef,
    redrawRef,
  } = useJellySprite();

  return (
    <>
      <div className="jelly-sprite__section">
        <div className="jelly-sprite__section-label">
          Reference
          {refImage && (
            <button
              className="jelly-sprite__deselect-btn"
              onClick={clearRefImage}
              title="Remove reference"
            >
              ✕
            </button>
          )}
        </div>
        {refImage ? (
          <>
            <img
              src={refImage}
              className="jelly-sprite__ref-preview"
              alt="Reference"
            />
            <div className="jelly-sprite__export-row">
              <label className="jelly-sprite__export-label">
                <input
                  type="checkbox"
                  checked={refVisible}
                  onChange={(e) => {
                    refVisibleRef.current = e.target.checked;
                    setRefVisible(e.target.checked);
                    redrawRef.current?.();
                  }}
                  style={{ marginRight: 6 }}
                />
                Visible
              </label>
            </div>
            <div className="jelly-sprite__export-row">
              <label className="jelly-sprite__export-label">Opacity</label>
              <input
                type="range"
                min={5}
                max={100}
                value={Math.round(refOpacity * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  refOpacityRef.current = v;
                  setRefOpacity(v);
                  redrawRef.current?.();
                }}
                className="jelly-sprite__brush-slider"
                style={{ flex: 1 }}
              />
              <span className="jelly-sprite__ref-opacity-label">
                {Math.round(refOpacity * 100)}%
              </span>
            </div>
          </>
        ) : (
          <label className="jelly-sprite__ref-load-btn">
            Load image…
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) =>
                e.target.files[0] && loadRefImage(e.target.files[0])
              }
            />
          </label>
        )}
      </div>

      <div className="jelly-sprite__section">
        <div className="jelly-sprite__section-label">
          Tile preview
          <div className="jelly-sprite__tile-mode-btns">
            <button
              className={`jelly-sprite__tile-mode-btn${tileVisible && tileCount === 2 ? " jelly-sprite__tile-mode-btn--active" : ""}`}
              onClick={() => {
                setTileVisible(true);
                setTileCount(2);
              }}
            >
              2×2
            </button>
            <button
              className={`jelly-sprite__tile-mode-btn${tileVisible && tileCount === 3 ? " jelly-sprite__tile-mode-btn--active" : ""}`}
              onClick={() => {
                setTileVisible(true);
                setTileCount(3);
              }}
            >
              3×3
            </button>
            {tileVisible && (
              <button
                className="jelly-sprite__tile-mode-btn"
                onClick={() => setTileVisible(false)}
              >
                off
              </button>
            )}
          </div>
        </div>
        {tileVisible && (
          <canvas ref={tileCanvasRef} className="jelly-sprite__tile-canvas" />
        )}
      </div>
    </>
  );
}

// ── More tab ──────────────────────────────────────────────────────────────────
function MoreTabBody() {
  const { projectState, importFromAnimator, useInAnimator, setExportOpen } =
    useJellySprite();
  return (
    <>
      <div className="jelly-sprite__section">
        <div className="jelly-sprite__section-label">Workspace</div>
        {projectState?.spriteSheet && (
          <button
            className="jelly-sprite__import-btn"
            onClick={importFromAnimator}
          >
            ← From Animator
          </button>
        )}
        <button className="jelly-sprite__use-btn" onClick={useInAnimator}>
          Send to Animator →
        </button>
      </div>
      <div className="jelly-sprite__section">
        <div className="jelly-sprite__section-label">Export</div>
        <button
          className="jelly-sprite__export-btn"
          onClick={() => setExportOpen(true)}
        >
          ⬇ Export…
        </button>
      </div>
    </>
  );
}

// ── Export modal ──────────────────────────────────────────────────────────────
export function ExportModal() {
  const {
    exportOpen,
    setExportOpen,
    frames,
    activePalette,
    exportFramesPerRow,
    setExportFramesPerRow,
    exportPadding,
    setExportPadding,
    exportLabels,
    setExportLabels,
    exportPNG,
    exportSpriteSheet,
    exportFramesZip,
    exportPaletteHex,
  } = useJellySprite();

  if (!exportOpen) return null;

  return (
    <div
      className="jelly-sprite__export-overlay"
      onClick={() => setExportOpen(false)}
    >
      <div
        className="jelly-sprite__export-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jelly-sprite__export-header">
          <span>Export</span>
          <button
            className="jelly-sprite__export-close"
            onClick={() => setExportOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="jelly-sprite__export-section">
          <div className="jelly-sprite__export-section-label">
            Current frame
          </div>
          <button
            className="jelly-sprite__export-action-btn"
            onClick={() => {
              exportPNG();
              setExportOpen(false);
            }}
          >
            PNG — active frame
          </button>
        </div>

        <div className="jelly-sprite__export-section">
          <div className="jelly-sprite__export-section-label">
            Sprite sheet ({frames.length} frames)
          </div>
          <div className="jelly-sprite__export-row">
            <label className="jelly-sprite__export-label">Columns</label>
            <input
              type="number"
              min={1}
              max={frames.length}
              value={exportFramesPerRow}
              onChange={(e) =>
                setExportFramesPerRow(Math.max(1, Number(e.target.value)))
              }
              className="jelly-sprite__export-number"
            />
          </div>
          <div className="jelly-sprite__export-row">
            <label className="jelly-sprite__export-label">Padding (px)</label>
            <input
              type="number"
              min={0}
              max={16}
              value={exportPadding}
              onChange={(e) =>
                setExportPadding(Math.max(0, Number(e.target.value)))
              }
              className="jelly-sprite__export-number"
            />
          </div>
          <div className="jelly-sprite__export-row">
            <label className="jelly-sprite__export-label">
              <input
                type="checkbox"
                checked={exportLabels}
                onChange={(e) => setExportLabels(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Frame labels
            </label>
          </div>
          <button
            className="jelly-sprite__export-action-btn"
            onClick={() => {
              exportSpriteSheet();
              setExportOpen(false);
            }}
          >
            PNG — sprite sheet
          </button>
        </div>

        <div className="jelly-sprite__export-section">
          <div className="jelly-sprite__export-section-label">
            Individual frames
          </div>
          <button
            className="jelly-sprite__export-action-btn"
            onClick={() => {
              exportFramesZip();
              setExportOpen(false);
            }}
            disabled={frames.length <= 1}
          >
            ZIP — all frames as PNGs
          </button>
        </div>

        <div className="jelly-sprite__export-section">
          <div className="jelly-sprite__export-section-label">
            Palette — {activePalette}
          </div>
          <button
            className="jelly-sprite__export-action-btn"
            onClick={() => {
              exportPaletteHex();
              setExportOpen(false);
            }}
          >
            .hex — Lospec palette
          </button>
        </div>
      </div>
    </div>
  );
}
