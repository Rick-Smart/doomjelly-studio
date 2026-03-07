import { useRef, useEffect } from "react";
import { useJellySpriteStore } from "../store/useJellySpriteStore.js";
import { createRenderer } from "../engine/canvasRenderer.js";

/**
 * useCanvas — M2 rebuild.
 *
 * Attaches to a <canvas> element, creates the offscreen buffer, initialises
 * pixel buffers for every layer that doesn't have one yet, wires up
 * createRenderer and stores redraw() in refs.redraw.
 *
 * Returns { canvasRef } — mount it on the <canvas> element.
 */
export function useCanvas() {
  const { refs, state } = useJellySpriteStore();
  const canvasRef = useRef(null);

  // ── On mount: create offscreen, init pixel buffers, create renderer ────
  useEffect(() => {
    const { canvasW, canvasH, layers } = refs.stateRef.current;

    refs.canvasEl = canvasRef.current;

    refs.offscreenEl = document.createElement("canvas");
    refs.offscreenEl.width = canvasW;
    refs.offscreenEl.height = canvasH;

    // Initialise any pixelBuffer slots that are still null
    layers.forEach((layer) => {
      if (!refs.pixelBuffers[layer.id]) {
        refs.pixelBuffers[layer.id] = new Uint8ClampedArray(
          canvasW * canvasH * 4,
        );
      }
    });

    const { redraw } = createRenderer(refs);
    refs.redraw = redraw;
    refs.redraw();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize offscreen when canvas dimensions change ─────────────────────
  useEffect(() => {
    if (!refs.offscreenEl) return;
    refs.offscreenEl.width = state.canvasW;
    refs.offscreenEl.height = state.canvasH;
    refs.redraw?.();
  }, [state.canvasW, state.canvasH]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Redraw on visual-only metadata changes ─────────────────────────────
  useEffect(() => {
    refs.redraw?.();
  }, [
    // eslint-disable-line react-hooks/exhaustive-deps
    state.zoom,
    state.gridVisible,
    state.frameGridVisible,
    state.onionSkinning,
    state.activeFrameIdx,
    state.refVisible,
    state.refOpacity,
    state.tileVisible,
    state.tileCount,
    state.selection,
  ]);

  return { canvasRef };
}
