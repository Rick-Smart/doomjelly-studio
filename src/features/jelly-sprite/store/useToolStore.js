import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BUILTIN_PALETTES } from "../../../ui/PaletteManager";
import * as A from "./jellySpriteActions";
import { MAX_COLOUR_HISTORY, MAX_ZOOM } from "../jellySprite.constants";

// ── Tool initial state (inlined from ToolContext.jsx — Sprint 12) ─────────────
const toolInitialState = {
  // Tools
  tool: "pencil",
  fillShapes: false,
  symmetryH: false,
  symmetryV: false,
  wandTolerance: 15,
  wandContiguous: true,

  // Brush
  brushType: "round",
  brushSize: 1,
  brushOpacity: 100,
  brushHardness: 100,

  // Color
  fgColor: "#000000",
  bgColor: "#ffffff",
  fgAlpha: 1,
  relatedColors: [],
  colorHistory: [],

  // Palettes
  palettes: { ...BUILTIN_PALETTES },
  activePalette: "DoomJelly 32",

  // View / canvas overlays
  zoom: 4,
  gridVisible: true,
  frameGridVisible: false,
  frameConfig: { frameW: 16, frameH: 16 },
  refImage: null,
  refOpacity: 0.5,
  refVisible: true,
  tileVisible: false,
  tileCount: 2,

  // Ink
  inkMode: "simple",
  shadingRamp: [],

  // UI
  panelTab: "palette",

  // Resize helper UI (not persisted — resets each session)
  resizeAnchor: "mc",
  customW: 128,
  customH: 128,
};

// ── Tool reducer (inlined from ToolContext.jsx — Sprint 12) ──────────────────
function toolReducer(state, action) {
  const { type, payload } = action;

  switch (type) {
    // View
    case A.SET_ZOOM:
      return { ...state, zoom: Math.max(1, Math.min(MAX_ZOOM, payload)) };
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

    // UI
    case A.SET_PANEL_TAB:
      return { ...state, panelTab: payload };
    case A.SET_RESIZE_ANCHOR:
      return { ...state, resizeAnchor: payload };
    case A.SET_CUSTOM_W:
      return { ...state, customW: payload };
    case A.SET_CUSTOM_H:
      return { ...state, customH: payload };

    // Ink
    case A.SET_INK_MODE:
      return { ...state, inkMode: payload };
    case A.SET_SHADING_RAMP:
      return { ...state, shadingRamp: payload };

    // Batch restore from a saved jellySprite payload (Sprint 7b)
    case A.LOAD_TOOL_STATE: {
      const s = payload ?? {};
      return {
        ...state,
        ...(s.zoom != null ? { zoom: s.zoom } : {}),
        ...(s.tool != null ? { tool: s.tool } : {}),
        ...(s.brushType != null ? { brushType: s.brushType } : {}),
        ...(s.brushSize != null ? { brushSize: s.brushSize } : {}),
        ...(s.brushOpacity != null ? { brushOpacity: s.brushOpacity } : {}),
        ...(s.brushHardness != null ? { brushHardness: s.brushHardness } : {}),
        ...(s.fillShapes != null ? { fillShapes: s.fillShapes } : {}),
        ...(s.symmetryH != null ? { symmetryH: s.symmetryH } : {}),
        ...(s.symmetryV != null ? { symmetryV: s.symmetryV } : {}),
        ...(s.fgColor != null ? { fgColor: s.fgColor } : {}),
        ...(s.bgColor != null ? { bgColor: s.bgColor } : {}),
        ...(s.fgAlpha != null ? { fgAlpha: s.fgAlpha } : {}),
        ...(s.colorHistory != null ? { colorHistory: s.colorHistory } : {}),
        ...(s.palettes != null ? { palettes: s.palettes } : {}),
        ...(s.activePalette != null ? { activePalette: s.activePalette } : {}),
        ...(s.fps != null ? {} : {}), // fps stays in JellySpriteStore
        ...(s.gridVisible != null ? { gridVisible: s.gridVisible } : {}),
        ...(s.frameGridVisible != null
          ? { frameGridVisible: s.frameGridVisible }
          : {}),
        ...(s.frameConfig != null ? { frameConfig: s.frameConfig } : {}),
        ...(s.refOpacity != null ? { refOpacity: s.refOpacity } : {}),
        ...(s.refVisible != null ? { refVisible: s.refVisible } : {}),
        ...(s.tileVisible != null ? { tileVisible: s.tileVisible } : {}),
        ...(s.tileCount != null ? { tileCount: s.tileCount } : {}),
        ...(s.inkMode != null ? { inkMode: s.inkMode } : {}),
        ...(s.shadingRamp != null ? { shadingRamp: s.shadingRamp } : {}),
        // refImage intentionally not restored — large blobs are never saved per-sprite
        refImage: null,
      };
    }

    default:
      return state;
  }
}

// Fields that survive page reload (no blobs, no session-only state).
const PERSIST_FIELDS = [
  "tool",
  "brushType",
  "brushSize",
  "brushOpacity",
  "brushHardness",
  "fgColor",
  "bgColor",
  "fgAlpha",
  "colorHistory",
  "relatedColors",
  "palettes",
  "activePalette",
  "gridVisible",
  "frameGridVisible",
  "frameConfig",
  "refOpacity",
  "refVisible",
  "tileCount",
  "panelTab",
  "zoom",
  "inkMode",
  "shadingRamp",
];

export const useToolStore = create(
  persist(
    (set, get) => ({
      ...toolInitialState,

      /**
       * Dispatch a tool action. Passes only the data fields to the
       * pure toolReducer (not the `dispatch` function itself).
       */
      dispatch(action) {
        const { dispatch: _d, ...data } = get();
        set(toolReducer(data, action));
      },
    }),
    {
      name: "dj-tool-state",
      partialize: (state) =>
        Object.fromEntries(PERSIST_FIELDS.map((k) => [k, state[k]])),
    },
  ),
);
