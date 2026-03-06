/**
 * Image export service — canvas-based PNG generation.
 *
 * buildPackedAtlas — crops every unique (col,row) cell referenced by the
 *   selected animations from the source sheet, arranges them into a tight
 *   roughly-square grid PNG, and generates a matching atlas JSON.
 *
 * buildAnimStrips — renders each animation as a horizontal strip PNG
 *   (frameW × frameCount wide, frameH tall) with a matching JSON descriptor.
 *
 * All output images use native (1×) pixel coordinates regardless of the
 * project's display scale setting.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Load an image from a URL (object URL or data URL).
 * Returns a Promise<HTMLImageElement>.
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load sprite sheet image."));
    img.src = src;
  });
}

function pickAnimations(animations, options) {
  if (options.target === "active") {
    return animations.filter((a) => a.id === options.activeAnimationId);
  }
  return animations;
}

/** Source rect (1× coords) for a given cell in the sprite sheet. */
function cellSrc(
  col,
  row,
  { frameW, frameH, offsetX, offsetY, gutterX, gutterY },
) {
  return {
    sx: offsetX + col * (frameW + gutterX),
    sy: offsetY + row * (frameH + gutterY),
    sw: frameW,
    sh: frameH,
  };
}

/**
 * Convert a canvas element to a PNG Blob.
 */
export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else
        reject(
          new Error(
            "canvas.toBlob() returned null — check browser permissions.",
          ),
        );
    }, "image/png");
  });
}

// ── Packed Atlas ──────────────────────────────────────────────────────────────

/**
 * Build a packed atlas PNG + JSON descriptor.
 *
 * All unique (col,row) cells referenced by the selected animations are
 * collected in order of first appearance then packed into a roughly-square
 * grid. The source sheet is drawn at native (1×) pixel size.
 *
 * Returns null when there are no cells to pack.
 * Returns { canvas, json } otherwise.
 *
 * json shape:
 *   {
 *     meta: { app, image, size: { w, h } },
 *     frames: { "frame_col_row": { x, y, w, h }, … },
 *     animations: { [name]: [{ frame, sprite, ticks, dx, dy }, …], … }
 *   }
 */
export function buildPackedAtlas(srcImg, animations, frameConfig, options) {
  const anims = pickAnimations(animations, options);
  const { frameW, frameH } = frameConfig;

  // Collect unique cells preserving order of first appearance
  const seen = new Set();
  const uniqueCells = [];
  for (const anim of anims) {
    for (const f of anim.frames) {
      const key = `${f.col},${f.row}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCells.push({ col: f.col, row: f.row });
      }
    }
  }

  if (uniqueCells.length === 0) return null;

  // Roughly-square grid
  const packCols = Math.ceil(Math.sqrt(uniqueCells.length));
  const packRows = Math.ceil(uniqueCells.length / packCols);

  const canvas = document.createElement("canvas");
  canvas.width = packCols * frameW;
  canvas.height = packRows * frameH;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // Draw cells and record packed positions
  const posMap = new Map(); // "col,row" → { x, y }
  uniqueCells.forEach(({ col, row }, idx) => {
    const { sx, sy, sw, sh } = cellSrc(col, row, frameConfig);
    const dx = (idx % packCols) * frameW;
    const dy = Math.floor(idx / packCols) * frameH;
    ctx.drawImage(srcImg, sx, sy, sw, sh, dx, dy, frameW, frameH);
    posMap.set(`${col},${row}`, { x: dx, y: dy });
  });

  // Build frames index
  const framesObj = {};
  uniqueCells.forEach(({ col, row }) => {
    const { x, y } = posMap.get(`${col},${row}`);
    framesObj[`frame_${col}_${row}`] = { x, y, w: frameW, h: frameH };
  });

  // Build animations index (references the new frame names)
  const animsObj = {};
  for (const anim of anims) {
    animsObj[anim.name] = anim.frames.map((f, i) => ({
      frame: i,
      sprite: `frame_${f.col}_${f.row}`,
      ticks: f.ticks ?? 6,
      dx: f.dx ?? 0,
      dy: f.dy ?? 0,
    }));
  }

  return {
    canvas,
    json: {
      meta: {
        app: "DoomJelly Studio",
        image: "atlas.png",
        size: { w: canvas.width, h: canvas.height },
      },
      frames: framesObj,
      animations: animsObj,
    },
  };
}

// ── Animation Strips ──────────────────────────────────────────────────────────

/**
 * Build per-animation strip images.
 *
 * Each animation's frames are drawn left-to-right in a single horizontal
 * PNG row. Offset (dx, dy) data is stored in the JSON only and is NOT baked
 * into the image so the strip stays a clean uniform grid.
 *
 * Returns [{ name, canvas, json }]
 *   canvas.width  = frameW * frameCount
 *   canvas.height = frameH
 *
 * json shape:
 *   {
 *     meta: { app, image, frameW, frameH, frameCount },
 *     frames: [{ index, x, y, w, h, ticks, dx, dy }, …]
 *   }
 */
/**
 * Generate a small thumbnail (square PNG data URL) from the first frame of
 * the first animation. Returns null if no image/animation/frame is available.
 *
 * @param {string} imageUrl - Object URL or data URL of the sprite sheet.
 * @param {object} frameConfig - { frameW, frameH, offsetX, offsetY, gutterX, gutterY }
 * @param {Array}  animations  - Project animations array.
 * @param {number} [size=48]   - Square output size in pixels.
 */
export async function generateThumbnail(
  imageUrl,
  frameConfig,
  animations,
  size = 48,
) {
  if (!imageUrl || !animations.length || !animations[0].frames.length)
    return null;
  const firstFrame = animations[0].frames[0];
  const img = await loadImage(imageUrl);
  const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } = frameConfig;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const sx = offsetX + firstFrame.col * (frameW + gutterX);
  const sy = offsetY + firstFrame.row * (frameH + gutterY);
  ctx.drawImage(img, sx, sy, frameW, frameH, 0, 0, size, size);
  return canvas.toDataURL("image/png");
}

export function buildAnimStrips(srcImg, animations, frameConfig, options) {
  const anims = pickAnimations(animations, options);
  const { frameW, frameH } = frameConfig;

  return anims.map((anim) => {
    const frameCount = anim.frames.length;
    const canvas = document.createElement("canvas");
    canvas.width = frameW * Math.max(frameCount, 1);
    canvas.height = frameH;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    anim.frames.forEach((f, i) => {
      const { sx, sy, sw, sh } = cellSrc(f.col, f.row, frameConfig);
      ctx.drawImage(srcImg, sx, sy, sw, sh, i * frameW, 0, frameW, frameH);
    });

    return {
      name: anim.name,
      canvas,
      json: {
        meta: {
          app: "DoomJelly Studio",
          image: `${anim.name}.png`,
          frameW,
          frameH,
          frameCount,
        },
        frames: anim.frames.map((f, i) => ({
          index: i,
          x: i * frameW,
          y: 0,
          w: frameW,
          h: frameH,
          ticks: f.ticks ?? 6,
          dx: f.dx ?? 0,
          dy: f.dy ?? 0,
        })),
      },
    };
  });
}
