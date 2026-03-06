import { useEffect, useRef, useCallback, useState } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import "./SheetViewerCanvas.css";

/**
 * Renders the sprite sheet image at the configured scale with a
 * pixel-perfect grid overlay showing frame cell boundaries.
 *
 * Hover highlight and click-to-add will be layered on top in a later pass.
 */
export function SheetViewerCanvas({ imageUrl }) {
  const { state, dispatch } = useProject();
  const { frameConfig, animations, activeAnimationId } = state;
  const { frameW, frameH, scale, offsetX, offsetY, gutterX, gutterY } =
    frameConfig;

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [hoveredCell, setHoveredCell] = useState(null);

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

  // Redraw whenever config, hover, or active animation frames change
  useEffect(() => {
    if (imgRef.current) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    frameW,
    frameH,
    scale,
    offsetX,
    offsetY,
    gutterX,
    gutterY,
    hoveredCell,
    animations,
    activeAnimationId,
  ]);

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

    // Build usage map: "col,row" → { count, firstIndex }
    const activeAnim = animations.find((a) => a.id === activeAnimationId);
    const usageMap = new Map();
    if (activeAnim) {
      activeAnim.frames.forEach((f, i) => {
        const key = `${f.col},${f.row}`;
        if (!usageMap.has(key))
          usageMap.set(key, { count: 0, firstIndex: i + 1 });
        usageMap.get(key).count++;
      });
    }

    // Draw used-cell highlights + badges
    usageMap.forEach(({ count, firstIndex }, key) => {
      const [col, row] = key.split(",").map(Number);
      const cellX = Math.round((offsetX + col * (frameW + gutterX)) * scale);
      const cellY = Math.round((offsetY + row * (frameH + gutterY)) * scale);
      const cw = frameW * scale;
      const ch = frameH * scale;

      // Tinted fill — brighter when also hovered
      const isHovered = hoveredCell?.col === col && hoveredCell?.row === row;
      ctx.fillStyle = isHovered
        ? "rgba(59, 130, 246, 0.45)"
        : "rgba(59, 130, 246, 0.25)";
      ctx.fillRect(cellX, cellY, cw, ch);

      // Badge pill: top-left corner, shows firstIndex / count
      const label = count > 1 ? `${firstIndex} ×${count}` : `${firstIndex}`;
      const badgePad = 3;
      const badgeH = Math.max(12, Math.round(scale * 7));
      const fontSize = badgeH - 2;
      ctx.font = `bold ${fontSize}px monospace`;
      const textW = ctx.measureText(label).width;
      const badgeW = textW + badgePad * 2;
      const bx = cellX + 2;
      const by = cellY + 2;

      // Pill background
      ctx.fillStyle = "rgba(10, 10, 20, 0.75)";
      ctx.beginPath();
      ctx.roundRect(bx, by, badgeW, badgeH, 3);
      ctx.fill();

      // Label
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, bx + badgePad, by + badgeH / 2);
    });

    // Draw hover highlight (on top of everything)
    if (hoveredCell) {
      const cellX = Math.round(
        (offsetX + hoveredCell.col * (frameW + gutterX)) * scale,
      );
      const cellY = Math.round(
        (offsetY + hoveredCell.row * (frameH + gutterY)) * scale,
      );
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        cellX + 0.5,
        cellY + 0.5,
        frameW * scale - 1,
        frameH * scale - 1,
      );
    }
  }, [
    frameW,
    frameH,
    scale,
    offsetX,
    offsetY,
    gutterX,
    gutterY,
    hoveredCell,
    animations,
    activeAnimationId,
  ]);

  function canvasCoordsToCell(e) {
    const canvas = canvasRef.current;
    if (!canvas || !frameW || !frameH) return null;
    const rect = canvas.getBoundingClientRect();
    const cssScaleX = canvas.width / rect.width;
    const cssScaleY = canvas.height / rect.height;
    const imgX = ((e.clientX - rect.left) * cssScaleX) / scale;
    const imgY = ((e.clientY - rect.top) * cssScaleY) / scale;
    const relX = imgX - offsetX;
    const relY = imgY - offsetY;
    if (relX < 0 || relY < 0) return null;
    const stepX = frameW + gutterX;
    const stepY = frameH + gutterY;
    if (stepX <= 0 || stepY <= 0) return null;
    const col = Math.floor(relX / stepX);
    const row = Math.floor(relY / stepY);
    // Reject clicks inside the gutter zone
    if (relX - col * stepX >= frameW) return null;
    if (relY - row * stepY >= frameH) return null;
    return { col, row };
  }

  function handleMouseMove(e) {
    if (!imageUrl) return;
    setHoveredCell(canvasCoordsToCell(e));
  }

  function handleMouseLeave() {
    setHoveredCell(null);
  }

  function handleClick(e) {
    const cell = canvasCoordsToCell(e);
    if (!cell) return;
    const activeAnim = animations.find((a) => a.id === activeAnimationId);
    if (!activeAnim) return;
    dispatch({
      type: "UPDATE_ANIMATION",
      payload: {
        id: activeAnim.id,
        frames: [
          ...activeAnim.frames,
          { col: cell.col, row: cell.row, ticks: 6, dx: 0, dy: 0 },
        ],
      },
    });
  }

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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      {imageUrl && !activeAnimationId && (
        <div className="sheet-viewer__hint sheet-viewer__hint--no-anim">
          → Create an animation in the right panel, then click cells to add
          frames
        </div>
      )}
      {imageUrl &&
        activeAnimationId &&
        (() => {
          const activeAnim = animations.find((a) => a.id === activeAnimationId);
          return activeAnim && activeAnim.frames.length === 0 ? (
            <div className="sheet-viewer__hint sheet-viewer__hint--no-frames">
              Click any cell to add it to “{activeAnim.name}”
            </div>
          ) : null;
        })()}
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
    // Clamp closing line to last pixel — Math.round(scaledW)+0.5 would be off-canvas
    const px = Math.min(Math.round(x) + 0.5, scaledW - 0.5);
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
    const py = Math.min(Math.round(y) + 0.5, scaledH - 0.5);
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
