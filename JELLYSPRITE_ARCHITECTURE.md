# JellySprite Architecture Reference

> **Stack:** React 19 + Vite · **Design:** Option B pixel-in-refs  
> **Last updated:** 2026-03-08 — M21 complete (onion skinning overlay fix, error boundary).

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [File Map](#2-file-map)
3. [The Two Data Classes](#3-the-two-data-classes)
4. [The `refs` Object — Complete Reference](#4-the-refs-object--complete-reference)
5. [Store — State Shape, Actions & Reducer](#5-store--state-shape-actions--reducer)
6. [Engine Layer](#6-engine-layer)
7. [Component & Hook Layer](#7-component--hook-layer)
8. [Data Flow Pipelines](#8-data-flow-pipelines)
9. [Selection System](#9-selection-system)
10. [Canvas Resize Pipeline](#10-canvas-resize-pipeline)
11. [Frame System](#11-frame-system)
12. [Playback System](#12-playback-system)
13. [Export System](#13-export-system)
14. [Keyboard Shortcuts](#14-keyboard-shortcuts)
15. [Constants & Factory Functions](#15-constants--factory-functions)
16. [Known Gotchas & Pitfalls](#16-known-gotchas--pitfalls)

---

## 1. Design Principles

### Option B Architecture

JellySprite uses a split-data approach:

| Data type                                                             | Where it lives           | Why                                                     |
| --------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------- |
| **Metadata** (layer names, visibility, tool state, palette, UI flags) | `useReducer` store state | Needs to trigger React re-renders                       |
| **Pixel data** (Uint8ClampedArray buffers)                            | `refs` object            | Never needs to re-render; mutated at 60fps without cost |

This means:

- **React state is cheap.** Every dispatch is for metadata only. No large arrays pass through the reducer.
- **Pixel mutations are free.** `refs.pixelBuffers[layerId][i] = 255` never triggers a render.
- **Closures never go stale.** The drawing engine and renderer both read `refs.stateRef.current` instead of closing over React state, so they always see the latest values without needing to be re-created.
- **No prop drilling.** All engine functions receive the single `refs` object.

### Engine Separation

The four engine files contain pure logic with no React imports:

- `drawingEngine.js` — all pointer input
- `compositeEngine.js` — layer compositing
- `historyEngine.js` — snapshot undo/redo
- `pixelOps.js` — low-level pixel math

This means they can be unit tested in isolation and reused outside React.

---

## 2. File Map

```
src/features/jelly-sprite/
│
│  ── Root components ─────────────────────────────────────────────────────────
├── JellySprite.jsx              Main body component (~1440 lines)
│                                 Mounts all panels + wires all action handlers
│                                 Contains keyboard shortcut handler + all
│                                 higher-level operations (changeSize, loadRef,
│                                 copy/paste, frame management, etc.)
│
├── JellySpriteWorkspace.jsx     Workspace wrapper
│                                 Wraps JellySpriteBody in <Page> + title bar
│                                 Handles project save/load integration
│
├── JellySprite.css              1457 lines — full UI coverage (136 rule blocks)
├── BrushThumb.jsx               Brush shape preview canvas (pure visual)
├── FrameThumb.jsx               Frame strip thumbnail (pure visual)
├── JellySpriteContext.js        Re-exports JellySpriteCtx for external consumers
│
│  ── Panels ───────────────────────────────────────────────────────────────────
├── panels/
│   ├── CanvasArea.jsx           Main canvas element + frame strip UI
│   │                             Forwards pointer events → refs.drawingEngine
│   ├── LeftToolbar.jsx          Tool buttons, symmetry, zoom, grid, transform,
│   │                             history — reads/dispatches via useJellySprite()
│   └── RightPanel.jsx           6-tab right panel (936 lines):
│                                  Palette · Brush · Layers · Canvas · View · More
│                                  + ExportModal integration
│
│  ── Store ─────────────────────────────────────────────────────────────────────
├── store/
│   ├── JellySpriteProvider.jsx  useReducer + refs object creation + context
│   ├── jellySpriteReducer.js    Pure reducer — handles all 91 action types
│   ├── jellySpriteActions.js    91 action type string constants (export *)
│   ├── jellySpriteInitialState.js  Full initial state + INIT_LAYER + INIT_FRAME
│   └── useJellySpriteStore.js   useContext(JellySpriteStoreCtx) → {state, dispatch, refs}
│
│  ── Engines ────────────────────────────────────────────────────────────────────
├── engine/
│   ├── canvasRenderer.js        createRenderer(refs) → { redraw }
│   ├── compositeEngine.js       compositeLayersToCanvas(layers, px, masks, canvas)
│   ├── drawingEngine.js         createDrawingEngine(refs) → pointer handlers + onSelectionChange
│   ├── historyEngine.js         wireHistoryEngine(refs, dispatch)
│   └── pixelOps.js              Pure pixel-math helpers (311 lines)
│
│  ── Hooks ──────────────────────────────────────────────────────────────────────
├── hooks/
│   ├── useCanvas.js             Wires canvasEl/offscreenEl + all three engines on mount
│   ├── useDrawingTools.js       Legacy hook — fallback for operations not on drawingEngine
│   ├── useFramePlayback.js      setInterval-based playback management
│   ├── useHistory.js            History stack state management
│   └── useLayerManager.js       Layer CRUD operations
│
│  ── Utilities ──────────────────────────────────────────────────────────────────
├── jellySprite.constants.js     TOOL_GROUPS, BRUSH_TYPES, BLEND_MODES,
│                                 CANVAS_SIZES, PANEL_TABS, MAX_HISTORY,
│                                 MAX_COLOUR_HISTORY, makeLayer(), makeFrame()
└── jellySprite.utils.js         hexToRgba, rgbaToHex, bresenhamLine,
                                  rasterRect, rasterEllipse, buildLassoMask
```

---

## 3. The Two Data Classes

### Class A — Metadata (React state via `useReducer`)

Everything that determines _how_ to draw or _what_ the UI looks like:

- Layer names, visibility, opacity, blend mode, order
- Active layer + frame index
- Tool type, brush settings, colors, palette
- Canvas dimensions, zoom, grid flags
- Export settings, UI panel tab open/closed
- Playback FPS, onion skinning flag
- History flags (canUndo/canRedo — the **stack itself** is in refs)

**Rule:** If it needs to re-render the UI, put it in state via dispatch.

### Class B — Pixel data (Mutable refs — no React involvement)

Everything that changes at drawing speed:

- `refs.pixelBuffers` — active frame's pixel data per layer
- `refs.maskBuffers` — layer mask data per layer
- `refs.frameSnapshots` — all other frames' pixel + mask data
- `refs.historyStack` — undo/redo snapshots
- `refs.clipboard` — copy/paste buffer
- `refs.selectionMask` — per-pixel lasso/wand selection mask
- `refs.canvasEl`, `refs.offscreenEl`, `refs.tileCanvasEl`, `refs.refImgEl` — DOM handles

**Rule:** If it changes during a brush stroke, put it in refs and call `refs.redraw()`.

---

## 4. The `refs` Object — Complete Reference

The `refs` object is created once in `JellySpriteProvider.jsx` via `useRef({...}).current`. It is a plain object that mutates freely and **never triggers re-renders**.

### Pixel Data

| Field            | Type                               | Description                                                              |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| `pixelBuffers`   | `{ [layerId]: Uint8ClampedArray }` | Active frame's RGBA pixel data, 4 bytes per pixel, row-major             |
| `maskBuffers`    | `{ [layerId]: Uint8Array }`        | Active frame's layer mask data, 1 byte per pixel (0=hidden, 255=visible) |
| `frameSnapshots` | `{ [frameId]: FrameSnapshot }`     | Complete saved state for every frame (see below)                         |

**FrameSnapshot shape:**

```js
{
  layers: Layer[],             // layer metadata array
  activeLayerId: string,       // active layer at time of save
  pixelBuffers: { [layerId]: Uint8ClampedArray },
  maskBuffers:  { [layerId]: Uint8Array },
}
```

### History

| Field          | Type             | Description                                       |
| -------------- | ---------------- | ------------------------------------------------- |
| `historyStack` | `HistoryEntry[]` | Array of snapshots (capped at `MAX_HISTORY = 50`) |
| `historyIndex` | `number`         | Current position in the stack; -1 = empty         |

**HistoryEntry shape:**

```js
{
  layers: Layer[],             // immutable — safe to share refs
  activeLayerId: string,
  pixelBuffers: { [layerId]: Uint8ClampedArray },  // deep copies
  maskBuffers:  { [layerId]: Uint8Array },         // deep copies
}
```

### Drawing / Selection State

| Field                   | Type                        | Description                                                                                                                                                           |
| ----------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clipboard`             | `Uint8ClampedArray \| null` | RGBA pixels of the copied region                                                                                                                                      |
| `clipboardW`            | `number`                    | Width of clipboard region in pixels                                                                                                                                   |
| `clipboardH`            | `number`                    | Height of clipboard region in pixels                                                                                                                                  |
| `selectionMask`         | `Uint8Array \| null`        | Per-pixel selection mask (1=selected, 0=not). **Always at current canvas coords** — translated on move pointer-up.                                                    |
| `selectionMaskOrigin`   | `{x,y} \| null`             | Canvas position of the mask when it was last committed (after a selection tool or move pointer-up). Used by `buildMaskEdgePath` to offset mask lookups during a drag. |
| `selectionMaskPath`     | `Path2D \| null`            | Cached `Path2D` of the marching ants boundary. Invalidated when zoom, position, or mask changes.                                                                      |
| `selectionMaskPathZoom` | `number`                    | Zoom value at time of last `selectionMaskPath` build.                                                                                                                 |
| `selectionMaskPathX`    | `number`                    | `selection.x` at time of last path build — detects position change during move drag.                                                                                  |
| `selectionMaskPathY`    | `number`                    | `selection.y` at time of last path build.                                                                                                                             |
| `lassoPath`             | `{x,y}[]`                   | Live lasso points being drawn (shown as in-progress path)                                                                                                             |
| `marchOffset`           | `number`                    | Marching ants dash animation phase (advances ~8px/sec via timestamp delta)                                                                                            |
| `marchingAntsRaf`       | `number \| null`            | `requestAnimationFrame` id for ants animation                                                                                                                         |
| `selection`             | `SelectionRect \| null`     | Engine's live selection value; written by `drawingEngine`, mirrors `state.selection`                                                                                  |

### Canvas DOM Elements

| Field          | Type                        | Set by                                          | Description                      |
| -------------- | --------------------------- | ----------------------------------------------- | -------------------------------- |
| `canvasEl`     | `HTMLCanvasElement \| null` | `useCanvas` mount effect                        | The visible zoomed canvas        |
| `offscreenEl`  | `HTMLCanvasElement \| null` | `useCanvas` mount effect                        | Offscreen 1:1 compositing canvas |
| `tileCanvasEl` | `HTMLCanvasElement \| null` | `useEffect([tileVisible])` in JellySprite.jsx   | Tile preview canvas element      |
| `refImgEl`     | `HTMLImageElement \| null`  | `loadRefImage()` / cleared by `clearRefImage()` | Reference image overlay element  |

> **Important:** `tileCanvasEl` and `refImgEl` must be populated for the renderer to draw the tile preview and reference image overlay. See [Gotchas §16.3](#163-tilecanvasel--refimgel-wiring).

### Selection mask invariant

`refs.selectionMask` **always lives at the current absolute canvas coordinates** of the selection. This is enforced by `drawingEngine.js` at pointer-up for the move tool: it translates all set bits by `(selection.x − selectionMaskOrigin.x, selection.y − selectionMaskOrigin.y)` and then resets `selectionMaskOrigin` to the new position.

During an active move drag (between pointer-down and pointer-up), the mask has not yet been translated. `buildMaskEdgePath` handles this by computing the same offset on-the-fly from `selectionMaskOrigin` vs the current `selection` position — so the outline renders correctly at all times.

Consequence: any code reading `refs.selectionMask` at a given `(px, py)` can always use current canvas coords directly.

### State Snapshot for Closures

| Field      | Type                 | Description                                                                                                                                                            |
| ---------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stateRef` | `{ current: state }` | Always-current view of React state. Updated synchronously every render in `JellySpriteProvider`. Used by drawing engine and renderer so their closures never go stale. |

### Playback

| Field              | Type             | Description                                                        |
| ------------------ | ---------------- | ------------------------------------------------------------------ |
| `playIntervalId`   | `number \| null` | `setInterval` id for frame playback                                |
| `playbackFrameIdx` | `number`         | Current frame displayed during playback                            |
| `isPlaying`        | `boolean`        | Mirrors `state.isPlaying` — used in renderer to pick display frame |

### Injected Functions

These start as no-ops (`() => {}`) and are overwritten by the hooks that create the real implementations.

| Field           | Set by                                | Signature       | Description                               |
| --------------- | ------------------------------------- | --------------- | ----------------------------------------- |
| `redraw`        | `useCanvas`                           | `() => void`    | Re-composites and redraws the full canvas |
| `pushHistory`   | `useCanvas` (via `wireHistoryEngine`) | `() => void`    | Snapshot current pixel state              |
| `undoHistory`   | `useCanvas` (via `wireHistoryEngine`) | `() => void`    | Apply previous snapshot                   |
| `redoHistory`   | `useCanvas` (via `wireHistoryEngine`) | `() => void`    | Apply next snapshot                       |
| `drawingEngine` | `useCanvas`                           | `DrawingEngine` | Pointer event handlers object             |

---

## 5. Store — State Shape, Actions & Reducer

### State Shape (`jellySpriteInitialState.js`)

```js
{
  // ── Canvas geometry ────────────────────────────────────────────────────────
  canvasW:          128,        // canvas width in pixels
  canvasH:          128,        // canvas height in pixels
  zoom:             4,          // display scale factor (1–16)

  // ── Layers (active frame's metadata) ──────────────────────────────────────
  layers:           [Layer],    // {id, name, visible, opacity, blendMode, hasMask}
  activeLayerId:    string,     // id of the currently selected layer
  editingMaskId:    null,       // non-null → brush writes to mask buffer, not pixels

  // ── Frames ────────────────────────────────────────────────────────────────
  frames:           [Frame],    // {id, name} — pixel data is in refs.frameSnapshots
  activeFrameIdx:   0,          // index into frames[]
  frameThumbnails:  {},         // { [frameId]: dataUrl } — used in frame strip

  // ── Playback ──────────────────────────────────────────────────────────────
  isPlaying:        false,
  fps:              8,          // playback speed in frames per second
  onionSkinning:    false,      // show prev/next frame ghosts while editing

  // ── Tools ─────────────────────────────────────────────────────────────────
  tool:             "pencil",   // see TOOL_GROUPS for all valid values
  fillShapes:       false,      // true → rect/ellipse filled; false → outline
  symmetryH:        false,      // mirror brush strokes horizontally
  symmetryV:        false,      // mirror brush strokes vertically

  // ── Brush ──────────────────────────────────────────────────────────────────
  brushType:        "round",    // round|square|diamond|cross|pixel|dither|dither2|star|ring|slash|bslash
  brushSize:        1,          // stamp radius in pixels (1–32)
  brushOpacity:     100,        // 1–100; applied via Porter-Duff "over" compositing
  brushHardness:    100,        // 0–100; cosine feather falloff at edges (100 = hard edge)

  // ── Color ─────────────────────────────────────────────────────────────────
  fgColor:          "#000000",  // foreground hex color
  bgColor:          "#ffffff",  // background hex color
  fgAlpha:          1,          // foreground alpha (0–1, separate from brushOpacity)
  colorHistory:     [],         // last MAX_COLOUR_HISTORY (10) hex strings used

  // ── Palettes ──────────────────────────────────────────────────────────────
  palettes:         {...BUILTIN_PALETTES},  // { [name]: hex[] }
  activePalette:    "DoomJelly 32",

  // ── Magic wand settings ──────────────────────────────────────────────────
  wandTolerance:    15,         // 0–255; how different a pixel can be and still be selected
  wandContiguous:   true,       // true = flood-fill neighbours; false = all matching pixels

  // ── Selection (metadata only) ─────────────────────────────────────────────
  // Pixel-level mask is in refs.selectionMask.
  selection:        null,       // null | { x, y, w, h, poly?: [{x,y},...] }

  // ── History flags (stack is in refs) ──────────────────────────────────────
  canUndo:          false,
  canRedo:          false,

  // ── Canvas resize UI ──────────────────────────────────────────────────────
  resizeAnchor:     "mc",       // tl|tc|tr|ml|mc|mr|bl|bc|br
  customW:          128,
  customH:          128,

  // ── View overlays ─────────────────────────────────────────────────────────
  gridVisible:      true,       // pixel grid (only drawn at zoom >= 4)
  frameGridVisible: false,      // custom overlay grid; off by default
  frameConfig:      { frameW: 16, frameH: 16 }, // custom grid cell size in pixels
  refImage:         null,       // data URL of the reference image | null
  refOpacity:       0.5,        // reference image overlay opacity
  refVisible:       true,       // reference image visibility toggle
  tileVisible:      false,      // show tiling preview canvas
  tileCount:        2,          // n×n tile grid for tile preview

  // ── UI state ──────────────────────────────────────────────────────────────
  panelTab:         "palette",  // palette|brush|layers|canvas|view|more
  exportOpen:       false,
  exportFramesPerRow: 4,
  exportPadding:    1,          // pixels between frames in sprite sheet
  exportLabels:     false,      // draw frame name labels on sprite sheet
}
```

### Layer Object Shape

```js
{
  id:        string,   // "layer-N" — generated by makeLayer()
  name:      string,
  visible:   boolean,
  opacity:   number,   // 0.0–1.0
  locked:    boolean,
  blendMode: string,   // CSS composite operation (see BLEND_MODES)
  hasMask:   boolean,  // true → refs.maskBuffers[id] exists
}
```

### Frame Object Shape

```js
{
  id:   string,  // "frame-N" — generated by makeFrame()
  name: string,
}
```

### All 91 Action Types

```
── Canvas ─────────────────────────────────────────────────────────────────────
SET_CANVAS_SIZE         payload: { w, h }
SET_ZOOM                payload: number

── Tools ──────────────────────────────────────────────────────────────────────
SET_TOOL                payload: string (tool id)
SET_FILL_SHAPES         payload: boolean
SET_SYMMETRY_H          payload: boolean
SET_SYMMETRY_V          payload: boolean

── Brush ──────────────────────────────────────────────────────────────────────
SET_BRUSH_TYPE          payload: string (brush id)
SET_BRUSH_SIZE          payload: number
SET_BRUSH_OPACITY       payload: number

── Color ──────────────────────────────────────────────────────────────────────
SET_FG_COLOR            payload: hex string
SET_BG_COLOR            payload: hex string
SET_FG_ALPHA            payload: 0–1
SWAP_COLORS             (no payload — swaps fgColor / bgColor)
PICK_COLOR              payload: hex string (sets fgColor from picker tool)

── Palette ────────────────────────────────────────────────────────────────────
SET_ACTIVE_PALETTE      payload: palette name string
PALETTE_ADD_COLOR       payload: hex string
PALETTE_REMOVE_COLOR    payload: hex string
PALETTE_ADD_NEW         payload: { name: string }
PALETTE_DELETE          payload: palette name string
PALETTE_RENAME          payload: { oldName: string, newName: string }
PALETTE_SET_COLORS      payload: { name: string, colors: hex[] }

── Layers ─────────────────────────────────────────────────────────────────────
SET_LAYERS              payload: Layer[]
SET_ACTIVE_LAYER        payload: layerId string
SET_EDITING_MASK        payload: layerId | null
ADD_LAYER               payload: { layer: Layer }
DELETE_LAYER            payload: { layerId, remainingLayers, newActiveLayerId }
DUPLICATE_LAYER         payload: { newLayer: Layer, insertAfterIndex: number }
MOVE_LAYER_UP           payload: layerId string
MOVE_LAYER_DOWN         payload: layerId string
UPDATE_LAYER            payload: { layerId: string, patch: Partial<Layer> }
MERGE_LAYER_DOWN        payload: { survivingLayerId, removedLayerId }
FLATTEN_ALL             payload: { newLayer: Layer }
ADD_LAYER_MASK          payload: layerId string
REMOVE_LAYER_MASK       payload: layerId string

── Frames ─────────────────────────────────────────────────────────────────────
ADD_FRAME               payload: { frame: Frame, layer: Layer }
DELETE_FRAME            payload: { frameId, remainingFrames, newIdx, newLayers, newActiveLayerId }
DUPLICATE_FRAME         payload: { newFrame, insertIdx, layers, activeLayerId }
RENAME_FRAME            payload: { frameId, name }
SWITCH_FRAME            payload: { newIdx, layers, activeLayerId }
UPDATE_THUMBNAIL        payload: { frameId, dataUrl }

── Playback ───────────────────────────────────────────────────────────────────
SET_IS_PLAYING          payload: boolean
SET_FPS                 payload: number
SET_ONION_SKINNING      payload: boolean

── Selection ──────────────────────────────────────────────────────────────────
SET_SELECTION           payload: { x, y, w, h, poly?: [{x,y}] } | null

── History ────────────────────────────────────────────────────────────────────
STROKE_COMPLETE         payload: { frameId, dataUrl }
SET_CAN_UNDO            payload: boolean
SET_CAN_REDO            payload: boolean
RESTORE_HISTORY         payload: { layers, activeLayerId, canUndo, canRedo }

── View ───────────────────────────────────────────────────────────────────────
SET_GRID_VISIBLE        payload: boolean
SET_FRAME_GRID_VISIBLE  payload: boolean
SET_FRAME_CONFIG        payload: { frameW: number, frameH: number }
SET_REF_IMAGE           payload: dataUrl | null
SET_REF_OPACITY         payload: 0–1
SET_REF_VISIBLE         payload: boolean
SET_TILE_VISIBLE        payload: boolean
SET_TILE_COUNT          payload: number

── UI ─────────────────────────────────────────────────────────────────────────
SET_PANEL_TAB           payload: string (tab id)
SET_EXPORT_OPEN         payload: boolean
SET_EXPORT_FRAMES_PER_ROW  payload: number
SET_EXPORT_PADDING      payload: number
SET_EXPORT_LABELS       payload: boolean
SET_RESIZE_ANCHOR       payload: string
SET_CUSTOM_W            payload: number
SET_CUSTOM_H            payload: number
```

### Reducer Rules

`jellySpriteReducer.js` is a pure function — same input always produces same output. Key rules:

1. Always returns a new object (never mutates `state`).
2. Does not touch `refs` at all — refs mutations happen in hooks/handlers.
3. Frame-related actions (`SWITCH_FRAME`, `ADD_FRAME`, etc.) carry precomputed `layers` and `activeLayerId` from the caller because the reducer cannot access `refs.frameSnapshots`.
4. `RESTORE_HISTORY` is the only action that restores `layers` and `activeLayerId` — this is dispatched by `undoHistory` / `redoHistory` after the pixel buffers are already restored.

---

## 6. Engine Layer

### `canvasRenderer.js` — `createRenderer(refs)`

Creates the `redraw()` function. Call `refs.redraw()` any time pixels or display params change.

**Render order (single call):**

1. Clear the visible canvas.
2. Composite active (or playback) frame's layers via `compositeLayersToCanvas` → draw scaled to `zoom` onto visible canvas.
3. If `onionSkinning` is on and not playing: draw previous frame (red tint) and next frame (blue tint) **as overlay** at 30% opacity on top of the active frame.
4. If `refImgEl` and `refVisible`: draw reference image overlay at `refOpacity`.
5. If `gridVisible && zoom >= 4`: draw pixel grid.
6. If `frameGridVisible && frameConfig`: draw frame boundary grid.
7. If `lassoPath.length > 1`: draw live lasso path (white + dashed black).
8. If `selection`: draw marching ants (rect or poly).
9. If `tileVisible && tileCanvasEl`: render n×n tile grid onto the tile canvas.

**Performance notes:**

- No heap allocations on the hot path except for onion-skin ghost compositing.
- `imageSmoothingEnabled = false` throughout for crisp pixel rendering.
- `refs.stateRef.current` is read once into a destructure at the top of each `redraw()` call.

---

### `compositeEngine.js` — `compositeLayersToCanvas(layers, pixelBuffers, maskBuffers, target)`

Pure function. Composites a layer stack onto a canvas element.

**Per visible layer:**

1. Skip if `layer.visible === false` or no pixel data.
2. If the layer has a mask (`maskBuffers[layer.id]` exists): create a copy of the pixel data and multiply each pixel's alpha by the normalized mask value.
3. Create an `ImageData` and `putImageData` onto a temporary canvas.
4. Draw the temporary canvas onto `target` using `globalAlpha = layer.opacity` and `globalCompositeOperation = layer.blendMode`.

Used by:

- `canvasRenderer.js` — display compositing
- `compositeFrameToCanvas()` in `JellySprite.jsx` — compositing frames for export
- Thumbnail generation

---

### `drawingEngine.js` — `createDrawingEngine(refs)`

Creates pointer event handlers. All state is read exclusively from `refs.stateRef.current` — the factory never closes over React state directly.

**Returns:**

```js
{
  onPointerDown:    (PointerEvent) => void,
  onPointerMove:    (PointerEvent) => void,
  onPointerUp:      (PointerEvent) => void,
  onPointerLeave:   (PointerEvent) => void,
  onSelectionChange: (callback: (sel) => void) => void,  // subscribe to selection changes
}
```

**Per-stroke private state (inside factory closure, not in refs):**

- `isDrawing` — whether a stroke is in progress
- `startPx` — `{x,y}` where the stroke began
- `lastPx` — last drawn position (for Bresenham interpolation)
- `previewSnap` — `Uint8ClampedArray` snapshot taken before shape preview starts (restored on move)
- `moveOrigin` — `{x,y,selX,selY}` for move-selection tool
- `movePixels` — `Uint8ClampedArray` of lifted selection content

**Tool behavior matrix:**

| Tool           | `onPointerDown`                           | `onPointerMove`                            | `onPointerUp`                         |
| -------------- | ----------------------------------------- | ------------------------------------------ | ------------------------------------- |
| `pencil`       | `applyFreehand`                           | Bresenham to last pos then `applyFreehand` | `refs.pushHistory()`                  |
| `eraser`       | Same as pencil with `[0,0,0,0]`           | Same                                       | `refs.pushHistory()`                  |
| `spray`        | `sprayBrush`                              | `sprayBrush` every move                    | `refs.pushHistory()`                  |
| `fill`         | `floodFill` at click pos                  | —                                          | `refs.pushHistory()`                  |
| `picker`       | `getPixel`, fire `onSelectionChange(hex)` | Same                                       | —                                     |
| `line`         | Store `startPx`, copy `previewSnap`       | Restore `previewSnap`, `drawLine` preview  | `refs.pushHistory()`                  |
| `rect`         | Store `startPx`, copy `previewSnap`       | Restore, `drawRect` preview                | `refs.pushHistory()`                  |
| `ellipse`      | Store `startPx`, copy `previewSnap`       | Restore, `drawEllipse` preview             | `refs.pushHistory()`                  |
| `select-rect`  | Begin selection                           | Update `{x,y,w,h}`, call `setSelection`    | Finalize                              |
| `select-lasso` | Begin `lassoPath`                         | Push to `lassoPath`                        | `buildLassoMask`, call `setSelection` |
| `select-wand`  | `magicWandBounds`, build mask             | —                                          | `setSelection`                        |
| `move`         | Lift pixels from selection                | Move lifted pixels to new pos              | Stamp + `refs.pushHistory()`          |

**`applyFreehand(x, y)` routes to:**

- `pencil` → `stampBrush(ctx, x, y, rgba)`
- `eraser` → `stampBrush(ctx, x, y, [0,0,0,0])`
- `spray` → `sprayBrush(ctx, x, y, rgba)`
- `fill` → `floodFill(buf, x, y, w, h, rgba, sel, lassoMask)`

**`makeBrushCtx(refs)` builds:**

```js
{
  buf:          refs.pixelBuffers[activeLayerId],
  maskBuf:      refs.maskBuffers[editingMaskId] or null,
  editingMaskId,
  brushType, brushSize,
  symmetryH, symmetryV,
  w: canvasW, h: canvasH,
  sel:          refs.selection,
  lassoMask:    refs.selectionMask,
}
```

**`getActiveRgba(refs)`:**
Combines `fgColor` hex with `fgAlpha * (brushOpacity / 100)` to produce the final `[r,g,b,a]` painted.

**Selection notification:**
The engine maintains a `selListeners[]` array. When `setSelection(val)` is called internally, it writes to `refs.selection` _and_ calls all registered listeners. `useCanvas.js` subscribes with `refs.drawingEngine.onSelectionChange(sel => dispatch({type: "SET_SELECTION", payload: sel}))` so state.selection stays synced.

---

### `historyEngine.js` — `wireHistoryEngine(refs, dispatch)`

Attaches `pushHistory`, `undoHistory`, `redoHistory` to `refs` and seeds the initial snapshot.

**`pushHistory()`:**

1. Deep-copy all `pixelBuffers` and `maskBuffers`.
2. Truncate forward history (invalidates redo).
3. Push snapshot; cap at `MAX_HISTORY = 50`.

**`undoHistory()` / `redoHistory()`:**

1. Decrement/increment `refs.historyIndex`.
2. Call `applySnapshot(refs, snapshot, dispatch)`:
   - Restore pixel buffers in-place (`.set(buf)` if same size, or replace).
   - Restore mask buffers.
   - `dispatch(RESTORE_HISTORY)` with layers, activeLayerId, canUndo, canRedo flags.
   - `refs.redraw()`.

---

### `pixelOps.js` — Pure Pixel Helpers

All functions take explicit `(buf, w, h, ...)` params — no globals.

| Function          | Signature                                              | Description                                                                                   |
| ----------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `getPixel`        | `(buf, x, y, w) → [r,g,b,a]`                           | Read one pixel                                                                                |
| `setPixel`        | `(buf, x, y, w, h, rgba)`                              | Write one pixel (bounds-checked)                                                              |
| `stampBrush`      | `(ctx, x, y, rgba)`                                    | Paint brush stamp at (x,y) with current brush shape/size; handles symmetry and selection mask |
| `sprayBrush`      | `(ctx, x, y, rgba)`                                    | Random scatter pixels in a radius                                                             |
| `floodFill`       | `(buf, x, y, w, h, rgba, sel, lassoMask)`              | BFS flood fill respecting selection                                                           |
| `drawLine`        | `(buf, x0, y0, x1, y1, w, h, rgba, brushSize)`         | Bresenham line                                                                                |
| `drawRect`        | `(buf, x0, y0, x1, y1, w, h, rgba, filled, brushSize)` | Rect (filled or outline)                                                                      |
| `drawEllipse`     | `(buf, cx, cy, rx, ry, w, h, rgba, filled)`            | Ellipse                                                                                       |
| `magicWandBounds` | `(buf, x, y, w, h, tolerance) → {x,y,w,h,mask}`        | Returns bounding rect + per-pixel mask for contiguous matching pixels                         |
| `copyRegion`      | `(buf, x, y, rw, rh, w) → Uint8ClampedArray`           | Copy rectangular region                                                                       |
| `pasteRegion`     | `(src, dst, x, y, rw, rh, dstW, dstH, sel, lassoMask)` | Paste src into dst at offset, respecting selection                                            |

---

## 7. Component & Hook Layer

### `JellySpriteProvider.jsx`

Provides `{ state, dispatch, refs }` via `JellySpriteStoreCtx`. The `refs` object is initialized once with null buffers for the seed layer/frame. **Critically**, `refs.stateRef.current = state` is updated synchronously every render so all closures always see current state.

### `useJellySpriteStore.js`

```js
const { state, dispatch, refs } = useJellySpriteStore();
```

Thin wrapper around `useContext(JellySpriteStoreCtx)`. Used by all panels and hooks.

### `useCanvas.js`

The bootstrap hook. Called once from `CanvasArea.jsx` (or its parent).

**On mount (runs once):**

1. Sets `refs.canvasEl = canvasRef.current`
2. Creates `refs.offscreenEl = document.createElement("canvas")`
3. Initializes pixel buffers for any null-buffer layers
4. `createRenderer(refs)` → sets `refs.redraw`
5. `wireHistoryEngine(refs, dispatch)` → sets `refs.pushHistory/undoHistory/redoHistory`
6. `createDrawingEngine(refs)` → sets `refs.drawingEngine`
7. Subscribes `onSelectionChange` to dispatch `SET_SELECTION`
8. Calls `refs.redraw()`

**Reactive effects:**

- `[canvasW, canvasH]` → resize offscreen canvas + redraw
- `[zoom, gridVisible, frameGridVisible, onionSkinning, activeFrameIdx, refVisible, refOpacity, tileVisible, tileCount, selection]` → redraw only

**Returns:** `{ canvasRef }` — attach to the `<canvas>` element.

### `useLayerManager.js`

Legacy hook (predates Option B). Manages `layers`, `activeLayerId`, `editingMaskId` as local `useState`, with `layerDataRef` as the pixel buffer map. Still used as fallback by `useDrawingTools.js`. In the main editor flow, layers are now managed through the reducer via dispatched actions.

### `useHistory.js`

History stack management hook. In the full Option B implementation the history is in `refs`, but this hook provides any additional state-level tracking needed.

### `useFramePlayback.js`

Manages `setInterval`-based playback. Sets `refs.isPlaying = true/false` and calls `refs.redraw()` on each tick.

---

## 8. Data Flow Pipelines

### A. Pointer Input → Pixel Write → Redraw

```
User pointer event on <canvas>
  │
  ▼
CanvasArea.jsx → refs.drawingEngine.onPointerDown/Move/Up(e)
  │
  ▼
drawingEngine reads tool from refs.stateRef.current
  │
  ├─ pencil/eraser → stampBrush(refs.pixelBuffers[activeLayerId], ...)
  ├─ spray → sprayBrush(...)
  ├─ fill  → floodFill(...)
  ├─ line/rect/ellipse → restore previewSnap, draw shape
  └─ select-* → build refs.selectionMask, call setSelection()
  │
  ▼
refs.redraw()  ← called after every pixel mutation
  │
  ▼
canvasRenderer reads refs.pixelBuffers + refs.stateRef.current
  → compositeLayersToCanvas → offscreenEl
  → draw offscreenEl scaled by zoom → canvasEl
  → draw overlays (grid, ref image, lasso, marching ants, tile)
  │
  ▼
onPointerUp → refs.pushHistory()
```

### B. Frame Switch

```
User clicks frame strip or calls dispatch(SWITCH_FRAME)
  │
  ▼
JellySprite.jsx. switchFrame(newIdx)
  │
  ├─ Save current frame: refs.frameSnapshots[currentFrameId] = {
  │    layers, activeLayerId,
  │    pixelBuffers: deep copy of refs.pixelBuffers,
  │    maskBuffers: deep copy of refs.maskBuffers
  │  }
  │
  ├─ Load new frame from refs.frameSnapshots[newFrameId]:
  │    refs.pixelBuffers = copy of snapshot.pixelBuffers
  │    refs.maskBuffers  = copy of snapshot.maskBuffers
  │
  ├─ dispatch(SWITCH_FRAME, { newIdx, layers, activeLayerId })
  │    → reducer updates state.activeFrameIdx, state.layers, state.activeLayerId
  │
  └─ refs.redraw()
```

### C. Canvas Resize

```
User submits new size in Canvas tab → changeSize(newW, newH, anchor)
  │
  ▼
1. Compute offset (dx, dy) based on resizeAnchor
2. Resize current frame buffers:
   - For each layer: create new Uint8ClampedArray(newW * newH * 4)
   - Copy pixels at offset using setPixel
   - refs.pixelBuffers[layerId] = newBuf
3. Resize mask buffers (same logic with Uint8Array)
4. Resize ALL other frames in refs.frameSnapshots:
   - Same copy-at-offset logic for pixelBuffers and maskBuffers
5. Resize refs.offscreenEl.width/height
6. dispatch(SET_CANVAS_SIZE, { w: newW, h: newH })
7. refs.redraw()
8. refs.pushHistory()
```

### D. Undo / Redo

```
Ctrl+Z pressed → JellySprite.jsx onKey handler
  │
  ▼
refs.undoHistory()         (or refs.redoHistory() for Ctrl+Y/Shift+Z)
  │
  ▼
historyEngine: decrement refs.historyIndex
  │
  ▼
applySnapshot(refs, snapshot, dispatch):
  - refs.pixelBuffers[id].set(snapshot.pixelBuffers[id])  for all layers
  - refs.maskBuffers[id].set(snapshot.maskBuffers[id])    for all masks
  - dispatch(RESTORE_HISTORY, { layers, activeLayerId, canUndo, canRedo })
  - refs.redraw()
```

### E. Color Pick

```
User clicks with picker tool (or drawingEngine fires onSelectionChange with hex)
  │
  ▼
drawingEngine: getPixel(refs.pixelBuffers[activeLayerId], x, y, w)
  → convert [r,g,b,a] to hex
  → call selListeners[i](hex)
  │
  ▼
useCanvas subscription: dispatch({ type: SET_SELECTION / PICK_COLOR, hex })
  │
  ▼
Reducer: state.fgColor = hex
  │
  ▼
Re-render (color swatch updates, next stroke uses new color)
```

---

## 9. Selection System

The selection system has three synchronized representations:

| Representation                                          | Location                    | Purpose                                                    |
| ------------------------------------------------------- | --------------------------- | ---------------------------------------------------------- |
| `refs.selection`                                        | refs                        | Engine's live write target; always current                 |
| `state.selection` via `refs.stateRef.current.selection` | Renderer reads via stateRef | Drives marching ants in `redraw()`                         |
| Dispatched `SET_SELECTION`                              | React state                 | Triggers re-render of UI elements that show selection info |

### Three Selection Modes

**Rectangular selection (`select-rect`):**

- Stores `refs.selection = { x, y, w, h }` (no `poly`)
- No `selectionMask` set — rect tools constrain by bounds check
- Marching ants: drawn as `strokeRect`

**Lasso selection (`select-lasso`):**

- **During draw:** `refs.lassoPath` grows on every `onPointerMove`; lasso path drawn live in renderer
- **On `onPointerUp`:** `buildLassoMask(path, w, h)` → `refs.selectionMask` (Uint8Array, 1 byte/pixel)
- `refs.selection = { x, y, w, h, poly: lassoPath }` (bounding box + hull)
- Marching ants: drawn as polygon

**Magic wand (`select-wand`):**

- `magicWandBounds(buf, x, y, w, h, tolerance)` returns `{ x, y, w, h, mask }`
- `refs.selectionMask = mask`
- `refs.selection = { x, y, w, h }` (bounding rect)

### Clearing Selection

`deselectAll()` in JellySprite.jsx:

```js
refs.selection = null;
refs.selectionMask = null;
refs.lassoPath = [];
dispatch(SET_SELECTION, null);
refs.redraw();
```

All four must be cleared. Missing any one causes apparent "stuck" selection behavior.

---

## 10. Canvas Resize Pipeline

The resize operation is the most complex pipeline because it must handle **all frames**, not just the current one.

### `changeSize(newW, newH, anchor)` in JellySprite.jsx

**Step 1 — Compute pixel offset from anchor:**

```
anchor "tl" → dx=0, dy=0
anchor "tc" → dx=(newW-oldW)/2, dy=0
anchor "mc" → dx=(newW-oldW)/2, dy=(newH-oldH)/2
... etc
```

**Step 2 — `resizeBuffer(oldBuf, is4Ch, dx, dy)` helper:**
Creates a new `Uint8ClampedArray` (or `Uint8Array` for masks), then copies only pixels whose destination coordinates are within bounds.

**Step 3 — Resize current frame buffers:**

```js
for each layerId in refs.pixelBuffers:
  refs.pixelBuffers[layerId] = resizeBuffer(oldBuf, true, dx, dy);
for each layerId in refs.maskBuffers:
  refs.maskBuffers[layerId] = resizeBuffer(oldBuf, false, dx, dy);
```

**Step 4 — Resize all frame snapshots:**

```js
for each frameId in refs.frameSnapshots:
  const snap = refs.frameSnapshots[frameId];
  for each layerId in snap.pixelBuffers:
    snap.pixelBuffers[layerId] = resizeBuffer(...);
  for each layerId in snap.maskBuffers:
    snap.maskBuffers[layerId] = resizeBuffer(...);
```

This was a critical M11 bug fix: before, only the current frame was resized. After switching to another frame, that frame's buffers were still the old size, causing rendering corruption.

**Step 5 — Sync offscreen canvas and dispatch:**

```js
refs.offscreenEl.width = newW;
refs.offscreenEl.height = newH;
dispatch(SET_CANVAS_SIZE, { w: newW, h: newH });
refs.redraw();
refs.pushHistory();
```

---

## 11. Frame System

### Adding a Frame (`addFrame()` in JellySprite.jsx)

1. Save current frame snapshot to `refs.frameSnapshots[currentFrameId]`.
2. Create a new `makeFrame(name)` and `makeLayer("Layer 1")`.
3. Initialize `refs.pixelBuffers[newLayer.id] = new Uint8ClampedArray(w * h * 4)`.
4. Initialize `refs.maskBuffers = {}`.
5. Create `refs.frameSnapshots[newFrame.id] = { layers: [newLayer], activeLayerId: newLayer.id, pixelBuffers, maskBuffers }`.
6. `dispatch(ADD_FRAME, { frame: newFrame, layer: newLayer })`.
7. Switch to the new frame via `switchFrame(newIdx)`.

### Duplicating a Frame

1. Save current frame.
2. Deep-copy all `pixelBuffers` and `maskBuffers` from the source frame's snapshot.
3. Create new frame id + snapshot with copies.
4. `dispatch(DUPLICATE_FRAME, { newFrame, insertIdx, layers, activeLayerId })`.

### Deleting a Frame

1. If only one frame, return early.
2. Remove `refs.frameSnapshots[frameId]`.
3. `dispatch(DELETE_FRAME, { frameId, remainingFrames, newIdx, newLayers, newActiveLayerId })`.
4. Load the new active frame's buffers from its snapshot.

### Thumbnail Generation

After every completed stroke (`STROKE_COMPLETE` action), `JellySprite.jsx` renders the active frame to a tiny offscreen canvas and dispatches `UPDATE_THUMBNAIL({ frameId, dataUrl })` to update the frame strip preview.

---

## 12. Playback System

Managed by `useFramePlayback.js` + `setInterval`.

```
dispatch(SET_IS_PLAYING, true)
  │
  ▼
refs.isPlaying = true
refs.playIntervalId = setInterval(() => {
  refs.playbackFrameIdx = (refs.playbackFrameIdx + 1) % frames.length
  refs.redraw()
}, 1000 / fps)
```

**In the renderer:** when `refs.isPlaying` is true, `dispIdx = refs.playbackFrameIdx` (not `activeFrameIdx`), and pixel/layer data is pulled from `refs.frameSnapshots[frames[dispIdx].id]`.

Playback does **not** modify any buffers or dispatch any actions — it only calls `refs.redraw()` on each tick.

---

## 13. Export System

All export helpers live as inline functions inside `JellySprite.jsx` (not a separate hook). They are exposed on the context so `ExportModal` in `RightPanel.jsx` can call them.

**Shared helpers:**

- `compositeFrameToCanvas(frameId)` — composites all visible layers for a frame → returns a `<canvas>`. Handles active frame (reads from live `layerDataRef`) vs non-active frames (reads from `frameDataRef`).
- `triggerDownload(url, filename)` — appends a temporary `<a>` to `document.body`, clicks it, removes it. Must use `document.body.appendChild` for Firefox/Edge compatibility.

**All downloads use `URL.createObjectURL(blob)` — never `toDataURL()`.** Chrome 65+ blocks JS-initiated downloads of `data:` URLs.

### `exportPNG()`

1. `saveCurrentFrameToRef()` — flushes active frame pixels
2. `compositeFrameToCanvas(activeFrameId)` → `canvas.toBlob()` → `URL.createObjectURL`
3. Download as `<name>.png`

### `exportSpriteSheet(framesPerRow, padding, labels)`

1. Save current frame
2. Compute sheet canvas: `ceil(frames.length / framesPerRow)` rows
3. Composite each frame; draw at `(col * (fw + padding), row * (fh + padding))`
4. Optional frame name labels
5. `sheet.toBlob()` → download as `<name>_sheet.png`

### `exportFramesZip()`

1. Save current frame
2. Create `JSZip` instance
3. For each frame: composite → `toDataURL("image/png")` → base64 → `zip.file(name, b64, { base64: true })`
4. `zip.generateAsync({ type: "blob" })` → download as `<name>_frames.zip`

### `exportGif()`

1. Save current frame
2. For each frame: `compositeFrameToCanvas` → `getImageData` → `quantize(data, 256)` → `applyPalette` → `encoder.writeFrame(index, w, h, { palette, delay })`
3. `encoder.finish()` → `new Blob([encoder.bytes()], { type: "image/gif" })` → download as `<name>.gif`
4. Delay per frame = `Math.round(1000 / fps)` ms
5. Uses `gifenc` (pure-JS, no worker files, ESM-compatible with Vite)

### `exportPaletteHex()`

1. Get `palettes[activePalette]` → hex strings, strip `#`, join newlines
2. Download as `<paletteName>.hex` (Lospec/Aseprite format)

---

## 14. Keyboard Shortcuts

All shortcuts use a `window.addEventListener("keydown", onKey)` handler added in a `useEffect` in `JellySprite.jsx`. Removed on unmount.

| Key                                     | Action                    |
| --------------------------------------- | ------------------------- |
| `P`                                     | Pencil tool               |
| `E`                                     | Eraser tool               |
| `F`                                     | Fill bucket               |
| `L`                                     | Line tool                 |
| `R`                                     | Rectangle tool            |
| `O`                                     | Ellipse tool              |
| `I`                                     | Color picker (eyedropper) |
| `M`                                     | Rectangular select        |
| `W`                                     | Magic wand select         |
| `V`                                     | Move selection            |
| `A`                                     | Spray tool                |
| `X`                                     | Swap fg/bg colors         |
| `Escape`                                | Deselect all              |
| `Space`                                 | Toggle playback           |
| `,`                                     | Previous frame            |
| `.`                                     | Next frame                |
| `Ctrl+Z`                                | Undo                      |
| `Ctrl+Y` / `Ctrl+Shift+Z`               | Redo                      |
| `Ctrl+D`                                | Deselect                  |
| `Ctrl+C`                                | Copy selection            |
| `Ctrl+V`                                | Paste                     |
| `Delete` / `Backspace` (with selection) | Clear selection content   |

---

## 15. Constants & Factory Functions

### `jellySprite.constants.js`

```js
MAX_HISTORY = 50; // max undo steps kept in refs.historyStack
MAX_COLOUR_HISTORY = 10; // max recent colors shown in color history

CANVAS_SIZES = [
  // preset sizes for Canvas tab
  { label: "64×64", w: 64, h: 64 },
  { label: "128×128", w: 128, h: 128 },
  { label: "256×128", w: 256, h: 128 },
  { label: "256×256", w: 256, h: 256 },
];

TOOL_GROUPS; // grouped tool definitions with id, icon, title
BRUSH_TYPES; // brush type definitions with id, label, title
BLEND_MODES; // CSS compositeOperation values with display labels
PANEL_TABS; // right-panel tab definitions
```

**`makeLayer(name)`** — creates a layer object with auto-incremented `id`:

```js
{ id: "layer-N", name, visible: true, opacity: 1.0, locked: false, blendMode: "normal", hasMask: false }
```

**`makeFrame(name)`** — creates a frame object:

```js
{
  id: ("frame-N", name);
}
```

> **Note:** Both counters (`_layerIdCounter`, `_frameIdCounter`) are module-level. They increment across the session lifetime. Never reset them without also resetting all refs.

### `jellySprite.utils.js`

| Function         | Signature                   | Description                               |
| ---------------- | --------------------------- | ----------------------------------------- |
| `hexToRgba`      | `(hex, a?) → [r,g,b,a]`     | Parse `#rrggbb` or `#rgb` to [0–255] RGBA |
| `rgbaToHex`      | `([r,g,b,a]) → "#rrggbb"`   | Convert RGBA to hex                       |
| `bresenhamLine`  | `(x0,y0,x1,y1) → [{x,y}]`   | Integer Bresenham line pixels             |
| `rasterRect`     | `(x0,y0,x1,y1) → [{x,y}]`   | Axis-aligned rect pixels                  |
| `rasterEllipse`  | `(cx,cy,rx,ry) → [{x,y}]`   | Midpoint ellipse pixels                   |
| `buildLassoMask` | `(path, w, h) → Uint8Array` | Scanline fill of polygon path to mask     |

---

## 16. Known Gotchas & Pitfalls

### 16.1 Multi-Frame Resize Bug (Fixed M11 — `c1bba73`)

**Problem:** `changeSize()` originally only resized `refs.pixelBuffers` and `refs.maskBuffers` for the _current_ frame. After a resize and frame switch, the other frames still had `Uint8ClampedArray` buffers of the old dimensions. The renderer tried to create `ImageData` from a wrongly-sized buffer, producing corrupted output or exceptions.

**Fix:** `changeSize()` now iterates `Object.entries(refs.frameSnapshots)` and applies `resizeBuffer()` to every frame's `pixelBuffers` and `maskBuffers`.

**Rule:** Any operation that changes `canvasW`/`canvasH` **must** resize all snapshots too.

---

### 16.2 Boolean Toggle Updater-Function Bug (Fixed `2ec6d9e` + expanded)

**Problem:** Several toggle buttons in `LeftToolbar.jsx` use the React-style updater pattern:

```js
onClick={() => setSymmetryH((v) => !v)
```

This passes a _function_ as `v` to the action creator. The original action creators dispatched the function directly as the payload:

```js
const setSymmetryH = (v) => sd({ type: A.SET_SYMMETRY_H, payload: v });
```

The reducer then stored the function itself as `state.symmetryH`. Because a function is always truthy, the toggle appeared to turn on but could never turn off.

The same bug applied to: `setSymmetryV`, `setGridVisible`, `setFrameGridVisible`.

**Fix:** Every boolean toggle action creator now unwraps updater functions before dispatching:

```js
const setSymmetryH = (v) =>
  sd({
    type: A.SET_SYMMETRY_H,
    payload: typeof v === "function" ? v(symmetryH) : v,
  });
const setSymmetryV = (v) =>
  sd({
    type: A.SET_SYMMETRY_V,
    payload: typeof v === "function" ? v(symmetryV) : v,
  });
const setGridVisible = (v) =>
  sd({
    type: A.SET_GRID_VISIBLE,
    payload: typeof v === "function" ? v(gridVisible) : v,
  });
const setFrameGridVisible = (v) =>
  sd({
    type: A.SET_FRAME_GRID_VISIBLE,
    payload: typeof v === "function" ? v(frameGridVisible) : v,
  });
```

**Rule:** The reducer is a pure function — never pass a callback as a payload. Any action creator that can receive an updater function must resolve it against the current state value before dispatching.

---

### 16.3 Custom Grid (`frameConfig`) Missing from State

**Problem:** The renderer's frame-grid branch checks `if (frameGridVisible && frameConfig)` and reads `frameConfig.frameW/frameH`. However, `frameConfig` was never added to `jellySpriteInitialState.js` or the reducer, so `state.frameConfig` was always `undefined`. The frame-grid button appeared active (since `frameGridVisible` defaulted to `true`) but the grid never drew — the `&& frameConfig` guard silently swallowed the render call.

**Fixes:**

- Added `frameConfig: { frameW: 16, frameH: 16 }` to `jellySpriteInitialState.js`.
- Added `SET_FRAME_CONFIG` action constant and reducer `case A.SET_FRAME_CONFIG: return { ...state, frameConfig: payload }`.
- Changed `frameGridVisible` default to `false` so the grid only appears when explicitly enabled by the user.
- Added a "Grid" section to the View tab (`RightPanel.jsx` → `ViewTabBody`) with pixel-grid and custom-grid checkboxes plus W×H cell-size inputs that dispatch `SET_FRAME_CONFIG`.

**Grid system summary:**

| Button / control        | State field        | What it draws                                                                     |
| ----------------------- | ------------------ | --------------------------------------------------------------------------------- |
| ⊞ Pixel grid (toolbar)  | `gridVisible`      | 1-pixel cell grid at zoom ≥ 4×                                                    |
| ▦ Custom grid (toolbar) | `frameGridVisible` | Configurable grid overlay with `frameConfig.frameW × frameConfig.frameH` px cells |
| W / H inputs (View tab) | `frameConfig`      | Cell size for the custom grid                                                     |

The custom grid is useful for: sprite sheet layout (e.g., 16×16 frame boundaries), tile alignment, or any repeating structure the user wants to see overlaid on the canvas.

---

### 16.4 `tileCanvasEl` / `refImgEl` Wiring (Fixed M14 — `7cbddf0`)

**Problem:** The renderer reads `refs.tileCanvasEl` and `refs.refImgEl`, but those fields were initialized to `null` in the provider and never populated.

**Fixes:**

- `loadRefImage()` now sets `refs.refImgEl = img` after the image loads; `clearRefImage()` sets `refs.refImgEl = null`.
- A `useEffect` in JellySprite.jsx with dependency `[tileVisible]` syncs `refs.tileCanvasEl = tileCanvasRef.current`.

**Rule:** Any DOM element that the renderer needs must be explicitly wired into `refs`. Don't assume it's done automatically.

---

### 16.5 Selection Synchronization

**Problem:** The selection state has three representations that must all stay in sync: `refs.selection` (engine writes), `state.selection` read via `refs.stateRef.current` (renderer reads), and React state `state.selection` (UI reads). Missing any one causes the selection to appear stuck or invisible.

**Fix:** `useCanvas.js` subscribes to the drawing engine's `onSelectionChange` callback and dispatches `SET_SELECTION` to keep React state in sync:

```js
refs.drawingEngine.onSelectionChange((sel) => {
  dispatch({ type: "SET_SELECTION", payload: sel });
});
```

`deselectAll()` must clear all three:

```js
refs.selection = null;
refs.selectionMask = null;
refs.lassoPath = [];
dispatch(SET_SELECTION, null);
refs.redraw();
```

---

### 16.6 History Index Seeding

`wireHistoryEngine` calls `pushHistory(refs)` once immediately to seed index 0. This means `undoHistory()` stops at index 0 (the blank canvas), never going below it. If you call `wireHistoryEngine` a second time (e.g., after project load), call `refs.historyStack = []; refs.historyIndex = -1` first to avoid duplicate initial entries.

---

### 16.7 `stateRef` Staleness Guard

The drawing engine and renderer closures read `refs.stateRef.current` instead of closing over `state`. This is safe because `JellySpriteProvider` updates `refs.stateRef.current = state` **synchronously every render**. However, during the very first render before any engine hook runs, `stateRef.current` is `jellySpriteInitialState`. This is intentional and correct.

Do **not** read `refs.stateRef.current` in event handlers that run _during_ a React render — it may be the previous state there.

---

### 16.8 `makeLayer` / `makeFrame` Counter Persistence

`_layerIdCounter` and `_frameIdCounter` in `jellySprite.constants.js` are module-scope incremental counters. They do not reset between project loads. IDs are therefore unique per session but not globally persistent. If you need stable IDs across saves (for project files), generate UUIDs at creation time and store them in the project JSON.

---

### 16.9 Mask Buffer Resize — Single-Channel vs Four-Channel (Fixed M20)

**Problem:** The original `resizeBuffer()` helper in `changeSize()` allocated a `Uint8ClampedArray(w * h * 4)` and used `* 4` index offsets — correct for RGBA pixel buffers. It was also used for mask buffers, which are `Uint8Array(w * h)` with 1 byte per pixel. Every mask resize produced a buffer 4× too large, with pixels mapped to wrong positions.

**Fix:** A dedicated `resizeMaskBuffer(oldBuf, oldW, oldH, newW, newH, dx, dy)` was added that allocates `Uint8Array(nw * nh)` and uses single-channel indices. `changeSize()` now calls `resizeMaskBuffer` for all `maskBuffers` and `snap.maskBuffers` entries.

**Rule:** Any time you see `Uint8Array` for a pixel-related buffer, it is a single-channel mask. Never multiply its index by 4.

---

### 16.11 Onion Skinning — Ghosts Invisible Over Opaque Pixels (Fixed M21)

**Problem:** Onion-skin ghost frames were composited onto `ctx` _before_ the active frame. Because `globalCompositeOperation` defaults to `source-over`, any opaque pixel in the current frame painted over the ghost completely, making ghosts visible only in fully-transparent areas. With any drawn content they were invisible.

**Fix:** The render order in `canvasRenderer.js` was inverted so the active frame is drawn first, then the ghost overlays are painted on top at `ONION_OPACITY` (0.3). This is the standard animation-tool behaviour (Aseprite, Krita, etc.).

---

### 16.10 Project Storage — localStorage Quota (Fixed M20)

**Problem:** Project bodies were saved to `localStorage` via `localStorage.setItem('dj-project-<id>', JSON.stringify(data))`. Browsers cap `localStorage` at ~5 MB per origin. A modest sprite with several frames and layers (base64-encoded pixel buffers) easily exceeds this, throwing a `QuotaExceededError` caught as "Failed to save project."

**Fix:** Project bodies are now stored in **IndexedDB** (no meaningful size limit). The small metadata index (`{ id, name, savedAt, animCount, frameCount, thumbnail }`) stays in `localStorage` since it's tiny.

**Architecture:** `src/services/projectService.js` is the only file that knows about storage. The rest of the app calls `saveProjectToStorage`, `loadProjectFromStorage`, `deleteProjectFromStorage` — no other file imports from a database service. When the app moves to Supabase, only the internals of `projectService.js` change.

---

---

## 17. Planned Refactors

### PR-1 — Split selection / move tool logic out of `drawingEngine.js`

`drawingEngine.js` routes all tool logic inline. The selection system has grown
substantially (per-pixel masks, add/subtract combining, mask translation, marching
ants path caching) and should be extracted into focused modules.

**Target layout:**

| File                         | Responsibility                                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/selectionUtils.js`   | Pure functions only: `buildRectMask`, `buildLassoMask`, `combineMasks`, `boundsFromMask`, `getOrBuildMask`, `translateMask`, `buildMaskEdgePath`. Zero refs, zero React. Unit-testable in isolation. |
| `engine/tools/selectTool.js` | Handlers for `select-rect`, `select-lasso`, `select-wand`. Reads/writes `refs.selectionMask`, `refs.selectionMaskOrigin`, calls `setSelection`.                                                      |
| `engine/tools/moveTool.js`   | Handlers for `move` tool. Owns `movePixels`, `moveOrigin`, `previewSnap` as module-scope locals. Translates mask on pointer-up.                                                                      |
| `engine/drawingEngine.js`    | Thin router — dispatches pointer events to the right tool module. Owns `setSelection` (shared by both tool modules via closure or passed as a param).                                                |

**Invariants to preserve (do not break these):**

- `refs.selectionMask` is always at current absolute canvas coords after any pointer-up
- `refs.selectionMaskOrigin` always equals `{x: refs.selection.x, y: refs.selection.y}` between drags
- `setSelection(val, fromMove)` — `fromMove=true` skips clearing `movePixels` and `selectionMaskOrigin`
- Path cache (`selectionMaskPath`, `selectionMaskPathZoom`, `selectionMaskPathX/Y`) is invalidated on any change that affects the outline

_End of JELLYSPRITE_ARCHITECTURE.md_
