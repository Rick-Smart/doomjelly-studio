import {
  pasteRegion,
  flipHorizontal,
  flipVertical,
  rotateCW90,
  rotateCCW90,
  rotateArbitraryNearestNeighbor,
} from "../pixelOps.js";
import { getOrBuildMask, boundsFromMask } from "../selectionUtils.js";

// Internal helpers (not exported)

function commitFloating(refs, state) {
  const sel = refs.selection;
  if (!sel || !state.movePixels) return;
  const st = refs.stateRef.current;
  const { canvasW: w, canvasH: h } = st;
  const buf = refs.doc.pixelBuffers[st.activeLayerId];
  if (!buf) return;
  if (state.previewSnap) buf.set(state.previewSnap);
  pasteRegion(buf, state.movePixels, sel.x, sel.y, sel.w, sel.h, w, h);
  state.movePixels = null;
  state.previewSnap = null;
  state.movePixelsOriginal = null;
}

function ensureFloatingSelection(refs, state) {
  if (state.movePixels) return true;
  const sel = refs.selection;
  if (!sel) return false;
  const st = refs.stateRef.current;
  const { canvasW: w, canvasH: h } = st;
  const buf = refs.doc.pixelBuffers[st.activeLayerId];
  if (!buf) return false;
  state.movePixels = new Uint8ClampedArray(sel.w * sel.h * 4);
  for (let dy = 0; dy < sel.h; dy++) {
    for (let dx = 0; dx < sel.w; dx++) {
      const si = ((sel.y + dy) * w + (sel.x + dx)) * 4;
      const di = (dy * sel.w + dx) * 4;
      if (
        refs.selectionMask &&
        !refs.selectionMask[(sel.y + dy) * w + (sel.x + dx)]
      ) {
        for (let c = 0; c < 4; c++) state.movePixels[di + c] = 0;
      } else {
        for (let c = 0; c < 4; c++) state.movePixels[di + c] = buf[si + c];
        for (let c = 0; c < 4; c++) buf[si + c] = 0;
      }
    }
  }
  state.previewSnap = new Uint8ClampedArray(buf);
  state.movePixelsOriginal = new Uint8ClampedArray(state.movePixels);
  state.moveOriginalW = sel.w;
  state.moveOriginalH = sel.h;
  state.moveOriginalCx = sel.x + sel.w / 2;
  state.moveOriginalCy = sel.y + sel.h / 2;
  refs.selectionMaskOrigin = { x: sel.x, y: sel.y };
  return true;
}

function applyFloatingTransform(
  refs,
  state,
  setSelection,
  newPixels,
  newW,
  newH,
) {
  const sel = refs.selection;
  if (!sel) return;
  state.movePixels = newPixels;
  const cx = sel.x + sel.w / 2;
  const cy = sel.y + sel.h / 2;
  const newSel = {
    x: Math.round(cx - newW / 2),
    y: Math.round(cy - newH / 2),
    w: newW,
    h: newH,
  };
  refs.selectionMask = null;
  refs.selectionMaskOrigin = { x: newSel.x, y: newSel.y };
  setSelection(newSel, true); // fromMove=true — keep movePixels alive
  const st = refs.stateRef.current;
  const { canvasW: w, canvasH: h } = st;
  const buf = refs.doc.pixelBuffers[st.activeLayerId];
  if (buf && state.previewSnap) {
    buf.set(state.previewSnap);
    pasteRegion(buf, newPixels, newSel.x, newSel.y, newW, newH, w, h);
  }
  refs.redraw?.();
}

// Exported operations

/**
 * Invert the current selection mask. Commits any floating selection first.
 */
export function invertSelection(refs, state, setSelection) {
  const st = refs.stateRef.current;
  const { canvasW: w, canvasH: h } = st;
  if (state.movePixels) {
    commitFloating(refs, state);
    (refs.onStrokeComplete ?? refs.pushHistory)?.();
  }
  const existing = getOrBuildMask(refs, w, h);
  if (!existing) return;
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inv[i] = existing[i] ? 0 : 1;
  refs.selectionMask = inv;
  const bounds = boundsFromMask(inv, w, h);
  if (bounds) {
    setSelection(bounds);
  } else {
    refs.selectionMask = null;
    setSelection(null);
  }
  refs.redraw?.();
}

/** Flip the floating selection (or canvas region) horizontally. */
export function flipSelH(refs, state, setSelection) {
  if (!ensureFloatingSelection(refs, state)) return;
  const sel = refs.selection;
  const newPixels = new Uint8ClampedArray(state.movePixels);
  flipHorizontal(newPixels, sel.w, sel.h);
  applyFloatingTransform(refs, state, setSelection, newPixels, sel.w, sel.h);
  state.movePixelsOriginal = new Uint8ClampedArray(newPixels);
}

/** Flip the floating selection (or canvas region) vertically. */
export function flipSelV(refs, state, setSelection) {
  if (!ensureFloatingSelection(refs, state)) return;
  const sel = refs.selection;
  const newPixels = new Uint8ClampedArray(state.movePixels);
  flipVertical(newPixels, sel.w, sel.h);
  applyFloatingTransform(refs, state, setSelection, newPixels, sel.w, sel.h);
  state.movePixelsOriginal = new Uint8ClampedArray(newPixels);
}

/** Rotate the floating selection (or canvas region) 90° clockwise. */
export function rotateSel90CW(refs, state, setSelection) {
  if (!ensureFloatingSelection(refs, state)) return;
  const sel = refs.selection;
  const newPixels = rotateCW90(state.movePixels, sel.w, sel.h);
  applyFloatingTransform(refs, state, setSelection, newPixels, sel.h, sel.w);
  state.movePixelsOriginal = new Uint8ClampedArray(newPixels);
  state.moveOriginalW = sel.h;
  state.moveOriginalH = sel.w;
  const ns = refs.selection;
  state.moveOriginalCx = ns.x + ns.w / 2;
  state.moveOriginalCy = ns.y + ns.h / 2;
}

/** Rotate the floating selection (or canvas region) 90° counter-clockwise. */
export function rotateSel90CCW(refs, state, setSelection) {
  if (!ensureFloatingSelection(refs, state)) return;
  const sel = refs.selection;
  const newPixels = rotateCCW90(state.movePixels, sel.w, sel.h);
  applyFloatingTransform(refs, state, setSelection, newPixels, sel.h, sel.w);
  state.movePixelsOriginal = new Uint8ClampedArray(newPixels);
  state.moveOriginalW = sel.h;
  state.moveOriginalH = sel.w;
  const ns = refs.selection;
  state.moveOriginalCx = ns.x + ns.w / 2;
  state.moveOriginalCy = ns.y + ns.h / 2;
}

/**
 * Rotate the floating selection by an arbitrary angle (nearest-neighbour).
 * Always resamples from movePixelsOriginal so slider scrubbing applies no
 * compounding quality loss.
 */
export function rotateSelArbitrary(refs, state, setSelection, deg) {
  if (!ensureFloatingSelection(refs, state)) return;
  if (!state.movePixelsOriginal) return;
  const { newBuf, newW, newH } = rotateArbitraryNearestNeighbor(
    state.movePixelsOriginal,
    state.moveOriginalW,
    state.moveOriginalH,
    deg,
  );
  const newSel = {
    x: Math.round(state.moveOriginalCx - newW / 2),
    y: Math.round(state.moveOriginalCy - newH / 2),
    w: newW,
    h: newH,
  };
  state.movePixels = newBuf;
  const st = refs.stateRef.current;
  const { canvasW: cw, canvasH: ch } = st;
  const rotMask = new Uint8Array(cw * ch);
  for (let my = 0; my < newH; my++) {
    for (let mx = 0; mx < newW; mx++) {
      if (newBuf[(my * newW + mx) * 4 + 3] > 0) {
        const cpx = newSel.x + mx;
        const cpy = newSel.y + my;
        if (cpx >= 0 && cpx < cw && cpy >= 0 && cpy < ch)
          rotMask[cpy * cw + cpx] = 1;
      }
    }
  }
  refs.selectionMask = rotMask;
  refs.selectionMaskOrigin = { x: newSel.x, y: newSel.y };
  refs.selectionMaskPath = null;
  setSelection(newSel, true);
  const buf = refs.doc.pixelBuffers[st.activeLayerId];
  if (buf && state.previewSnap) {
    buf.set(state.previewSnap);
    pasteRegion(buf, newBuf, newSel.x, newSel.y, newW, newH, cw, ch);
  }
  refs.redraw?.();
  // NOTE: movePixelsOriginal intentionally NOT updated here —
  // the rotation slider always resamples from the pre-rotation source.
}
