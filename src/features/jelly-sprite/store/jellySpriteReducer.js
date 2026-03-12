import { MAX_COLOUR_HISTORY, MAX_ZOOM } from "../jellySprite.constants";
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
        customW: payload.w,
        customH: payload.h,
      };
    case A.SET_ZOOM:
      return { ...state, zoom: Math.max(1, Math.min(MAX_ZOOM, payload)) };

    // Tools
    case A.SET_TOOL:
      return { ...state, tool: payload };
    case A.SET_FILL_SHAPES:
      return { ...state, fillShapes: payload };
    case A.SET_SYMMETRY_H:
      return { ...state, symmetryH: payload };
    case A.SET_SYMMETRY_V:
      return { ...state, symmetryV: payload };
    case A.SET_WAND_TOLERANCE:
      return { ...state, wandTolerance: Math.max(0, Math.min(255, payload)) };
    case A.SET_WAND_CONTIGUOUS:
      return { ...state, wandContiguous: payload };

    // Brush
    case A.SET_BRUSH_TYPE:
      return { ...state, brushType: payload };
    case A.SET_BRUSH_SIZE:
      return { ...state, brushSize: Math.max(1, Math.min(32, payload)) };
    case A.SET_BRUSH_OPACITY:
      return { ...state, brushOpacity: Math.max(1, Math.min(100, payload)) };
    case A.SET_BRUSH_HARDNESS:
      return { ...state, brushHardness: Math.max(0, Math.min(100, payload)) };

    // Color
    case A.SET_FG_COLOR:
      return { ...state, fgColor: payload };
    case A.SET_BG_COLOR:
      return { ...state, bgColor: payload };
    case A.SET_FG_ALPHA:
      return { ...state, fgAlpha: Math.max(0, Math.min(1, payload)) };
    case A.SWAP_COLORS:
      return { ...state, fgColor: state.bgColor, bgColor: state.fgColor };
    case A.PICK_COLOR: {
      const hex = payload;
      const history = [
        hex,
        ...state.colorHistory.filter((c) => c !== hex),
      ].slice(0, MAX_COLOUR_HISTORY);
      return { ...state, fgColor: hex, colorHistory: history };
    }

    case A.COMMIT_COLOR: {
      // payload: string[] — selected color first, then related tones.
      // relatedColors: all tones (shown as the top swatch group).
      // colorHistory: just the selected color (the bottom "recent" group).
      const incoming = Array.isArray(payload) ? payload : [payload];
      const selected = incoming[0] ?? state.fgColor;
      const history = [
        selected,
        ...state.colorHistory.filter((c) => c !== selected),
      ].slice(0, MAX_COLOUR_HISTORY);
      return {
        ...state,
        fgColor: selected,
        relatedColors: incoming,
        colorHistory: history,
      };
    }

    // Palette
    case A.SET_ACTIVE_PALETTE:
      return { ...state, activePalette: payload };
    case A.PALETTE_ADD_COLOR: {
      const colors = state.palettes[state.activePalette] ?? [];
      if (colors.includes(payload)) return state;
      return {
        ...state,
        palettes: {
          ...state.palettes,
          [state.activePalette]: [...colors, payload],
        },
      };
    }
    case A.PALETTE_REMOVE_COLOR: {
      const colors = state.palettes[state.activePalette] ?? [];
      return {
        ...state,
        palettes: {
          ...state.palettes,
          [state.activePalette]: colors.filter((c) => c !== payload),
        },
      };
    }
    case A.PALETTE_ADD_NEW:
      return {
        ...state,
        palettes: { ...state.palettes, [payload.name]: [] },
        activePalette: payload.name,
      };
    case A.PALETTE_DELETE: {
      if (!state.palettes[payload]) return state;
      const { [payload]: _dropped, ...rest } = state.palettes;
      const nextActive = Object.keys(rest)[0] ?? "";
      return { ...state, palettes: rest, activePalette: nextActive };
    }
    case A.PALETTE_RENAME: {
      const { oldName, newName } = payload;
      if (!state.palettes[oldName]) return state;
      const { [oldName]: colors, ...rest } = state.palettes;
      return {
        ...state,
        palettes: { ...rest, [newName]: colors },
        activePalette:
          state.activePalette === oldName ? newName : state.activePalette,
      };
    }
    case A.PALETTE_SET_COLORS:
      return {
        ...state,
        palettes: { ...state.palettes, [payload.name]: payload.colors },
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

    // View
    case A.SET_GRID_VISIBLE:
      return { ...state, gridVisible: payload };
    case A.SET_FRAME_GRID_VISIBLE:
      return { ...state, frameGridVisible: payload };
    case A.SET_FRAME_CONFIG:
      return { ...state, frameConfig: payload };
    case A.SET_REF_IMAGE:
      return { ...state, refImage: payload };
    case A.SET_REF_OPACITY:
      return { ...state, refOpacity: payload };
    case A.SET_REF_VISIBLE:
      return { ...state, refVisible: payload };
    case A.SET_TILE_VISIBLE:
      return { ...state, tileVisible: payload };
    case A.SET_TILE_COUNT:
      return { ...state, tileCount: payload };

    // UI
    case A.SET_PANEL_TAB:
      return { ...state, panelTab: payload };
    case A.SET_RESIZE_ANCHOR:
      return { ...state, resizeAnchor: payload };
    case A.SET_CUSTOM_W:
      return { ...state, customW: payload };
    case A.SET_CUSTOM_H:
      return { ...state, customH: payload };

    // Persistence
    // Atomic batch restore of all store fields from a saved project.
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
        zoom: s.zoom ?? state.zoom,
        tool: s.tool ?? state.tool,
        brushType: s.brushType ?? state.brushType,
        brushSize: s.brushSize ?? state.brushSize,
        brushOpacity: s.brushOpacity ?? state.brushOpacity,
        brushHardness: s.brushHardness ?? state.brushHardness,
        fillShapes: s.fillShapes ?? state.fillShapes,
        symmetryH: s.symmetryH ?? state.symmetryH,
        symmetryV: s.symmetryV ?? state.symmetryV,
        wandTolerance: s.wandTolerance ?? state.wandTolerance,
        wandContiguous: s.wandContiguous ?? state.wandContiguous,
        fgColor: s.fgColor ?? state.fgColor,
        bgColor: s.bgColor ?? state.bgColor,
        fgAlpha: s.fgAlpha ?? state.fgAlpha,
        colorHistory: s.colorHistory ?? state.colorHistory,
        palettes: s.palettes ?? state.palettes,
        activePalette: s.activePalette ?? state.activePalette,
        fps: s.fps ?? state.fps,
        onionSkinning: s.onionSkinning ?? state.onionSkinning,
        gridVisible: s.gridVisible ?? state.gridVisible,
        frameGridVisible: s.frameGridVisible ?? state.frameGridVisible,
        frameConfig: s.frameConfig ?? state.frameConfig,
        refImage: s.refImage ?? null,
        refOpacity: s.refOpacity ?? state.refOpacity,
        refVisible: s.refVisible ?? state.refVisible,
        tileVisible: s.tileVisible ?? state.tileVisible,
        tileCount: s.tileCount ?? state.tileCount,
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
