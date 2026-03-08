/**
 * canvasRenderer.js
 *
 * Creates and returns the core redraw() function for the JellySprite canvas.
 *
 * Design rules:
 * - Never closes over React state directly — reads everything from refs.stateRef.current
 *   so the closure never goes stale between renders.
 * - All pixel data is read from refs.pixelBuffers and refs.frameSnapshots.
 * - canvas2d API only — no React involved.
 *
 * @param {Object} refs   - The stable refs object from JellySpriteProvider
 * @returns {{ redraw: () => void }}
 */
import { compositeLayersToCanvas } from "./compositeEngine.js";

const ONION_OPACITY = 0.3;

/**
 * Build a Path2D of the mask boundary as connected runs (not disconnected
 * 1-pixel segments). Consecutive boundary edge pixels in the same row/column
 * are grouped into a single moveTo+lineTo so that lineDash flows smoothly
 * along each run rather than restarting at every pixel.
 *
 * Path is in screen space (pixel coords × zoom) so it can be stroked directly
 * without any ctx.scale transform.
 */
function buildMaskEdgePath(mask, sel, maskOrigin, w, h, z) {
  const { x: bx, y: by, w: bw, h: bh } = sel;
  // How far the selection has been moved from where the mask was originally
  // created. When maskOrigin matches sel, offset is (0,0) (no move).
  const ox = bx - (maskOrigin ? maskOrigin.x : bx);
  const oy = by - (maskOrigin ? maskOrigin.y : by);

  // Look up a mask bit at display position (px, py) by translating back to
  // the original mask coordinates.
  const bit = (px, py) => {
    const mx = px - ox, my = py - oy;
    if (mx < 0 || mx >= w || my < 0 || my >= h) return 0;
    return mask[my * w + mx];
  };

  const path = new Path2D();

  // ── Horizontal runs ────────────────────────────────────────────────────
  for (let py = by; py < by + bh; py++) {
    // top edges
    let runX = -1;
    for (let px = bx; px <= bx + bw; px++) {
      const edge =
        px < bx + bw &&
        bit(px, py) &&
        !bit(px, py - 1);
      if (edge && runX < 0) {
        runX = px;
      } else if (!edge && runX >= 0) {
        path.moveTo(runX * z, py * z);
        path.lineTo(px * z, py * z);
        runX = -1;
      }
    }
    // bottom edges
    runX = -1;
    for (let px = bx; px <= bx + bw; px++) {
      const edge =
        px < bx + bw &&
        bit(px, py) &&
        !bit(px, py + 1);
      if (edge && runX < 0) {
        runX = px;
      } else if (!edge && runX >= 0) {
        path.moveTo(runX * z, (py + 1) * z);
        path.lineTo(px * z, (py + 1) * z);
        runX = -1;
      }
    }
  }

  // ── Vertical runs ──────────────────────────────────────────────────────
  for (let px = bx; px < bx + bw; px++) {
    // left edges
    let runY = -1;
    for (let py = by; py <= by + bh; py++) {
      const edge =
        py < by + bh &&
        bit(px, py) &&
        !bit(px - 1, py);
      if (edge && runY < 0) {
        runY = py;
      } else if (!edge && runY >= 0) {
        path.moveTo(px * z, runY * z);
        path.lineTo(px * z, py * z);
        runY = -1;
      }
    }
    // right edges
    runY = -1;
    for (let py = by; py <= by + bh; py++) {
      const edge =
        py < by + bh &&
        bit(px, py) &&
        !bit(px + 1, py);
      if (edge && runY < 0) {
        runY = py;
      } else if (!edge && runY >= 0) {
        path.moveTo((px + 1) * z, runY * z);
        path.lineTo((px + 1) * z, py * z);
        runY = -1;
      }
    }
  }

  return path;
}

export function createRenderer(refs) {
  /**
   * redraw — call this any time pixels or display parameters change.
   * Safe to call at 60fps from the drawing engine (no allocations in
   * the hot path except for onion-skin ghost compositing).
   */
  function redraw() {
    const canvas = refs.canvasEl;
    const off = refs.offscreenEl;
    if (!canvas || !off) return;

    const state = refs.stateRef.current;
    const {
      canvasW: w,
      canvasH: h,
      zoom: z,
      layers,
      activeLayerId,
      frames,
      activeFrameIdx,
      gridVisible,
      frameGridVisible,
      onionSkinning,
      frameConfig,
      refImage,
      refVisible,
      refOpacity,
      tileVisible,
      tileCount,
      selection,
    } = state;

    const ctx = canvas.getContext("2d");

    // Determine which frame index to display (playback vs editing)
    const dispIdx = refs.isPlaying ? refs.playbackFrameIdx : activeFrameIdx;
    const displayFrame = frames[dispIdx];

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ── Onion skinning ────────────────────────────────────────────────────
    if (onionSkinning && !refs.isPlaying && frames.length > 1) {
      const curIdx = activeFrameIdx;

      const drawGhost = (frameIdx, tintColor) => {
        const ghostFrame = frames[frameIdx];
        if (!ghostFrame) return;
        const snap = refs.frameSnapshots[ghostFrame.id];
        if (!snap) return;

        // Composite the ghost frame onto the offscreen canvas
        compositeLayersToCanvas(
          snap.layers,
          snap.pixelBuffers,
          snap.maskBuffers ?? {},
          off,
        );

        // Build a tinted copy
        const ghost = document.createElement("canvas");
        ghost.width = w;
        ghost.height = h;
        const gCtx = ghost.getContext("2d");
        gCtx.drawImage(off, 0, 0);
        gCtx.globalCompositeOperation = "source-atop";
        gCtx.fillStyle = tintColor;
        gCtx.fillRect(0, 0, w, h);

        ctx.globalAlpha = ONION_OPACITY;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(ghost, 0, 0, w * z, h * z);
        ctx.globalAlpha = 1;
      };

      if (curIdx > 0) drawGhost(curIdx - 1, "rgba(255,80,80,0.5)");
      if (curIdx < frames.length - 1)
        drawGhost(curIdx + 1, "rgba(80,80,255,0.5)");
    }

    // ── Composite active (or playback) frame ──────────────────────────────
    if (displayFrame) {
      const isActiveFrame = dispIdx === activeFrameIdx;
      const renderLayers = isActiveFrame
        ? layers
        : (refs.frameSnapshots[displayFrame.id]?.layers ?? layers);
      const renderPixelBuffers = isActiveFrame
        ? refs.pixelBuffers
        : (refs.frameSnapshots[displayFrame.id]?.pixelBuffers ??
          refs.pixelBuffers);
      const renderMaskBuffers = isActiveFrame
        ? refs.maskBuffers
        : (refs.frameSnapshots[displayFrame.id]?.maskBuffers ??
          refs.maskBuffers);
      compositeLayersToCanvas(
        renderLayers,
        renderPixelBuffers,
        renderMaskBuffers,
        off,
      );
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, w * z, h * z);

    // ── Reference image overlay ───────────────────────────────────────────
    if (refs.refImgEl && refVisible) {
      ctx.globalAlpha = refOpacity;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(refs.refImgEl, 0, 0, w * z, h * z);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
    }

    // ── Pixel grid ────────────────────────────────────────────────────────
    if (gridVisible && z >= 4) {
      ctx.lineWidth = 1;
      // Draw light lines first, then dark lines on top so the grid is visible
      // over both light/transparent and dark painted pixels.
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      for (let x = 0; x <= w; x++) {
        ctx.beginPath();
        ctx.moveTo(x * z + 0.5, 0);
        ctx.lineTo(x * z + 0.5, h * z);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * z + 0.5);
        ctx.lineTo(w * z, y * z + 0.5);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      for (let x = 0; x <= w; x++) {
        ctx.beginPath();
        ctx.moveTo(x * z + 0.5, 0);
        ctx.lineTo(x * z + 0.5, h * z);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * z + 0.5);
        ctx.lineTo(w * z, y * z + 0.5);
        ctx.stroke();
      }
    }

    // ── Frame grid ────────────────────────────────────────────────────────
    if (frameGridVisible && frameConfig) {
      const { frameW, frameH } = frameConfig;
      if (frameW > 0 && frameH > 0) {
        ctx.strokeStyle = "rgba(80,120,255,0.4)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= w; x += frameW) {
          ctx.beginPath();
          ctx.moveTo(x * z, 0);
          ctx.lineTo(x * z, h * z);
          ctx.stroke();
        }
        for (let y = 0; y <= h; y += frameH) {
          ctx.beginPath();
          ctx.moveTo(0, y * z);
          ctx.lineTo(w * z, y * z);
          ctx.stroke();
        }
      }
    }

    // ── Live lasso path ───────────────────────────────────────────────────
    // lassoPath2D is built incrementally in drawingEngine — O(1) to stroke.
    if (refs.lassoPath2D && refs.lassoXYLen > 1) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.stroke(refs.lassoPath2D);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.setLineDash([4, 4]);
      ctx.stroke(refs.lassoPath2D);
      ctx.setLineDash([]);

      // Snap-to-start indicator: circle when cursor is within snap radius
      const sp = refs.lassoStartPx;
      const xy = refs.lassoXY;
      const n = refs.lassoXYLen;
      if (sp && xy && n > 0) {
        const curX = xy[(n - 1) * 2];
        const curY = xy[(n - 1) * 2 + 1];
        const snapDist = Math.max(2, 8 / z);
        const dx = curX - sp.x, dy = curY - sp.y;
        if (Math.sqrt(dx * dx + dy * dy) <= snapDist) {
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath();
          ctx.arc((sp.x + 0.5) * z, (sp.y + 0.5) * z, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.7)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // ── Marching ants selection ───────────────────────────────────────────
    if (selection) {
      const offset = refs.marchOffset ?? 0;
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);

      if (refs.selectionMask && !selection.poly) {
        // Rebuild when selection position, zoom, or mask origin changes.
        const mo = refs.selectionMaskOrigin;
        if (
          !refs.selectionMaskPath ||
          refs.selectionMaskPathZoom !== z ||
          refs.selectionMaskPathX !== selection.x ||
          refs.selectionMaskPathY !== selection.y
        ) {
          refs.selectionMaskPath = buildMaskEdgePath(
            refs.selectionMask,
            selection,
            mo,
            w,
            h,
            z,
          );
          refs.selectionMaskPathZoom = z;
          refs.selectionMaskPathX = selection.x;
          refs.selectionMaskPathY = selection.y;
        }
        // Stroke in screen space — lineWidth/lineDash already set by outer ctx.save block.
        ctx.lineDashOffset = -offset;
        ctx.stroke(refs.selectionMaskPath);
        ctx.strokeStyle = "#000000";
        ctx.lineDashOffset = -offset + 6;
        ctx.stroke(refs.selectionMaskPath);
      } else if (selection.poly && selection.poly.length > 1) {
        const drawPoly = (dashOffset) => {
          ctx.lineDashOffset = dashOffset;
          ctx.beginPath();
          ctx.moveTo(
            (selection.poly[0].x + 0.5) * z,
            (selection.poly[0].y + 0.5) * z,
          );
          for (let i = 1; i < selection.poly.length; i++) {
            ctx.lineTo(
              (selection.poly[i].x + 0.5) * z,
              (selection.poly[i].y + 0.5) * z,
            );
          }
          ctx.closePath();
          ctx.stroke();
        };
        drawPoly(-offset);
        ctx.strokeStyle = "#000000";
        drawPoly(-offset + 6);
      } else {
        const { x, y, w: sw, h: sh } = selection;
        ctx.lineDashOffset = -offset;
        ctx.strokeRect(x * z + 0.5, y * z + 0.5, sw * z, sh * z);
        ctx.strokeStyle = "#000000";
        ctx.lineDashOffset = -offset + 6;
        ctx.strokeRect(x * z + 0.5, y * z + 0.5, sw * z, sh * z);
      }
      ctx.restore();
    }

    // ── Tile preview ──────────────────────────────────────────────────────
    if (tileVisible && refs.tileCanvasEl) {
      const tc = refs.tileCanvasEl;
      const n = tileCount ?? 2;
      tc.width = w * n;
      tc.height = h * n;
      const tCtx = tc.getContext("2d");
      tCtx.imageSmoothingEnabled = false;
      tCtx.clearRect(0, 0, tc.width, tc.height);
      for (let row = 0; row < n; row++)
        for (let col = 0; col < n; col++) tCtx.drawImage(off, col * w, row * h);
    }
  }

  return { redraw };
}
