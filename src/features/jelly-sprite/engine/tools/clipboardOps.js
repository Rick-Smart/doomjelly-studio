import { copyRegion, pasteRegion } from "../pixelOps.js";

export function copySelection(refs) {
  const sel = refs.selection;
  if (!sel) return;
  const st = refs.stateRef.current;
  const buf = refs.pixelBuffers[st.activeLayerId];
  if (!buf) return;
  refs.clipboard = copyRegion(
    buf,
    sel.x,
    sel.y,
    sel.w,
    sel.h,
    st.canvasW,
    refs.selectionMask,
  );
  refs.clipboardW = sel.w;
  refs.clipboardH = sel.h;
}

export function pasteSelection(refs, setSelection) {
  if (!refs.clipboard) return;
  const st = refs.stateRef.current;
  const buf = refs.pixelBuffers[st.activeLayerId];
  if (!buf) return;
  const { canvasW: w, canvasH: h } = st;
  const px = Math.max(0, Math.floor(w / 2 - refs.clipboardW / 2));
  const py = Math.max(0, Math.floor(h / 2 - refs.clipboardH / 2));
  pasteRegion(
    buf,
    refs.clipboard,
    px,
    py,
    refs.clipboardW,
    refs.clipboardH,
    w,
    h,
  );
  setSelection({ x: px, y: py, w: refs.clipboardW, h: refs.clipboardH });
  (refs.onStrokeComplete ?? refs.pushHistory)?.();
  refs.redraw?.();
}

export function deleteSelectionContents(refs) {
  const sel = refs.selection;
  if (!sel) return;
  const st = refs.stateRef.current;
  const buf = refs.pixelBuffers[st.activeLayerId];
  if (!buf) return;
  const { canvasW: w, canvasH: h } = st;
  for (let dy = 0; dy < sel.h; dy++) {
    for (let dx = 0; dx < sel.w; dx++) {
      const px = sel.x + dx,
        py = sel.y + dy;
      if (px < 0 || px >= w || py < 0 || py >= h) continue;
      if (refs.selectionMask && !refs.selectionMask[py * w + px]) continue;
      const i = (py * w + px) * 4;
      buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
    }
  }
  (refs.onStrokeComplete ?? refs.pushHistory)?.();
  refs.redraw?.();
}
