import { useRef, useEffect, useState, useCallback } from "react";
import { useProject } from "../../contexts/ProjectContext";
import { ColorPicker } from "./ColorPicker";
import { PaletteManager, BUILTIN_PALETTES } from "./PaletteManager";
import "./PixelLab.css";

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

const TOOLS = [
  { id: "pencil", icon: "✏", title: "Pencil (P)" },
  { id: "eraser", icon: "⌫", title: "Eraser (E)" },
  { id: "fill", icon: "▨", title: "Fill bucket (F)" },
  { id: "line", icon: "╱", title: "Line (L)" },
  { id: "rect", icon: "□", title: "Rectangle (R)" },
  { id: "ellipse", icon: "○", title: "Ellipse (O)" },
  { id: "picker", icon: "⊕", title: "Color picker (I)" },
];

const MAX_HISTORY = 50;
const MAX_COLOUR_HISTORY = 10;

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
export function PixelLab({ onSwitchToAnimator }) {
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

  // Colour — foreground, background, alpha, history
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [fgAlpha, setFgAlpha] = useState(1);
  const [colorHistory, setColorHistory] = useState([]);

  // Palette management
  const [palettes, setPalettes] = useState(BUILTIN_PALETTES);
  const [activePalette, setActivePalette] = useState("DoomJelly 32");

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
  };

  // ── Init / resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const w = canvasW,
      h = canvasH;
    pixelsRef.current = new Uint8ClampedArray(w * h * 4);
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

    const src = state.PixelLabDataUrl;
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

  useEffect(() => {
    redraw();
  }, [zoom, gridVisible, frameGridVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rendering ──────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const off = offscreenRef.current;
    if (!canvas || !off || !pixelsRef.current) return;

    const ctx = canvas.getContext("2d");
    const w = canvasW,
      h = canvasH,
      z = zoom;

    const offCtx = off.getContext("2d");
    offCtx.putImageData(
      new ImageData(new Uint8ClampedArray(pixelsRef.current), w, h),
      0,
      0,
    );

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
  }, [
    canvasW,
    canvasH,
    zoom,
    gridVisible,
    frameGridVisible,
    state.frameConfig,
  ]);

  // ── Pixel helpers ─────────────────────────────────────────────────────────
  function getPixel(x, y) {
    const i = (y * canvasW + x) * 4,
      p = pixelsRef.current;
    return [p[i], p[i + 1], p[i + 2], p[i + 3]];
  }
  function setPixel(x, y, rgba, buf = pixelsRef.current) {
    if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) return;
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
    if (tool === "pencil" || tool === "eraser") {
      const px = tool === "eraser" ? [0, 0, 0, 0] : rgba;
      paintWithSymmetry(x, y, px, pixelsRef.current);
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
    }
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    isDrawing.current = true;
    const { x, y } = getCanvasCoords(e);
    startPixel.current = { x, y };
    lastPixel.current = { x, y };

    if (["line", "rect", "ellipse"].includes(tool)) {
      previewSnap.current = new Uint8ClampedArray(pixelsRef.current);
    }

    applyFreehand(x, y);
    redraw();
  }

  function onMouseMove(e) {
    if (!isDrawing.current) return;
    const { x, y } = getCanvasCoords(e);
    const last = lastPixel.current;

    if (["line", "rect", "ellipse"].includes(tool)) {
      const { x: sx, y: sy } = startPixel.current;
      previewShape(sx, sy, x, y);
      redraw();
    } else if (last && (last.x !== x || last.y !== y)) {
      const dx = x - last.x,
        dy = y - last.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 0; i <= steps; i++) {
        applyFreehand(
          Math.round(last.x + (dx * i) / steps),
          Math.round(last.y + (dy * i) / steps),
        );
      }
      redraw();
    }
    lastPixel.current = { x, y };
  }

  function onMouseUp(e) {
    if (!isDrawing.current) return;
    isDrawing.current = false;

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
    pushHistoryEntry();
    saveToProject();
  }

  // ── History ────────────────────────────────────────────────────────────────
  function pushHistoryEntry() {
    const snap = new Uint8ClampedArray(pixelsRef.current);
    const h = historyRef.current.slice(0, histIdxRef.current + 1);
    h.push(snap);
    if (h.length > MAX_HISTORY) h.shift();
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
      } else if (e.key === "p") a.setTool("pencil");
      else if (e.key === "e") a.setTool("eraser");
      else if (e.key === "f") a.setTool("fill");
      else if (e.key === "l") a.setTool("line");
      else if (e.key === "r") a.setTool("rect");
      else if (e.key === "o") a.setTool("ellipse");
      else if (e.key === "i") a.setTool("picker");
      else if (e.key === "x") a.swapColors();
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
  const cursorStyle =
    tool === "picker"
      ? "crosshair"
      : ["line", "rect", "ellipse"].includes(tool)
        ? "crosshair"
        : "cell";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pixel-lab">
      {/* ── Left toolbar ── */}
      <div className="pixel-lab__toolbar">
        {/* Drawing tools */}
        <div className="pixel-lab__tool-group">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`pixel-lab__tool-btn${tool === t.id ? " pixel-lab__tool-btn--active" : ""}`}
              onClick={() => setTool(t.id)}
              title={t.title}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="pixel-lab__toolbar-sep" />

        {/* Shape fill toggle */}
        {["rect", "ellipse"].includes(tool) && (
          <>
            <button
              className={`pixel-lab__tool-btn${fillShapes ? " pixel-lab__tool-btn--active" : ""}`}
              onClick={() => setFillShapes((v) => !v)}
              title={fillShapes ? "Filled shape" : "Outlined shape"}
            >
              {fillShapes ? "■" : "□"}
            </button>
            <div className="pixel-lab__toolbar-sep" />
          </>
        )}

        {/* Symmetry */}
        <div className="pixel-lab__tool-group">
          <button
            className={`pixel-lab__tool-btn${symmetryH ? " pixel-lab__tool-btn--active" : ""}`}
            onClick={() => setSymmetryH((v) => !v)}
            title="Mirror horizontal (S)"
          >
            ⇔
          </button>
          <button
            className={`pixel-lab__tool-btn${symmetryV ? " pixel-lab__tool-btn--active" : ""}`}
            onClick={() => setSymmetryV((v) => !v)}
            title="Mirror vertical"
          >
            ⇕
          </button>
        </div>

        <div className="pixel-lab__toolbar-sep" />

        {/* Zoom */}
        <div className="pixel-lab__tool-group">
          <button
            className="pixel-lab__tool-btn"
            onClick={() => setZoom((z) => Math.max(1, z - 1))}
            title="Zoom out (-)"
          >
            −
          </button>
          <span className="pixel-lab__zoom-label">{zoom}×</span>
          <button
            className="pixel-lab__tool-btn"
            onClick={() => setZoom((z) => Math.min(16, z + 1))}
            title="Zoom in (+)"
          >
            +
          </button>
        </div>

        <div className="pixel-lab__toolbar-sep" />

        {/* Grid toggles */}
        <div className="pixel-lab__tool-group">
          <button
            className={`pixel-lab__tool-btn${gridVisible ? " pixel-lab__tool-btn--active" : ""}`}
            onClick={() => setGridVisible((v) => !v)}
            title="Toggle pixel grid"
          >
            ⊞
          </button>
          <button
            className={`pixel-lab__tool-btn${frameGridVisible ? " pixel-lab__tool-btn--active" : ""}`}
            onClick={() => setFrameGridVisible((v) => !v)}
            title="Toggle frame grid"
          >
            ▦
          </button>
        </div>

        <div className="pixel-lab__toolbar-sep" />

        {/* Flip / rotate */}
        <div className="pixel-lab__tool-group">
          <button
            className="pixel-lab__tool-btn"
            onClick={flipH}
            title="Flip horizontal"
          >
            ↔
          </button>
          <button
            className="pixel-lab__tool-btn"
            onClick={flipV}
            title="Flip vertical"
          >
            ↕
          </button>
          <button
            className="pixel-lab__tool-btn"
            onClick={rotateCW}
            title="Rotate 90° CW"
          >
            ↻
          </button>
          <button
            className="pixel-lab__tool-btn"
            onClick={rotateCCW}
            title="Rotate 90° CCW"
          >
            ↺
          </button>
        </div>

        <div className="pixel-lab__toolbar-sep" />

        {/* Undo / redo */}
        <div className="pixel-lab__tool-group">
          <button
            className="pixel-lab__tool-btn"
            onClick={doUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            className="pixel-lab__tool-btn"
            onClick={doRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            ↪
          </button>
        </div>

        <div className="pixel-lab__toolbar-sep" />

        <button
          className="pixel-lab__tool-btn pixel-lab__tool-btn--danger"
          onClick={clearCanvas}
          title="Clear canvas"
        >
          ✕
        </button>
      </div>

      {/* ── Canvas ── */}
      <div className="pixel-lab__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="pixel-lab__canvas"
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
      <div className="pixel-lab__panel">
        {/* Foreground / background colour slots */}
        <div className="pixel-lab__section">
          <div className="pixel-lab__section-label">
            Color <span className="pixel-lab__key-hint">X=swap</span>
          </div>
          <div className="pixel-lab__fg-bg">
            <div
              className="pixel-lab__fg-bg-bg"
              style={{ background: bgColor }}
              title="Background colour (click to edit)"
              onClick={() => {
                const tmp = fgColor;
                setFgColor(bgColor);
                setBgColor(tmp);
              }}
            />
            <div
              className="pixel-lab__fg-bg-fg"
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
              className="pixel-lab__swap-btn"
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
        <div className="pixel-lab__section">
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
          <div className="pixel-lab__section">
            <div className="pixel-lab__section-label">Recent</div>
            <div className="pixel-lab__history">
              {colorHistory.map((c, i) => (
                <button
                  key={i}
                  className={`pixel-lab__history-cell${fgColor === c ? " pixel-lab__palette-cell--active" : ""}`}
                  style={{ background: c }}
                  title={c}
                  onClick={() => pickColor(c)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Palette manager */}
        <div className="pixel-lab__section">
          <div className="pixel-lab__section-label">Palette</div>
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

        {/* Canvas size presets */}
        <div className="pixel-lab__section">
          <div className="pixel-lab__section-label">Canvas size</div>
          <div className="pixel-lab__size-btns">
            {CANVAS_SIZES.map((s) => (
              <button
                key={s.label}
                className={`pixel-lab__size-btn${canvasW === s.w && canvasH === s.h ? " pixel-lab__size-btn--active" : ""}`}
                onClick={() => changeSize(s.w, s.h)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cross-workspace */}
        <div className="pixel-lab__section">
          {state.spriteSheet && (
            <button
              className="pixel-lab__import-btn"
              onClick={importFromAnimator}
            >
              ← From Animator
            </button>
          )}
          <button className="pixel-lab__use-btn" onClick={useInAnimator}>
            Send to Animator →
          </button>
        </div>
      </div>
    </div>
  );
}

