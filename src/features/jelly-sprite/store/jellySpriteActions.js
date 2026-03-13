// Canvas geometry
export const SET_CANVAS_SIZE = "SET_CANVAS_SIZE"; // { w, h }
export const SET_ZOOM = "SET_ZOOM"; // number

// Tools
export const SET_TOOL = "SET_TOOL"; // string (tool id)
export const SET_FILL_SHAPES = "SET_FILL_SHAPES"; // boolean
export const SET_SYMMETRY_H = "SET_SYMMETRY_H"; // boolean
export const SET_SYMMETRY_V = "SET_SYMMETRY_V"; // boolean
export const SET_WAND_TOLERANCE = "SET_WAND_TOLERANCE"; // number 0–255
export const SET_WAND_CONTIGUOUS = "SET_WAND_CONTIGUOUS"; // boolean

// Brush
export const SET_BRUSH_TYPE = "SET_BRUSH_TYPE"; // string (brush id)
export const SET_BRUSH_SIZE = "SET_BRUSH_SIZE"; // number 1–32
export const SET_BRUSH_OPACITY = "SET_BRUSH_OPACITY"; // number 1–100
export const SET_BRUSH_HARDNESS = "SET_BRUSH_HARDNESS"; // number 0–100

// Color
export const SET_FG_COLOR = "SET_FG_COLOR"; // hex string
export const SET_BG_COLOR = "SET_BG_COLOR"; // hex string
export const SET_FG_ALPHA = "SET_FG_ALPHA"; // number 0–1
export const SWAP_COLORS = "SWAP_COLORS"; // no payload
export const PICK_COLOR = "PICK_COLOR"; // hex string — sets fgColor + history
export const COMMIT_COLOR = "COMMIT_COLOR"; // string[] — [selected, ...related tones]

// Palette
export const SET_ACTIVE_PALETTE = "SET_ACTIVE_PALETTE"; // palette name string
export const PALETTE_ADD_COLOR = "PALETTE_ADD_COLOR"; // hex string
export const PALETTE_REMOVE_COLOR = "PALETTE_REMOVE_COLOR"; // hex string
export const PALETTE_ADD_NEW = "PALETTE_ADD_NEW"; // { name }
export const PALETTE_DELETE = "PALETTE_DELETE"; // palette name string
export const PALETTE_RENAME = "PALETTE_RENAME"; // { oldName, newName }
export const PALETTE_SET_COLORS = "PALETTE_SET_COLORS"; // { name, colors }

// Layers
export const SET_LAYERS = "SET_LAYERS"; // Layer[] — bridge for frame hook until M6
export const SET_ACTIVE_LAYER = "SET_ACTIVE_LAYER"; // layerId string
export const SET_EDITING_MASK = "SET_EDITING_MASK"; // layerId string | null
export const ADD_LAYER = "ADD_LAYER"; // { layer } — new layer object
export const DELETE_LAYER = "DELETE_LAYER"; // { layerId, remainingLayers, newActiveLayerId }
export const DUPLICATE_LAYER = "DUPLICATE_LAYER"; // { newLayer, insertAfterIndex }
export const MOVE_LAYER_UP = "MOVE_LAYER_UP"; // layerId string
export const MOVE_LAYER_DOWN = "MOVE_LAYER_DOWN"; // layerId string
export const UPDATE_LAYER = "UPDATE_LAYER"; // { layerId, patch }
export const MERGE_LAYER_DOWN = "MERGE_LAYER_DOWN"; // { survivingLayerId, removedLayerId }
export const FLATTEN_ALL = "FLATTEN_ALL"; // { newLayer }
export const ADD_LAYER_MASK = "ADD_LAYER_MASK"; // layerId string
export const REMOVE_LAYER_MASK = "REMOVE_LAYER_MASK"; // layerId string

// Frames
export const ADD_FRAME = "ADD_FRAME"; // { frame, layer }
export const DELETE_FRAME = "DELETE_FRAME"; // { frameId, remainingFrames, newIdx, newLayers, newActiveLayerId }
export const DUPLICATE_FRAME = "DUPLICATE_FRAME"; // { newFrame, insertIdx, layers, activeLayerId }
export const RENAME_FRAME = "RENAME_FRAME"; // { frameId, name }
export const SWITCH_FRAME = "SWITCH_FRAME"; // { newIdx, layers, activeLayerId }
export const UPDATE_THUMBNAIL = "UPDATE_THUMBNAIL"; // { frameId, dataUrl }

// Playback
export const SET_IS_PLAYING = "SET_IS_PLAYING"; // boolean
export const SET_FPS = "SET_FPS"; // number
export const SET_PLAYBACK_FRAME_IDX = "SET_PLAYBACK_FRAME_IDX"; // number
export const SET_ONION_SKINNING = "SET_ONION_SKINNING"; // boolean

// Selection
export const SET_SELECTION = "SET_SELECTION"; // { x, y, w, h, poly? } | null

// History
export const STROKE_COMPLETE = "STROKE_COMPLETE"; // { frameId, dataUrl } thumbnail update + canUndo
export const SET_CAN_UNDO = "SET_CAN_UNDO"; // boolean
export const SET_CAN_REDO = "SET_CAN_REDO"; // boolean
export const RESTORE_HISTORY = "RESTORE_HISTORY"; // { layers, activeLayerId, canUndo, canRedo }

// View
export const SET_GRID_VISIBLE = "SET_GRID_VISIBLE"; // boolean
export const SET_FRAME_GRID_VISIBLE = "SET_FRAME_GRID_VISIBLE"; // boolean
export const SET_FRAME_CONFIG = "SET_FRAME_CONFIG"; // { frameW, frameH } | null
export const SET_REF_IMAGE = "SET_REF_IMAGE"; // dataUrl string | null
export const SET_REF_OPACITY = "SET_REF_OPACITY"; // number 0–1
export const SET_REF_VISIBLE = "SET_REF_VISIBLE"; // boolean
export const SET_TILE_VISIBLE = "SET_TILE_VISIBLE"; // boolean
export const SET_TILE_COUNT = "SET_TILE_COUNT"; // number

// Persistence
export const LOAD_JELLY_STATE = "LOAD_JELLY_STATE"; // document state restore (from jellySpritePersistence)
export const LOAD_TOOL_STATE = "LOAD_TOOL_STATE"; // tool state restore (into ToolContext)

// UI
export const SET_PANEL_TAB = "SET_PANEL_TAB"; // tab id string
export const SET_RESIZE_ANCHOR = "SET_RESIZE_ANCHOR"; // anchor string
export const SET_CUSTOM_W = "SET_CUSTOM_W"; // number
export const SET_CUSTOM_H = "SET_CUSTOM_H"; // number
