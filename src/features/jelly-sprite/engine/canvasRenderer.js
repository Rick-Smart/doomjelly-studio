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
    const lassoPath = refs.lassoPath ?? [];
    if (lassoPath.length > 1) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo((lassoPath[0].x + 0.5) * z, (lassoPath[0].y + 0.5) * z);
      for (let i = 1; i < lassoPath.length; i++) {
        ctx.lineTo((lassoPath[i].x + 0.5) * z, (lassoPath[i].y + 0.5) * z);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // ── Marching ants selection ───────────────────────────────────────────
    if (selection) {
      const offset = refs.marchOffset ?? 0;
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      if (refs.selectionMask && !selection.poly) {
        // Per-pixel mask boundary — draw an edge segment for every transition
        // at the mask border. Iterated within the selection bounding box only.
        const mask = refs.selectionMask;
        const { x: bx, y: by, w: bw, h: bh } = selection;
        const drawMaskEdges = (style, dashOff) => {
          ctx.strokeStyle = style;
          ctx.lineDashOffset = dashOff;
          ctx.beginPath();
          for (let py = by; py < by + bh; py++) {
            for (let px = bx; px < bx + bw; px++) {
              if (!mask[py * w + px]) continue;
              if (py === 0 || !mask[(py - 1) * w + px]) {
                ctx.moveTo(px * z, py * z);
                ctx.lineTo((px + 1) * z, py * z);
              }
              if (py === h - 1 || !mask[(py + 1) * w + px]) {
                ctx.moveTo(px * z, (py + 1) * z);
                ctx.lineTo((px + 1) * z, (py + 1) * z);
              }
              if (px === 0 || !mask[py * w + (px - 1)]) {
                ctx.moveTo(px * z, py * z);
                ctx.lineTo(px * z, (py + 1) * z);
              }
              if (px === w - 1 || !mask[py * w + (px + 1)]) {
                ctx.moveTo((px + 1) * z, py * z);
                ctx.lineTo((px + 1) * z, (py + 1) * z);
              }
            }
          }
          ctx.stroke();
        };
        drawMaskEdges("#ffffff", -offset);
        drawMaskEdges("#000000", -offset + 4);
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
        drawPoly(-offset + 4);
      } else {
        const { x, y, w: sw, h: sh } = selection;
        ctx.lineDashOffset = -offset;
        ctx.strokeRect(x * z + 0.5, y * z + 0.5, sw * z, sh * z);
        ctx.strokeStyle = "#000000";
        ctx.lineDashOffset = -offset + 4;
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
