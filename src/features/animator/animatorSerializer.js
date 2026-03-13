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
