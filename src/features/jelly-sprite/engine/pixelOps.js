import {
  hexToRgba,
  rgbaToHex,
  rasterRect,
  rasterEllipse,
} from "../jellySprite.utils.js";
import { bresenhamLine } from "./selectionUtils.js";

export { hexToRgba, rgbaToHex };

// Low-level

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

export function colorsMatchTolerance(a, b, tol) {
  return (
    Math.abs(a[0] - b[0]) <= tol &&
    Math.abs(a[1] - b[1]) <= tol &&
    Math.abs(a[2] - b[2]) <= tol &&
    Math.abs(a[3] - b[3]) <= tol
  );
}

// Flood fill

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

// Symmetry + brush stamping

/**
 * Alpha-composite src over the existing pixel at (x,y) using Porter-Duff "over".
 * Falls back to direct write for fully opaque src (fast path).
 */
function compositePixelConstrained(buf, x, y, w, h, src, sel, lassoMask) {
  if (sel) {
    if (x < sel.x || x >= sel.x + sel.w || y < sel.y || y >= sel.y + sel.h)
      return;
    if (lassoMask && !lassoMask[y * w + x]) return;
  }
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const i = (y * w + x) * 4;
  const sA = src[3] / 255;
  if (sA >= 1) {
    // Fully opaque — direct write (fast path)
    buf[i] = src[0];
    buf[i + 1] = src[1];
    buf[i + 2] = src[2];
    buf[i + 3] = 255;
    return;
  }
  const dA = buf[i + 3] / 255;
  const outA = sA + dA * (1 - sA);
  if (outA < 1 / 255) {
    buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
    return;
  }
  buf[i] = Math.round((src[0] * sA + buf[i] * dA * (1 - sA)) / outA);
  buf[i + 1] = Math.round((src[1] * sA + buf[i + 1] * dA * (1 - sA)) / outA);
  buf[i + 2] = Math.round((src[2] * sA + buf[i + 2] * dA * (1 - sA)) / outA);
  buf[i + 3] = Math.round(outA * 255);
}

/**
 * lockAlphaPixelConstrained — like compositePixelConstrained but locks the
 * destination alpha. Only paints on pixels that already have alpha > 0;
 * fully transparent pixels are skipped entirely (preserving transparency).
 */
function lockAlphaPixelConstrained(buf, x, y, w, h, src, sel, lassoMask) {
  if (sel) {
    if (x < sel.x || x >= sel.x + sel.w || y < sel.y || y >= sel.y + sel.h)
      return;
    if (lassoMask && !lassoMask[y * w + x]) return;
  }
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const i = (y * w + x) * 4;
  if (buf[i + 3] === 0) return; // skip transparent pixels — alpha is locked
  const sA = src[3] / 255;
  if (sA >= 1) {
    buf[i] = src[0];
    buf[i + 1] = src[1];
    buf[i + 2] = src[2];
    // buf[i + 3] unchanged
    return;
  }
  buf[i] = Math.round(src[0] * sA + buf[i] * (1 - sA));
  buf[i + 1] = Math.round(src[1] * sA + buf[i + 1] * (1 - sA));
  buf[i + 2] = Math.round(src[2] * sA + buf[i + 2] * (1 - sA));
  // buf[i + 3] unchanged
}

/** Reduce the alpha of an existing pixel by `strength` (0–255). */
function erasePixelConstrained(buf, x, y, w, h, strength, sel, lassoMask) {
  if (sel) {
    if (x < sel.x || x >= sel.x + sel.w || y < sel.y || y >= sel.y + sel.h)
      return;
    if (lassoMask && !lassoMask[y * w + x]) return;
  }
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const i = (y * w + x) * 4;
  buf[i + 3] = Math.round(buf[i + 3] * (1 - strength / 255));
}

/**
 * shadePixelConstrained — shading ink step.
 * Finds the pixel's current hex color in shadingRamp and advances one step
 * deeper (toward the end of the array). Skips transparent pixels.
 * No-op if the pixel's color is not in the ramp or already at the darkest end.
 */
function shadePixelConstrained(buf, x, y, w, h, shadingRamp, sel, lassoMask) {
  if (!shadingRamp || shadingRamp.length < 2) return;
  if (sel) {
    if (x < sel.x || x >= sel.x + sel.w || y < sel.y || y >= sel.y + sel.h)
      return;
    if (lassoMask && !lassoMask[y * w + x]) return;
  }
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const i = (y * w + x) * 4;
  if (buf[i + 3] === 0) return; // skip transparent
  const currentHex = rgbaToHex(buf[i], buf[i + 1], buf[i + 2]).toLowerCase();
  const rampIdx = shadingRamp.findIndex((c) => c.toLowerCase() === currentHex);
  if (rampIdx === -1 || rampIdx >= shadingRamp.length - 1) return;
  const [nr, ng, nb] = hexToRgba(shadingRamp[rampIdx + 1], 255);
  buf[i] = nr;
  buf[i + 1] = ng;
  buf[i + 2] = nb;
  // alpha unchanged
}

/**
 * paintWithSymmetry — composites rgba at (x,y) and any mirror positions.
 * If editingMaskId is set, writes to the mask buffer instead.
 * Respects ctx.inkMode: "simple" (default), "lock-alpha", or "shading".
 * For "shading", ctx.shadingRamp must be a string[] of hex colors.
 */
export function paintWithSymmetry(
  {
    buf,
    maskBuf,
    editingMaskId,
    symmetryH,
    symmetryV,
    w,
    h,
    sel,
    lassoMask,
    inkMode,
    shadingRamp,
  },
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

  if (inkMode === "lock-alpha") {
    lockAlphaPixelConstrained(buf, x, y, w, h, rgba, sel, lassoMask);
    if (symmetryH)
      lockAlphaPixelConstrained(buf, w - 1 - x, y, w, h, rgba, sel, lassoMask);
    if (symmetryV)
      lockAlphaPixelConstrained(buf, x, h - 1 - y, w, h, rgba, sel, lassoMask);
    if (symmetryH && symmetryV)
      lockAlphaPixelConstrained(
        buf,
        w - 1 - x,
        h - 1 - y,
        w,
        h,
        rgba,
        sel,
        lassoMask,
      );
    return;
  }

  if (inkMode === "shading") {
    shadePixelConstrained(buf, x, y, w, h, shadingRamp, sel, lassoMask);
    if (symmetryH)
      shadePixelConstrained(
        buf,
        w - 1 - x,
        y,
        w,
        h,
        shadingRamp,
        sel,
        lassoMask,
      );
    if (symmetryV)
      shadePixelConstrained(
        buf,
        x,
        h - 1 - y,
        w,
        h,
        shadingRamp,
        sel,
        lassoMask,
      );
    if (symmetryH && symmetryV)
      shadePixelConstrained(
        buf,
        w - 1 - x,
        h - 1 - y,
        w,
        h,
        shadingRamp,
        sel,
        lassoMask,
      );
    return;
  }

  compositePixelConstrained(buf, x, y, w, h, rgba, sel, lassoMask);
  if (symmetryH)
    compositePixelConstrained(buf, w - 1 - x, y, w, h, rgba, sel, lassoMask);
  if (symmetryV)
    compositePixelConstrained(buf, x, h - 1 - y, w, h, rgba, sel, lassoMask);
  if (symmetryH && symmetryV)
    compositePixelConstrained(
      buf,
      w - 1 - x,
      h - 1 - y,
      w,
      h,
      rgba,
      sel,
      lassoMask,
    );
}

function eraseWithSymmetry(ctx, x, y, strength) {
  const { buf, symmetryH, symmetryV, w, h, sel, lassoMask } = ctx;
  erasePixelConstrained(buf, x, y, w, h, strength, sel, lassoMask);
  if (symmetryH)
    erasePixelConstrained(buf, w - 1 - x, y, w, h, strength, sel, lassoMask);
  if (symmetryV)
    erasePixelConstrained(buf, x, h - 1 - y, w, h, strength, sel, lassoMask);
  if (symmetryH && symmetryV)
    erasePixelConstrained(
      buf,
      w - 1 - x,
      h - 1 - y,
      w,
      h,
      strength,
      sel,
      lassoMask,
    );
}

/**
 * Compute a feather (hardness) weight for a pixel at offset (dx,dy) from
 * brush centre within radius r.
 * hardness: 0–100 (100 = hard edge, 0 = fully soft/Gaussian-like)
 * Returns a multiplier 0–1 applied to the source alpha.
 */
function featherWeight(dx, dy, r, hardness) {
  if (hardness >= 100 || r === 0) return 1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const normalized = r > 0 ? dist / r : 0; // 0 = centre, 1 = outer edge
  const hardEdge = hardness / 100; // fraction of radius where falloff starts
  if (normalized <= hardEdge) return 1;
  const t = (normalized - hardEdge) / (1 - hardEdge); // 0–1 in falloff zone
  // Cosine falloff — smooth S-curve
  return 0.5 * (1 + Math.cos(Math.PI * t));
}

/**
 * stampBrush — render a single brush dab at (cx,cy).
 * ctx: { buf, maskBuf, editingMaskId, brushType, brushSize, brushHardness,
 *        symmetryH, symmetryV, w, h, sel, lassoMask }
 */
export function stampBrush(ctx, cx, cy, rgba) {
  const { brushType, brushSize, brushHardness = 100 } = ctx;
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
      // Shape filter
      if (brushType === "round" && dx * dx + dy * dy > r * r) continue;
      // square: all pass
      if (brushType === "diamond" && Math.abs(dx) + Math.abs(dy) > r) continue;
      if (brushType === "cross" && dx !== 0 && dy !== 0) continue;
      if (brushType === "dither" && (cx + cy + dx + dy) % 2 !== 0) continue;
      if (brushType === "dither2" && (cx + cy + dx + dy) % 2 === 0) continue;
      // star = cross union diagonal (8-point star)
      if (
        brushType === "star" &&
        dx !== 0 &&
        dy !== 0 &&
        Math.abs(dx) !== Math.abs(dy)
      )
        continue;
      // ring = circle outline (~inner 60% hollow)
      if (brushType === "ring") {
        const d2 = dx * dx + dy * dy;
        const inner = Math.max(0, r - 2);
        if (d2 < inner * inner || d2 > r * r) continue;
      }
      // slash = NE diagonal (dy === -dx)
      if (brushType === "slash" && dy !== -dx) continue;
      // bslash = NW diagonal (dy === dx)
      if (brushType === "bslash" && dy !== dx) continue;

      // Feathering
      let paintRgba = rgba;
      if (brushHardness < 100 && r > 0) {
        const w = featherWeight(dx, dy, r, brushHardness);
        if (w <= 0) continue;
        if (w < 1) {
          paintRgba = [rgba[0], rgba[1], rgba[2], Math.round(rgba[3] * w)];
        }
      }
      paintWithSymmetry(ctx, cx + dx, cy + dy, paintRgba);
    }
  }
}

/**
 * stampErase — erase within the brush footprint with variable strength.
 * strength: 0–255 (255 = full erase, scales with brushOpacity).
 * Respects brush shape, size, hardness, and symmetry.
 */
export function stampErase(ctx, cx, cy, strength) {
  const { brushType, brushSize, brushHardness = 100 } = ctx;
  if (brushType === "pixel") {
    eraseWithSymmetry(ctx, cx, cy, strength);
    return;
  }
  const r = Math.max(0, brushSize - 1);
  if (r === 0) {
    eraseWithSymmetry(ctx, cx, cy, strength);
    return;
  }
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (brushType === "round" && dx * dx + dy * dy > r * r) continue;
      if (brushType === "diamond" && Math.abs(dx) + Math.abs(dy) > r) continue;
      if (brushType === "cross" && dx !== 0 && dy !== 0) continue;
      if (brushType === "dither" && (cx + cy + dx + dy) % 2 !== 0) continue;
      if (brushType === "dither2" && (cx + cy + dx + dy) % 2 === 0) continue;
      if (
        brushType === "star" &&
        dx !== 0 &&
        dy !== 0 &&
        Math.abs(dx) !== Math.abs(dy)
      )
        continue;
      if (brushType === "ring") {
        const d2 = dx * dx + dy * dy;
        const inner = Math.max(0, r - 2);
        if (d2 < inner * inner || d2 > r * r) continue;
      }
      if (brushType === "slash" && dy !== -dx) continue;
      if (brushType === "bslash" && dy !== dx) continue;

      let s = strength;
      if (brushHardness < 100 && r > 0) {
        const w = featherWeight(dx, dy, r, brushHardness);
        if (w <= 0) continue;
        s = Math.round(strength * w);
      }
      eraseWithSymmetry(ctx, cx + dx, cy + dy, s);
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

// Shape rasterisers

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

// Magic wand

/**
 * BFS flood-fill from (sx,sy), matching the colour at that pixel within tolerance.
 * Returns a Uint8Array(w*h) where 1 = selected pixel, or null if nothing matched.
 */
export function magicWandMask(buf, sx, sy, w, h, tol = 0) {
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
    if (!colorsMatchTolerance(getPixel(buf, x, y, w), target, tol)) continue;
    mask[i] = 1;
    found = true;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return found ? mask : null;
}

/**
 * Global (non-contiguous) selection: scan ALL pixels and select those within
 * tolerance of the colour at (sx, sy).
 * Returns a Uint8Array(w*h) where 1 = selected pixel, or null if nothing matched.
 */
export function magicWandMaskGlobal(buf, sx, sy, w, h, tol = 0) {
  const target = getPixel(buf, sx, sy, w);
  const mask = new Uint8Array(w * h);
  let found = false;
  for (let i = 0; i < w * h; i++) {
    if (
      colorsMatchTolerance(
        getPixel(buf, i % w, Math.floor(i / w), w),
        target,
        tol,
      )
    ) {
      mask[i] = 1;
      found = true;
    }
  }
  return found ? mask : null;
}

// Clipboard helpers

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

// Transform helpers

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

/**
 * Rotate a pixel buffer by an arbitrary angle using nearest-neighbour sampling.
 * Always pass the ORIGINAL lifted pixels, never an already-rotated intermediate,
 * to avoid compounding resampling loss on each slider tick.
 *
 * Returns { newBuf, newW, newH } — the tight bounding box of the rotated content.
 */
export function rotateArbitraryNearestNeighbor(src, sw, sh, deg) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Tight bounding box of the rotated rectangle
  const newW = Math.ceil(Math.abs(sw * cos) + Math.abs(sh * sin));
  const newH = Math.ceil(Math.abs(sh * cos) + Math.abs(sw * sin));
  const newBuf = new Uint8ClampedArray(newW * newH * 4);
  // Centres of source and destination in continuous coords
  const ocx = (sw - 1) / 2;
  const ocy = (sh - 1) / 2;
  const ncx = (newW - 1) / 2;
  const ncy = (newH - 1) / 2;
  for (let ny = 0; ny < newH; ny++) {
    for (let nx = 0; nx < newW; nx++) {
      // Translate destination pixel to centred coord
      const dx = nx - ncx;
      const dy = ny - ncy;
      // Inverse rotation (by -deg) to find source coord
      const ox = Math.round(dx * cos + dy * sin + ocx);
      const oy = Math.round(-dx * sin + dy * cos + ocy);
      if (ox < 0 || ox >= sw || oy < 0 || oy >= sh) continue;
      const si = (oy * sw + ox) * 4;
      const di = (ny * newW + nx) * 4;
      newBuf[di] = src[si];
      newBuf[di + 1] = src[si + 1];
      newBuf[di + 2] = src[si + 2];
      newBuf[di + 3] = src[si + 3];
    }
  }
  return { newBuf, newW, newH };
}
