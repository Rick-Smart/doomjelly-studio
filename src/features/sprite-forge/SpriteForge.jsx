import { useRef, useEffect, useState } from "react";
import { useProject } from "../../contexts/ProjectContext";
import "./SpriteForge.css";

// ── Palette ───────────────────────────────────────────────────────────────────
const PALETTE = [
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
];

const CANVAS_SIZES = [
  { label: "64×64", w: 64, h: 64 },
  { label: "128×128", w: 128, h: 128 },
  { label: "256×128", w: 256, h: 128 },
  { label: "256×256", w: 256, h: 256 },
];

const TOOLS = [
  { id: "pencil", icon: "✏", title: "Pencil (P)" },
  { id: "eraser", icon: "⌫", title: "Eraser (E)" },
  { id: "fill", icon: "▨", title: "Fill bucket (F)" },
  { id: "picker", icon: "⊕", title: "Color picker (I)" },
];

// ── Color helpers ─────────────────────────────────────────────────────────────
function hexToRgba(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
    255,
  ];
}

function rgbaToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SpriteForge({ onSwitchToAnimator }) {
  const { state, dispatch } = useProject();

  // Canvas dimensions
  const [canvasW, setCanvasW] = useState(128);
  const [canvasH, setCanvasH] = useState(128);
  const [zoom, setZoom] = useState(4);

  // Tools & display
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#000000");
  const [gridVisible, setGridVisible] = useState(true);
  const [frameGridVisible, setFrameGridVisible] = useState(true);

  // Undo/redo
  const historyRef = useRef([]);
  const histIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Canvas refs
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const pixelsRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPixel = useRef(null);

  // Stable ref for keyboard handler closures
  const actionsRef = useRef({});
  actionsRef.current = {
    doUndo: () => doUndo(),
    doRedo: () => doRedo(),
    setTool,
  };

  // ── Init / resize ───────────────────────────────────────────────────────────
  useEffect(() => {
    const w = canvasW;
    const h = canvasH;
    pixelsRef.current = new Uint8ClampedArray(w * h * 4); // transparent
    offscreenRef.current = document.createElement("canvas");
    offscreenRef.current.width = w;
    offscreenRef.current.height = h;

    function finish() {
      historyRef.current = [new Uint8ClampedArray(pixelsRef.current)];
      histIdxRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      redraw();
    }

    const src = state.spriteForgeDataUrl;
    if (src) {
      const img = new Image();
      img.onload = () => {
        const ctx = offscreenRef.current.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        pixelsRef.current.set(ctx.getImageData(0, 0, w, h).data);
        finish();
      };
      img.src = src;
    } else {
      finish();
    }
  }, [canvasW, canvasH]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw on display setting changes
  useEffect(() => {
    redraw();
  }, [zoom, gridVisible, frameGridVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rendering ───────────────────────────────────────────────────────────────
  function redraw() {
    const canvas = canvasRef.current;
    const off = offscreenRef.current;
    if (!canvas || !off || !pixelsRef.current) return;

    const ctx = canvas.getContext("2d");
    const w = canvasW,
      h = canvasH,
      z = zoom;

    // Push pixel data to offscreen, then scale up to display canvas
    const offCtx = off.getContext("2d");
    const imgData = new ImageData(
      new Uint8ClampedArray(pixelsRef.current),
      w,
      h,
    );
    offCtx.putImageData(imgData, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, w * z, h * z);

    // Pixel grid (only at zoom ≥ 4)
    if (gridVisible && z >= 4) {
      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= w; x++) {
        ctx.beginPath();
        ctx.moveTo(x * z, 0);
        ctx.lineTo(x * z, h * z);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * z);
        ctx.lineTo(w * z, y * z);
        ctx.stroke();
      }
    }

    // Frame boundary grid (blue lines)
    if (frameGridVisible) {
      const { frameW, frameH } = state.frameConfig;
      if (frameW > 0 && frameH > 0) {
        ctx.strokeStyle = "rgba(80,120,255,0.4)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= w; x += frameW) {
          ctx.beginPath();
          ctx.moveTo(x * z, 0);
          ctx.lineTo(x * z, h * z);
          ctx.stroke();
        }
        for (let y = 0; y <= h; y += frameH) {
          ctx.beginPath();
          ctx.moveTo(0, y * z);
          ctx.lineTo(w * z, y * z);
          ctx.stroke();
        }
      }
    }
  }

  // ── Pixel helpers ────────────────────────────────────────────────────────────
  function getPixel(x, y) {
    const i = (y * canvasW + x) * 4;
    const p = pixelsRef.current;
    return [p[i], p[i + 1], p[i + 2], p[i + 3]];
  }

  function setPixel(x, y, rgba) {
    const i = (y * canvasW + x) * 4;
    const p = pixelsRef.current;
    p[i] = rgba[0];
    p[i + 1] = rgba[1];
    p[i + 2] = rgba[2];
    p[i + 3] = rgba[3];
  }

  function colorsMatch(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
  }

  function floodFill(sx, sy, fillColor) {
    const target = getPixel(sx, sy);
    if (colorsMatch(target, fillColor)) return;
    const queue = [[sx, sy]];
    const visited = new Set();
    while (queue.length > 0) {
      const [x, y] = queue.pop();
      const key = y * canvasW + x;
      if (visited.has(key)) continue;
      if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) continue;
      if (!colorsMatch(getPixel(x, y), target)) continue;
      visited.add(key);
      setPixel(x, y, fillColor);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  function getCanvasCoords(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(canvasW - 1, Math.floor((e.clientX - rect.left) / zoom)),
      ),
      y: Math.max(
        0,
        Math.min(canvasH - 1, Math.floor((e.clientY - rect.top) / zoom)),
      ),
    };
  }

  // ── Drawing ──────────────────────────────────────────────────────────────────
  function applyTool(x, y) {
    if (tool === "pencil") setPixel(x, y, hexToRgba(color));
    else if (tool === "eraser") setPixel(x, y, [0, 0, 0, 0]);
    else if (tool === "fill") floodFill(x, y, hexToRgba(color));
    else if (tool === "picker") {
      const [r, g, b, a] = getPixel(x, y);
      if (a > 0) setColor(rgbaToHex(r, g, b));
    }
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    isDrawing.current = true;
    const { x, y } = getCanvasCoords(e);
    lastPixel.current = { x, y };
    applyTool(x, y);
    redraw();
  }

  function onMouseMove(e) {
    if (!isDrawing.current) return;
    const { x, y } = getCanvasCoords(e);
    const last = lastPixel.current;
    if (last && (last.x !== x || last.y !== y)) {
      if (tool === "pencil" || tool === "eraser") {
        const dx = x - last.x,
          dy = y - last.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        for (let i = 0; i <= steps; i++) {
          applyTool(
            Math.round(last.x + (dx * i) / steps),
            Math.round(last.y + (dy * i) / steps),
          );
        }
        redraw();
      }
      lastPixel.current = { x, y };
    }
  }

  function onMouseUp() {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPixel.current = null;
    pushHistoryEntry();
    saveToProject();
  }

  function onMouseLeave() {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    pushHistoryEntry();
    saveToProject();
  }

  // ── History ──────────────────────────────────────────────────────────────────
  function pushHistoryEntry() {
    const snap = new Uint8ClampedArray(pixelsRef.current);
    const h = historyRef.current.slice(0, histIdxRef.current + 1);
    h.push(snap);
    if (h.length > 50) h.shift();
    historyRef.current = h;
    histIdxRef.current = h.length - 1;
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(false);
  }

  function doUndo() {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current--;
    pixelsRef.current.set(historyRef.current[histIdxRef.current]);
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(true);
    redraw();
    saveToProject();
  }

  function doRedo() {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current++;
    pixelsRef.current.set(historyRef.current[histIdxRef.current]);
    setCanUndo(true);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
    redraw();
    saveToProject();
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA"].includes(tag)) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        actionsRef.current.doUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        actionsRef.current.doRedo();
      } else if (e.key === "p") actionsRef.current.setTool("pencil");
      else if (e.key === "e") actionsRef.current.setTool("eraser");
      else if (e.key === "f") actionsRef.current.setTool("fill");
      else if (e.key === "i") actionsRef.current.setTool("picker");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Persistence ──────────────────────────────────────────────────────────────
  function saveToProject() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    dispatch({
      type: "SET_SPRITE_FORGE_DATA",
      payload: canvas.toDataURL("image/png"),
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  function clearCanvas() {
    pixelsRef.current.fill(0);
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function useInAnimator() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    dispatch({ type: "SET_SPRITE_FORGE_DATA", payload: dataUrl });
    dispatch({
      type: "SET_SPRITE_SHEET",
      payload: {
        dataUrl,
        objectUrl: dataUrl,
        filename: `${state.name || "sprite"}.png`,
        width: canvasW,
        height: canvasH,
      },
    });
    onSwitchToAnimator?.();
  }

  async function importFromAnimator() {
    const sh = state.spriteSheet;
    if (!sh?.objectUrl) return;
    let src = sh.objectUrl;
    if (!src.startsWith("data:")) {
      try {
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = src;
        });
        const cvs = document.createElement("canvas");
        cvs.width = sh.width;
        cvs.height = sh.height;
        cvs.getContext("2d").drawImage(img, 0, 0);
        src = cvs.toDataURL("image/png");
      } catch {
        return;
      }
    }
    const w = canvasW;
    const h = canvasH;
    const loadImg = new Image();
    loadImg.onload = () => {
      const ctx = offscreenRef.current.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(loadImg, 0, 0, w, h);
      pixelsRef.current.set(ctx.getImageData(0, 0, w, h).data);
      pushHistoryEntry();
      redraw();
      saveToProject();
    };
    loadImg.src = src;
  }

  function changeSize(w, h) {
    if (w === canvasW && h === canvasH) return;
    const hasContent =
      historyRef.current.length > 1 || pixelsRef.current?.some((v) => v !== 0);
    if (
      !hasContent ||
      window.confirm(
        `Resize to ${w}×${h}? This will clear the current drawing.`,
      )
    ) {
      setCanvasW(w);
      setCanvasH(h);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="sprite-forge">
      {/* ── Left toolbar ── */}
      <div className="sprite-forge__toolbar">
        <div className="sprite-forge__tool-group">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`sprite-forge__tool-btn${tool === t.id ? " sprite-forge__tool-btn--active" : ""}`}
              onClick={() => setTool(t.id)}
              title={t.title}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="sprite-forge__toolbar-sep" />

        <div className="sprite-forge__tool-group">
          <button
            className="sprite-forge__tool-btn"
            onClick={() => setZoom((z) => Math.max(1, z - 1))}
            title="Zoom out"
          >
            −
          </button>
          <span className="sprite-forge__zoom-label">{zoom}×</span>
          <button
            className="sprite-forge__tool-btn"
            onClick={() => setZoom((z) => Math.min(12, z + 1))}
            title="Zoom in"
          >
            +
          </button>
        </div>

        <div className="sprite-forge__toolbar-sep" />

        <div className="sprite-forge__tool-group">
          <button
            className={`sprite-forge__tool-btn${gridVisible ? " sprite-forge__tool-btn--active" : ""}`}
            onClick={() => setGridVisible((v) => !v)}
            title="Toggle pixel grid"
          >
            ⊞
          </button>
          <button
            className={`sprite-forge__tool-btn${frameGridVisible ? " sprite-forge__tool-btn--active" : ""}`}
            onClick={() => setFrameGridVisible((v) => !v)}
            title="Toggle frame boundaries"
          >
            ▦
          </button>
        </div>

        <div className="sprite-forge__toolbar-sep" />

        <div className="sprite-forge__tool-group">
          <button
            className="sprite-forge__tool-btn"
            onClick={doUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            className="sprite-forge__tool-btn"
            onClick={doRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            ↪
          </button>
        </div>

        <div className="sprite-forge__toolbar-sep" />

        <button
          className="sprite-forge__tool-btn sprite-forge__tool-btn--danger"
          onClick={clearCanvas}
          title="Clear canvas"
        >
          ✕
        </button>
      </div>

      {/* ── Canvas ── */}
      <div className="sprite-forge__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="sprite-forge__canvas"
          width={canvasW * zoom}
          height={canvasH * zoom}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          style={{ cursor: tool === "picker" ? "crosshair" : "cell" }}
        />
      </div>

      {/* ── Right panel ── */}
      <div className="sprite-forge__panel">
        <div className="sprite-forge__section">
          <div className="sprite-forge__section-label">Color</div>
          <div className="sprite-forge__color-row">
            <div
              className="sprite-forge__color-swatch"
              style={{ background: color }}
            />
            <input
              type="color"
              className="sprite-forge__color-input"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              title="Custom color"
            />
          </div>
        </div>

        <div className="sprite-forge__section">
          <div className="sprite-forge__section-label">Palette</div>
          <div className="sprite-forge__palette">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={`sprite-forge__palette-cell${color === c ? " sprite-forge__palette-cell--active" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="sprite-forge__section">
          <div className="sprite-forge__section-label">Canvas size</div>
          <div className="sprite-forge__size-btns">
            {CANVAS_SIZES.map((s) => (
              <button
                key={s.label}
                className={`sprite-forge__size-btn${canvasW === s.w && canvasH === s.h ? " sprite-forge__size-btn--active" : ""}`}
                onClick={() => changeSize(s.w, s.h)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sprite-forge__section">
          {state.spriteSheet && (
            <button
              className="sprite-forge__import-btn"
              onClick={importFromAnimator}
            >
              ← From Animator
            </button>
          )}
          <button className="sprite-forge__use-btn" onClick={useInAnimator}>
            Send to Animator →
          </button>
        </div>
      </div>
    </div>
  );
}
