import { useRef, useEffect } from "react";
import { useJellySpriteStore } from "../store/useJellySpriteStore.js";
import { useToolStore } from "../store/useToolStore.js";
import { createRenderer } from "../engine/canvasRenderer.js";
import { createDrawingEngine } from "../engine/drawingEngine.js";

export function useCanvas() {
  const { refs, state, dispatch } = useJellySpriteStore();
  const ts = useToolStore();
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
      if (!refs.doc.pixelBuffers[layer.id]) {
        refs.doc.pixelBuffers[layer.id] = new Uint8ClampedArray(
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

  // Redraw on visual-only metadata changes (view fields come from ToolContext, doc fields from JellySpriteStore)
  useEffect(() => {
    refs.redraw?.();
  }, [
    // eslint-disable-line react-hooks/exhaustive-deps
    ts.zoom,
    ts.gridVisible,
    ts.frameGridVisible,
    ts.frameConfig,
    ts.refVisible,
    ts.refOpacity,
    ts.tileVisible,
    ts.tileCount,
    state.onionSkinning,
    state.activeFrameIdx,
    state.selection,
  ]);

  return { canvasRef };
}
