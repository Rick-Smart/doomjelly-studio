import { useEffect, useRef, useCallback, useState } from "react";
import { cellToPixel } from "../../../engine/frameUtils";
import { useAnimator } from "../../../contexts/AnimatorContext";
import { selectActiveAnimation } from "../selectors";
import { useTheme } from "../../../contexts/ThemeContext";
import "./SheetViewerCanvas.css";

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 8;
const ZOOM_STEP = 0.15;

/**
 * Renders the sprite sheet image at the configured scale with a
 * pixel-perfect grid overlay showing frame cell boundaries.
 *
 * Hover highlight and click-to-add will be layered on top in a later pass.
 * Supports scroll-to-zoom and space+drag (or middle-click drag) to pan.
 */
export function SheetViewerCanvas({ imageUrl }) {
  const { state, dispatch } = useAnimator();
  const { theme } = useTheme();
  const { frameConfig, animations, activeAnimationId, activeSheetId, sheets } =
    state;
  const { frameW, frameH, scale, offsetX, offsetY, gutterX, gutterY } =
    frameConfig;

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [dragStartCell, setDragStartCell] = useState(null);
  const [dragCell, setDragCell] = useState(null);

  // Zoom / pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({
    panning: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const spaceRef = useRef(false);

  // Load / reload the image whenever the URL changes
  // Zoom: scroll wheel
  const handleWheel = useCallback(
    (e) => {
      if (!imageUrl) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setZoom((z) =>
        Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + delta).toFixed(4))),
      );
    },
    [imageUrl],
  );

  // Attach wheel as non-passive so we can preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Pan: Space+LMB or Middle-click drag
  useEffect(() => {
    function onKeyDown(e) {
      if (
        e.code === "Space" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName,
        )
      ) {
        e.preventDefault();
        spaceRef.current = true;
        if (containerRef.current) containerRef.current.style.cursor = "grab";
      }
    }
    function onKeyUp(e) {
      if (e.code === "Space") {
        spaceRef.current = false;
        if (containerRef.current) containerRef.current.style.cursor = "";
        panRef.current.panning = false;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  function handlePanMouseDown(e) {
    const isMiddle = e.button === 1;
    const isSpaceLMB = e.button === 0 && spaceRef.current;
    if (!isMiddle && !isSpaceLMB) return;
    e.preventDefault();
    panRef.current = {
      panning: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    if (containerRef.current) containerRef.current.style.cursor = "grabbing";
  }

  function handlePanMouseMove(e) {
    if (!panRef.current.panning) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    setPan({ x: panRef.current.originX + dx, y: panRef.current.originY + dy });
  }

  function handlePanMouseUp() {
    if (!panRef.current.panning) return;
    panRef.current.panning = false;
    if (containerRef.current)
      containerRef.current.style.cursor = spaceRef.current ? "grab" : "";
  }

  // Fit the sheet to the current container size (used on image load + zoom-reset button)
  const fitToContainer = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const cw = container.clientWidth - 32;
    const ch = container.clientHeight - 32;
    const scaledW = img.naturalWidth * scale;
    const scaledH = img.naturalHeight * scale;
    if (scaledW > 0 && scaledH > 0) {
      const fitZoom = Math.min(cw / scaledW, ch / scaledH, ZOOM_MAX);
      setZoom(Math.max(ZOOM_MIN, +fitZoom.toFixed(4)));
    }
    setPan({ x: 0, y: 0 });
  }, [scale]);

  useEffect(() => {
    if (!imageUrl) {
      imgRef.current = null;
      clearCanvas();
      return;
    }
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      fitToContainer();
      draw();
    };
    img.src = imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // Redraw whenever config, hover, drag, active animation, zoom, or theme changes
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
    dragStartCell,
    dragCell,
    animations,
    activeAnimationId,
    zoom,
    theme,
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
    const gridLineColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--text")
      .trim();
    const accentHex = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();
    const ar = parseInt(accentHex.slice(1, 3), 16);
    const ag = parseInt(accentHex.slice(3, 5), 16);
    const ab = parseInt(accentHex.slice(5, 7), 16);
    drawGrid(
      ctx,
      img.naturalWidth,
      img.naturalHeight,
      scale,
      {
        frameW,
        frameH,
        offsetX,
        offsetY,
        gutterX,
        gutterY,
      },
      zoom,
      gridLineColor,
    );

    // Build usage map: "col,row" → { count, firstIndex }
    // Only highlight frames that belong to the currently displayed sheet.
    const primarySheetId = sheets[0]?.id ?? activeSheetId;
    const activeAnim = selectActiveAnimation(state);
    const activeSheetFrames = activeAnim
      ? activeAnim.frames.filter(
          (f) => (f.sheetId ?? primarySheetId) === activeSheetId,
        )
      : [];
    const usageMap = new Map();
    activeSheetFrames.forEach((f, i) => {
      const key = `${f.col},${f.row}`;
      if (!usageMap.has(key))
        usageMap.set(key, { count: 0, firstIndex: i + 1 });
      usageMap.get(key).count++;
    });

    // Draw used-cell highlights + badges
    usageMap.forEach(({ count, firstIndex }, key) => {
      const [col, row] = key.split(",").map(Number);
      const { x: _cx, y: _cy } = cellToPixel(col, row, frameConfig);
      const cellX = Math.round(_cx * scale);
      const cellY = Math.round(_cy * scale);
      const cw = frameW * scale;
      const ch = frameH * scale;

      // Tinted fill — brighter when also hovered
      const isHovered = hoveredCell?.col === col && hoveredCell?.row === row;
      ctx.fillStyle = isHovered
        ? `rgba(${ar},${ag},${ab},0.45)`
        : `rgba(${ar},${ag},${ab},0.25)`;
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

    // Draw drag-select rectangle overlay
    if (dragStartCell && dragCell) {
      const minCol = Math.min(dragStartCell.col, dragCell.col);
      const maxCol = Math.max(dragStartCell.col, dragCell.col);
      const minRow = Math.min(dragStartCell.row, dragCell.row);
      const maxRow = Math.max(dragStartCell.row, dragCell.row);
      const { x: _tlx, y: _tly } = cellToPixel(minCol, minRow, frameConfig);
      const { x: _brx, y: _bry } = cellToPixel(maxCol, maxRow, frameConfig);
      const rx1 = Math.round(_tlx * scale);
      const ry1 = Math.round(_tly * scale);
      const rx2 = Math.round((_brx + frameW) * scale);
      const ry2 = Math.round((_bry + frameH) * scale);
      const rw = rx2 - rx1;
      const rh = ry2 - ry1;
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.18)`;
      ctx.fillRect(rx1, ry1, rw, rh);
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.95)`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(rx1 + 0.5, ry1 + 0.5, rw - 1, rh - 1);
      ctx.setLineDash([]);
    }

    // Draw hover highlight (on top of everything)
    if (hoveredCell) {
      const { x: _hx, y: _hy } = cellToPixel(
        hoveredCell.col,
        hoveredCell.row,
        frameConfig,
      );
      const cellX = Math.round(_hx * scale);
      const cellY = Math.round(_hy * scale);
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
    dragStartCell,
    dragCell,
    animations,
    activeAnimationId,
    zoom,
    theme,
  ]);

  function canvasCoordsToCell(e) {
    const canvas = canvasRef.current;
    if (!canvas || !frameW || !frameH) return null;
    const rect = canvas.getBoundingClientRect();
    // Account for the CSS zoom transform applied to the canvas element
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
    const cell = canvasCoordsToCell(e);
    setHoveredCell(cell);
    if (dragStartCell) setDragCell(cell);
  }

  function handleMouseLeave() {
    setHoveredCell(null);
    if (!dragStartCell) return; // preserve drag if button still held
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return;
    if (!imageUrl) return;
    const cell = canvasCoordsToCell(e);
    if (!cell) return;
    setDragStartCell(cell);
    setDragCell(cell);
  }

  function handleMouseUp(e) {
    if (e.button !== 0 || !dragStartCell) return;
    const endCell = canvasCoordsToCell(e) ?? dragCell;
    setDragStartCell(null);
    setDragCell(null);
    if (!endCell) return;
    const activeAnim = selectActiveAnimation(state);
    if (!activeAnim) return;
    const minCol = Math.min(dragStartCell.col, endCell.col);
    const maxCol = Math.max(dragStartCell.col, endCell.col);
    const minRow = Math.min(dragStartCell.row, endCell.row);
    const maxRow = Math.max(dragStartCell.row, endCell.row);
    const newFrames = [];
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        newFrames.push({
          col,
          row,
          ticks: 6,
          dx: 0,
          dy: 0,
          sheetId: activeSheetId ?? undefined,
        });
      }
    }
    if (newFrames.length === 0) return;
    dispatch({
      type: "UPDATE_ANIMATION",
      payload: {
        id: activeAnim.id,
        frames: [...activeAnim.frames, ...newFrames],
      },
    });
  }

  function handleContextMenu(e) {
    e.preventDefault();
    const cell = canvasCoordsToCell(e);
    if (!cell) return;
    const activeAnim = selectActiveAnimation(state);
    if (!activeAnim) return;
    // Find the last frame matching this cell and remove it.
    const lastIdx = activeAnim.frames.reduce(
      (found, f, i) => (f.col === cell.col && f.row === cell.row ? i : found),
      -1,
    );
    if (lastIdx === -1) return;
    const updated = activeAnim.frames.filter((_, i) => i !== lastIdx);
    dispatch({
      type: "UPDATE_ANIMATION",
      payload: { id: activeAnim.id, frames: updated },
    });
  }

  return (
    <div
      className="sheet-viewer"
      ref={containerRef}
      onMouseMove={(e) => {
        handlePanMouseMove(e);
        handleMouseMove(e);
      }}
      onMouseUp={(e) => {
        handlePanMouseUp();
        handleMouseUp(e);
      }}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handlePanMouseDown}
    >
      {!imageUrl && (
        <div className="sheet-viewer__empty">
          Import a sprite sheet to get started
        </div>
      )}
      {/* Zoomable / pannable viewport */}
      <div
        className="sheet-viewer__viewport"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          display: imageUrl ? "inline-block" : "none",
        }}
      >
        <canvas
          ref={canvasRef}
          className="sheet-viewer__canvas"
          onMouseMove={handleMouseMove}
          onMouseDown={(e) => {
            if (e.button === 0 && !spaceRef.current) handleMouseDown(e);
          }}
          onMouseUp={(e) => {
            if (e.button === 0 && !spaceRef.current) handleMouseUp(e);
          }}
          onContextMenu={handleContextMenu}
        />
      </div>
      {/* Zoom controls */}
      {imageUrl && (
        <div className="sheet-viewer__zoom-controls">
          <button
            className="sheet-viewer__zoom-btn"
            onClick={() =>
              setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(4)))
            }
            title="Zoom in (scroll up)"
          >
            +
          </button>
          <button
            className="sheet-viewer__zoom-btn sheet-viewer__zoom-label"
            onClick={fitToContainer}
            title="Fit to panel (click to reset)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="sheet-viewer__zoom-btn"
            onClick={() =>
              setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(4)))
            }
            title="Zoom out (scroll down)"
          >
            −
          </button>
        </div>
      )}
      {imageUrl && !activeAnimationId && (
        <div className="sheet-viewer__hint sheet-viewer__hint--no-anim">
          → Create an animation in the right panel, then click cells to add
          frames
        </div>
      )}
      {imageUrl &&
        activeAnimationId &&
        (() => {
          const activeAnim = selectActiveAnimation(state);
          return activeAnim && activeAnim.frames.length === 0 ? (
            <div className="sheet-viewer__hint sheet-viewer__hint--no-frames">
              Click any cell to add it to "{activeAnim.name}"
            </div>
          ) : null;
        })()}
    </div>
  );
}

// Grid drawing

function drawGrid(
  ctx,
  imgW,
  imgH,
  scale,
  cfg,
  zoom = 1,
  lineColor = "#e2e2f0",
) {
  const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } = cfg;
  if (!frameW || !frameH) return;

  const s = scale;
  const scaledW = imgW * s;
  const scaledH = imgH * s;

  // Scale line width up when CSS zoom is < 1 so lines stay visible
  const lw = Math.max(1, 1.5 / zoom);

  ctx.save();
  // Use theme text color at 65% opacity — contrasts on all themes
  ctx.strokeStyle = lineColor + "a6"; // hex alpha: a6 ≈ 65%
  ctx.lineWidth = lw;

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
        ctx.strokeStyle = lineColor + "66"; // 40% opacity for gutter dashes
        ctx.lineWidth = lw;
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
        ctx.strokeStyle = lineColor + "66"; // 40% opacity for gutter dashes
        ctx.lineWidth = lw;
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
