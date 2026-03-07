import { useJellySprite } from "../JellySpriteContext";
import { TOOL_GROUPS } from "../jellySprite.constants";

export function LeftToolbar() {
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
  } = useJellySprite();

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
                onClick={() => setTool(t.id)}
                title={t.title}
              >
                {t.icon}
              </button>
            ))}
          </div>
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
          <button
            className="jelly-sprite__tool-btn jelly-sprite__tool-btn--danger"
            onClick={clearCanvas}
            title="Clear layer"
            style={{ gridColumn: "span 2" }}
          >
            ✕ Clear
          </button>
        </div>
      </div>
    </div>
  );
}
