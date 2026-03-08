import { createContext, useReducer, useRef } from "react";
import { jellySpriteReducer } from "./jellySpriteReducer";
import {
  jellySpriteInitialState,
  INIT_LAYER,
  INIT_FRAME,
} from "./jellySpriteInitialState";

// ── Context ───────────────────────────────────────────────────────────────────
// Provides { state, dispatch, refs } to all descendants.
// - state   : reducer state (metadata — see jellySpriteInitialState.js for shape)
// - dispatch : send actions to the reducer (use constants from jellySpriteActions.js)
// - refs    : stable object holding all pixel data and canvas handles.
//             Contents mutate freely without triggering re-renders.
export const JellySpriteStoreCtx = createContext(null);

// ── Refs shape documentation ──────────────────────────────────────────────────
// refs.pixelBuffers     { [layerId]: Uint8ClampedArray }   active frame's pixel data
// refs.maskBuffers      { [layerId]: Uint8Array }          active frame's mask data
// refs.frameSnapshots   { [frameId]: { layers, activeLayerId, pixelBuffers, maskBuffers } }
// refs.historyStack     HistoryEntry[]                     undo/redo snapshots
// refs.historyIndex     number                             current position in stack
// refs.clipboard        Uint8ClampedArray | null           copy/paste buffer
// refs.clipboardW       number                             clipboard region width
// refs.clipboardH       number                             clipboard region height
// refs.selectionMask    Uint8Array | null                  per-pixel lasso mask
// refs.lassoPath2D      Path2D | null                      incremental live-drag path (renderer strokes this)
// refs.lassoXY          Int16Array                         interleaved [x0,y0,...] canvas coords, typed buffer
// refs.lassoXYLen       number                             logical point count in lassoXY
// refs.lassoStartPx     { x, y } | null                    first lasso point (snap-to-start indicator)
// refs.marchOffset      number                             marching ants animation offset
// refs.marchingAntsRaf  number | null                      rAF id for ants animation
// refs.canvasEl         HTMLCanvasElement | null           the visible canvas
// refs.offscreenEl      HTMLCanvasElement | null           offscreen compositing canvas
// refs.tileCanvasEl     HTMLCanvasElement | null           tile preview canvas
// refs.refImgEl         HTMLImageElement | null            reference image element
// refs.stateRef         { current: state }                 always-current state snapshot (for closures)
// refs.playIntervalId   number | null                      setInterval id for playback
// refs.playbackFrameIdx number                             current playback frame
// refs.isPlaying        boolean                            mirror of state.isPlaying for closures
// refs.redraw           () => void                         the live redraw function (set by useCanvas)
// refs.pushHistory      (state) => void                    snapshot current buffers (set by Provider)
// refs.undoHistory      (dispatch) => void                 restore previous snapshot
// refs.redoHistory      (dispatch) => void                 restore next snapshot

export function JellySpriteProvider({ children }) {
  const [state, dispatch] = useReducer(
    jellySpriteReducer,
    jellySpriteInitialState,
  );

  // ── Refs object — created once, never replaced ────────────────────────────
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
