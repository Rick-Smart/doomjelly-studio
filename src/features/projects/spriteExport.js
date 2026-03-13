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
export async function exportJellySheet(spriteName, jellyBody) {
  const frames = jellyBody?.frames;
  if (!frames?.length) throw new Error("No frame data to export");

  const frameW = jellyBody.canvasW;
  const frameH = jellyBody.canvasH;

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
export async function exportAnimatorSheet(spriteName, animatorBody) {
  const sheet = animatorBody?.sheets?.[0];
  if (!sheet?.dataUrl) throw new Error("No animator sprite sheet saved yet");

  const resp = await fetch(sheet.dataUrl);
  const blob = await resp.blob();
  triggerDownload(URL.createObjectURL(blob), `${spriteName}_animator.png`);

  const fc = sheet.frameConfig ?? {};
  const frameW = fc.frameW ?? 32;
  const frameH = fc.frameH ?? 32;
  const cols = sheet.width ? Math.max(1, Math.floor(sheet.width / frameW)) : 1;
  const rows = sheet.height
    ? Math.max(1, Math.floor(sheet.height / frameH))
    : 1;

  const meta = {
    name: spriteName,
    format: "doomjelly-animator",
    version: 1,
    spriteSheet: {
      filename: sheet.filename ?? `${spriteName}_animator.png`,
      width: sheet.width,
      height: sheet.height,
      frameW,
      frameH,
      cols,
      rows,
      frameCount: cols * rows,
    },
    animations: animatorBody.animations ?? [],
  };
  const jsonBlob = new Blob([JSON.stringify(meta, null, 2)], {
    type: "application/json",
  });
  triggerDownload(URL.createObjectURL(jsonBlob), `${spriteName}_animator.json`);
}

// Export an animated GIF from jelly_body frame flat images.
export async function exportGif(spriteName, jellyBody) {
  const frames = jellyBody?.frames;
  if (!frames?.length) throw new Error("No frames to export");

  const w = jellyBody.canvasW;
  const h = jellyBody.canvasH;
  const fps = jellyBody.fps ?? 12;
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
