import { useEffect, useRef, useCallback } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import "./SheetViewerCanvas.css";

/**
 * Renders the sprite sheet image at the configured scale with a
 * pixel-perfect grid overlay showing frame cell boundaries.
 *
 * Hover highlight and click-to-add will be layered on top in a later pass.
 */
export function SheetViewerCanvas({ imageUrl }) {
  const { state } = useProject();
  const { frameConfig } = state;
  const { frameW, frameH, scale, offsetX, offsetY, gutterX, gutterY } =
    frameConfig;

  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  // Load / reload the image whenever the URL changes
  useEffect(() => {
    if (!imageUrl) {
      imgRef.current = null;
      clearCanvas();
      return;
    }
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // Redraw whenever config changes (image already loaded)
  useEffect(() => {
    if (imgRef.current) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameW, frameH, scale, offsetX, offsetY, gutterX, gutterY]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const scaledW = Math.round(img.naturalWidth * scale);
    const scaledH = Math.round(img.naturalHeight * scale);

    canvas.width = scaledW;
    canvas.height = scaledH;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    // Draw sheet
    ctx.drawImage(img, 0, 0, scaledW, scaledH);

    // Draw grid overlay
    drawGrid(ctx, img.naturalWidth, img.naturalHeight, scale, {
      frameW,
      frameH,
      offsetX,
      offsetY,
      gutterX,
      gutterY,
    });
  }, [frameW, frameH, scale, offsetX, offsetY, gutterX, gutterY]);

  return (
    <div className="sheet-viewer">
      {!imageUrl && (
        <div className="sheet-viewer__empty">
          Import a sprite sheet to get started
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="sheet-viewer__canvas"
        style={{ display: imageUrl ? "block" : "none" }}
      />
    </div>
  );
}

// ── Grid drawing ─────────────────────────────────────────

function drawGrid(ctx, imgW, imgH, scale, cfg) {
  const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } = cfg;
  if (!frameW || !frameH) return;

  const s = scale;
  const scaledW = imgW * s;
  const scaledH = imgH * s;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 0, 0.55)";
  ctx.lineWidth = 1;

  const cellStepX = (frameW + gutterX) * s;
  const cellStepY = (frameH + gutterY) * s;
  const startX = offsetX * s;
  const startY = offsetY * s;

  // Vertical lines (left edge of each column, plus final right edge)
  for (let x = startX; x <= scaledW + 0.5; x += cellStepX) {
    const px = Math.round(x) + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, startY);
    ctx.lineTo(px, scaledH);
    ctx.stroke();

    // Right edge of frame (before gutter)
    if (gutterX > 0) {
      const rx = Math.round(x + frameW * s) + 0.5;
      if (rx < scaledW) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 100, 0, 0.4)";
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(rx, startY);
        ctx.lineTo(rx, scaledH);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Horizontal lines (top edge of each row, plus final bottom edge)
  for (let y = startY; y <= scaledH + 0.5; y += cellStepY) {
    const py = Math.round(y) + 0.5;
    ctx.beginPath();
    ctx.moveTo(startX, py);
    ctx.lineTo(scaledW, py);
    ctx.stroke();

    if (gutterY > 0) {
      const by = Math.round(y + frameH * s) + 0.5;
      if (by < scaledH) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 100, 0, 0.4)";
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(startX, by);
        ctx.lineTo(scaledW, by);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  ctx.restore();
}
