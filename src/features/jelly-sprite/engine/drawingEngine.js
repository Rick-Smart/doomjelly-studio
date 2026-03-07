/**
 * drawingEngine.js
 *
 * Creates and returns pointer-event handlers that paint into refs.pixelBuffers,
 * manage selection, and call refs.redraw() after every change.
 *
 * Design rules:
 * - Never closes over React state. All state is read from refs.stateRef.current.
 * - All pixel mutations go through pixelOps helpers.
 * - Calls refs.onStrokeComplete() on stroke completion (history + thumbnail + dispatch).
 * - Does NOT touch React setState — that is handled by the returned
 *   { getSelection } helper which JellySpriteBody uses to sync React state.
 *
 * Wired once from useCanvas (after buffers + renderer are ready):
 *
 *   const engine = createDrawingEngine(refs);
 *   refs.drawingEngine = engine;
 *
 * The canvas element calls:
 *   engine.onPointerDown(e)
 *   engine.onPointerMove(e)
 *   engine.onPointerUp(e)
 *   engine.onPointerLeave(e)
 */

import {
  hexToRgba,
  rgbaToHex,
  getPixel,
  stampBrush,
  sprayBrush,
  floodFill,
  drawLine,
  drawRect,
  drawEllipse,
  magicWandBounds,
  copyRegion,
  pasteRegion,
} from "./pixelOps.js";
import { buildLassoMask } from "../jellySprite.utils.js";

// ── Internal helpers ──────────────────────────────────────────────────────────

function canvasCoords(e, canvasEl, zoom, w, h) {
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(w - 1, Math.floor((e.clientX - rect.left) / zoom))),
    y: Math.max(0, Math.min(h - 1, Math.floor((e.clientY - rect.top) / zoom))),
  };
}

/**
 * Derive a brush-dab context object from current refs state.
 * Passed to stampBrush / paintWithSymmetry / sprayBrush.
 */
function makeBrushCtx(refs) {
  const st = refs.stateRef.current;
  const layers = st.layers;
  const activeLayerId = st.activeLayerId;
  const editingMaskId = st.editingMaskId ?? null;

  return {
    buf: refs.pixelBuffers[activeLayerId] ?? null,
    maskBuf: editingMaskId ? refs.maskBuffers[editingMaskId] : null,
    editingMaskId,
    brushType: st.brushType,
    brushSize: st.brushSize,
    symmetryH: st.symmetryH,
    symmetryV: st.symmetryV,
    w: st.canvasW,
    h: st.canvasH,
    sel: refs.selection ?? null,
    lassoMask: refs.selectionMask ?? null,
  };
}

function getActiveRgba(refs) {
  const st = refs.stateRef.current;
  return hexToRgba(
    st.fgColor,
    Math.round(st.fgAlpha * (st.brushOpacity / 100) * 255),
  );
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createDrawingEngine(refs) {
  // Per-stroke working state (private, not in refs)
  let isDrawing = false;
  let startPx = null; // { x, y } — stroke start pixel
  let lastPx = null; // { x, y } — last seen pixel (for interpolation)
  let previewSnap = null; // Uint8ClampedArray copy taken before shape preview
  let moveOrigin = null; // { x, y, selX, selY } — for selection move
  let movePixels = null; // Uint8ClampedArray — lifted selection pixels

  // Notify listeners when selection changes (used to sync React state)
  const selListeners = [];
  function setSelection(val) {
    refs.selection = val;
    for (const fn of selListeners) fn(val);
  }

  // ── Single-coord apply ─────────────────────────────────────────────────────
  function applyFreehand(x, y) {
    const st = refs.stateRef.current;
    const tool = st.tool;
    if (tool === "pencil") {
      stampBrush(makeBrushCtx(refs), x, y, getActiveRgba(refs));
    } else if (tool === "eraser") {
      stampBrush(makeBrushCtx(refs), x, y, [0, 0, 0, 0]);
    } else if (tool === "spray") {
      sprayBrush(makeBrushCtx(refs), x, y, getActiveRgba(refs));
    } else if (tool === "fill") {
      const bctx = makeBrushCtx(refs);
      floodFill(
        bctx.buf,
        x,
        y,
        bctx.w,
        bctx.h,
        getActiveRgba(refs),
        refs.selection,
        refs.selectionMask,
      );
    } else if (tool === "picker") {
      const activeLayerId = st.activeLayerId;
      const buf = refs.pixelBuffers[activeLayerId];
      if (!buf) return null;
      const [r, g, b, a] = getPixel(buf, x, y, st.canvasW);
      if (a > 0) return rgbaToHex(r, g, b); // caller picks the colour
    }
    return null;
  }

  // ── Shape preview helper ───────────────────────────────────────────────────
  function previewShape(x0, y0, x1, y1) {
    if (!previewSnap) return;
    const st = refs.stateRef.current;
    const buf = refs.pixelBuffers[st.activeLayerId];
    if (!buf) return;
    buf.set(previewSnap);

    const rgba = getActiveRgba(refs);
    const ctx = makeBrushCtx(refs);
    const tool = st.tool;

    if (tool === "line") {
      drawLine(ctx, x0, y0, x1, y1, rgba);
    } else if (tool === "rect") {
      drawRect(ctx, x0, y0, x1, y1, st.fillShapes, rgba);
    } else if (tool === "ellipse") {
      drawEllipse(ctx, x0, y0, x1, y1, st.fillShapes, rgba);
    } else if (tool === "select-rect") {
      const lx = Math.min(x0, x1),
        ty = Math.min(y0, y1);
      setSelection({
        x: lx,
        y: ty,
        w: Math.abs(x1 - x0) + 1,
        h: Math.abs(y1 - y0) + 1,
      });
    }
  }

  // ── Pointer down ───────────────────────────────────────────────────────────
  function onPointerDown(e) {
    if (e.button !== 0) return null;
    e.preventDefault();

    const st = refs.stateRef.current;
    const { canvasW: w, canvasH: h, zoom, tool } = st;
    const { x, y } = canvasCoords(e, refs.canvasEl, zoom, w, h);

    isDrawing = true;
    startPx = { x, y };
    lastPx = { x, y };

    // ── Move ────────────────────────────────────────────────────────────────
    if (tool === "move") {
      const sel = refs.selection;
      if (sel) {
        moveOrigin = { x, y, selX: sel.x, selY: sel.y };
        const buf = refs.pixelBuffers[st.activeLayerId];
        if (buf) {
          movePixels = new Uint8ClampedArray(sel.w * sel.h * 4);
          for (let dy = 0; dy < sel.h; dy++) {
            for (let dx = 0; dx < sel.w; dx++) {
              const si = ((sel.y + dy) * w + (sel.x + dx)) * 4;
              const di = (dy * sel.w + dx) * 4;
              for (let c = 0; c < 4; c++) movePixels[di + c] = buf[si + c];
              for (let c = 0; c < 4; c++) buf[si + c] = 0;
            }
          }
          previewSnap = new Uint8ClampedArray(buf);
        }
        refs.redraw?.();
      }
      return null;
    }

    // ── Shape tools: snapshot for preview ───────────────────────────────────
    if (["line", "rect", "ellipse", "select-rect"].includes(tool)) {
      if (tool === "select-rect") refs.selectionMask = null;
      const buf = refs.pixelBuffers[st.activeLayerId];
      if (buf) previewSnap = new Uint8ClampedArray(buf);
    }

    // ── Lasso ───────────────────────────────────────────────────────────────
    if (tool === "select-lasso") {
      refs.selectionMask = null;
      refs.selection = null;
      refs.lassoPath = [{ x, y }];
      return null;
    }

    // ── Magic wand ──────────────────────────────────────────────────────────
    if (tool === "select-wand") {
      refs.selectionMask = null;
      const buf = refs.pixelBuffers[st.activeLayerId];
      if (buf) {
        const bounds = magicWandBounds(buf, x, y, w, h);
        if (bounds) setSelection(bounds);
      }
      return null;
    }

    // ── Freehand tools ───────────────────────────────────────────────────────
    if (!["select-rect", "move"].includes(tool)) {
      const pickedHex = applyFreehand(x, y);
      refs.redraw?.();
      if (pickedHex) return pickedHex; // picker — caller handles color pick
    }
    return null;
  }

  // ── Pointer move ───────────────────────────────────────────────────────────
  function onPointerMove(e) {
    if (!isDrawing) return null;

    const st = refs.stateRef.current;
    const { canvasW: w, canvasH: h, zoom, tool } = st;
    const { x, y } = canvasCoords(e, refs.canvasEl, zoom, w, h);

    // ── Move ────────────────────────────────────────────────────────────────
    if (tool === "move" && moveOrigin) {
      const ddx = x - moveOrigin.x;
      const ddy = y - moveOrigin.y;
      const newSel = {
        ...refs.selection,
        x: moveOrigin.selX + ddx,
        y: moveOrigin.selY + ddy,
      };
      const buf = refs.pixelBuffers[st.activeLayerId];
      if (buf && previewSnap) {
        buf.set(previewSnap);
        const src = movePixels;
        for (let dy = 0; dy < newSel.h; dy++) {
          for (let dx = 0; dx < newSel.w; dx++) {
            const tx = newSel.x + dx,
              ty = newSel.y + dy;
            if (tx < 0 || tx >= w || ty < 0 || ty >= h) continue;
            const si = (dy * newSel.w + dx) * 4;
            const di = (ty * w + tx) * 4;
            for (let c = 0; c < 4; c++)
              buf[di + c] = src[di + c - (di - si)] ?? src[si + c];
          }
        }
        // Simpler blit
        buf.set(previewSnap);
        pasteRegion(buf, src, newSel.x, newSel.y, newSel.w, newSel.h, w, h);
      }
      setSelection({ ...newSel });
      refs.redraw?.();
      return null;
    }

    // ── Lasso ───────────────────────────────────────────────────────────────
    if (tool === "select-lasso") {
      refs.lassoPath = [...refs.lassoPath, { x, y }];
      refs.redraw?.();
      return null;
    }

    // ── Shape preview ────────────────────────────────────────────────────────
    if (["line", "rect", "ellipse", "select-rect"].includes(tool)) {
      previewShape(startPx.x, startPx.y, x, y);
      refs.redraw?.();
    } else if (lastPx && (lastPx.x !== x || lastPx.y !== y)) {
      // Interpolate between lastPx and current to avoid gaps
      const ddx = x - lastPx.x,
        ddy = y - lastPx.y;
      const steps = Math.max(Math.abs(ddx), Math.abs(ddy));
      for (let i = 0; i <= steps; i++) {
        const pickedHex = applyFreehand(
          Math.round(lastPx.x + (ddx * i) / steps),
          Math.round(lastPx.y + (ddy * i) / steps),
        );
        if (pickedHex) return pickedHex;
      }
      refs.redraw?.();
    }

    lastPx = { x, y };
    return null;
  }

  // ── Pointer up ─────────────────────────────────────────────────────────────
  function onPointerUp(e) {
    if (!isDrawing) return;
    isDrawing = false;

    const st = refs.stateRef.current;
    const { canvasW: w, canvasH: h, zoom, tool } = st;
    const { x, y } = canvasCoords(e, refs.canvasEl, zoom, w, h);

    // ── Move finalise ────────────────────────────────────────────────────────
    if (tool === "move" && moveOrigin) {
      moveOrigin = null;
      movePixels = null;
      previewSnap = null;
      (refs.onStrokeComplete ?? refs.pushHistory)?.();
      return;
    }

    // ── Lasso finalise ────────────────────────────────────────────────────────
    if (tool === "select-lasso") {
      const pts = refs.lassoPath;
      refs.lassoPath = [];
      if (pts.length >= 3) {
        const mask = buildLassoMask(pts, w, h);
        refs.selectionMask = mask;
        let minX = w,
          maxX = 0,
          minY = h,
          maxY = 0;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        setSelection({
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
          poly: pts,
        });
      } else {
        setSelection(null);
        refs.selectionMask = null;
      }
      lastPx = null;
      startPx = null;
      return;
    }

    // ── Rect select finalise ─────────────────────────────────────────────────
    if (tool === "select-rect") {
      const lx = Math.min(startPx.x, x),
        ty = Math.min(startPx.y, y);
      setSelection({
        x: lx,
        y: ty,
        w: Math.abs(x - startPx.x) + 1,
        h: Math.abs(y - startPx.y) + 1,
      });
      lastPx = null;
      startPx = null;
      previewSnap = null;
      return;
    }

    // ── Shape finalise ────────────────────────────────────────────────────────
    if (["line", "rect", "ellipse"].includes(tool)) {
      previewShape(startPx.x, startPx.y, x, y);
      previewSnap = null;
      refs.redraw?.();
    }

    lastPx = null;
    startPx = null;
    (refs.onStrokeComplete ?? refs.pushHistory)?.();
  }

  // ── Pointer leave ──────────────────────────────────────────────────────────
  function onPointerLeave() {
    if (!isDrawing) return;
    const st = refs.stateRef.current;
    if (["line", "rect", "ellipse"].includes(st.tool) && previewSnap) {
      const buf = refs.pixelBuffers[st.activeLayerId];
      if (buf) buf.set(previewSnap);
      previewSnap = null;
      refs.redraw?.();
    }
    isDrawing = false;
    lastPx = null;
    startPx = null;
    const tool = st.tool;
    if (
      !["select-rect", "select-lasso", "select-wand", "move"].includes(tool)
    ) {
      (refs.onStrokeComplete ?? refs.pushHistory)?.();
    }
  }

  // ── Clipboard / selection operations ─────────────────────────────────────
  function copySelection() {
    const sel = refs.selection;
    if (!sel) return;
    const st = refs.stateRef.current;
    const buf = refs.pixelBuffers[st.activeLayerId];
    if (!buf) return;
    refs.clipboard = copyRegion(
      buf,
      sel.x,
      sel.y,
      sel.w,
      sel.h,
      st.canvasW,
      refs.selectionMask,
    );
    refs.clipboardW = sel.w;
    refs.clipboardH = sel.h;
  }

  function pasteSelection() {
    if (!refs.clipboard) return;
    const st = refs.stateRef.current;
    const buf = refs.pixelBuffers[st.activeLayerId];
    if (!buf) return;
    const { canvasW: w, canvasH: h } = st;
    const px = Math.max(0, Math.floor(w / 2 - refs.clipboardW / 2));
    const py = Math.max(0, Math.floor(h / 2 - refs.clipboardH / 2));
    pasteRegion(
      buf,
      refs.clipboard,
      px,
      py,
      refs.clipboardW,
      refs.clipboardH,
      w,
      h,
    );
    setSelection({ x: px, y: py, w: refs.clipboardW, h: refs.clipboardH });
    (refs.onStrokeComplete ?? refs.pushHistory)?.();
    refs.redraw?.();
  }

  function deleteSelectionContents() {
    const sel = refs.selection;
    if (!sel) return;
    const st = refs.stateRef.current;
    const buf = refs.pixelBuffers[st.activeLayerId];
    if (!buf) return;
    const { canvasW: w, canvasH: h } = st;
    for (let dy = 0; dy < sel.h; dy++) {
      for (let dx = 0; dx < sel.w; dx++) {
        const px = sel.x + dx,
          py = sel.y + dy;
        if (px < 0 || px >= w || py < 0 || py >= h) continue;
        if (refs.selectionMask && !refs.selectionMask[py * w + px]) continue;
        const i = (py * w + px) * 4;
        buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
      }
    }
    (refs.onStrokeComplete ?? refs.pushHistory)?.();
    refs.redraw?.();
  }

  function cropToSelection() {
    // Phase M5+ — resize canvas to selection bounds. No-op for now.
  }

  // ── Subscribe to selection changes ────────────────────────────────────────
  function onSelectionChange(fn) {
    selListeners.push(fn);
    return () => {
      const i = selListeners.indexOf(fn);
      if (i >= 0) selListeners.splice(i, 1);
    };
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    copySelection,
    pasteSelection,
    deleteSelectionContents,
    cropToSelection,
    onSelectionChange,
    /** Read current selection rect */
    getSelection: () => refs.selection,
  };
}
