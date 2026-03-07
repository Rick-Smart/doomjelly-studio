// ── Pure utility & drawing functions ─────────────────────────────────────────

export function hexToRgba(hex, alpha = 255) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
    alpha,
  ];
}

export function rgbaToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Scanline polygon fill → Uint8Array (per-pixel 0/1) in full canvas space. */
export function buildLassoMask(poly, w, h) {
  const mask = new Uint8Array(w * h);
  if (poly.length < 3) return mask;
  const n = poly.length;
  let minY = h,
    maxY = 0;
  for (const p of poly) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(h - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    const hits = [];
    for (let i = 0; i < n; i++) {
      const a = poly[i],
        b = poly[(i + 1) % n];
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

export function bresenhamLine(x0, y0, x1, y1, cb) {
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

export function rasterRect(x0, y0, x1, y1, filled, cb) {
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

export function rasterEllipse(cx, cy, rx, ry, filled, cb) {
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
