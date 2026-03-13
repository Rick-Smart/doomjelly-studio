import { frameRect } from "../engine/frameUtils.js";

function frameToRect(frame, frameConfig) {
  return frameRect(frame.col, frame.row, frameConfig);
}

function pickAnimations(animations, options) {
  if (options.target === "active") {
    return animations.filter((a) => a.id === options.activeAnimationId);
  }
  return animations;
}

// Format: Generic JSON

/**
 * Simple flat array format.
 * [{ animation, frame, x, y, w, h, dx, dy, ticks }]
 */
export function toGenericJSON(animations, frameConfig, options) {
  const anims = pickAnimations(animations, options);
  const result = {};
  for (const anim of anims) {
    result[anim.name] = anim.frames.map((f, i) => ({
      frame: i,
      ...frameToRect(f, frameConfig),
      dx: f.dx ?? 0,
      dy: f.dy ?? 0,
      ticks: f.ticks ?? 6,
    }));
  }
  return result;
}

// Format: Phaser 3 JSON Atlas

/**
 * Phaser 3 texture atlas + animation config shape.
 * Compatible with Phaser.Loader.atlas() + Phaser.Animations.fromJSON()
 */
export function toPhaser3JSON(animations, frameConfig, options) {
  const anims = pickAnimations(animations, options);
  const { frameW, frameH } = frameConfig;

  // Build deduplicated frame list across all exported animations
  const frameMap = new Map(); // key: "col_row" → frame name
  const atlasFrames = [];

  for (const anim of anims) {
    for (const f of anim.frames) {
      const key = `${f.col}_${f.row}`;
      if (!frameMap.has(key)) {
        const name = `frame_${f.col}_${f.row}`;
        frameMap.set(key, name);
        const { x, y } = frameToRect(f, frameConfig);
        atlasFrames.push({
          filename: name,
          frame: { x, y, w: frameW, h: frameH },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: frameW, h: frameH },
          sourceSize: { w: frameW, h: frameH },
        });
      }
    }
  }

  const animDefs = anims.map((anim) => ({
    key: anim.name,
    type: "frame",
    frames: anim.frames.map((f) => ({
      key: frameMap.get(`${f.col}_${f.row}`),
      duration: f.ticks ?? 6,
      ...(((f.dx ?? 0) !== 0 || (f.dy ?? 0) !== 0) && {
        offsetX: f.dx ?? 0,
        offsetY: f.dy ?? 0,
      }),
    })),
    frameRate: 10,
    repeat: -1,
  }));

  return {
    textures: [
      {
        image: "spritesheet.png",
        format: "RGBA8888",
        size: { w: 0, h: 0 }, // user fills in actual sheet dimensions
        scale: 1,
        frames: atlasFrames,
      },
    ],
    meta: {
      app: "DoomJelly Studio",
      version: "1",
    },
    animations: animDefs,
  };
}

// Format: Canvas/Sprite.js (UI_TOOLS convention)

/**
 * canvas/sprite.js format — returns a plain object; serialize() converts to
 * an ES module export string.
 */
export function toCanvasSpriteJS(animations, frameConfig, options) {
  const anims = pickAnimations(animations, options);
  const result = {};
  for (const anim of anims) {
    result[anim.name] = {
      frames: anim.frames.map((f) => ({
        col: f.col,
        row: f.row,
        ticks: f.ticks ?? 6,
        dx: f.dx ?? 0,
        dy: f.dy ?? 0,
      })),
      loop: true,
      pingpong: false,
    };
  }
  return result;
}

function serializeCanvasSpriteJS(data) {
  // Convert to JS module syntax: strip quotes from identifier keys.
  const json = JSON.stringify(data, null, 2);
  const js = json.replace(/^(\s*)"(\w+)":/gm, "$1$2:");
  return `export const animations = ${js};\n`;
}

// Format registry

export const EXPORT_FORMATS = [
  {
    id: "generic",
    label: "Generic JSON",
    description: "{ animName: [{ frame, x, y, w, h, dx, dy, ticks }] }",
    generate: toGenericJSON,
  },
  {
    id: "phaser3",
    label: "Phaser 3 Atlas",
    description: "Texture atlas + animation config for Phaser.Loader.atlas()",
    generate: toPhaser3JSON,
  },
  {
    id: "canvas-sprite",
    label: "Canvas/Sprite.js",
    description: "ES module export for UI_TOOLS canvas/sprite convention",
    generate: toCanvasSpriteJS,
    serialize: serializeCanvasSpriteJS,
    ext: "js",
  },
];

// Download helper

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
