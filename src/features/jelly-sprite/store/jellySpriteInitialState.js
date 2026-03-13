import { makeLayer, makeFrame } from "../jellySprite.constants";

const _initLayer = makeLayer("Layer 1");
const _initFrame = makeFrame("Frame 1");

/**
 * JellySpriteStore initial state — document / playback state only.
 *
 * Tool, brush, color, palette, and view state have been extracted to
 * ToolContext (Sprint 7b). Everything here is document-level:
 * canvas geometry, layers/frames structure, playback, history flags.
 */
export const jellySpriteInitialState = {
  // Canvas geometry
  canvasW: 32,
  canvasH: 32,

  // Layers
  layers: [_initLayer],
  activeLayerId: _initLayer.id,
  editingMaskId: null,

  // Frames
  frames: [_initFrame],
  activeFrameIdx: 0,
  frameThumbnails: {},

  // Playback
  isPlaying: false,
  fps: 8,
  playbackFrameIdx: 0,
  onionSkinning: false,

  // Selection (metadata only — pixel mask lives in refs.selectionMask)
  selection: null,

  // History availability (actual stack lives in refs)
  canUndo: false,
  canRedo: false,
};

// Export seed values so the Provider can initialize refs consistently
export const INIT_LAYER = _initLayer;
export const INIT_FRAME = _initFrame;
