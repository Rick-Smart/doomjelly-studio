import { createContext, useReducer, useRef } from "react";
import { jellySpriteReducer } from "./jellySpriteReducer";
import {
  jellySpriteInitialState,
  INIT_LAYER,
  INIT_FRAME,
} from "./jellySpriteInitialState";

export const JellySpriteStoreCtx = createContext(null);

export function JellySpriteProvider({ children }) {
  const [state, dispatch] = useReducer(
    jellySpriteReducer,
    jellySpriteInitialState,
  );

  // Refs object — created once, never replaced
  // Initialize with the same seed layer/frame that the initial state uses.
  const refs = useRef({
    // Pixel data for the active frame (populated properly in M2/M3)
    pixelBuffers: { [INIT_LAYER.id]: null },
    maskBuffers: {},

    // Saved state for all frames keyed by frame ID
    frameSnapshots: {
      [INIT_FRAME.id]: {
        layers: jellySpriteInitialState.layers,
        activeLayerId: INIT_LAYER.id,
        pixelBuffers: { [INIT_LAYER.id]: null },
        maskBuffers: {},
      },
    },

    // History
    historyStack: [],
    historyIndex: -1,

    // Drawing
    clipboard: null,
    clipboardW: 0,
    clipboardH: 0,
    selectionMask: null,
    lassoPath: [],
    marchOffset: 0,
    marchingAntsRaf: null,

    // Canvas elements (set by useCanvas in M2)
    canvasEl: null,
    offscreenEl: null,
    tileCanvasEl: null,
    refImgEl: null,

    // Always-current state for closures that can't close over state directly
    // (drawing engine, renderer). Updated every render — see Provider body below.
    stateRef: { current: jellySpriteInitialState },

    // Playback
    playIntervalId: null,
    playbackFrameIdx: 0,
    isPlaying: false,

    // Functions populated in later milestones
    redraw: () => {},
    pushHistory: () => {},
    undoHistory: () => {},
    redoHistory: () => {},
  }).current; // .current so we get the plain object, not the ref wrapper

  // Keep stateRef always current so closures (renderer, drawing engine) never go stale
  refs.stateRef.current = state;

  return (
    <JellySpriteStoreCtx.Provider value={{ state, dispatch, refs }}>
      {children}
    </JellySpriteStoreCtx.Provider>
  );
}
