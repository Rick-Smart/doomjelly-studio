import { useRef, useEffect, useCallback, useState } from "react";

/**
 * Manages the canvas element, offscreen buffer, pixel refs, and the
 * core redraw function.  Everything that needs to READ or WRITE pixels
 * should accept these refs as arguments rather than closing over them.
 */
// useCanvas reads playback/selection refs from window.__jellyRefs__ (set by
// useFramePlayback and useDrawingTools) to avoid circular hook dependencies.
export function useCanvas({
  canvasW,
  canvasH,
  zoom,
  gridVisible,
  frameGridVisible,
  onionSkinning,
  frameConfig,
  layerDataRef,
  layerMaskDataRef,
  layersRef,
  refImgElRef,
  refVisibleRef,
  refOpacityRef,
  tileCanvasRef,
  tileUpdateRef,
}) {
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const pixelsRef = useRef(null);
  const redrawRef = useRef(null);

  const onionOpacity = 0.3;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const off = offscreenRef.current;
    if (!canvas || !off) return;

    const ctx = canvas.getContext("2d");
    const w = canvasW,
      h = canvasH,
      z = zoom;
    const offCtx = off.getContext("2d");

    function compositeFrame(frameId) {
      const jr = window.__jellyRefs__;
      const framesRef = jr?.framesRef ?? { current: [] };
      const activeFrameIdxRef = jr?.activeFrameIdxRef ?? { current: 0 };
      const isActive =
        framesRef.current[activeFrameIdxRef.current]?.id === frameId;
      const renderLayers = isActive
        ? layersRef.current
        : (window.__frameDataRef__?.current?.[frameId]?.layers ??
          layersRef.current);
      const renderPixelData = isActive
        ? layerDataRef.current
        : (window.__frameDataRef__?.current?.[frameId]?.pixelData ??
          layerDataRef.current);

      offCtx.clearRect(0, 0, w, h);
      renderLayers.forEach((layer) => {
        if (!layer.visible) return;
        const data = renderPixelData[layer.id];
        if (!data) return;
        const mask = layerMaskDataRef.current[layer.id];
        let drawData = data;
        if (mask) {
          const masked = new Uint8ClampedArray(data);
          for (let i = 0; i < mask.length; i++) {
            masked[i * 4 + 3] = Math.round((masked[i * 4 + 3] * mask[i]) / 255);
          }
          drawData = masked;
        }
        const imgData = new ImageData(drawData, w, h);
        const tmp = document.createElement("canvas");
        tmp.width = w;
        tmp.height = h;
        tmp.getContext("2d").putImageData(imgData, 0, 0);
        offCtx.globalAlpha = layer.opacity;
        offCtx.globalCompositeOperation = layer.blendMode ?? "normal";
        offCtx.drawImage(tmp, 0, 0);
        offCtx.globalAlpha = 1;
        offCtx.globalCompositeOperation = "source-over";
      });
    }

    const jr2 = window.__jellyRefs__;
    const framesRef = jr2?.framesRef ?? { current: [] };
    const activeFrameIdxRef = jr2?.activeFrameIdxRef ?? { current: 0 };
    const isPlayingRef = jr2?.isPlayingRef ?? { current: false };
    const playbackFrameIdxRef = jr2?.playbackFrameIdxRef ?? { current: 0 };
    const marchOffsetRef = jr2?.marchOffsetRef ?? { current: 0 };
    const selectionRef = jr2?.selectionRef ?? { current: null };
    const lassoPathRef = jr2?.lassoPathRef ?? { current: [] };

    const currentFrames = framesRef.current;
    const dispIdx = isPlayingRef.current
      ? playbackFrameIdxRef.current
      : activeFrameIdxRef.current;
    const displayFrameId = currentFrames[dispIdx]?.id;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Onion skinning
    if (onionSkinning && !isPlayingRef.current && currentFrames.length > 1) {
      const curIdx = activeFrameIdxRef.current;
      const drawGhost = (idx, color) => {
        compositeFrame(currentFrames[idx].id);
        const ghost = document.createElement("canvas");
        ghost.width = w;
        ghost.height = h;
        const gCtx = ghost.getContext("2d");
        gCtx.drawImage(off, 0, 0);
        gCtx.globalCompositeOperation = "source-atop";
        gCtx.fillStyle = color;
        gCtx.fillRect(0, 0, w, h);
        ctx.globalAlpha = onionOpacity;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(ghost, 0, 0, w * z, h * z);
        ctx.globalAlpha = 1;
      };
      if (curIdx > 0) drawGhost(curIdx - 1, "rgba(255,80,80,0.5)");
      if (curIdx < currentFrames.length - 1)
        drawGhost(curIdx + 1, "rgba(80,80,255,0.5)");
    }

    if (displayFrameId) compositeFrame(displayFrameId);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, w * z, h * z);

    // Reference image overlay
    if (refImgElRef.current && refVisibleRef.current) {
      ctx.globalAlpha = refOpacityRef.current;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(refImgElRef.current, 0, 0, w * z, h * z);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
    }

    // Pixel grid
    if (gridVisible && z >= 4) {
      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= w; x++) {
        ctx.beginPath();
        ctx.moveTo(x * z, 0);
        ctx.lineTo(x * z, h * z);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * z);
        ctx.lineTo(w * z, y * z);
        ctx.stroke();
      }
    }

    // Frame grid
    if (frameGridVisible) {
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

    // Live lasso path
    if (lassoPathRef.current.length > 1) {
      const pts = lassoPathRef.current;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo((pts[0].x + 0.5) * z, (pts[0].y + 0.5) * z);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo((pts[i].x + 0.5) * z, (pts[i].y + 0.5) * z);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // Marching ants selection
    const sel = selectionRef.current;
    if (sel) {
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      if (sel.poly && sel.poly.length > 1) {
        const drawPoly = (offset) => {
          ctx.lineDashOffset = offset;
          ctx.beginPath();
          ctx.moveTo((sel.poly[0].x + 0.5) * z, (sel.poly[0].y + 0.5) * z);
          for (let i = 1; i < sel.poly.length; i++) {
            ctx.lineTo((sel.poly[i].x + 0.5) * z, (sel.poly[i].y + 0.5) * z);
          }
          ctx.closePath();
          ctx.stroke();
        };
        drawPoly(-marchOffsetRef.current);
        ctx.strokeStyle = "#000000";
        drawPoly(-marchOffsetRef.current + 4);
      } else {
        const { x, y, w: sw, h: sh } = sel;
        ctx.lineDashOffset = -marchOffsetRef.current;
        ctx.strokeRect(x * z + 0.5, y * z + 0.5, sw * z, sh * z);
        ctx.strokeStyle = "#000000";
        ctx.lineDashOffset = -marchOffsetRef.current + 4;
        ctx.strokeRect(x * z + 0.5, y * z + 0.5, sw * z, sh * z);
      }
      ctx.restore();
    }

    tileUpdateRef.current?.();
  }, [
    canvasW,
    canvasH,
    zoom,
    gridVisible,
    frameGridVisible,
    frameConfig,
    onionSkinning,
    layerDataRef,
    layerMaskDataRef,
    layersRef,
    refImgElRef,
    refVisibleRef,
    refOpacityRef,
    tileCanvasRef,
    tileUpdateRef,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep redrawRef pointing at latest redraw each render
  useEffect(() => {
    redrawRef.current = redraw;
  });

  return { canvasRef, offscreenRef, pixelsRef, redraw, redrawRef };
}
