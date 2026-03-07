/**
 * One-shot patch script for drawingEngine.js
 * Run: node scripts/patch-drawing-engine.js
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(
  __dirname,
  "../src/features/jelly-sprite/engine/drawingEngine.js",
);
const src = fs.readFileSync(FILE, "utf8");

// Normalise to LF for processing, restore CRLF at end
const hasCRLF = src.includes("\r\n");
let code = hasCRLF ? src.replace(/\r\n/g, "\n") : src;

// ── 1. Insert helper functions after canvasCoords closing } ──────────────────
const HELPERS = `
// ── Selection mask helpers ────────────────────────────────────────────────────

function buildRectMask(sel, w, h) {
  const mask = new Uint8Array(w * h);
  const x1 = Math.max(0, sel.x), y1 = Math.max(0, sel.y);
  const x2 = Math.min(w - 1, sel.x + sel.w - 1);
  const y2 = Math.min(h - 1, sel.y + sel.h - 1);
  for (let py = y1; py <= y2; py++)
    for (let px = x1; px <= x2; px++)
      mask[py * w + px] = 1;
  return mask;
}

function getOrBuildMask(refs, w, h) {
  if (refs.selectionMask) return new Uint8Array(refs.selectionMask);
  if (refs.selection) return buildRectMask(refs.selection, w, h);
  return null;
}

function combineMasks(existing, incoming, mode, w, h) {
  const result = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = existing ? existing[i] : 0;
    const b = incoming[i];
    if (mode === 'add') result[i] = a || b ? 1 : 0;
    else if (mode === 'subtract') result[i] = a && !b ? 1 : 0;
    else result[i] = b;
  }
  return result;
}

function boundsFromMask(mask, w, h) {
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++)
      if (mask[py * w + px]) {
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
      }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
`;

// Find the end of canvasCoords (the } that closes it, not indented)
code = code.replace(
  /(function canvasCoords[\s\S]*?\n})\n/,
  "$1\n" + HELPERS + "\n",
);

// ── 2. Add selMode variable next to movePixels declaration ───────────────────
code = code.replace(
  "  let movePixels = null; // Uint8ClampedArray — lifted selection pixels\n",
  "  let movePixels = null; // Uint8ClampedArray — lifted selection pixels\n" +
    '  let selMode = \'replace\'; // "replace" | "add" | "subtract" — set from modifier keys on pointer-down\n',
);

// ── 3. Set selMode at start of onPointerDown ─────────────────────────────────
code = code.replace(
  "    isDrawing = true;\n    startPx = { x, y };",
  "    selMode = e.shiftKey ? 'add' : e.altKey ? 'subtract' : 'replace';\n    isDrawing = true;\n    startPx = { x, y };",
);

// ── 4. Shape snapshot: only clear selectionMask in replace mode ──────────────
code = code.replace(
  "      if (tool === 'select-rect') refs.selectionMask = null;\n",
  "      if (tool === 'select-rect' && selMode === 'replace') refs.selectionMask = null;\n",
);

// ── 5. Lasso pointer-down: respect selMode ───────────────────────────────────
code = code.replace(
  "    if (tool === 'select-lasso') {\n      refs.selectionMask = null;\n      refs.selection = null;\n      refs.lassoPath = [{ x, y }];\n      return null;\n    }",
  `    if (tool === 'select-lasso') {
      if (selMode === 'replace') {
        refs.selectionMask = null;
        refs.selection = null;
      }
      refs.lassoPath = [{ x, y }];
      return null;
    }`,
);

// ── 6. Wand pointer-down: respect selMode ────────────────────────────────────
code = code.replace(
  `    if (tool === 'select-wand') {
      refs.selectionMask = null;
      const buf = refs.pixelBuffers[st.activeLayerId];
      if (buf) {
        const bounds = magicWandBounds(buf, x, y, w, h);
        if (bounds) setSelection(bounds);
      }
      return null;
    }`,
  `    if (tool === 'select-wand') {
      const buf = refs.pixelBuffers[st.activeLayerId];
      if (buf) {
        const bounds = magicWandBounds(buf, x, y, w, h);
        if (bounds) {
          if (selMode === 'replace') {
            refs.selectionMask = null;
            setSelection(bounds);
          } else {
            const newMask = buildRectMask(bounds, w, h);
            const existing = getOrBuildMask(refs, w, h);
            const combined = combineMasks(existing, newMask, selMode, w, h);
            refs.selectionMask = combined;
            const newBounds = boundsFromMask(combined, w, h);
            if (newBounds) { setSelection({ ...newBounds }); }
            else { refs.selectionMask = null; setSelection(null); }
          }
        }
      }
      refs.redraw?.();
      return null;
    }`,
);

// ── 7. previewShape select-rect: skip setSelection in add/subtract mode ───────
code = code.replace(
  `    } else if (tool === 'select-rect') {
      const lx = Math.min(x0, x1),
        ty = Math.min(y0, y1);
      setSelection({
        x: lx,
        y: ty,
        w: Math.abs(x1 - x0) + 1,
        h: Math.abs(y1 - y0) + 1,
      });
    }`,
  `    } else if (tool === 'select-rect') {
      if (selMode === 'replace') {
        const lx = Math.min(x0, x1), ty = Math.min(y0, y1);
        setSelection({ x: lx, y: ty, w: Math.abs(x1 - x0) + 1, h: Math.abs(y1 - y0) + 1 });
      }
    }`,
);

// ── 8. Lasso pointer-up finalize: respect selMode ─────────────────────────────
code = code.replace(
  `    if (tool === 'select-lasso') {
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
    }`,
  `    if (tool === 'select-lasso') {
      const pts = refs.lassoPath;
      refs.lassoPath = [];
      if (pts.length >= 3) {
        const newMask = buildLassoMask(pts, w, h);
        if (selMode === 'replace') {
          refs.selectionMask = newMask;
          let minX = w, maxX = 0, minY = h, maxY = 0;
          for (const p of pts) {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
          }
          setSelection({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, poly: pts });
        } else {
          const existing = getOrBuildMask(refs, w, h);
          const combined = combineMasks(existing, newMask, selMode, w, h);
          refs.selectionMask = combined;
          const bounds = boundsFromMask(combined, w, h);
          if (bounds) { setSelection({ ...bounds }); }
          else { refs.selectionMask = null; setSelection(null); }
        }
      } else {
        if (selMode === 'replace') { setSelection(null); refs.selectionMask = null; }
      }
      lastPx = null;
      startPx = null;
      return;
    }`,
);

// ── 9. Rect select pointer-up finalize: respect selMode ──────────────────────
code = code.replace(
  `    if (tool === 'select-rect') {
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
    }`,
  `    if (tool === 'select-rect') {
      const lx = Math.min(startPx.x, x), ty = Math.min(startPx.y, y);
      const newSel = { x: lx, y: ty, w: Math.abs(x - startPx.x) + 1, h: Math.abs(y - startPx.y) + 1 };
      if (selMode === 'replace') {
        refs.selectionMask = null;
        setSelection(newSel);
      } else {
        const newMask = buildRectMask(newSel, w, h);
        const existing = getOrBuildMask(refs, w, h);
        const combined = combineMasks(existing, newMask, selMode, w, h);
        refs.selectionMask = combined;
        const bounds = boundsFromMask(combined, w, h);
        if (bounds) { setSelection({ ...bounds }); }
        else { refs.selectionMask = null; setSelection(null); }
      }
      lastPx = null;
      startPx = null;
      previewSnap = null;
      selMode = 'replace';
      return;
    }`,
);

// ── 10. Reset selMode at end of onPointerUp (before onStrokeComplete) ─────────
code = code.replace(
  "    lastPx = null;\n    startPx = null;\n    (refs.onStrokeComplete ?? refs.pushHistory)?.();\n  }\n\n  // ",
  "    lastPx = null;\n    startPx = null;\n    selMode = 'replace';\n    (refs.onStrokeComplete ?? refs.pushHistory)?.();\n  }\n\n  // ",
);

// Restore line endings
if (hasCRLF) code = code.replace(/\n/g, "\r\n");
fs.writeFileSync(FILE, code, "utf8");
console.log("Patch applied. File size:", code.length);
