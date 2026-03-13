import * as A from "./jellySpriteActions";

export function jellySpriteReducer(state, action) {
  const { type, payload } = action;

  switch (type) {
    // Canvas geometry
    case A.SET_CANVAS_SIZE:
      return {
        ...state,
        canvasW: payload.w,
        canvasH: payload.h,
      };

    // Layers
    case A.SET_LAYERS:
      return { ...state, layers: payload };
    case A.SET_ACTIVE_LAYER:
      return { ...state, activeLayerId: payload };
    case A.SET_EDITING_MASK:
      return { ...state, editingMaskId: payload };
    case A.ADD_LAYER:
      return {
        ...state,
        layers: [...state.layers, payload.layer],
        activeLayerId: payload.layer.id,
      };
    case A.DELETE_LAYER:
      return {
        ...state,
        layers: payload.remainingLayers,
        activeLayerId: payload.newActiveLayerId,
      };
    case A.DUPLICATE_LAYER: {
      const { newLayer, insertAfterIndex } = payload;
      const next = [...state.layers];
      next.splice(insertAfterIndex + 1, 0, newLayer);
      return { ...state, layers: next, activeLayerId: newLayer.id };
    }
    case A.MOVE_LAYER_UP: {
      const idx = state.layers.findIndex((l) => l.id === payload);
      if (idx >= state.layers.length - 1) return state;
      const next = [...state.layers];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return { ...state, layers: next };
    }
    case A.MOVE_LAYER_DOWN: {
      const idx = state.layers.findIndex((l) => l.id === payload);
      if (idx <= 0) return state;
      const next = [...state.layers];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      return { ...state, layers: next };
    }
    case A.UPDATE_LAYER:
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === payload.layerId ? { ...l, ...payload.patch } : l,
        ),
      };
    case A.MERGE_LAYER_DOWN:
      return {
        ...state,
        layers: state.layers.filter((l) => l.id !== payload.removedLayerId),
        activeLayerId: payload.survivingLayerId,
      };
    case A.FLATTEN_ALL:
      return {
        ...state,
        layers: [payload.newLayer],
        activeLayerId: payload.newLayer.id,
        editingMaskId: null,
      };
    case A.ADD_LAYER_MASK:
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === payload ? { ...l, hasMask: true } : l,
        ),
      };
    case A.REMOVE_LAYER_MASK: {
      const next = state.layers.map((l) =>
        l.id === payload ? { ...l, hasMask: false } : l,
      );
      return {
        ...state,
        layers: next,
        editingMaskId:
          state.editingMaskId === payload ? null : state.editingMaskId,
      };
    }

    // Frames
    case A.ADD_FRAME:
      return {
        ...state,
        frames: [...state.frames, payload.frame],
        activeFrameIdx: state.frames.length,
        layers: [payload.layer],
        activeLayerId: payload.layer.id,
        canUndo: false,
        canRedo: false,
      };
    case A.DELETE_FRAME:
      return {
        ...state,
        frames: payload.remainingFrames,
        activeFrameIdx: payload.newIdx,
        layers: payload.newLayers,
        activeLayerId: payload.newActiveLayerId,
        canUndo: false,
        canRedo: false,
      };
    case A.DUPLICATE_FRAME: {
      const { newFrame, insertIdx, layers, activeLayerId } = payload;
      const nextFrames = [...state.frames];
      nextFrames.splice(insertIdx, 0, newFrame);
      return {
        ...state,
        frames: nextFrames,
        activeFrameIdx: insertIdx,
        layers,
        activeLayerId,
      };
    }
    case A.RENAME_FRAME:
      return {
        ...state,
        frames: state.frames.map((f) =>
          f.id === payload.frameId ? { ...f, name: payload.name } : f,
        ),
      };
    case A.SWITCH_FRAME:
      return {
        ...state,
        activeFrameIdx: payload.newIdx,
        layers: payload.layers,
        activeLayerId: payload.activeLayerId,
      };
    case A.UPDATE_THUMBNAIL:
      return {
        ...state,
        frameThumbnails: {
          ...state.frameThumbnails,
          [payload.frameId]: payload.dataUrl,
        },
      };

    // Playback
    case A.SET_IS_PLAYING:
      return { ...state, isPlaying: payload };
    case A.SET_FPS:
      return { ...state, fps: payload };
    case A.SET_PLAYBACK_FRAME_IDX:
      return { ...state, playbackFrameIdx: payload };
    case A.SET_ONION_SKINNING:
      return { ...state, onionSkinning: payload };

    // Selection
    case A.SET_SELECTION:
      return { ...state, selection: payload };

    // History
    case A.STROKE_COMPLETE: {
      const { frameId, dataUrl } = payload;
      return {
        ...state,
        canUndo: true,
        canRedo: false,
        frameThumbnails: { ...state.frameThumbnails, [frameId]: dataUrl },
      };
    }
    case A.SET_CAN_UNDO:
      return { ...state, canUndo: payload };
    case A.SET_CAN_REDO:
      return { ...state, canRedo: payload };
    case A.RESTORE_HISTORY:
      return {
        ...state,
        layers: payload.layers,
        activeLayerId: payload.activeLayerId,
        canUndo: payload.canUndo,
        canRedo: payload.canRedo,
      };

    // Persistence
    // Atomic batch restore of all store fields from a saved project.
    // Pixel buffer / refs restoration is handled imperatively in JellySprite.jsx.
    // payload: { storeState, frames, activeFrameIdx, layers, activeLayerId }
    // Atomic batch restore of document state from a saved project.
    // Tool / view state is restored separately via LOAD_TOOL_STATE in ToolContext.
    // Pixel buffer / refs restoration is handled imperatively in JellySprite.jsx.
    // payload: { storeState, frames, activeFrameIdx, layers, activeLayerId }
    case A.LOAD_JELLY_STATE: {
      const {
        storeState: s,
        frames,
        activeFrameIdx,
        layers,
        activeLayerId,
      } = payload;
      return {
        ...state,
        canvasW: s.canvasW ?? state.canvasW,
        canvasH: s.canvasH ?? state.canvasH,
        fps: s.fps ?? state.fps,
        onionSkinning: s.onionSkinning ?? state.onionSkinning,
        // Restore frame + layer structure
        frames: frames ?? state.frames,
        activeFrameIdx: activeFrameIdx ?? 0,
        layers: layers ?? state.layers,
        activeLayerId: activeLayerId ?? state.activeLayerId,
        // Reset transient / session-only state
        selection: null,
        canUndo: false,
        canRedo: false,
        isPlaying: false,
        frameThumbnails: {},
      };
    }

    default:
      return state;
  }
}
