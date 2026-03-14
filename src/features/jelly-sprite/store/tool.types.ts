/**
 * src/features/jelly-sprite/store/tool.types.ts — TypeScript interfaces for ToolContext.
 *
 * ToolContext owns all tool/brush/color/palette/view state. It is persisted
 * to localStorage under "dj-tool-state" and shared across documents (not
 * per-sprite). Extracted from JellySpriteStore in Sprint 7b.
 *
 * Sprint 8 — TypeScript migration.
 */

// ── State ──────────────────────────────────────────────────────────────────────

export interface ToolFrameConfig {
  frameW: number;
  frameH: number;
}

export interface ToolState {
  // Tools
  tool: string;
  fillShapes: boolean;
  symmetryH: boolean;
  symmetryV: boolean;
  wandTolerance: number;
  wandContiguous: boolean;

  // Brush
  brushType: string;
  brushSize: number;
  brushOpacity: number;
  brushHardness: number;

  // Color
  fgColor: string;
  bgColor: string;
  fgAlpha: number;
  relatedColors: string[];
  colorHistory: string[];

  // Palettes — { [paletteName]: string[] }
  palettes: Record<string, string[]>;
  activePalette: string;

  // View / canvas overlays
  zoom: number;
  gridVisible: boolean;
  frameGridVisible: boolean;
  frameConfig: ToolFrameConfig;
  refImage: string | null;
  refOpacity: number;
  refVisible: boolean;
  tileVisible: boolean;
  tileCount: number;

  // Ink
  inkMode: "simple" | "lock-alpha" | "shading";
  shadingRamp: string[];

  // UI
  panelTab: string;

  // Resize helper (session-only, not persisted)
  resizeAnchor: string;
  customW: number;
  customH: number;
}

// ── Actions ────────────────────────────────────────────────────────────────────

export type ToolAction =
  // View
  | { type: "SET_ZOOM"; payload: number }
  | { type: "SET_GRID_VISIBLE"; payload: boolean }
  | { type: "SET_FRAME_GRID_VISIBLE"; payload: boolean }
  | { type: "SET_FRAME_CONFIG"; payload: ToolFrameConfig }
  | { type: "SET_REF_IMAGE"; payload: string | null }
  | { type: "SET_REF_OPACITY"; payload: number }
  | { type: "SET_REF_VISIBLE"; payload: boolean }
  | { type: "SET_TILE_VISIBLE"; payload: boolean }
  | { type: "SET_TILE_COUNT"; payload: number }
  // Tools
  | { type: "SET_TOOL"; payload: string }
  | { type: "SET_FILL_SHAPES"; payload: boolean }
  | { type: "SET_SYMMETRY_H"; payload: boolean }
  | { type: "SET_SYMMETRY_V"; payload: boolean }
  | { type: "SET_WAND_TOLERANCE"; payload: number }
  | { type: "SET_WAND_CONTIGUOUS"; payload: boolean }
  // Brush
  | { type: "SET_BRUSH_TYPE"; payload: string }
  | { type: "SET_BRUSH_SIZE"; payload: number }
  | { type: "SET_BRUSH_OPACITY"; payload: number }
  | { type: "SET_BRUSH_HARDNESS"; payload: number }
  // Color
  | { type: "SET_FG_COLOR"; payload: string }
  | { type: "SET_BG_COLOR"; payload: string }
  | { type: "SET_FG_ALPHA"; payload: number }
  | { type: "SWAP_COLORS" }
  | { type: "PICK_COLOR"; payload: string }
  | { type: "COMMIT_COLOR"; payload: string[] }
  // Palette
  | { type: "SET_ACTIVE_PALETTE"; payload: string }
  | { type: "PALETTE_ADD_COLOR"; payload: string }
  | { type: "PALETTE_REMOVE_COLOR"; payload: string }
  | { type: "PALETTE_ADD_NEW"; payload: { name: string } }
  | { type: "PALETTE_DELETE"; payload: string }
  | { type: "PALETTE_RENAME"; payload: { oldName: string; newName: string } }
  | { type: "PALETTE_SET_COLORS"; payload: { name: string; colors: string[] } }
  // Ink
  | { type: "SET_INK_MODE"; payload: "simple" | "lock-alpha" | "shading" }
  | { type: "SET_SHADING_RAMP"; payload: string[] }
  // Persistence
  | { type: "LOAD_TOOL_STATE"; payload: Partial<ToolState> }
  // UI
  | { type: "SET_PANEL_TAB"; payload: string }
  | { type: "SET_RESIZE_ANCHOR"; payload: string }
  | { type: "SET_CUSTOM_W"; payload: number }
  | { type: "SET_CUSTOM_H"; payload: number };

// ── Context value ──────────────────────────────────────────────────────────────

export interface ToolContextValue {
  state: ToolState;
  dispatch: (action: ToolAction) => void;
}
