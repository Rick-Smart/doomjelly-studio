import { createContext, useReducer, useRef } from "react";
import { jellySpriteReducer } from "./jellySpriteReducer";
import {
  jellySpriteInitialState,
  INIT_LAYER,
  INIT_FRAME,
} from "./jellySpriteInitialState";
import { PixelDocument } from "../engine/PixelDocument.js";

export const JellySpriteStoreCtx = createContext(null);

export function JellySpriteProvider({ children }) {
  const [state, dispatch] = useReducer(
    jellySpriteReducer,
    jellySpriteInitialState,
  );

  // Refs object — created once, never replaced
  const refs = useRef({
    // PixelDocument — canonical pixel/mask/history/snapshot store (Sprint 7c+)
    // Lazy-initialized below so PixelDocument construction is deferred.
    doc: null,

    // Drawing
    clipboard: null,
    clipboardW: 0,
    clipboardH: 0,
    selectionMask: null,
    lassoPath: [],
    marchOffset: 0,
    marchingAntsRaf: null,
    selection: null,
    selectionMaskPath: null,

    // Canvas elements (set by useCanvas)
    canvasEl: null,
    offscreenEl: null,
    tileCanvasEl: null,
    refImgEl: null,

    // Always-current state for closures (drawing engine, renderer).
    // Updated every render — see JellySpriteBody.
    stateRef: { current: jellySpriteInitialState },

    // Playback
    playIntervalId: null,
    playbackFrameIdx: 0,
    isPlaying: false,

    // Functions wired by useCanvas (redraw) and wireHistoryEngine (history).
    // Initialised to null; callers must use optional-chaining (refs.redraw?.()).
    redraw: null,
    pushHistory: null,
    undoHistory: null,
    redoHistory: null,
    onStrokeComplete: null,
  }).current; // .current so we get the plain object, not the ref wrapper

  // Lazy-init PixelDocument — runs only on the first render (refs.doc starts null)
  if (!refs.doc) {
    const doc = new PixelDocument({
      canvasW: jellySpriteInitialState.canvasW,
      canvasH: jellySpriteInitialState.canvasH,
    });
    // Initialize pixel buffers to null until the canvas mounts
    doc.pixelBuffers = { [INIT_LAYER.id]: null };
    doc.frameSnapshots[INIT_FRAME.id] = {
      layers: jellySpriteInitialState.layers,
      activeLayerId: INIT_LAYER.id,
      pixelBuffers: { [INIT_LAYER.id]: null },
      maskBuffers: {},
    };
    refs.doc = doc;
  }

  // Note: stateRef is merged in JellySpriteBody as { ...ss, ...ts } to include ToolContext state.

  return (
    <JellySpriteStoreCtx.Provider value={{ state, dispatch, refs }}>
      {children}
    </JellySpriteStoreCtx.Provider>
  );
}
