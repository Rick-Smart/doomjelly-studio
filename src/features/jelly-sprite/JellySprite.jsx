import { useRef, useEffect, useState, useCallback } from "react";
import { useProject } from "../../contexts/ProjectContext";
import { ColorPicker } from "./ColorPicker";
import { PaletteManager, BUILTIN_PALETTES } from "./PaletteManager";
import "./JellySprite.css";

// ── Colour helpers ────────────────────────────────────────────────────────────
function hexToRgba(hex, alpha = 255) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
    alpha,
  ];
}
function rgbaToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

const CANVAS_SIZES = [
  { label: "64×64", w: 64, h: 64 },
  { label: "128×128", w: 128, h: 128 },
  { label: "256×128", w: 256, h: 128 },
  { label: "256×256", w: 256, h: 256 },
];

const TOOL_GROUPS = [
  {
    label: "Select",
    tools: [
      { id: "select-rect", icon: "⬚", title: "Rect Select (M)" },
      { id: "select-lasso", icon: "⌾", title: "Lasso Select" },
      { id: "select-wand", icon: "⁂", title: "Magic Wand (W)" },
      { id: "move", icon: "✥", title: "Move Selection (V)" },
    ],
  },
  {
    label: "Draw",
    tools: [
      { id: "pencil", icon: "✏", title: "Pencil (P)" },
      { id: "eraser", icon: "⌫", title: "Eraser (E)" },
      { id: "fill", icon: "▨", title: "Fill Bucket (F)" },
      { id: "picker", icon: "⊕", title: "Color Picker (I)" },
    ],
  },
  {
    label: "Shape",
    tools: [
      { id: "line", icon: "╱", title: "Line (L)" },
      { id: "rect", icon: "□", title: "Rectangle (R)" },
      { id: "ellipse", icon: "○", title: "Ellipse (O)" },
      { id: "spray", icon: "⋮⋮", title: "Spray (A)" },
    ],
  },
];

const BRUSH_TYPES = [
  { id: "round", icon: "●", title: "Round brush" },
  { id: "square", icon: "■", title: "Square brush" },
  { id: "dither", icon: "░", title: "Dither brush" },
];

const MAX_HISTORY = 50;
const MAX_COLOUR_HISTORY = 10;
let _layerIdCounter = 1;
function makeLayer(name) {
  return {
    id: `layer-${_layerIdCounter++}`,
    name,
    visible: true,
    opacity: 1.0,
    locked: false,
  };
}

// ── Pixel-drawing algorithms ──────────────────────────────────────────────────
function bresenhamLine(x0, y0, x1, y1, cb) {
  let dx = Math.abs(x1 - x0),
    sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0),
    sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    cb(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function rasterRect(x0, y0, x1, y1, filled, cb) {
  const lx = Math.min(x0, x1),
    rx = Math.max(x0, x1);
  const ty = Math.min(y0, y1),
    by = Math.max(y0, y1);
  for (let y = ty; y <= by; y++) {
    for (let x = lx; x <= rx; x++) {
      if (filled || x === lx || x === rx || y === ty || y === by) cb(x, y);
    }
  }
}

function rasterEllipse(cx, cy, rx, ry, filled, cb) {
  // Midpoint ellipse algorithm
  if (rx === 0 || ry === 0) {
    bresenhamLine(cx - rx, cy, cx + rx, cy, cb);
    return;
  }
  let x = 0,
    y = ry;
  let dx = 0,
    dy = 2 * rx * rx * y;
  let p1 = ry * ry - rx * rx * ry + 0.25 * rx * rx;
  const plot4 = (px, py) => {
    if (filled) {
      for (let ix = cx - px; ix <= cx + px; ix++) {
        cb(ix, cy + py);
        cb(ix, cy - py);
      }
    } else {
      cb(cx + px, cy + py);
      cb(cx - px, cy + py);
      cb(cx + px, cy - py);
      cb(cx - px, cy - py);
    }
  };
  while (dx < dy) {
    plot4(x, y);
    x++;
    dx += 2 * ry * ry;
    if (p1 < 0) {
      p1 += dx + ry * ry;
    } else {
      y--;
      dy -= 2 * rx * rx;
      p1 += dx - dy + ry * ry;
    }
  }
  let p2 =
    ry * ry * (x + 0.5) ** 2 + rx * rx * (y - 1) ** 2 - rx * rx * ry * ry;
  while (y >= 0) {
    plot4(x, y);
    y--;
    dy -= 2 * rx * rx;
    if (p2 > 0) {
      p2 += rx * rx - dy;
    } else {
      x++;
      dx += 2 * ry * ry;
      p2 += dx - dy + rx * rx;
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function JellySprite({ onSwitchToAnimator }) {
  const { state, dispatch } = useProject();

  // Canvas dimensions
  const [canvasW, setCanvasW] = useState(128);
  const [canvasH, setCanvasH] = useState(128);
  const [zoom, setZoom] = useState(4);

  // Tools & display
  const [tool, setTool] = useState("pencil");
  const [fillShapes, setFillShapes] = useState(false);
  const [symmetryH, setSymmetryH] = useState(false);
  const [symmetryV, setSymmetryV] = useState(false);
  const [gridVisible, setGridVisible] = useState(true);
  const [frameGridVisible, setFrameGridVisible] = useState(true);

  // Brush options
  const [brushType, setBrushType] = useState("round");
  const [brushSize, setBrushSize] = useState(1);

  // Selection state — {x, y, w, h} | null; lasso path for marching ants
  const [selection, setSelection] = useState(null);
  const selectionRef = useRef(null);
  const lassoPathRef = useRef([]); // array of {x,y} for lasso
  const marchingAntsRef = useRef(null); // requestAnimationFrame id
  const marchOffsetRef = useRef(0);
  // Move tool state
  const moveOriginRef = useRef(null);
  const movePixelSnapRef = useRef(null);

  // Colour — foreground, background, alpha, history
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [fgAlpha, setFgAlpha] = useState(1);
  const [colorHistory, setColorHistory] = useState([]);

  // Palette management
  const [palettes, setPalettes] = useState(BUILTIN_PALETTES);
  const [activePalette, setActivePalette] = useState("DoomJelly 32");

  // Layers
  const initLayer = makeLayer("Layer 1");
  const [layers, setLayers] = useState([initLayer]);
  const [activeLayerId, setActiveLayerId] = useState(initLayer.id);
  const layerDataRef = useRef({ [initLayer.id]: null }); // id → Uint8ClampedArray | null

  // Undo/redo — stores full {layerData, layers, activeLayerId} snapshots
  const historyRef = useRef([]);
  const histIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Canvas refs
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  // pixelsRef points to the ACTIVE layer's data for backward-compat with drawing code
  const pixelsRef = useRef(null);
  const isDrawing = useRef(false);
  const startPixel = useRef(null); // for line/rect/ellipse preview
  const lastPixel = useRef(null);
  const previewSnap = useRef(null); // pixel snapshot before shape preview

  // Stable ref for keyboard closures
  const actionsRef = useRef({});
  actionsRef.current = {
    doUndo: () => doUndo(),
    doRedo: () => doRedo(),
    setTool,
    swapColors: () => {
      setFgColor(bgColor);
      setBgColor(fgColor);
    },
    deselectAll: () => {
      setSelection(null);
      selectionRef.current = null;
    },
  };

  // ── Init / resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const w = canvasW,
      h = canvasH;
    const size = w * h * 4;

    // Resize all existing layer buffers (clear on resize)
    const newLayerData = {};
    setLayers((prevLayers) => {
      prevLayers.forEach((l) => {
        newLayerData[l.id] = new Uint8ClampedArray(size);
      });
      return prevLayers;
    });
    layerDataRef.current = newLayerData;

    // Sync pixelsRef to active layer
    pixelsRef.current =
      layerDataRef.current[activeLayerId] ??
      (layerDataRef.current[activeLayerId] = new Uint8ClampedArray(size));

    offscreenRef.current = document.createElement("canvas");
    offscreenRef.current.width = w;
    offscreenRef.current.height = h;

    function finish() {
      historyRef.current = [snapshotHistory()];
      histIdxRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      redraw();
    }

    const src = state.JellySpriteDataUrl;
    if (src) {
      const img = new Image();
      img.onload = () => {
        const ctx = offscreenRef.current.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        pixelsRef.current.set(ctx.getImageData(0, 0, w, h).data);
        layerDataRef.current[activeLayerId] = pixelsRef.current;
        finish();
      };
      img.src = src;
    } else {
      finish();
    }
  }, [canvasW, canvasH]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync pixelsRef when active layer changes
  useEffect(() => {
    const w = canvasW,
      h = canvasH;
    if (!layerDataRef.current[activeLayerId]) {
      layerDataRef.current[activeLayerId] = new Uint8ClampedArray(w * h * 4);
    }
    pixelsRef.current = layerDataRef.current[activeLayerId];
    redraw();
  }, [activeLayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    redraw();
  }, [zoom, gridVisible, frameGridVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marching ants animation for selection
  useEffect(() => {
    if (!selection) {
      if (marchingAntsRef.current)
        cancelAnimationFrame(marchingAntsRef.current);
      return;
    }
    const animate = () => {
      marchOffsetRef.current = (marchOffsetRef.current + 1) % 16;
      redraw();
      marchingAntsRef.current = requestAnimationFrame(animate);
    };
    marchingAntsRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(marchingAntsRef.current);
  }, [selection]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rendering ──────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const off = offscreenRef.current;
    if (!canvas || !off) return;

    const ctx = canvas.getContext("2d");
    const w = canvasW,
      h = canvasH,
      z = zoom;
    const offCtx = off.getContext("2d");

    // Composite all visible layers bottom to top
    offCtx.clearRect(0, 0, w, h);
    const currentLayers = layers; // closed over from render
    currentLayers.forEach((layer) => {
      if (!layer.visible) return;
      const data = layerDataRef.current[layer.id];
      if (!data) return;
      const imgData = new ImageData(new Uint8ClampedArray(data), w, h);
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      tmp.getContext("2d").putImageData(imgData, 0, 0);
      offCtx.globalAlpha = layer.opacity;
      offCtx.drawImage(tmp, 0, 0);
      offCtx.globalAlpha = 1;
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, w * z, h * z);

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

    // Draw selection overlay (marching ants)
    const sel = selectionRef.current;
    if (sel) {
      const { x, y, w: sw, h: sh } = sel;
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -marchOffsetRef.current;
      ctx.strokeRect(x * z + 0.5, y * z + 0.5, sw * z, sh * z);
      ctx.strokeStyle = "#000000";
      ctx.lineDashOffset = -marchOffsetRef.current + 4;
      ctx.strokeRect(x * z + 0.5, y * z + 0.5, sw * z, sh * z);
      ctx.restore();
    }
  }, [
    canvasW,
    canvasH,
    zoom,
    gridVisible,
    frameGridVisible,
    state.frameConfig,
    layers,
  ]);

  // ── Pixel helpers ─────────────────────────────────────────────────────────
  function getPixel(x, y) {
    const i = (y * canvasW + x) * 4,
      p = pixelsRef.current;
    return [p[i], p[i + 1], p[i + 2], p[i + 3]];
  }
  function setPixel(x, y, rgba, buf = pixelsRef.current) {
    if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) return;
    // Clip to selection if active
    const sel = selectionRef.current;
    if (
      sel &&
      (x < sel.x || x >= sel.x + sel.w || y < sel.y || y >= sel.y + sel.h)
    )
      return;
    const i = (y * canvasW + x) * 4;
    buf[i] = rgba[0];
    buf[i + 1] = rgba[1];
    buf[i + 2] = rgba[2];
    buf[i + 3] = rgba[3];
  }
  function colorsMatch(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
  }

  function floodFill(sx, sy, rgba) {
    const target = getPixel(sx, sy);
    if (colorsMatch(target, rgba)) return;
    const queue = [[sx, sy]],
      visited = new Set();
    while (queue.length) {
      const [x, y] = queue.pop();
      const key = y * canvasW + x;
      if (visited.has(key)) continue;
      if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) continue;
      if (!colorsMatch(getPixel(x, y), target)) continue;
      visited.add(key);
      setPixel(x, y, rgba);
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

  // Paint a brush stamp — round, square, or dither at given size
  function stampBrush(cx, cy, rgba, buf) {
    const r = Math.max(0, brushSize - 1);
    if (r === 0) {
      paintWithSymmetry(cx, cy, rgba, buf);
      return;
    }
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (brushType === "round" && dx * dx + dy * dy > r * r) continue;
        if (brushType === "dither" && (cx + cy + dx + dy) % 2 !== 0) continue;
        paintWithSymmetry(cx + dx, cy + dy, rgba, buf);
      }
    }
  }

  // Spray brush: random scatter in radius
  function sprayBrush(cx, cy, rgba) {
    const r = brushSize * 3 + 3;
    const count = Math.max(4, brushSize * 4);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * r;
      const x = Math.round(cx + Math.cos(angle) * dist);
      const y = Math.round(cy + Math.sin(angle) * dist);
      paintWithSymmetry(x, y, rgba, pixelsRef.current);
    }
  }

  // Apply symmetry: paint mirror pixels too
  function paintWithSymmetry(x, y, rgba, buf) {
    setPixel(x, y, rgba, buf);
    if (symmetryH) setPixel(canvasW - 1 - x, y, rgba, buf);
    if (symmetryV) setPixel(x, canvasH - 1 - y, rgba, buf);
    if (symmetryH && symmetryV)
      setPixel(canvasW - 1 - x, canvasH - 1 - y, rgba, buf);
  }

  // ── Drawing ────────────────────────────────────────────────────────────────
  function getActiveRgba() {
    return hexToRgba(fgColor, Math.round(fgAlpha * 255));
  }

  function applyFreehand(x, y) {
    const rgba = getActiveRgba();
    if (tool === "pencil") {
      stampBrush(x, y, rgba, pixelsRef.current);
    } else if (tool === "eraser") {
      stampBrush(x, y, [0, 0, 0, 0], pixelsRef.current);
    } else if (tool === "spray") {
      sprayBrush(x, y, rgba);
    } else if (tool === "fill") {
      floodFill(x, y, rgba);
    } else if (tool === "picker") {
      const [r, g, b, a] = getPixel(x, y);
      if (a > 0) pickColor(rgbaToHex(r, g, b));
    }
  }

  // Shape preview: restore snapshot then draw shape into pixelsRef
  function previewShape(x0, y0, x1, y1) {
    if (!previewSnap.current) return;
    pixelsRef.current.set(previewSnap.current);
    const rgba = getActiveRgba();
    if (tool === "line") {
      bresenhamLine(x0, y0, x1, y1, (px, py) =>
        paintWithSymmetry(px, py, rgba, pixelsRef.current),
      );
    } else if (tool === "rect") {
      rasterRect(x0, y0, x1, y1, fillShapes, (px, py) =>
        paintWithSymmetry(px, py, rgba, pixelsRef.current),
      );
    } else if (tool === "ellipse") {
      const cx = Math.round((x0 + x1) / 2),
        cy = Math.round((y0 + y1) / 2);
      const rx = Math.abs(x1 - x0) / 2,
        ry = Math.abs(y1 - y0) / 2;
      rasterEllipse(
        cx,
        cy,
        Math.round(rx),
        Math.round(ry),
        fillShapes,
        (px, py) => paintWithSymmetry(px, py, rgba, pixelsRef.current),
      );
    } else if (tool === "select-rect") {
      // Preview rect selection — just update selectionRef, don't paint pixels
      const lx = Math.min(x0, x1),
        ty = Math.min(y0, y1);
      const sw = Math.abs(x1 - x0) + 1,
        sh = Math.abs(y1 - y0) + 1;
      selectionRef.current = { x: lx, y: ty, w: sw, h: sh };
    }
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    isDrawing.current = true;
    const { x, y } = getCanvasCoords(e);
    startPixel.current = { x, y };
    lastPixel.current = { x, y };

    if (tool === "move") {
      const sel = selectionRef.current;
      if (sel) {
        moveOriginRef.current = { x, y, selX: sel.x, selY: sel.y };
        // Copy selected pixels for moving
        const buf = new Uint8ClampedArray(sel.w * sel.h * 4);
        for (let dy = 0; dy < sel.h; dy++) {
          for (let dx = 0; dx < sel.w; dx++) {
            const si = ((sel.y + dy) * canvasW + (sel.x + dx)) * 4;
            const di = (dy * sel.w + dx) * 4;
            for (let c = 0; c < 4; c++) buf[di + c] = pixelsRef.current[si + c];
            // Clear source
            for (let c = 0; c < 4; c++) pixelsRef.current[si + c] = 0;
          }
        }
        movePixelSnapRef.current = buf;
        previewSnap.current = new Uint8ClampedArray(pixelsRef.current);
        redraw();
        return;
      }
    }

    if (["line", "rect", "ellipse", "select-rect"].includes(tool)) {
      previewSnap.current = new Uint8ClampedArray(pixelsRef.current);
    }

    if (tool === "select-lasso") {
      lassoPathRef.current = [{ x, y }];
      return;
    }

    if (tool === "select-wand") {
      applyMagicWand(x, y);
      return;
    }

    if (!["select-rect", "move"].includes(tool)) {
      applyFreehand(x, y);
      redraw();
    }
  }

  function onMouseMove(e) {
    if (!isDrawing.current) return;
    const { x, y } = getCanvasCoords(e);
    const last = lastPixel.current;

    if (tool === "move" && moveOriginRef.current) {
      const orig = moveOriginRef.current;
      const dx = x - orig.x,
        dy = y - orig.y;
      const newSel = {
        ...selectionRef.current,
        x: orig.selX + dx,
        y: orig.selY + dy,
      };
      // Restore snap, paste pixels at new position
      pixelsRef.current.set(previewSnap.current);
      const buf = movePixelSnapRef.current;
      for (let ddy = 0; ddy < newSel.h; ddy++) {
        for (let ddx = 0; ddx < newSel.w; ddx++) {
          const di = (ddy * newSel.w + ddx) * 4;
          const tx = newSel.x + ddx,
            ty = newSel.y + ddy;
          if (tx < 0 || tx >= canvasW || ty < 0 || ty >= canvasH) continue;
          const si = (ty * canvasW + tx) * 4;
          for (let c = 0; c < 4; c++) pixelsRef.current[si + c] = buf[di + c];
        }
      }
      selectionRef.current = newSel;
      setSelection({ ...newSel });
      redraw();
      return;
    }

    if (tool === "select-lasso") {
      lassoPathRef.current.push({ x, y });
      // Update selection as bounding box of lasso path
      const pts = lassoPathRef.current;
      const xs = pts.map((p) => p.x),
        ys = pts.map((p) => p.y);
      const lx = Math.min(...xs),
        rx = Math.max(...xs);
      const ty = Math.min(...ys),
        by = Math.max(...ys);
      selectionRef.current = { x: lx, y: ty, w: rx - lx + 1, h: by - ty + 1 };
      redraw();
      return;
    }

    if (["line", "rect", "ellipse", "select-rect"].includes(tool)) {
      const { x: sx, y: sy } = startPixel.current;
      previewShape(sx, sy, x, y);
      redraw();
    } else if (last && (last.x !== x || last.y !== y)) {
      const ddx = x - last.x,
        ddy = y - last.y;
      const steps = Math.max(Math.abs(ddx), Math.abs(ddy));
      for (let i = 0; i <= steps; i++) {
        applyFreehand(
          Math.round(last.x + (ddx * i) / steps),
          Math.round(last.y + (ddy * i) / steps),
        );
      }
      redraw();
    }
    lastPixel.current = { x, y };
  }

  function onMouseUp(e) {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (tool === "move" && moveOriginRef.current) {
      moveOriginRef.current = null;
      movePixelSnapRef.current = null;
      previewSnap.current = null;
      pushHistoryEntry();
      saveToProject();
      return;
    }

    if (tool === "select-lasso") {
      lassoPathRef.current = [];
      setSelection(selectionRef.current ? { ...selectionRef.current } : null);
      lastPixel.current = null;
      startPixel.current = null;
      return;
    }

    if (tool === "select-rect") {
      const { x, y } = getCanvasCoords(e);
      const { x: sx, y: sy } = startPixel.current;
      const lx = Math.min(sx, x),
        ty = Math.min(sy, y);
      const sw = Math.abs(x - sx) + 1,
        sh = Math.abs(y - sy) + 1;
      const newSel = { x: lx, y: ty, w: sw, h: sh };
      selectionRef.current = newSel;
      setSelection(newSel);
      lastPixel.current = null;
      startPixel.current = null;
      previewSnap.current = null;
      return;
    }

    if (["line", "rect", "ellipse"].includes(tool)) {
      const { x, y } = getCanvasCoords(e);
      const { x: sx, y: sy } = startPixel.current;
      previewShape(sx, sy, x, y);
      previewSnap.current = null;
      redraw();
    }

    lastPixel.current = null;
    startPixel.current = null;
    pushHistoryEntry();
    saveToProject();
  }

  function onMouseLeave() {
    if (!isDrawing.current) return;
    if (["line", "rect", "ellipse"].includes(tool) && previewSnap.current) {
      pixelsRef.current.set(previewSnap.current);
      previewSnap.current = null;
      redraw();
    }
    isDrawing.current = false;
    lastPixel.current = null;
    startPixel.current = null;
    if (
      !["select-rect", "select-lasso", "select-wand", "move"].includes(tool)
    ) {
      pushHistoryEntry();
      saveToProject();
    }
  }

  // Magic wand: flood-select contiguous same-colour region → bounding box selection
  function applyMagicWand(sx, sy) {
    const target = getPixel(sx, sy);
    const visited = new Set();
    const queue = [[sx, sy]];
    let minX = sx,
      maxX = sx,
      minY = sy,
      maxY = sy;
    while (queue.length) {
      const [x, y] = queue.pop();
      const key = y * canvasW + x;
      if (visited.has(key)) continue;
      if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) continue;
      if (!colorsMatch(getPixel(x, y), target)) continue;
      visited.add(key);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    const newSel = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    selectionRef.current = newSel;
    setSelection(newSel);
  }

  // ── History ────────────────────────────────────────────────────────────────
  function snapshotHistory() {
    const snap = {};
    for (const [id, data] of Object.entries(layerDataRef.current)) {
      snap[id] = data ? new Uint8ClampedArray(data) : null;
    }
    return snap;
  }

  function pushHistoryEntry() {
    const snap = snapshotHistory();
    const h = historyRef.current.slice(0, histIdxRef.current + 1);
    h.push(snap);
    if (h.length > MAX_HISTORY) h.shift();
    historyRef.current = h;
    histIdxRef.current = h.length - 1;
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(false);
  }

  function restoreHistory(snap) {
    for (const [id, data] of Object.entries(snap)) {
      if (data) {
        if (!layerDataRef.current[id]) {
          layerDataRef.current[id] = new Uint8ClampedArray(data);
        } else {
          layerDataRef.current[id].set(data);
        }
      }
    }
    // Keep pixelsRef pointed at active layer
    pixelsRef.current = layerDataRef.current[activeLayerId];
  }

  function doUndo() {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current--;
    restoreHistory(historyRef.current[histIdxRef.current]);
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(true);
    redraw();
    saveToProject();
  }

  function doRedo() {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current++;
    restoreHistory(historyRef.current[histIdxRef.current]);
    setCanUndo(true);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
    redraw();
    saveToProject();
  }

  // ── Colour helpers ─────────────────────────────────────────────────────────
  function pickColor(hex) {
    setFgColor(hex);
    setColorHistory((h) =>
      [hex, ...h.filter((c) => c !== hex)].slice(0, MAX_COLOUR_HISTORY),
    );
  }

  // ── Transform actions ──────────────────────────────────────────────────────
  function flipH() {
    const w = canvasW,
      h = canvasH,
      p = pixelsRef.current;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < Math.floor(w / 2); x++) {
        const i = (y * w + x) * 4,
          j = (y * w + (w - 1 - x)) * 4;
        for (let c = 0; c < 4; c++) {
          const tmp = p[i + c];
          p[i + c] = p[j + c];
          p[j + c] = tmp;
        }
      }
    }
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function flipV() {
    const w = canvasW,
      h = canvasH,
      p = pixelsRef.current;
    for (let y = 0; y < Math.floor(h / 2); y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4,
          j = ((h - 1 - y) * w + x) * 4;
        for (let c = 0; c < 4; c++) {
          const tmp = p[i + c];
          p[i + c] = p[j + c];
          p[j + c] = tmp;
        }
      }
    }
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function rotateCW() {
    const w = canvasW,
      h = canvasH,
      src = pixelsRef.current;
    const dst = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * w + x) * 4,
          di = (x * h + (h - 1 - y)) * 4;
        dst[di] = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = src[si + 3];
      }
    }
    pixelsRef.current = dst;
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function rotateCCW() {
    const w = canvasW,
      h = canvasH,
      src = pixelsRef.current;
    const dst = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * w + x) * 4,
          di = ((w - 1 - x) * h + y) * 4;
        dst[di] = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = src[si + 3];
      }
    }
    pixelsRef.current = dst;
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA"].includes(tag)) return;
      const a = actionsRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        a.doUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        a.doRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        a.deselectAll();
      } else if (e.key === "p") a.setTool("pencil");
      else if (e.key === "e") a.setTool("eraser");
      else if (e.key === "f") a.setTool("fill");
      else if (e.key === "l") a.setTool("line");
      else if (e.key === "r") a.setTool("rect");
      else if (e.key === "o") a.setTool("ellipse");
      else if (e.key === "i") a.setTool("picker");
      else if (e.key === "m") a.setTool("select-rect");
      else if (e.key === "w") a.setTool("select-wand");
      else if (e.key === "v") a.setTool("move");
      else if (e.key === "a") a.setTool("spray");
      else if (e.key === "x") a.swapColors();
      else if (e.key === "Escape") a.deselectAll();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Persistence ────────────────────────────────────────────────────────────
  function saveToProject() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    dispatch({
      type: "SET_SPRITE_FORGE_DATA",
      payload: canvas.toDataURL("image/png"),
    });
  }

  // ── Cross-workspace actions ────────────────────────────────────────────────
  function clearCanvas() {
    pixelsRef.current.fill(0);
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  // ── Layer management ───────────────────────────────────────────────────────
  function addLayer() {
    const newLayer = makeLayer(`Layer ${layers.length + 1}`);
    layerDataRef.current[newLayer.id] = new Uint8ClampedArray(
      canvasW * canvasH * 4,
    );
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  }

  function deleteLayer(id) {
    if (layers.length <= 1) return; // must keep at least one
    const remaining = layers.filter((l) => l.id !== id);
    delete layerDataRef.current[id];
    setLayers(remaining);
    const newActive =
      id === activeLayerId ? remaining[remaining.length - 1].id : activeLayerId;
    setActiveLayerId(newActive);
  }

  function duplicateLayer(id) {
    const src = layers.find((l) => l.id === id);
    if (!src) return;
    const dup = makeLayer(src.name + " copy");
    const srcData = layerDataRef.current[id];
    layerDataRef.current[dup.id] = srcData
      ? new Uint8ClampedArray(srcData)
      : new Uint8ClampedArray(canvasW * canvasH * 4);
    const idx = layers.findIndex((l) => l.id === id);
    setLayers((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
    setActiveLayerId(dup.id);
  }

  function mergeLayerDown(id) {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    const below = layers[idx - 1];
    const topData = layerDataRef.current[id];
    const botData = layerDataRef.current[below.id];
    if (!topData || !botData) return;
    const topLayer = layers[idx];
    // Composite top onto bottom using top's opacity
    for (let i = 0; i < botData.length; i += 4) {
      const ta = (topData[i + 3] / 255) * topLayer.opacity;
      const ba = botData[i + 3] / 255;
      const outA = ta + ba * (1 - ta);
      if (outA === 0) {
        botData[i] = botData[i + 1] = botData[i + 2] = botData[i + 3] = 0;
        continue;
      }
      botData[i] = Math.round(
        (topData[i] * ta + botData[i] * ba * (1 - ta)) / outA,
      );
      botData[i + 1] = Math.round(
        (topData[i + 1] * ta + botData[i + 1] * ba * (1 - ta)) / outA,
      );
      botData[i + 2] = Math.round(
        (topData[i + 2] * ta + botData[i + 2] * ba * (1 - ta)) / outA,
      );
      botData[i + 3] = Math.round(outA * 255);
    }
    delete layerDataRef.current[id];
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setActiveLayerId(below.id);
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function flattenAll() {
    const w = canvasW,
      h = canvasH;
    const flat = new Uint8ClampedArray(w * h * 4);
    layers.forEach((layer) => {
      if (!layer.visible) return;
      const data = layerDataRef.current[layer.id];
      if (!data) return;
      for (let i = 0; i < flat.length; i += 4) {
        const ta = (data[i + 3] / 255) * layer.opacity;
        const ba = flat[i + 3] / 255;
        const outA = ta + ba * (1 - ta);
        if (outA === 0) continue;
        flat[i] = Math.round((data[i] * ta + flat[i] * ba * (1 - ta)) / outA);
        flat[i + 1] = Math.round(
          (data[i + 1] * ta + flat[i + 1] * ba * (1 - ta)) / outA,
        );
        flat[i + 2] = Math.round(
          (data[i + 2] * ta + flat[i + 2] * ba * (1 - ta)) / outA,
        );
        flat[i + 3] = Math.round(outA * 255);
      }
    });
    const baseLayer = makeLayer("Flattened");
    layerDataRef.current = { [baseLayer.id]: flat };
    pixelsRef.current = flat;
    setLayers([baseLayer]);
    setActiveLayerId(baseLayer.id);
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function moveLayerUp(id) {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx >= layers.length - 1) return;
    setLayers((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  function moveLayerDown(id) {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    setLayers((prev) => {
      const next = [...prev];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      return next;
    });
  }

  function updateLayer(id, patch) {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
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
    const loadImg = new Image();
    loadImg.onload = () => {
      const ctx = offscreenRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.drawImage(loadImg, 0, 0, canvasW, canvasH);
      pixelsRef.current.set(ctx.getImageData(0, 0, canvasW, canvasH).data);
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

  // ── Palette management ─────────────────────────────────────────────────────
  function paletteAddColor(hex) {
    setPalettes((prev) => {
      const colors = prev[activePalette] ?? [];
      if (colors.includes(hex)) return prev;
      return { ...prev, [activePalette]: [...colors, hex] };
    });
  }
  function paletteRemoveColor(idx) {
    setPalettes((prev) => ({
      ...prev,
      [activePalette]: prev[activePalette].filter((_, i) => i !== idx),
    }));
  }
  function paletteSetColors(colors) {
    setPalettes((prev) => ({ ...prev, [activePalette]: colors }));
  }
  function paletteAddNew(name) {
    setPalettes((prev) => ({ ...prev, [name]: [] }));
    setActivePalette(name);
  }
  function paletteDelete(name) {
    const next = { ...palettes };
    delete next[name];
    const fallback = Object.keys(next)[0];
    setPalettes(next);
    setActivePalette(fallback);
  }
  function paletteRename(oldName, newName) {
    const next = {};
    for (const [k, v] of Object.entries(palettes)) {
      next[k === oldName ? newName : k] = v;
    }
    setPalettes(next);
    if (activePalette === oldName) setActivePalette(newName);
  }

  // ── Cursor ────────────────────────────────────────────────────────────────
  const selectTools = ["select-rect", "select-lasso", "select-wand"];
  const cursorStyle =
    tool === "picker"
      ? "crosshair"
      : tool === "move"
        ? isDrawing.current
          ? "grabbing"
          : "grab"
        : selectTools.includes(tool)
          ? "crosshair"
          : ["line", "rect", "ellipse"].includes(tool)
            ? "crosshair"
            : "cell";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="jelly-sprite">
      {/* ── Left toolbar ── */}
      <div className="jelly-sprite__toolbar">
        {/* Tool groups */}
        {TOOL_GROUPS.map((group) => (
          <div key={group.label} className="jelly-sprite__tool-section">
            <div className="jelly-sprite__tool-section-label">
              {group.label}
            </div>
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

        {/* Shape fill toggle — only for rect/ellipse */}
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

        {/* Symmetry */}
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

        {/* Zoom */}
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

        {/* Grid toggles */}
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
              onClick={() => setFrameGridVisible((v) => !v)}
              title="Toggle frame grid"
            >
              ▦
            </button>
          </div>
        </div>

        <div className="jelly-sprite__toolbar-sep" />

        {/* Flip / rotate */}
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

        {/* Undo / redo + clear */}
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

      {/* ── Canvas ── */}
      <div className="jelly-sprite__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="jelly-sprite__canvas"
          width={canvasW * zoom}
          height={canvasH * zoom}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          style={{ cursor: cursorStyle }}
        />
      </div>

      {/* ── Right panel ── */}
      <div className="jelly-sprite__panel">
        {/* Foreground / background colour slots */}
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

        {/* Inline HSV picker */}
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

        {/* Colour history */}
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

        {/* Palette manager */}
        <div className="jelly-sprite__section">
          <div className="jelly-sprite__section-label">Palette</div>
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

        {/* Brush options */}
        <div className="jelly-sprite__section">
          <div className="jelly-sprite__section-label">Brush</div>
          <div className="jelly-sprite__brush-types">
            {BRUSH_TYPES.map((b) => (
              <button
                key={b.id}
                className={`jelly-sprite__tool-btn${brushType === b.id ? " jelly-sprite__tool-btn--active" : ""}`}
                onClick={() => setBrushType(b.id)}
                title={b.title}
              >
                {b.icon}
              </button>
            ))}
          </div>
          <div className="jelly-sprite__brush-size-row">
            <span className="jelly-sprite__brush-size-label">
              Size {brushSize}px
            </span>
            <input
              type="range"
              min={1}
              max={32}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="jelly-sprite__brush-slider"
            />
          </div>
        </div>

        {/* Selection info */}
        {selection && (
          <div className="jelly-sprite__section">
            <div className="jelly-sprite__section-label">
              Selection
              <button
                className="jelly-sprite__deselect-btn"
                onClick={() => {
                  setSelection(null);
                  selectionRef.current = null;
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
                title="Delete selection contents"
                onClick={() => {
                  const sel = selectionRef.current;
                  if (!sel) return;
                  for (let dy = 0; dy < sel.h; dy++) {
                    for (let dx = 0; dx < sel.w; dx++) {
                      const i = ((sel.y + dy) * canvasW + (sel.x + dx)) * 4;
                      pixelsRef.current[i] =
                        pixelsRef.current[i + 1] =
                        pixelsRef.current[i + 2] =
                        pixelsRef.current[i + 3] =
                          0;
                    }
                  }
                  pushHistoryEntry();
                  redraw();
                  saveToProject();
                }}
              >
                Delete contents
              </button>
            </div>
          </div>
        )}

        {/* Layers panel */}
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
              <div
                key={layer.id}
                className={`jelly-sprite__layer-row${layer.id === activeLayerId ? " jelly-sprite__layer-row--active" : ""}`}
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
                    title="Duplicate layer"
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
            ))}
            {[...layers].reverse().map((layer) =>
              layer.id === activeLayerId ? (
                <div
                  key={`op-${layer.id}`}
                  className="jelly-sprite__layer-opacity-row"
                >
                  <span className="jelly-sprite__brush-size-label">
                    Opacity {Math.round(layer.opacity * 100)}%
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
                  />
                </div>
              ) : null,
            )}
          </div>
          <div className="jelly-sprite__layer-merge-row">
            <button
              className="jelly-sprite__size-btn"
              onClick={() => {
                const idx = layers.findIndex((l) => l.id === activeLayerId);
                mergeLayerDown(activeLayerId);
              }}
              disabled={layers.findIndex((l) => l.id === activeLayerId) <= 0}
              title="Merge active layer down"
            >
              Merge Down
            </button>
            <button
              className="jelly-sprite__size-btn"
              onClick={flattenAll}
              disabled={layers.length <= 1}
              title="Flatten all layers into one"
            >
              Flatten All
            </button>
          </div>
        </div>

        {/* Canvas size presets */}
        <div className="jelly-sprite__section">
          <div className="jelly-sprite__section-label">Canvas size</div>
          <div className="jelly-sprite__size-btns">
            {CANVAS_SIZES.map((s) => (
              <button
                key={s.label}
                className={`jelly-sprite__size-btn${canvasW === s.w && canvasH === s.h ? " jelly-sprite__size-btn--active" : ""}`}
                onClick={() => changeSize(s.w, s.h)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cross-workspace */}
        <div className="jelly-sprite__section">
          {state.spriteSheet && (
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
      </div>
    </div>
  );
}
