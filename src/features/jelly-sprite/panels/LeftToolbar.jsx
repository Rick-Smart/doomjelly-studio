import { useState } from "react";
import { useJellySprite } from "../JellySpriteContext";
import { TOOL_GROUPS } from "../jellySprite.constants";
import { ConfirmDialog } from "../../../ui/ConfirmDialog";

export function LeftToolbar() {
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const {
    tool,
    setTool,
    fillShapes,
    setFillShapes,
    symmetryH,
    setSymmetryH,
    symmetryV,
    setSymmetryV,
    zoom,
    setZoom,
    gridVisible,
    setGridVisible,
    frameGridVisible,
    setFrameGridVisible,
    setPanelTab,
    flipH,
    flipV,
    rotateCW,
    rotateCCW,
    doUndo,
    doRedo,
    canUndo,
    canRedo,
    clearCanvas,
    deselectAll,
    inkMode,
    setInkMode,
  } = useJellySprite();

  const SELECT_TOOLS = new Set(["select-rect", "select-lasso", "select-wand"]);

  return (
    <div className="jelly-sprite__toolbar">
      {TOOL_GROUPS.map((group) => (
        <div key={group.label} className="jelly-sprite__tool-section">
          <div className="jelly-sprite__tool-section-label">{group.label}</div>
          <div className="jelly-sprite__tool-group">
            {group.tools.map((t) => (
              <button
                key={t.id}
                className={`jelly-sprite__tool-btn${tool === t.id ? " jelly-sprite__tool-btn--active" : ""}`}
                onClick={() => {
                  if (t.id === tool && SELECT_TOOLS.has(t.id)) {
                    // Clicking the active selection tool again deselects all
                    deselectAll();
                    setTool("pencil");
                  } else {
                    setTool(t.id);
                    if (t.id === "picker") setPanelTab("palette");
                  }
                }}
                title={t.title}
              >
                {t.icon}
              </button>
            ))}
          </div>
          {group.label === "Select" && (
            <div className="jelly-sprite__sel-hint">⇧ add · ⌥ subtract</div>
          )}
        </div>
      ))}

      <div className="jelly-sprite__toolbar-sep" />

      {["rect", "ellipse"].includes(tool) && (
        <div className="jelly-sprite__tool-section">
          <div className="jelly-sprite__tool-section-label">Fill</div>
          <div className="jelly-sprite__tool-group">
            <button
              className={`jelly-sprite__tool-btn${!fillShapes ? " jelly-sprite__tool-btn--active" : ""}`}
              onClick={() => setFillShapes(false)}
              title="Outlined shape"
            >
              □
            </button>
            <button
              className={`jelly-sprite__tool-btn${fillShapes ? " jelly-sprite__tool-btn--active" : ""}`}
              onClick={() => setFillShapes(true)}
              title="Filled shape"
            >
              ■
            </button>
          </div>
        </div>
      )}

      <div className="jelly-sprite__tool-section">
        <div className="jelly-sprite__tool-section-label">Mirror</div>
        <div className="jelly-sprite__tool-group">
          <button
            className={`jelly-sprite__tool-btn${symmetryH ? " jelly-sprite__tool-btn--active" : ""}`}
            onClick={() => setSymmetryH((v) => !v)}
            title="Mirror horizontal"
          >
            ⇔
          </button>
          <button
            className={`jelly-sprite__tool-btn${symmetryV ? " jelly-sprite__tool-btn--active" : ""}`}
            onClick={() => setSymmetryV((v) => !v)}
            title="Mirror vertical"
          >
            ⇕
          </button>
        </div>
      </div>

      <div className="jelly-sprite__tool-section">
        <div className="jelly-sprite__tool-section-label">Ink</div>
        <div className="jelly-sprite__tool-group">
          <button
            className={`jelly-sprite__tool-btn${inkMode === "simple" ? " jelly-sprite__tool-btn--active" : ""}`}
            onClick={() => setInkMode("simple")}
            title="Simple ink — normal paint (default)"
          >
            ✏
          </button>
          <button
            className={`jelly-sprite__tool-btn${inkMode === "lock-alpha" ? " jelly-sprite__tool-btn--active" : ""}`}
            onClick={() => setInkMode("lock-alpha")}
            title="Lock Alpha — paint only on existing pixels, preserve transparency"
          >
            🔒
          </button>
          <button
            className={`jelly-sprite__tool-btn${inkMode === "shading" ? " jelly-sprite__tool-btn--active" : ""}`}
            onClick={() => {
              setInkMode("shading");
              setPanelTab("palette");
            }}
            title="Shading ink — shift pixel color along the shading ramp (define ramp in Palette tab)"
          >
            🌑
          </button>
        </div>
      </div>

      <div className="jelly-sprite__toolbar-sep" />

      <div className="jelly-sprite__tool-section">
        <div className="jelly-sprite__tool-section-label">Zoom</div>
        <div className="jelly-sprite__tool-group">
          <button
            className="jelly-sprite__tool-btn"
            onClick={() => setZoom((z) => Math.max(1, z - 1))}
            title="Zoom out (-)"
          >
            −
          </button>
          <button
            className="jelly-sprite__tool-btn"
            onClick={() => setZoom((z) => Math.min(16, z + 1))}
            title="Zoom in (+)"
          >
            +
          </button>
        </div>
        <span className="jelly-sprite__zoom-label">{zoom}×</span>
      </div>

      <div className="jelly-sprite__toolbar-sep" />

      <div className="jelly-sprite__tool-section">
        <div className="jelly-sprite__tool-section-label">Grid</div>
        <div className="jelly-sprite__tool-group">
          <button
            className={`jelly-sprite__tool-btn${gridVisible ? " jelly-sprite__tool-btn--active" : ""}`}
            onClick={() => setGridVisible((v) => !v)}
            title="Toggle pixel grid"
          >
            ⊞
          </button>
          <button
            className={`jelly-sprite__tool-btn${frameGridVisible ? " jelly-sprite__tool-btn--active" : ""}`}
            onClick={() => {
              const next = !frameGridVisible;
              setFrameGridVisible(next);
              if (next) setPanelTab("view");
            }}
            title="Toggle custom grid (configure size in View tab)"
          >
            ▦
          </button>
        </div>
      </div>

      <div className="jelly-sprite__toolbar-sep" />

      <div className="jelly-sprite__tool-section">
        <div className="jelly-sprite__tool-section-label">Transform</div>
        <div className="jelly-sprite__tool-group">
          <button
            className="jelly-sprite__tool-btn"
            onClick={flipH}
            title="Flip horizontal"
          >
            ↔
          </button>
          <button
            className="jelly-sprite__tool-btn"
            onClick={flipV}
            title="Flip vertical"
          >
            ↕
          </button>
          <button
            className="jelly-sprite__tool-btn"
            onClick={rotateCW}
            title="Rotate 90° CW"
          >
            ↻
          </button>
          <button
            className="jelly-sprite__tool-btn"
            onClick={rotateCCW}
            title="Rotate 90° CCW"
          >
            ↺
          </button>
        </div>
      </div>

      <div className="jelly-sprite__toolbar-sep" />

      <div className="jelly-sprite__tool-section">
        <div className="jelly-sprite__tool-section-label">History</div>
        <div className="jelly-sprite__tool-group">
          <button
            className="jelly-sprite__tool-btn"
            onClick={doUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            className="jelly-sprite__tool-btn"
            onClick={doRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            ↪
          </button>
        </div>
      </div>

      <div className="jelly-sprite__toolbar-spacer" />

      <div className="jelly-sprite__tool-section">
        <button
          className="jelly-sprite__clear-btn"
          onClick={() => setClearConfirmOpen(true)}
          title="Clear active layer — cannot be undone"
        >
          🗑 Clear Layer
        </button>
      </div>

      <ConfirmDialog
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={clearCanvas}
        title="Clear layer?"
        message="This will erase all pixels on the active layer. This action cannot be undone."
        confirmLabel="Clear"
        cancelLabel="Keep"
        variant="danger"
      />
    </div>
  );
}
