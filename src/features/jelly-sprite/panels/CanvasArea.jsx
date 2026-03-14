import { useRef, useCallback, useEffect } from "react";
import { useJellySprite } from "../JellySpriteContext";
import { FrameThumb } from "../FrameThumb";

// ── Brush cursor helpers ──────────────────────────────────────────────────────

/** Tools that replace the native cursor with the brush-shape overlay. */
const BRUSH_CURSOR_TOOLS = new Set(["pencil", "eraser", "spray"]);

/**
 * Returns true if (cx+dx, cy+dy) is inside the brush footprint.
 * Matches the filter logic in pixelOps.js stampBrush.
 */
function inBrushShape(type, dx, dy, r, cx, cy) {
  switch (type) {
    case "round":
      return dx * dx + dy * dy <= r * r;
    case "diamond":
      return Math.abs(dx) + Math.abs(dy) <= r;
    case "cross":
      return dx === 0 || dy === 0;
    case "dither":
      return (cx + cy + dx + dy) % 2 !== 0;
    case "dither2":
      return (cx + cy + dx + dy) % 2 === 0;
    case "star":
      return dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
    case "ring": {
      const d2 = dx * dx + dy * dy;
      const inner = Math.max(0, r - 2);
      return d2 >= inner * inner && d2 <= r * r;
    }
    case "slash":
      return dy === -dx;
    case "bslash":
      return dy === dx;
    default: // "square", "pixel"
      return true;
  }
}

/**
 * Draw the brush-shape outline onto the overlay canvas.
 * Uses a black (2.5px) + white (1px) double-stroke for visibility on any bg.
 */
function renderBrushCursor(
  overlayCanvas,
  pos,
  tool,
  brushType,
  brushSize,
  zoom,
) {
  const ctx = overlayCanvas.getContext("2d");
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (!pos) return;

  const { x: cx, y: cy } = pos;
  const z = zoom;

  // Spray: show spray-radius circle
  if (tool === "spray") {
    const scx = (cx + 0.5) * z;
    const scy = (cy + 0.5) * z;
    const sr = brushSize * z;
    ctx.save();
    ctx.beginPath();
    ctx.arc(scx, scy, sr, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Pencil / eraser: draw brush footprint outline
  const r = brushType === "pixel" ? 0 : Math.max(0, brushSize - 1);
  const onPixels = new Set();
  if (r === 0) {
    onPixels.add(`${cx},${cy}`);
  } else {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (inBrushShape(brushType, dx, dy, r, cx, cy)) {
          onPixels.add(`${cx + dx},${cy + dy}`);
        }
      }
    }
  }

  // Build path of all visible edge segments
  function buildEdgePath() {
    ctx.beginPath();
    for (const key of onPixels) {
      const [px, py] = key.split(",").map(Number);
      const sx = px * z + 0.5;
      const sy = py * z + 0.5;
      if (!onPixels.has(`${px},${py - 1}`)) {
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + z, sy);
      }
      if (!onPixels.has(`${px},${py + 1}`)) {
        ctx.moveTo(sx, sy + z);
        ctx.lineTo(sx + z, sy + z);
      }
      if (!onPixels.has(`${px - 1},${py}`)) {
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + z);
      }
      if (!onPixels.has(`${px + 1},${py}`)) {
        ctx.moveTo(sx + z, sy);
        ctx.lineTo(sx + z, sy + z);
      }
    }
  }

  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  buildEdgePath();
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  buildEdgePath();
  ctx.stroke();
  ctx.restore();
}

export function CanvasArea() {
  const {
    editingMaskId,
    setEditingMaskId,
    canvasW,
    canvasH,
    zoom,
    canvasRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    cursorStyle,
    isPlaying,
    fps,
    setFps,
    onionSkinning,
    setOnionSkinning,
    tool,
    brushType,
    brushSize,
    frames,
    activeFrameIdx,
    frameThumbnails,
    playbackFrameIdx,
    playbackFrameIdxRef,
    switchToFrame,
    duplicateFrame,
    deleteFrame,
    addFrame,
    renameFrame,
    startPlayback,
    stopPlayback,
  } = useJellySprite();

  // ── Brush cursor overlay ────────────────────────────────────────────────────
  const brushCursorRef = useRef(null);
  // Store latest brush props in a ref so the draw callback never goes stale.
  const brushPropsRef = useRef({ tool, brushType, brushSize, zoom, isPlaying });
  brushPropsRef.current = { tool, brushType, brushSize, zoom, isPlaying };
  // Current cursor position in canvas-pixel coords, or null when outside.
  const cursorPxRef = useRef(null);
  const rafRef = useRef(null);

  // Stable draw function — reads only from refs so useCallback dep array is [].
  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const canvas = brushCursorRef.current;
      if (!canvas) return;
      const {
        tool: t,
        brushType: bt,
        brushSize: bs,
        zoom: z,
        isPlaying: ip,
      } = brushPropsRef.current;
      if (ip || !BRUSH_CURSOR_TOOLS.has(t)) {
        // Clear when playing or on non-paint tools
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      renderBrushCursor(canvas, cursorPxRef.current, t, bt, bs, z);
    });
  }, []);

  // Redraw when brush settings or zoom change (user changed them while hovering).
  useEffect(() => {
    scheduleDraw();
  }, [tool, brushType, brushSize, zoom, isPlaying, scheduleDraw]);

  // Cancel RAF on unmount.
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Wrapped pointer handlers — forward to drawing engine + update cursor pos.
  const handlePointerMove = useCallback(
    (e) => {
      onPointerMove(e);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const rawX = Math.floor((e.clientX - rect.left) / zoom);
      const rawY = Math.floor((e.clientY - rect.top) / zoom);
      cursorPxRef.current =
        rawX >= 0 && rawX < canvasW && rawY >= 0 && rawY < canvasH
          ? { x: rawX, y: rawY }
          : null;
      scheduleDraw();
    },
    [onPointerMove, canvasRef, zoom, canvasW, canvasH, scheduleDraw],
  );

  const handlePointerLeave = useCallback(
    (e) => {
      onPointerLeave(e);
      cursorPxRef.current = null;
      scheduleDraw();
    },
    [onPointerLeave, scheduleDraw],
  );

  return (
    <div className="jelly-sprite__canvas-area">
      {editingMaskId && (
        <div className="jelly-sprite__mask-edit-banner">
          <span>✦ Mask edit mode — pencil reveals, eraser hides</span>
          <button
            className="jelly-sprite__mask-edit-done"
            onClick={() => setEditingMaskId(null)}
          >
            Done
          </button>
        </div>
      )}
      <div className="jelly-sprite__canvas-wrap">
        {/* Inner wrapper gives overlay canvas an absolute-positioning context */}
        <div className="jelly-sprite__canvas-inner">
          <canvas
            ref={canvasRef}
            className="jelly-sprite__canvas"
            width={canvasW * zoom}
            height={canvasH * zoom}
            onPointerDown={onPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={handlePointerLeave}
            style={{ cursor: cursorStyle }}
          />
          <canvas
            ref={brushCursorRef}
            className="jelly-sprite__brush-cursor"
            width={canvasW * zoom}
            height={canvasH * zoom}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="jelly-sprite__frame-strip">
        <div className="jelly-sprite__frame-strip-controls">
          <button
            className={`jelly-sprite__playback-btn${isPlaying ? " jelly-sprite__playback-btn--active" : ""}`}
            onClick={isPlaying ? stopPlayback : startPlayback}
            disabled={frames.length <= 1}
            title={isPlaying ? "Stop (Space)" : "Play (Space)"}
          >
            {isPlaying ? "⏹" : "▶"}
          </button>
          <div className="jelly-sprite__fps-control">
            <span className="jelly-sprite__fps-label">{fps} FPS</span>
            <input
              type="range"
              min={1}
              max={30}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="jelly-sprite__fps-slider"
              disabled={isPlaying}
            />
          </div>
          <button
            className={`jelly-sprite__playback-btn${onionSkinning ? " jelly-sprite__playback-btn--active" : ""}`}
            onClick={() => setOnionSkinning(!onionSkinning)}
            title="Onion skinning"
            disabled={isPlaying || frames.length <= 1}
          >
            👻
          </button>
        </div>
        <div className="jelly-sprite__frames-scroll">
          {frames.map((frame, idx) => (
            <FrameThumb
              key={frame.id}
              thumb={frameThumbnails[frame.id]}
              name={frame.name}
              active={idx === activeFrameIdx}
              idx={idx}
              playbackIdx={isPlaying ? playbackFrameIdx : -1}
              isPlaying={isPlaying}
              onClick={() => !isPlaying && switchToFrame(idx)}
              onDuplicate={() => duplicateFrame(idx)}
              onDelete={() => deleteFrame(idx)}
              onRename={(name) => renameFrame(frame.id, name)}
              canDelete={frames.length > 1 && !isPlaying}
            />
          ))}
          <button
            className="jelly-sprite__add-frame-btn"
            onClick={addFrame}
            disabled={isPlaying}
            title="Add frame"
          >
            + Frame
          </button>
        </div>
      </div>
    </div>
  );
}
