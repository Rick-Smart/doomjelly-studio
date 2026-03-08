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
  magicWandMask,
  pasteRegion,
} from "./pixelOps.js";
import {
  buildLassoMask,
  bresenhamLine,
  buildRectMask,
  getOrBuildMask,
  combineMasks,
  boundsFromMask,
} from "./selectionUtils.js";
import * as clipboardOps from "./tools/clipboardOps.js";
import * as selOps from "./tools/selectionOps.js";

// ── Internal helpers ──────────────────────────────────────────────────────────

function canvasCoords(e, canvasEl, zoom, w, h) {
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(w - 1, Math.floor((e.clientX - rect.left) / zoom))),
    y: Math.max(0, Math.min(h - 1, Math.floor((e.clientY - rect.top) / zoom))),
  };
}

// ── Brush context ─────────────────────────────────────────────────────────────
/**
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
  // Pointer-handler-only transient state.
  let isDrawing = false;
  let startPx = null;    // { x, y } — stroke start pixel
  let lastPx = null;     // { x, y } — last seen pixel (for interpolation)
  let moveOrigin = null; // { x, y, selX, selY } — for selection move
  let selMode = "replace"; // "replace" | "add" | "subtract" — set on pointer-down
  // Lasso drag state (typed-buffer, zero hot-path allocation).
  // Preallocated once; resized only when canvas is larger than previous alloc.
  let lassoXY = new Int16Array(0); // interleaved Int16 [x0,y0, x1,y1, ...]
  let lassoXYLen = 0;    // logical point count (not byte count)
  let lassoLastPx = null;
  let lassoStartPx = null;
  let lassoPath2D = null;

  // Floating-selection state shared with selectionOps tool module.
  // previewSnap = canvas snapshot with floating pixels erased (background).
  const state = {
    previewSnap: null,
    movePixels: null,
    movePixelsOriginal: null,
    moveOriginalW: 0,
    moveOriginalH: 0,
    moveOriginalCx: 0,
    moveOriginalCy: 0,
  };

  // Notify listeners when selection changes (used to sync React state)
  const selListeners = [];
  // fromMove=true means the move tool itself is updating the selection mid-drag;
  // skip clearing movePixels in that case. Any other caller (selection tools,
  // deselect) sets fromMove=false (default), which commits the lift.
  function setSelection(val, fromMove = false) {
    refs.selection = val;
    refs.selectionMaskPath = null; // invalidate Path2D edge cache
    if (!fromMove) {
      state.movePixels = null;
      state.movePixelsOriginal = null;
      // NOTE: do NOT clear previewSnap here — previewShape calls setSelection
      // on every pointer-move event to update the live selection rect preview,
      // and nulling previewSnap would cause previewShape to return early on the
      // very next frame and freeze the marching ants mid-drag.
      // previewSnap is set fresh in onPointerDown for every new stroke.
      // Record where the mask lives so buildMaskEdgePath can offset correctly
      // when the move tool translates the selection away from its origin.
      refs.selectionMaskOrigin = val ? { x: val.x, y: val.y } : null;
    }
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
    if (!state.previewSnap) return;
    const st = refs.stateRef.current;
    const buf = refs.pixelBuffers[st.activeLayerId];
    if (!buf) return;
    buf.set(state.previewSnap);

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
      // In add/subtract mode, don't update the committed selection during drag;
      // instead expose a preview rect so the renderer shows progress.
      if (selMode === "replace") {
        const lx = Math.min(x0, x1),
          ty = Math.min(y0, y1);
        setSelection({
          x: lx,
          y: ty,
          w: Math.abs(x1 - x0) + 1,
          h: Math.abs(y1 - y0) + 1,
        });
      } else {
        refs.selectionPreviewRect = {
          x: Math.min(x0, x1),
          y: Math.min(y0, y1),
          w: Math.abs(x1 - x0) + 1,
          h: Math.abs(y1 - y0) + 1,
        };
      }
    }
  }

  // ── Pointer down ───────────────────────────────────────────────────────────
  function onPointerDown(e) {
    if (e.button !== 0) return null;
    e.preventDefault();

    const st = refs.stateRef.current;
    const { canvasW: w, canvasH: h, zoom, tool } = st;
    const { x, y } = canvasCoords(e, refs.canvasEl, zoom, w, h);

    selMode = e.shiftKey ? "add" : e.altKey ? "subtract" : "replace";
    isDrawing = true;
    startPx = { x, y };
    lastPx = { x, y };

    // ── Move ────────────────────────────────────────────────────────────────
    if (tool === "move") {
      const sel = refs.selection;
      if (sel) {
        moveOrigin = { x, y, selX: sel.x, selY: sel.y };
        const buf = refs.pixelBuffers[st.activeLayerId];
        if (buf && !state.movePixels) {
          // First drag: lift pixels out of the canvas buffer.
          state.movePixels = new Uint8ClampedArray(sel.w * sel.h * 4);
          for (let dy = 0; dy < sel.h; dy++) {
            for (let dx = 0; dx < sel.w; dx++) {
              const si = ((sel.y + dy) * w + (sel.x + dx)) * 4;
              const di = (dy * sel.w + dx) * 4;
              if (
                refs.selectionMask &&
                !refs.selectionMask[(sel.y + dy) * w + (sel.x + dx)]
              ) {
                // Pixel outside mask — leave on canvas, store transparent
                for (let c = 0; c < 4; c++) state.movePixels[di + c] = 0;
              } else {
                for (let c = 0; c < 4; c++) state.movePixels[di + c] = buf[si + c];
                for (let c = 0; c < 4; c++) buf[si + c] = 0;
              }
            }
          }
          state.previewSnap = new Uint8ClampedArray(buf);
          // Store the pristine original so selection transform ops can
          // resample from it without compounding quality loss.
          state.movePixelsOriginal = new Uint8ClampedArray(state.movePixels);
          state.moveOriginalW = sel.w;
          state.moveOriginalH = sel.h;
          state.moveOriginalCx = sel.x + sel.w / 2;
          state.moveOriginalCy = sel.y + sel.h / 2;
        } else if (buf && state.movePixels) {
          // Subsequent drag: reuse the previewSnap from the first lift.
          // That snapshot already has the selected pixels erased, so it IS the
          // correct "canvas without floating pixels" background.  Rebuilding
          // from buf would erase blended background pixels at the drop position
          // (the "kneaded eraser" accumulation bug).
          if (!state.previewSnap) {
            // Safety fallback: only reached if previewSnap was cleared between
            // drags (e.g. undo/redo). Rebuild by zeroing the selection region.
            state.previewSnap = new Uint8ClampedArray(buf);
            const sel = refs.selection;
            for (let dy = 0; dy < sel.h; dy++) {
              for (let dx = 0; dx < sel.w; dx++) {
                const px = sel.x + dx,
                  py = sel.y + dy;
                if (px < 0 || px >= w || py < 0 || py >= h) continue;
                if (refs.selectionMask && !refs.selectionMask[py * w + px])
                  continue;
                const i = (py * w + px) * 4;
                state.previewSnap[i] =
                  state.previewSnap[i + 1] =
                  state.previewSnap[i + 2] =
                  state.previewSnap[i + 3] =
                    0;
              }
            }
          }
        }
        refs.redraw?.();
      }
      return null;
    }

    // ── Shape tools: snapshot for preview ───────────────────────────────────
    if (["line", "rect", "ellipse", "select-rect"].includes(tool)) {
      if (tool === "select-rect" && selMode === "replace")
        refs.selectionMask = null;
      refs.selectionPreviewRect = null; // clear stale add/subtract preview
      const buf = refs.pixelBuffers[st.activeLayerId];
      if (buf) state.previewSnap = new Uint8ClampedArray(buf);
    }

    // ── Lasso ───────────────────────────────────────────────────────────────
    if (tool === "select-lasso") {
      if (selMode === "replace") {
        refs.selectionMask = null;
        refs.selection = null;
      }
      // Ensure typed buffer is large enough for worst-case perimeter.
      // A 256×256 canvas has at most 65536 canvas pixels ≈ worst lasso length.
      const maxPts = w * h;
      if (lassoXY.length < maxPts * 2) lassoXY = new Int16Array(maxPts * 2);
      lassoXY[0] = x;
      lassoXY[1] = y;
      lassoXYLen = 1;
      lassoLastPx = { x, y };
      lassoStartPx = { x, y };
      lassoPath2D = new Path2D();
      lassoPath2D.moveTo((x + 0.5) * zoom, (y + 0.5) * zoom);
      // Expose to renderer
      refs.lassoPath2D = lassoPath2D;
      refs.lassoStartPx = lassoStartPx;
      refs.lassoXY = lassoXY;
      refs.lassoXYLen = 0; // renderer uses lassoXYLen > 0 to skip vs draw
      return null;
    }

    // ── Magic wand ──────────────────────────────────────────────────────────
    if (tool === "select-wand") {
      const buf = refs.pixelBuffers[st.activeLayerId];
      if (buf) {
        const wandMask = magicWandMask(buf, x, y, w, h);
        if (wandMask) {
          if (selMode === "replace") {
            refs.selectionMask = wandMask;
            const bounds = boundsFromMask(wandMask, w, h);
            if (bounds) setSelection(bounds);
          } else {
            const existing = getOrBuildMask(refs, w, h);
            const combined = combineMasks(existing, wandMask, selMode, w, h);
            refs.selectionMask = combined;
            const newBounds = boundsFromMask(combined, w, h);
            if (newBounds) {
              setSelection({ ...newBounds });
            } else {
              refs.selectionMask = null;
              setSelection(null);
            }
          }
        }
      }
      refs.redraw?.();
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
      if (buf && state.previewSnap) {
        buf.set(state.previewSnap);
        pasteRegion(
          buf,
          state.movePixels,
          newSel.x,
          newSel.y,
          newSel.w,
          newSel.h,
          w,
          h,
        );
      }
      setSelection({ ...newSel }, true); // fromMove=true: keep movePixels alive
      refs.redraw?.();
      return null;
    }

    // ── Lasso ───────────────────────────────────────────────────────────────
    if (tool === "select-lasso" && lassoLastPx) {
      const { canvasW: lw, canvasH: lh, zoom: lz } = st;
      // Bresenham-connect last stored pixel to current to fill skipped pixels
      // (fast drags at low zoom skip integer coords between events).
      bresenhamLine(lassoLastPx.x, lassoLastPx.y, x, y, (bx, by) => {
        // Dedup: skip if identical to the last stored point
        const li = (lassoXYLen - 1) * 2;
        if (lassoXYLen > 0 && lassoXY[li] === bx && lassoXY[li + 1] === by)
          return;
        if (lassoXYLen * 2 >= lassoXY.length) return; // guard (shouldn't happen)
        lassoXY[lassoXYLen * 2] = bx;
        lassoXY[lassoXYLen * 2 + 1] = by;
        lassoXYLen++;
        lassoPath2D.lineTo((bx + 0.5) * lz, (by + 0.5) * lz);
      });
      lassoLastPx = { x, y };
      // Expose current length so renderer can draw the snap indicator correctly
      refs.lassoXYLen = lassoXYLen;
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
      // Translate the selection mask to its new absolute canvas position.
      // This keeps refs.selectionMask in sync with where the pixels actually
      // are now, so that subsequent operations (second-drag erase, add/subtract
      // on a moved selection, etc.) all use correct canvas-current coordinates.
      if (refs.selectionMask && refs.selectionMaskOrigin && refs.selection) {
        const dx = refs.selection.x - refs.selectionMaskOrigin.x;
        const dy = refs.selection.y - refs.selectionMaskOrigin.y;
        if (dx !== 0 || dy !== 0) {
          const newMask = new Uint8Array(w * h);
          for (let py = 0; py < h; py++) {
            for (let px = 0; px < w; px++) {
              if (refs.selectionMask[py * w + px]) {
                const npx = px + dx,
                  npy = py + dy;
                if (npx >= 0 && npx < w && npy >= 0 && npy < h)
                  newMask[npy * w + npx] = 1;
              }
            }
          }
          refs.selectionMask = newMask;
        }
      }
      // Sync origin to current position so future offset calculations start
      // from where the mask actually is.
      refs.selectionMaskOrigin = refs.selection
        ? { x: refs.selection.x, y: refs.selection.y }
        : null;
      refs.selectionMaskPath = null; // force path rebuild with translated mask

      // Keep both movePixels and previewSnap alive for the next drag.
      // previewSnap holds the canvas-without-floating-pixels background and
      // must NOT be nulled here — doing so forces a buggy rebuild that erases
      // blended background pixels at the drop position (kneaded eraser bug).
      // Both are cleared together by setSelection(val, false) when the
      // floating selection is committed or cancelled.
      moveOrigin = null;
      (refs.onStrokeComplete ?? refs.pushHistory)?.();
      return;
    }

    // ── Lasso finalise ────────────────────────────────────────────────────────
    if (tool === "select-lasso") {
      // Clear live-drag renderer state
      refs.lassoPath2D = null;
      refs.lassoStartPx = null;
      refs.lassoXYLen = 0;

      if (lassoXYLen >= 3) {
        // Build polygon array from the typed buffer (no copy — just a view walk)
        const pts = [];
        for (let i = 0; i < lassoXYLen; i++)
          pts.push({ x: lassoXY[i * 2], y: lassoXY[i * 2 + 1] });

        const newMask = buildLassoMask(pts, w, h);
        // Unified: always derive bounds from the committed mask, both modes.
        // (Old replace path used pts-loop which could disagree with scanline edges.)
        const existing =
          selMode === "replace" ? null : getOrBuildMask(refs, w, h);
        const combined = existing
          ? combineMasks(existing, newMask, selMode, w, h)
          : newMask;
        refs.selectionMask = combined;
        const bounds = boundsFromMask(combined, w, h);
        if (bounds) {
          // No poly key — marching ants always use the mask-edge Path2D walker.
          // This eliminates the open-outline seam and the replace vs combined
          // rendering inconsistency.
          setSelection({ ...bounds });
        } else {
          refs.selectionMask = null;
          setSelection(null);
        }
      } else {
        if (selMode === "replace") {
          setSelection(null);
          refs.selectionMask = null;
        }
      }

      lassoXYLen = 0;
      lassoLastPx = null;
      lassoStartPx = null;
      lassoPath2D = null;
      lastPx = null;
      startPx = null;
      return;
    }

    // ── Rect select finalise ─────────────────────────────────────────────────
    if (tool === "select-rect") {
      refs.selectionPreviewRect = null; // clear the in-drag preview
      const lx = Math.min(startPx.x, x),
        ty = Math.min(startPx.y, y);
      const newSel = {
        x: lx,
        y: ty,
        w: Math.abs(x - startPx.x) + 1,
        h: Math.abs(y - startPx.y) + 1,
      };
      if (selMode === "replace") {
        refs.selectionMask = buildRectMask(newSel, w, h);
        setSelection(newSel);
      } else {
        const newMask = buildRectMask(newSel, w, h);
        const existing = getOrBuildMask(refs, w, h);
        const combined = combineMasks(existing, newMask, selMode, w, h);
        refs.selectionMask = combined;
        const bounds = boundsFromMask(combined, w, h);
        if (bounds) {
          setSelection({ ...bounds });
        } else {
          refs.selectionMask = null;
          setSelection(null);
        }
      }
      lastPx = null;
      startPx = null;
      state.previewSnap = null;
      selMode = "replace";
      return;
    }

    // ── Shape finalise ────────────────────────────────────────────────────
    if (["line", "rect", "ellipse"].includes(tool)) {
      previewShape(startPx.x, startPx.y, x, y);
      state.previewSnap = null;
      refs.redraw?.();
    }

    lastPx = null;
    startPx = null;
    selMode = "replace";
    (refs.onStrokeComplete ?? refs.pushHistory)?.();
  }

  // ── Pointer leave ──────────────────────────────────────────────────────────
  function onPointerLeave() {
    if (!isDrawing) return;
    const st = refs.stateRef.current;
    if (["line", "rect", "ellipse"].includes(st.tool) && state.previewSnap) {
      const buf = refs.pixelBuffers[st.activeLayerId];
      if (buf) buf.set(state.previewSnap);
      state.previewSnap = null;
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

  // ── Clipboard / selection operations (delegated to tools/) ───────────────
  function copySelection() { clipboardOps.copySelection(refs); }
  function pasteSelection() { clipboardOps.pasteSelection(refs, setSelection); }
  function deleteSelectionContents() { clipboardOps.deleteSelectionContents(refs); }
  function cropToSelection() {
    // Phase M5+ — resize canvas to selection bounds. No-op for now.
  }

  // ── Selection transform operations (delegated to tools/) ─────────────────
  function invertSelection() { selOps.invertSelection(refs, state, setSelection); }
  function flipSelH() { selOps.flipSelH(refs, state, setSelection); }
  function flipSelV() { selOps.flipSelV(refs, state, setSelection); }
  function rotateSel90CW() { selOps.rotateSel90CW(refs, state, setSelection); }
  function rotateSel90CCW() { selOps.rotateSel90CCW(refs, state, setSelection); }
  function rotateSelArbitrary(deg) { selOps.rotateSelArbitrary(refs, state, setSelection, deg); }

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
    invertSelection,
    flipSelH,
    flipSelV,
    rotateSel90CW,
    rotateSel90CCW,
    rotateSelArbitrary,
    onSelectionChange,
    /** Read current selection rect */
    getSelection: () => refs.selection,
  };
}
