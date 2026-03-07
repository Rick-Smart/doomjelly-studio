import { BUILTIN_PALETTES } from "../../../ui/PaletteManager";
import { makeLayer, makeFrame } from "../jellySprite.constants";

// ── Factory — called once at module load to seed the initial layer + frame ───
const _initLayer = makeLayer("Layer 1");
const _initFrame = makeFrame("Frame 1");

// ── Initial state ─────────────────────────────────────────────────────────────
// This object is the authoritative reference for every field that lives in the
// JellySprite reducer state. Pixel data is NOT here — it lives in refs.
// All fields are grouped by concern so it's easy to find the right thing.
export const jellySpriteInitialState = {
  // ── Canvas geometry ──────────────────────────────────────────────────────
  canvasW: 128,
  canvasH: 128,
  zoom: 4,

  // ── Layers ───────────────────────────────────────────────────────────────
  // The active frame's layer metadata array. Changes when switching frames.
  layers: [_initLayer],
  activeLayerId: _initLayer.id,
  editingMaskId: null, // non-null when user is painting into a layer mask

  // ── Frames ───────────────────────────────────────────────────────────────
  frames: [_initFrame],
  activeFrameIdx: 0,
  frameThumbnails: {}, // { [frameId]: dataUrl string }

  // ── Playback ─────────────────────────────────────────────────────────────
  isPlaying: false,
  fps: 8,
  onionSkinning: false,

  // ── Tools ────────────────────────────────────────────────────────────────
  tool: "pencil",
  fillShapes: false, // outline vs filled for rect/ellipse
  symmetryH: false, // mirror paint horizontally
  symmetryV: false, // mirror paint vertically

  // ── Brush ────────────────────────────────────────────────────────────────
  brushType: "round", // round | square | diamond | cross | pixel | dither | dither2
  brushSize: 1, // 1–32
  brushOpacity: 100, // 1–100 (percentage)

  // ── Color ────────────────────────────────────────────────────────────────
  fgColor: "#000000",
  bgColor: "#ffffff",
  fgAlpha: 1, // 0–1, separate from brushOpacity
  colorHistory: [], // last MAX_COLOUR_HISTORY used colors

  // ── Palettes ─────────────────────────────────────────────────────────────
  palettes: { ...BUILTIN_PALETTES },
  activePalette: "DoomJelly 32",

  // ── Selection (metadata only — pixel mask lives in refs.selectionMask) ──
  selection: null, // null | { x, y, w, h, poly? }

  // ── History availability ─────────────────────────────────────────────────
  // The actual stack lives in refs — these are just UI flags.
  canUndo: false,
  canRedo: false,

  // ── Canvas resize helpers ─────────────────────────────────────────────────
  resizeAnchor: "mc", // tl | tc | tr | ml | mc | mr | bl | bc | br
  customW: 128,
  customH: 128,

  // ── View ─────────────────────────────────────────────────────────────────
  gridVisible: true,
  frameGridVisible: false,
  // Custom overlay grid — cell dimensions in pixels. null disables drawing.
  frameConfig: { frameW: 16, frameH: 16 },
  refImage: null, // data URL of reference image, or null
  refOpacity: 0.5,
  refVisible: true,
  tileVisible: false,
  tileCount: 2,

  // ── UI state ─────────────────────────────────────────────────────────────
  panelTab: "palette", // palette | brush | layers | canvas | view | more
  exportOpen: false,
  exportFramesPerRow: 4,
  exportPadding: 1,
  exportLabels: false,
};

// Export seed values so the Provider can initialize refs consistently
export const INIT_LAYER = _initLayer;
export const INIT_FRAME = _initFrame;
