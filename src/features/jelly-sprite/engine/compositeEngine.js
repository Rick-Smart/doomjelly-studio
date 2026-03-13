export function compositeLayersToCanvas(
  layers,
  pixelBuffers,
  maskBuffers,
  target,
) {
  const w = target.width;
  const h = target.height;
  const ctx = target.getContext("2d");

  ctx.clearRect(0, 0, w, h);

  for (const layer of layers) {
    if (!layer.visible) continue;
    const data = pixelBuffers[layer.id];
    if (!data) continue;

    // Guard: skip layers whose buffer doesn't match the target canvas dimensions.
    // This can happen in the brief window between a canvas resize and the effect
    // that rebuilds pixel buffers (e.g. justRestoredRef race). Skipping is
    // always safer than crashing with an ImageData constructor error.
    if (data.length !== w * h * 4) continue;

    const mask = maskBuffers?.[layer.id];
    let drawData = data;

    // Apply layer mask: multiply each pixel's alpha by normalised mask value
    if (mask) {
      drawData = new Uint8ClampedArray(data);
      for (let i = 0; i < mask.length; i++) {
        drawData[i * 4 + 3] = Math.round((drawData[i * 4 + 3] * mask[i]) / 255);
      }
    }

    const imgData = new ImageData(drawData, w, h);

    // Draw via a temporary canvas so we can apply globalAlpha + compositeOperation
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    tmp.getContext("2d").putImageData(imgData, 0, 0);

    ctx.globalAlpha = layer.opacity ?? 1;
    ctx.globalCompositeOperation = layer.blendMode ?? "source-over";
    ctx.drawImage(tmp, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
}
