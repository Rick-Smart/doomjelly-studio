import { GIFEncoder, quantize, applyPalette } from "gifenc";

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Export all frames from jelly_body as a horizontal PNG sprite sheet.
export async function exportJellySheet(spriteName, jellySpriteState) {
  const frames = jellySpriteState?.frames;
  if (!frames?.length) throw new Error("No frame data to export");

  const frameW = jellySpriteState.canvasW;
  const frameH = jellySpriteState.canvasH;

  const images = await Promise.all(
    frames.map((f) =>
      f.flatImage ? loadImage(f.flatImage) : Promise.resolve(null),
    ),
  );

  const canvas = document.createElement("canvas");
  canvas.width = frameW * frames.length;
  canvas.height = frameH;
  const ctx = canvas.getContext("2d");
  images.forEach((img, i) => {
    if (img) ctx.drawImage(img, i * frameW, 0);
  });

  canvas.toBlob((blob) => {
    triggerDownload(URL.createObjectURL(blob), `${spriteName}_sheet.png`);
  });
}

// Export the animator sprite sheet PNG and its JSON metadata.
export async function exportAnimatorSheet(spriteName, animatorState) {
  const sh = animatorState?.spriteSheet;
  if (!sh?.dataUrl) throw new Error("No animator sprite sheet saved yet");

  const resp = await fetch(sh.dataUrl);
  const blob = await resp.blob();
  triggerDownload(URL.createObjectURL(blob), `${spriteName}_animator.png`);

  const meta = {
    name: spriteName,
    format: "doomjelly-animator",
    version: 1,
    spriteSheet: {
      filename: `${spriteName}_animator.png`,
      width: sh.width,
      height: sh.height,
      frameW: sh.frameW,
      frameH: sh.frameH,
      cols: sh.cols,
      rows: sh.rows,
      frameCount: sh.frameCount,
    },
    animations: animatorState.animations ?? [],
  };
  const jsonBlob = new Blob([JSON.stringify(meta, null, 2)], {
    type: "application/json",
  });
  triggerDownload(URL.createObjectURL(jsonBlob), `${spriteName}_animator.json`);
}

// Export an animated GIF from jelly_body frame flat images.
export async function exportGif(spriteName, jellySpriteState) {
  const frames = jellySpriteState?.frames;
  if (!frames?.length) throw new Error("No frames to export");

  const w = jellySpriteState.canvasW;
  const h = jellySpriteState.canvasH;
  const fps = jellySpriteState.fps ?? 12;
  const delay = Math.round(1000 / Math.max(1, fps));

  const encoder = GIFEncoder();

  for (const frame of frames) {
    if (!frame.flatImage) continue;
    const img = await loadImage(frame.flatImage);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h).data;
    const palette = quantize(imageData, 256, { format: "rgb444" });
    const index = applyPalette(imageData, palette);
    encoder.writeFrame(index, w, h, { palette, delay });
  }

  encoder.finish();
  const blob = new Blob([encoder.bytes()], { type: "image/gif" });
  triggerDownload(URL.createObjectURL(blob), `${spriteName}.gif`);
}
