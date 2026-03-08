import { useRef, useEffect } from "react";
import { useJellySpriteStore } from "../store/useJellySpriteStore.js";
import { createRenderer } from "../engine/canvasRenderer.js";
import { wireHistoryEngine } from "../engine/historyEngine.js";
import { createDrawingEngine } from "../engine/drawingEngine.js";

/**
 * useCanvas — M2/M3 rebuild.
 *
 * On mount:
 *   1. Attaches to the <canvas> element (refs.canvasEl)
 *   2. Creates offscreen canvas
 *   3. Initialises pixel buffers for any layers that don't have one yet
 *   4. Wires canvasRenderer → refs.redraw
 *   5. Wires historyEngine → refs.pushHistory / refs.undoHistory / refs.redoHistory
 *   6. Wires drawingEngine → refs.drawingEngine  (pointer events, clipboard ops)
 *
 * Returns { canvasRef } — mount on the <canvas> element.
 */
export function useCanvas() {
  const { refs, state, dispatch } = useJellySpriteStore();
  const canvasRef = useRef(null);

  // ── On mount: create offscreen, init pixel buffers, wire all engines ───
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

    // 1. Renderer
    const { redraw } = createRenderer(refs);
    refs.redraw = redraw;

    // 2. History engine (seeds initial snapshot)
    wireHistoryEngine(refs, dispatch);

    // 3. Drawing engine
    refs.drawingEngine = createDrawingEngine(refs);

    // Sync selection from the engine into React state so the renderer
    // (which reads state.selection via refs.stateRef) and marching ants
    // effect both see the update.
    refs.drawingEngine.onSelectionChange((sel) => {
      dispatch({ type: "SET_SELECTION", payload: sel });
    });

    refs.redraw();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize offscreen when canvas dimensions change ─────────────────────
  // NOTE: do NOT call redraw() here. This effect fires before JellySprite's
  // own [canvasW, canvasH] effect, which rebuilds the pixel buffers at the
  // new size and then calls redraw(). Calling redraw() here would composite
  // old-size pixel buffers onto the newly-sized offscreenEl → DOMException.
  useEffect(() => {
    if (!refs.offscreenEl) return;
    refs.offscreenEl.width = state.canvasW;
    refs.offscreenEl.height = state.canvasH;
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
