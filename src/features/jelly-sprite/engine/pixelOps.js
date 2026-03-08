/**
 * pixelOps.js
 *
 * Pure pixel-manipulation helpers. All functions operate on a
 * Uint8ClampedArray buffer and take explicit width/height params so
 * they can be used for any buffer (active layer, clipboard, mask, etc.)
 * without closing over any React state.
 *
 * Import what you need — no side effects, no globals.
 */

import {
  hexToRgba,
  rgbaToHex,
  bresenhamLine,
  rasterRect,
  rasterEllipse,
} from "../jellySprite.utils.js";

export { hexToRgba, rgbaToHex };

// ── Low-level ─────────────────────────────────────────────────────────────────

/** Read one pixel from buf. Returns [r,g,b,a]. */
export function getPixel(buf, x, y, w) {
  const i = (y * w + x) * 4;
  return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
}

/** Write one rgba pixel to buf, respecting canvas bounds. No-op for out-of-bounds. */
export function setPixel(buf, x, y, w, h, rgba) {
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const i = (y * w + x) * 4;
  buf[i] = rgba[0];
  buf[i + 1] = rgba[1];
  buf[i + 2] = rgba[2];
  buf[i + 3] = rgba[3];
}

/**
 * setPixelConstrained — like setPixel but also enforces an optional
 * selection rect + lasso mask.
 */
export function setPixelConstrained(buf, x, y, w, h, rgba, sel, lassoMask) {
  if (sel) {
    if (x < sel.x || x >= sel.x + sel.w || y < sel.y || y >= sel.y + sel.h)
      return;
    if (lassoMask && !lassoMask[y * w + x]) return;
  }
  setPixel(buf, x, y, w, h, rgba);
}

export function colorsMatch(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

// ── Flood fill ────────────────────────────────────────────────────────────────

export function floodFill(buf, sx, sy, w, h, rgba, sel, lassoMask) {
  const target = getPixel(buf, sx, sy, w);
  if (colorsMatch(target, rgba)) return;
  const queue = [[sx, sy]];
  const visited = new Set();
  while (queue.length) {
    const [x, y] = queue.pop();
    const key = y * w + x;
    if (visited.has(key)) continue;
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    if (!colorsMatch(getPixel(buf, x, y, w), target)) continue;
    visited.add(key);
    setPixelConstrained(buf, x, y, w, h, rgba, sel, lassoMask);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

// ── Symmetry + brush stamping ─────────────────────────────────────────────────

/**
 * paintWithSymmetry — paints at (x,y) and any mirror positions.
 * If editingMaskId is set, writes to the mask buffer instead.
 */
export function paintWithSymmetry(
  { buf, maskBuf, editingMaskId, symmetryH, symmetryV, w, h, sel, lassoMask },
  x,
  y,
  rgba,
) {
  if (editingMaskId && maskBuf) {
    const applyMask = (px, py) => {
      if (px < 0 || px >= w || py < 0 || py >= h) return;
      maskBuf[py * w + px] = rgba[3];
    };
    applyMask(x, y);
    if (symmetryH) applyMask(w - 1 - x, y);
    if (symmetryV) applyMask(x, h - 1 - y);
    if (symmetryH && symmetryV) applyMask(w - 1 - x, h - 1 - y);
    return;
  }
  setPixelConstrained(buf, x, y, w, h, rgba, sel, lassoMask);
  if (symmetryH)
    setPixelConstrained(buf, w - 1 - x, y, w, h, rgba, sel, lassoMask);
  if (symmetryV)
    setPixelConstrained(buf, x, h - 1 - y, w, h, rgba, sel, lassoMask);
  if (symmetryH && symmetryV)
    setPixelConstrained(buf, w - 1 - x, h - 1 - y, w, h, rgba, sel, lassoMask);
}

/**
 * stampBrush — render a single brush dab at (cx,cy).
 * ctx: { buf, maskBuf, editingMaskId, brushType, brushSize, symmetryH, symmetryV, w, h, sel, lassoMask }
 */
export function stampBrush(ctx, cx, cy, rgba) {
  const { brushType, brushSize } = ctx;
  if (brushType === "pixel") {
    paintWithSymmetry(ctx, cx, cy, rgba);
    return;
  }
  const r = Math.max(0, brushSize - 1);
  if (r === 0) {
    paintWithSymmetry(ctx, cx, cy, rgba);
    return;
  }
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (brushType === "round" && dx * dx + dy * dy > r * r) continue;
      if (brushType === "square") {
        /* all pass */
      }
      if (brushType === "diamond" && Math.abs(dx) + Math.abs(dy) > r) continue;
      if (brushType === "cross" && dx !== 0 && dy !== 0) continue;
      if (brushType === "dither" && (cx + cy + dx + dy) % 2 !== 0) continue;
      if (brushType === "dither2" && (cx + cy + dx + dy) % 2 === 0) continue;
      paintWithSymmetry(ctx, cx + dx, cy + dy, rgba);
    }
  }
}

/** sprayBrush — scatter random pixels within a radius */
export function sprayBrush(ctx, cx, cy, rgba) {
  const r = ctx.brushSize * 3 + 3;
  const count = Math.max(4, ctx.brushSize * 4);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * r;
    paintWithSymmetry(
      ctx,
      Math.round(cx + Math.cos(angle) * dist),
      Math.round(cy + Math.sin(angle) * dist),
      rgba,
    );
  }
}

// ── Shape rasterisers ─────────────────────────────────────────────────────────

export function drawLine(ctx, x0, y0, x1, y1, rgba) {
  bresenhamLine(x0, y0, x1, y1, (px, py) =>
    paintWithSymmetry(ctx, px, py, rgba),
  );
}

export function drawRect(ctx, x0, y0, x1, y1, filled, rgba) {
  rasterRect(x0, y0, x1, y1, filled, (px, py) =>
    paintWithSymmetry(ctx, px, py, rgba),
  );
}

export function drawEllipse(ctx, x0, y0, x1, y1, filled, rgba) {
  const cx = Math.round((x0 + x1) / 2);
  const cy = Math.round((y0 + y1) / 2);
  const rx = Math.round(Math.abs(x1 - x0) / 2);
  const ry = Math.round(Math.abs(y1 - y0) / 2);
  rasterEllipse(cx, cy, rx, ry, filled, (px, py) =>
    paintWithSymmetry(ctx, px, py, rgba),
  );
}

// ── Magic wand ────────────────────────────────────────────────────────────────

/**
 * BFS flood-fill from (sx,sy), matching the colour at that pixel.
 * Returns a Uint8Array(w*h) where 1 = selected pixel, or null if nothing matched.
 */
export function magicWandMask(buf, sx, sy, w, h) {
  const target = getPixel(buf, sx, sy, w);
  const mask = new Uint8Array(w * h);
  const visited = new Uint8Array(w * h);
  const queue = [[sx, sy]];
  let found = false;
  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    const i = y * w + x;
    if (visited[i]) continue;
    visited[i] = 1;
    if (!colorsMatch(getPixel(buf, x, y, w), target)) continue;
    mask[i] = 1;
    found = true;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return found ? mask : null;
}

// ── Clipboard helpers ─────────────────────────────────────────────────────────

/** Copy a rectangular region from buf into a new Uint8ClampedArray. */
export function copyRegion(buf, sx, sy, sw, sh, canvasW, lassoMask) {
  const out = new Uint8ClampedArray(sw * sh * 4);
  for (let dy = 0; dy < sh; dy++) {
    for (let dx = 0; dx < sw; dx++) {
      if (lassoMask && !lassoMask[(sy + dy) * canvasW + (sx + dx)]) continue;
      const si = ((sy + dy) * canvasW + (sx + dx)) * 4;
      const di = (dy * sw + dx) * 4;
      out[di] = buf[si];
      out[di + 1] = buf[si + 1];
      out[di + 2] = buf[si + 2];
      out[di + 3] = buf[si + 3];
    }
  }
  return out;
}

/** Blit clipboard buffer onto buf at (dx,dy). */
export function pasteRegion(dst, cbuf, dx, dy, sw, sh, canvasW, canvasH) {
  for (let row = 0; row < sh; row++) {
    for (let col = 0; col < sw; col++) {
      const tx = dx + col,
        ty = dy + row;
      if (tx < 0 || tx >= canvasW || ty < 0 || ty >= canvasH) continue;
      const si = (row * sw + col) * 4;
      const di = (ty * canvasW + tx) * 4;
      if (cbuf[si + 3] === 0) continue; // transparent — skip
      dst[di] = cbuf[si];
      dst[di + 1] = cbuf[si + 1];
      dst[di + 2] = cbuf[si + 2];
      dst[di + 3] = cbuf[si + 3];
    }
  }
}

// ── Transform helpers ─────────────────────────────────────────────────────────

export function flipHorizontal(buf, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < Math.floor(w / 2); x++) {
      const a = (y * w + x) * 4;
      const b = (y * w + (w - 1 - x)) * 4;
      for (let c = 0; c < 4; c++) {
        const tmp = buf[a + c];
        buf[a + c] = buf[b + c];
        buf[b + c] = tmp;
      }
    }
  }
}

export function flipVertical(buf, w, h) {
  for (let y = 0; y < Math.floor(h / 2); y++) {
    for (let x = 0; x < w; x++) {
      const a = (y * w + x) * 4;
      const b = ((h - 1 - y) * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        const tmp = buf[a + c];
        buf[a + c] = buf[b + c];
        buf[b + c] = tmp;
      }
    }
  }
}

/** Rotate canvas 90° clockwise. Returns a new buffer (dimensions swap). */
export function rotateCW90(buf, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const nx = h - 1 - y;
      const ny = x;
      const di = (ny * h + nx) * 4;
      out[di] = buf[si];
      out[di + 1] = buf[si + 1];
      out[di + 2] = buf[si + 2];
      out[di + 3] = buf[si + 3];
    }
  }
  return out;
}

/** Rotate canvas 90° counter-clockwise. Returns a new buffer. */
export function rotateCCW90(buf, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const nx = y;
      const ny = w - 1 - x;
      const di = (ny * h + nx) * 4;
      out[di] = buf[si];
      out[di + 1] = buf[si + 1];
      out[di + 2] = buf[si + 2];
      out[di + 3] = buf[si + 3];
    }
  }
  return out;
}
