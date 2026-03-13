/**
 * Pure grid-math utilities for sprite-sheet frame calculations.
 * No React, no DOM, no I/O — safe to import from anywhere (Rule 14).
 *
 * frameConfig shape:
 *   { frameW, frameH, offsetX, offsetY, gutterX, gutterY }
 */

/**
 * Pixel coordinates of a cell's top-left corner on the source sheet.
 * @returns {{ x: number, y: number }}
 */
export function cellToPixel(
  col,
  row,
  { offsetX, offsetY, frameW, frameH, gutterX, gutterY },
) {
  return {
    x: offsetX + col * (frameW + gutterX),
    y: offsetY + row * (frameH + gutterY),
  };
}

/**
 * Which grid cell contains a given pixel (1× sheet coordinates).
 * Returns null when the pixel lands in an offset or gutter area.
 * @returns {{ col: number, row: number } | null}
 */
export function pixelToCell(
  px,
  py,
  { offsetX, offsetY, frameW, frameH, gutterX, gutterY },
) {
  const lx = px - offsetX;
  const ly = py - offsetY;
  if (lx < 0 || ly < 0) return null;
  const stepX = frameW + gutterX;
  const stepY = frameH + gutterY;
  const col = Math.floor(lx / stepX);
  const row = Math.floor(ly / stepY);
  // Check the pixel is inside the cell body, not the gutter.
  if (lx % stepX >= frameW || ly % stepY >= frameH) return null;
  return { col, row };
}

/**
 * Full pixel rectangle (source coords) for a frame in the sprite sheet.
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function frameRect(col, row, frameConfig) {
  const { x, y } = cellToPixel(col, row, frameConfig);
  return { x, y, w: frameConfig.frameW, h: frameConfig.frameH };
}

/**
 * Number of complete columns and rows that fit in a sheet.
 * Uses `(dim - offset + gutter) / step` so the last cell doesn't need a
 * trailing gutter (most common sprite-sheet layout).
 * @returns {{ cols: number, rows: number }}
 */
export function sheetGridDims(
  sheetW,
  sheetH,
  { offsetX, offsetY, frameW, frameH, gutterX, gutterY },
) {
  if (!frameW || !frameH) return { cols: 0, rows: 0 };
  const stepX = frameW + gutterX;
  const stepY = frameH + gutterY;
  if (stepX <= 0 || stepY <= 0) return { cols: 0, rows: 0 };
  const cols = Math.max(0, Math.floor((sheetW - offsetX + gutterX) / stepX));
  const rows = Math.max(0, Math.floor((sheetH - offsetY + gutterY) / stepY));
  return { cols, rows };
}

/**
 * Total number of frames that fit in a sheet.
 */
export function frameCount(sheetW, sheetH, frameConfig) {
  const { cols, rows } = sheetGridDims(sheetW, sheetH, frameConfig);
  return cols * rows;
}
