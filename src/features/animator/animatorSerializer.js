/**
 * Animator persistence helpers.
 *
 * Pure async functions — no React, no dispatch, no side effects.
 * Imported by AnimatorPage for both interactive saves and auto-save on unmount.
 */

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function sheetToDataUrl(sheet) {
  if (sheet.objectUrl) {
    try {
      const blob = await fetch(sheet.objectUrl).then((r) => r.blob());
      return blobToDataUrl(blob);
    } catch {}
  }
  return sheet.dataUrl ?? null;
}

/**
 * Build the full animator body to persist.
 * Async because volatile objectUrls are converted to dataUrls for all sheets.
 *
 * @param {object} st  ProjectContext state snapshot
 * @returns {Promise<object|null>}  animatorBody, or null if there's nothing to save
 */
export async function buildAnimatorBody(st) {
  if (!st.sheets.length) return null;
  const sheetsWithData = await Promise.all(
    st.sheets.map(async (sheet) => {
      const dataUrl = await sheetToDataUrl(sheet);
      const { objectUrl: _o, ...rest } = sheet;
      return { ...rest, dataUrl };
    }),
  );
  if (!sheetsWithData.some((s) => s.dataUrl)) return null;
  return {
    sheets: sheetsWithData,
    activeSheetId: st.activeSheetId,
    animations: st.animations,
    frameConfig: st.frameConfig,
  };
}

/**
 * Build a synthetic animatorBody from a JellyBody when the animator workspace
 * has never been saved for this sprite.  Composites the per-frame flatImage
 * data-URLs into a horizontal sprite sheet so the Animator has something to
 * show immediately on first open.
 *
 * @param {object} jellyBody
 * @returns {Promise<object|null>}  animatorBody, or null if no flatImages found
 */
export async function buildSheetFromJellyBody(jellyBody) {
  const frames = jellyBody?.frames;
  if (!frames?.length) return null;

  const flatFrames = frames.filter((f) => f.flatImage);
  if (!flatFrames.length) return null;

  const frameW = jellyBody.canvasW ?? 32;
  const frameH = jellyBody.canvasH ?? 32;

  const images = await Promise.all(
    flatFrames.map(
      (f) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = f.flatImage;
        }),
    ),
  );

  const canvas = document.createElement("canvas");
  canvas.width = frameW * flatFrames.length;
  canvas.height = frameH;
  const ctx = canvas.getContext("2d");
  images.forEach((img, i) => {
    if (img) ctx.drawImage(img, i * frameW, 0);
  });

  const dataUrl = canvas.toDataURL("image/png");
  const sheetId = crypto.randomUUID();
  const frameConfig = {
    frameW,
    frameH,
    scale: 2,
    offsetX: 0,
    offsetY: 0,
    gutterX: 0,
    gutterY: 0,
  };

  return {
    sheets: [
      {
        id: sheetId,
        dataUrl,
        objectUrl: null,
        width: canvas.width,
        height: canvas.height,
        frameConfig,
        filename: "sheet.png",
      },
    ],
    animations: [],
    frameConfig,
    activeSheetId: sheetId,
  };
}
