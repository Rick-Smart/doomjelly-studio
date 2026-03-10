import { useRef, useEffect } from "react";
import { useJellySpriteStore } from "../store/useJellySpriteStore.js";
import { createRenderer } from "../engine/canvasRenderer.js";
import { createDrawingEngine } from "../engine/drawingEngine.js";

export function useCanvas() {
  const { refs, state, dispatch } = useJellySpriteStore();
  const canvasRef = useRef(null);

  // On mount: create offscreen, init pixel buffers, wire all engines
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

    // 2. Drawing engine
    // NOTE: history is wired by JellySprite's own [canvasW, canvasH] effect
    // (which runs after this mount effect). Wiring it here too would double-
    // seed and reset the history stack on every canvas resize.
    refs.drawingEngine = createDrawingEngine(refs);

    // Sync selection from the engine into React state so the renderer
    // (which reads state.selection via refs.stateRef) and marching ants
    // effect both see the update.
    refs.drawingEngine.onSelectionChange((sel) => {
      dispatch({ type: "SET_SELECTION", payload: sel });
    });

    refs.redraw();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize offscreen when canvas dimensions change
  // NOTE: do NOT call redraw() here. This effect fires before JellySprite's
  // own [canvasW, canvasH] effect, which rebuilds the pixel buffers at the
  // new size and then calls redraw(). Calling redraw() here would composite
  // old-size pixel buffers onto the newly-sized offscreenEl → DOMException.
  useEffect(() => {
    if (!refs.offscreenEl) return;
    refs.offscreenEl.width = state.canvasW;
    refs.offscreenEl.height = state.canvasH;
  }, [state.canvasW, state.canvasH]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw on visual-only metadata changes
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
