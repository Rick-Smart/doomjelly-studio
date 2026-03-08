/**
 * selectionUtils.js
 *
 * Pure, engine-layer helpers for selection masks and pixel-accurate line
 * drawing. No React imports; no refs; no side effects.
 *
 * Kept inside engine/ so the drawing engine can import from within its own
 * layer rather than reaching up into the feature-level utils.
 */

// ── Mask construction ─────────────────────────────────────────────────────────

/** Fill a rectangular region into a flat Uint8Array bitmask (1 = selected). */
export function buildRectMask(sel, w, h) {
  const mask = new Uint8Array(w * h);
  const x1 = Math.max(0, sel.x),
    y1 = Math.max(0, sel.y);
  const x2 = Math.min(w - 1, sel.x + sel.w - 1);
  const y2 = Math.min(h - 1, sel.y + sel.h - 1);
  for (let py = y1; py <= y2; py++)
    for (let px = x1; px <= x2; px++) mask[py * w + px] = 1;
  return mask;
}

/**
 * Return a copy of refs.selectionMask if one exists, otherwise build a
 * rect mask from refs.selection, otherwise return null.
 */
export function getOrBuildMask(refs, w, h) {
  if (refs.selectionMask) return new Uint8Array(refs.selectionMask);
  if (refs.selection) return buildRectMask(refs.selection, w, h);
  return null;
}

/**
 * Combine two bitmasks according to the selection mode.
 *  'replace'  → incoming only
 *  'add'      → union
 *  'subtract' → existing minus incoming
 */
export function combineMasks(existing, incoming, mode, w, h) {
  const result = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = existing ? existing[i] : 0;
    const b = incoming[i];
    if (mode === "add")         result[i] = a || b ? 1 : 0;
    else if (mode === "subtract") result[i] = a && !b ? 1 : 0;
    else                          result[i] = b; // replace
  }
  return result;
}

/**
 * Return the tight bounding rect of all set pixels in a bitmask, or null
 * if no pixels are set.
 */
export function boundsFromMask(mask, w, h) {
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++)
      if (mask[py * w + px]) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// ── Geometric primitives ──────────────────────────────────────────────────────

/**
 * Scanline polygon fill → Uint8Array bitmask (1 = inside) in full canvas
 * space. `poly` is an array of { x, y } canvas-pixel coordinates.
 */
export function buildLassoMask(poly, w, h) {
  const mask = new Uint8Array(w * h);
  if (poly.length < 3) return mask;
  const n = poly.length;
  let minY = h, maxY = 0;
  for (const p of poly) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(h - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    const hits = [];
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        hits.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i < hits.length - 1; i += 2) {
      const x0 = Math.max(0, Math.ceil(hits[i]));
      const x1 = Math.min(w - 1, Math.floor(hits[i + 1]));
      for (let x = x0; x <= x1; x++) mask[y * w + x] = 1;
    }
  }
  return mask;
}

/**
 * Rasterise a line from (x0,y0) to (x1,y1) using Bresenham's algorithm,
 * calling `cb(x, y)` for every pixel on the line.
 */
export function bresenhamLine(x0, y0, x1, y1, cb) {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    cb(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
