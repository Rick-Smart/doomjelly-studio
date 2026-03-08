import { useRef, useState, useEffect } from "react";
import { hexToRgba, rgbaToHex, rasterRect, rasterEllipse } from "../jellySprite.utils";
import { buildLassoMask, bresenhamLine } from "../engine/selectionUtils.js";

/**
 * All mouse-event handlers, pixel helpers, brush stamping, flood fill,
 * shape preview, selection tools, and transform operations.
 */
export function useDrawingTools({
  canvasW,
  canvasH,
  canvasRef,
  zoom,
  pixelsRef,
  layerDataRef,
  layerMaskDataRef,
  editingMaskIdRef,
  activeLayerIdRef,
  tool,
  brushType,
  brushSize,
  brushOpacity,
  fillShapes,
  symmetryH,
  symmetryV,
  fgColor,
  fgAlpha,
  pendingResizeDataRef,
  resizeAnchor,
  pushHistoryEntry,
  redraw,
  saveToProject,
  setCanvasW,
  setCanvasH,
  setSelection,
}) {
  const [selection, setSelectionState] = useState(null);
  const selectionRef = useRef(null);
  const lassoPathRef = useRef([]);
  const lassoMaskRef = useRef(null);
  const marchingAntsRef = useRef(null);
  const marchOffsetRef = useRef(0);
  const moveOriginRef = useRef(null);
  const movePixelSnapRef = useRef(null);
  const clipboardRef = useRef(null);
  const isDrawing = useRef(false);
  const startPixel = useRef(null);
  const lastPixel = useRef(null);
  const previewSnap = useRef(null);

  // Expose drawing refs so useCanvas can pick them up without circular deps.
  useEffect(() => {
    window.__jellyRefs__ = Object.assign(window.__jellyRefs__ ?? {}, {
      marchOffsetRef,
      selectionRef,
      lassoPathRef,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Proxy so callers get both the state update and keep selectionRef in sync
  function _setSelection(val) {
    selectionRef.current = val;
    setSelectionState(val);
    if (setSelection) setSelection(val);
  }

  // ── Pixel helpers ──────────────────────────────────────────────────────────
  function getPixel(x, y) {
    const i = (y * canvasW + x) * 4,
      p = pixelsRef.current;
    return [p[i], p[i + 1], p[i + 2], p[i + 3]];
  }

  function setPixel(x, y, rgba, buf = pixelsRef.current) {
    if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) return;
    const sel = selectionRef.current;
    if (sel) {
      if (x < sel.x || x >= sel.x + sel.w || y < sel.y || y >= sel.y + sel.h)
        return;
      if (lassoMaskRef.current && !lassoMaskRef.current[y * canvasW + x])
        return;
    }
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

  function paintWithSymmetry(x, y, rgba, buf) {
    const maskId = editingMaskIdRef.current;
    if (maskId) {
      const mask = layerMaskDataRef.current[maskId];
      if (mask) {
        const applyMask = (px, py) => {
          if (px < 0 || px >= canvasW || py < 0 || py >= canvasH) return;
          mask[py * canvasW + px] = rgba[3];
        };
        applyMask(x, y);
        if (symmetryH) applyMask(canvasW - 1 - x, y);
        if (symmetryV) applyMask(x, canvasH - 1 - y);
        if (symmetryH && symmetryV) applyMask(canvasW - 1 - x, canvasH - 1 - y);
      }
      return;
    }
    setPixel(x, y, rgba, buf);
    if (symmetryH) setPixel(canvasW - 1 - x, y, rgba, buf);
    if (symmetryV) setPixel(x, canvasH - 1 - y, rgba, buf);
    if (symmetryH && symmetryV)
      setPixel(canvasW - 1 - x, canvasH - 1 - y, rgba, buf);
  }

  function stampBrush(cx, cy, rgba, buf) {
    if (brushType === "pixel") {
      paintWithSymmetry(cx, cy, rgba, buf);
      return;
    }
    const r = Math.max(0, brushSize - 1);
    if (r === 0) {
      paintWithSymmetry(cx, cy, rgba, buf);
      return;
    }
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (brushType === "round" && dx * dx + dy * dy > r * r) continue;
        if (brushType === "diamond" && Math.abs(dx) + Math.abs(dy) > r)
          continue;
        if (brushType === "cross" && dx !== 0 && dy !== 0) continue;
        if (brushType === "dither" && (cx + cy + dx + dy) % 2 !== 0) continue;
        if (brushType === "dither2" && (cx + cy + dx + dy) % 2 === 0) continue;
        paintWithSymmetry(cx + dx, cy + dy, rgba, buf);
      }
    }
  }

  function sprayBrush(cx, cy, rgba) {
    const r = brushSize * 3 + 3;
    const count = Math.max(4, brushSize * 4);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * r;
      paintWithSymmetry(
        Math.round(cx + Math.cos(angle) * dist),
        Math.round(cy + Math.sin(angle) * dist),
        rgba,
        pixelsRef.current,
      );
    }
  }

  // ── Drawing ────────────────────────────────────────────────────────────────
  function getActiveRgba() {
    return hexToRgba(fgColor, Math.round(fgAlpha * (brushOpacity / 100) * 255));
  }

  function applyFreehand(x, y) {
    const rgba = getActiveRgba();
    if (tool === "pencil") stampBrush(x, y, rgba, pixelsRef.current);
    else if (tool === "eraser")
      stampBrush(x, y, [0, 0, 0, 0], pixelsRef.current);
    else if (tool === "spray") sprayBrush(x, y, rgba);
    else if (tool === "fill") floodFill(x, y, rgba);
    else if (tool === "picker") {
      const [r, g, b, a] = getPixel(x, y);
      if (a > 0) return rgbaToHex(r, g, b); // caller handles pickColor()
    }
    return null;
  }

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
      const lx = Math.min(x0, x1),
        ty = Math.min(y0, y1);
      selectionRef.current = {
        x: lx,
        y: ty,
        w: Math.abs(x1 - x0) + 1,
        h: Math.abs(y1 - y0) + 1,
      };
    }
  }

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
    _setSelection(newSel);
  }

  // ── Mouse handlers ─────────────────────────────────────────────────────────
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
        const buf = new Uint8ClampedArray(sel.w * sel.h * 4);
        for (let dy = 0; dy < sel.h; dy++) {
          for (let dx = 0; dx < sel.w; dx++) {
            const si = ((sel.y + dy) * canvasW + (sel.x + dx)) * 4;
            const di = (dy * sel.w + dx) * 4;
            for (let c = 0; c < 4; c++) buf[di + c] = pixelsRef.current[si + c];
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
      if (tool === "select-rect") lassoMaskRef.current = null;
      previewSnap.current = new Uint8ClampedArray(pixelsRef.current);
    }

    if (tool === "select-lasso") {
      lassoMaskRef.current = null;
      selectionRef.current = null;
      lassoPathRef.current = [{ x, y }];
      return;
    }

    if (tool === "select-wand") {
      lassoMaskRef.current = null;
      applyMagicWand(x, y);
      return;
    }

    if (!["select-rect", "move"].includes(tool)) {
      const pickedHex = applyFreehand(x, y);
      if (pickedHex) return pickedHex; // picker — caller handles pickColor
      redraw();
    }
    return null;
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
      setSelectionState({ ...newSel });
      redraw();
      return;
    }

    if (tool === "select-lasso") {
      lassoPathRef.current.push({ x, y });
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
        const pickedHex = applyFreehand(
          Math.round(last.x + (ddx * i) / steps),
          Math.round(last.y + (ddy * i) / steps),
        );
        if (pickedHex) return pickedHex;
      }
      redraw();
    }
    lastPixel.current = { x, y };
    return null;
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
      const pts = lassoPathRef.current;
      lassoPathRef.current = [];
      if (pts.length >= 3) {
        const mask = buildLassoMask(pts, canvasW, canvasH);
        lassoMaskRef.current = mask;
        let minX = canvasW,
          maxX = 0,
          minY = canvasH,
          maxY = 0;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const newSel = {
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
          poly: pts,
        };
        selectionRef.current = newSel;
        setSelectionState(newSel);
      } else {
        selectionRef.current = null;
        lassoMaskRef.current = null;
        setSelectionState(null);
      }
      lastPixel.current = null;
      startPixel.current = null;
      return;
    }

    if (tool === "select-rect") {
      const { x, y } = getCanvasCoords(e);
      const { x: sx, y: sy } = startPixel.current;
      const lx = Math.min(sx, x),
        ty = Math.min(sy, y);
      const newSel = {
        x: lx,
        y: ty,
        w: Math.abs(x - sx) + 1,
        h: Math.abs(y - sy) + 1,
      };
      selectionRef.current = newSel;
      setSelectionState(newSel);
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

  // ── Selection clipboard ────────────────────────────────────────────────────
  function copySelection() {
    const sel = selectionRef.current;
    if (!sel) return;
    const { x: sx, y: sy, w: sw, h: sh } = sel;
    const src = pixelsRef.current;
    const buf = new Uint8ClampedArray(sw * sh * 4);
    for (let dy = 0; dy < sh; dy++) {
      for (let dx = 0; dx < sw; dx++) {
        if (
          lassoMaskRef.current &&
          !lassoMaskRef.current[(sy + dy) * canvasW + (sx + dx)]
        )
          continue;
        const si = ((sy + dy) * canvasW + (sx + dx)) * 4;
        const di = (dy * sw + dx) * 4;
        buf[di] = src[si];
        buf[di + 1] = src[si + 1];
        buf[di + 2] = src[si + 2];
        buf[di + 3] = src[si + 3];
      }
    }
    clipboardRef.current = { pixels: buf, w: sw, h: sh };
  }

  function pasteSelection() {
    const clip = clipboardRef.current;
    if (!clip) return;
    const { pixels, w: cw, h: ch } = clip;
    const px = Math.max(0, Math.floor((canvasW - cw) / 2));
    const py = Math.max(0, Math.floor((canvasH - ch) / 2));
    const dst = pixelsRef.current;
    for (let dy = 0; dy < ch; dy++) {
      for (let dx = 0; dx < cw; dx++) {
        const nx = px + dx,
          ny = py + dy;
        if (nx >= canvasW || ny >= canvasH) continue;
        const si = (dy * cw + dx) * 4;
        const di = (ny * canvasW + nx) * 4;
        const sa = pixels[si + 3] / 255;
        const da = dst[di + 3] / 255;
        const oa = sa + da * (1 - sa);
        if (oa === 0) {
          dst[di] = dst[di + 1] = dst[di + 2] = dst[di + 3] = 0;
        } else {
          dst[di] = Math.round(
            (pixels[si] * sa + dst[di] * da * (1 - sa)) / oa,
          );
          dst[di + 1] = Math.round(
            (pixels[si + 1] * sa + dst[di + 1] * da * (1 - sa)) / oa,
          );
          dst[di + 2] = Math.round(
            (pixels[si + 2] * sa + dst[di + 2] * da * (1 - sa)) / oa,
          );
          dst[di + 3] = Math.round(oa * 255);
        }
      }
    }
    lassoMaskRef.current = null;
    const newSel = {
      x: px,
      y: py,
      w: Math.min(cw, canvasW - px),
      h: Math.min(ch, canvasH - py),
    };
    selectionRef.current = newSel;
    setSelectionState(newSel);
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function deleteSelectionContents() {
    const sel = selectionRef.current;
    if (!sel) return;
    for (let dy = 0; dy < sel.h; dy++) {
      for (let dx = 0; dx < sel.w; dx++) {
        if (
          lassoMaskRef.current &&
          !lassoMaskRef.current[(sel.y + dy) * canvasW + (sel.x + dx)]
        )
          continue;
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
  }

  function cropToSelection() {
    const sel = selectionRef.current;
    if (!sel) return;
    const { x: sx, y: sy, w: sw, h: sh } = sel;
    const cropped = {};
    for (const [lid, data] of Object.entries(layerDataRef.current)) {
      const buf = new Uint8ClampedArray(sw * sh * 4);
      for (let dy = 0; dy < sh; dy++) {
        for (let dx = 0; dx < sw; dx++) {
          const si = ((sy + dy) * canvasW + (sx + dx)) * 4;
          const di = (dy * sw + dx) * 4;
          buf[di] = data[si];
          buf[di + 1] = data[si + 1];
          buf[di + 2] = data[si + 2];
          buf[di + 3] = data[si + 3];
        }
      }
      cropped[lid] = buf;
    }
    pendingResizeDataRef.current = cropped;
    selectionRef.current = null;
    setSelectionState(null);
    setCanvasW(sw);
    setCanvasH(sh);
  }

  // ── Transform ──────────────────────────────────────────────────────────────
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
    // dst is interpreted as h-wide × w-tall (dimensions swap on rotation)
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
    if (w !== h) {
      // Non-square: canvas dimensions swap — use the resize path so the
      // renderer knows the new width/height (same pattern as cropToSelection)
      pendingResizeDataRef.current = { [activeLayerIdRef.current]: dst };
      setCanvasW(h);
      setCanvasH(w);
    } else {
      pixelsRef.current = dst;
      layerDataRef.current[activeLayerIdRef.current] = dst;
      pushHistoryEntry();
      redraw();
      saveToProject();
    }
  }

  function rotateCCW() {
    const w = canvasW,
      h = canvasH,
      src = pixelsRef.current;
    // dst is interpreted as h-wide × w-tall (dimensions swap on rotation)
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
    if (w !== h) {
      pendingResizeDataRef.current = { [activeLayerIdRef.current]: dst };
      setCanvasW(h);
      setCanvasH(w);
    } else {
      pixelsRef.current = dst;
      layerDataRef.current[activeLayerIdRef.current] = dst;
      pushHistoryEntry();
      redraw();
      saveToProject();
    }
  }

  return {
    selection,
    selectionRef,
    lassoPathRef,
    lassoMaskRef,
    marchOffsetRef,
    marchingAntsRef,
    clipboardRef,
    isDrawing,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    copySelection,
    pasteSelection,
    deleteSelectionContents,
    cropToSelection,
    flipH,
    flipV,
    rotateCW,
    rotateCCW,
    setSelection: _setSelection,
  };
}
