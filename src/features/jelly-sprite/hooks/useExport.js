import JSZip from "jszip";

/**
 * All export functions: PNG, sprite sheet, ZIP, palette HEX.
 * Receives refs/state needed to composite frames; doesn't own any state itself.
 */
export function useExport({
  canvasW,
  canvasH,
  framesRef,
  activeFrameIdxRef,
  layerDataRef,
  layerMaskDataRef,
  layersRef,
  frameDataRef,
  palettes,
  activePalette,
  exportFramesPerRow,
  exportPadding,
  exportLabels,
  saveCurrentFrameToRef,
  projectName,
}) {
  // ── Composite helpers ──────────────────────────────────────────────────────
  function compositeFrameToCanvas(frameId) {
    const w = canvasW,
      h = canvasH;
    const cvs = document.createElement("canvas");
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext("2d");
    const isActive =
      framesRef.current[activeFrameIdxRef.current]?.id === frameId;
    const renderLayers = isActive
      ? layersRef.current
      : (frameDataRef.current[frameId]?.layers ?? []);
    const renderPixelData = isActive
      ? layerDataRef.current
      : (frameDataRef.current[frameId]?.pixelData ?? {});
    renderLayers.forEach((layer) => {
      if (!layer.visible) return;
      const data = renderPixelData[layer.id];
      if (!data) return;
      const imgData = new ImageData(new Uint8ClampedArray(data), w, h);
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      tmp.getContext("2d").putImageData(imgData, 0, 0);
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 1;
    });
    return cvs;
  }

  function triggerDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  // ── Export functions ───────────────────────────────────────────────────────
  function exportPNG() {
    saveCurrentFrameToRef();
    const activeFrameId = framesRef.current[activeFrameIdxRef.current]?.id;
    if (!activeFrameId) return;
    const cvs = compositeFrameToCanvas(activeFrameId);
    triggerDownload(
      cvs.toDataURL("image/png"),
      `${projectName || "sprite"}.png`,
    );
  }

  function exportSpriteSheet(
    framesPerRow = exportFramesPerRow,
    padding = exportPadding,
    labels = exportLabels,
  ) {
    saveCurrentFrameToRef();
    const allFrames = framesRef.current;
    const fw = canvasW,
      fh = canvasH;
    const cols = Math.min(framesPerRow, allFrames.length);
    const rows = Math.ceil(allFrames.length / cols);
    const labelH = labels ? 12 : 0;
    const shW = cols * (fw + padding) + padding;
    const shH = rows * (fh + padding + labelH) + padding;

    const sheet = document.createElement("canvas");
    sheet.width = shW;
    sheet.height = shH;
    const ctx = sheet.getContext("2d");

    allFrames.forEach((frame, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = padding + col * (fw + padding);
      const y = padding + row * (fh + padding + labelH);
      ctx.drawImage(compositeFrameToCanvas(frame.id), x, y);
      if (labels) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.font = "9px monospace";
        ctx.fillText(frame.name || `F${idx + 1}`, x + 2, y + fh + 9);
      }
    });

    triggerDownload(
      sheet.toDataURL("image/png"),
      `${projectName || "sprite"}_sheet.png`,
    );
  }

  async function exportFramesZip() {
    saveCurrentFrameToRef();
    const zip = new JSZip();
    const folder = zip.folder("frames");
    const allFrames = framesRef.current;
    for (let i = 0; i < allFrames.length; i++) {
      const frame = allFrames[i];
      const dataUrl = compositeFrameToCanvas(frame.id).toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      const num = String(i + 1).padStart(3, "0");
      folder.file(`${projectName || "sprite"}_frame_${num}.png`, base64, {
        base64: true,
      });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(
      URL.createObjectURL(blob),
      `${projectName || "sprite"}_frames.zip`,
    );
  }

  function exportPaletteHex() {
    const colors = palettes[activePalette] ?? [];
    const hex = colors.map((c) => c.replace("#", "")).join("\n");
    const blob = new Blob([hex], { type: "text/plain" });
    triggerDownload(
      URL.createObjectURL(blob),
      `${activePalette.replace(/\s+/g, "_")}.hex`,
    );
  }

  return { exportPNG, exportSpriteSheet, exportFramesZip, exportPaletteHex };
}
