# JellySprite — Rebuild Plan (Option B Architecture)

---

> ## ⚠️ NUMBERING NOTE — This file's M1–M16 are INDEPENDENT of ROADMAP.md
>
> `ROADMAP.md` uses M8–M18 to track the original Animator/Editor feature work (all
> now complete). **This file uses M1–M16 exclusively for the JellySprite component
> rebuild.** When you see "M10" in a commit message or conversation about JellySprite,
> it refers to "Selection Tools + Transforms" (this file, line ~550), NOT
> "Resizable Panel Dividers" (ROADMAP.md). Never update ROADMAP.md with JellySprite
> rebuild progress — update only this file.

---

## Progress Tracker

| Milestone | Name                             | Status         | Commit    |
| --------- | -------------------------------- | -------------- | --------- |
| M1        | Store Skeleton                   | ✅ Done        | `ea4eacb` |
| M2        | Core Canvas Rendering            | ✅ Done        | `4acc409` |
| M3        | Drawing Engine (Pencil + Eraser) | ✅ Done        | `2538c78` |
| M4        | All Remaining Drawing Tools      | ✅ Done        | `b21875b` |
| M5        | Brush Shapes + Symmetry          | ✅ Done        | `07b4505` |
| M6        | Layer System                     | ✅ Done        | `07b4505` |
| M7        | History (Undo/Redo)              | ✅ Done        | `c96011d` |
| M8        | Frame System                     | ✅ Done        | `809e51b` |
| M9        | Playback + Onion Skinning        | ✅ Done        | `c53263e` |
| M10       | Selection Tools + Transforms     | ✅ Done        | `b9c6fbe` |
| QA        | Tool + Panel Audit               | 🔄 In Progress | —         |
| M11       | Canvas Resize                    | ✅ Done        | `c1bba73` |
| M12       | Export + Workspace Integration   | ✅ Done        | `7cbddf0` |
| M13       | Color System + Palette Manager   | ✅ Done        | `7cbddf0` |
| M14       | View Tools                       | ✅ Done        | `7cbddf0` |
| M15       | Keyboard Shortcuts               | ✅ Done        | `7cbddf0` |
| M16       | UI Polish + CSS                  | ✅ Done        | `7cbddf0` |

---

> ## ⚠️ MANDATORY RULE — SAVE AND PUSH AFTER EVERY MILESTONE
>
> After completing each numbered milestone below:
>
> 1. Run `git add -A`
> 2. Run `git commit -m "jellysprite: M<N> — <milestone name>"`
> 3. Run `git push`
>
> **Do not skip this.** If something breaks in M7 you should be able to roll back to M6 without losing weeks of work.
> Every milestone should leave the app in a buildable, runnable state. If it doesn't, keep going until it does before committing.

---

## Why We're Rebuilding

The previous architecture extracted 6 hooks from a monolithic component, but those hooks still had the same logical coupling as before — they just communicated through increasingly awkward indirection:

- `window.__jellyRefs__` and `window.__frameDataRef__` were globals used to break circular hook dependencies
- "Stub refs" (`pushHistoryEntryStubRef`, `redrawStubRef`, `saveToProjectStubRef`) existed solely because hooks needed to call each other but were structured in a way that created circular imports
- `pixelsRef` and `layerDataRef` could silently point to different buffers (the root drawing bug), because there was no single owner enforcing that rule
- Every hook knew too much about every other hook's internals

**The new architecture has one core principle: a single store owns all state, pixel data lives in refs that the store controls. Nothing is hidden in globals.**

---

## Architecture Overview — Read This Carefully Before Building Anything

### The Two Classes of Data

JellySprite has two fundamentally different kinds of data, and understanding this distinction is everything:

**Class 1: Metadata (lives in the store / React state)**
Things that describe _what exists_ and _what is selected_:

- The list of layers (id, name, visible, opacity, blendMode, hasMask)
- The active layer ID
- The list of frames (id, name)
- The active frame index
- Tool, brush settings, colors, zoom, grid flags
- Selection rect/polygon
- Undo/redo availability flags (canUndo, canRedo)
- Frame thumbnails (data URLs)
- Palette data, color history
- Playback state (isPlaying, fps, onionSkinning)
- UI state (panelTab, exportOpen, etc.)

When this changes, React re-renders and the UI updates. These changes are **infrequent** — they happen when you click a tool button, switch a layer, add a frame, complete a stroke, etc.

**Class 2: Pixel data (lives in refs, never in React state)**
The raw `Uint8ClampedArray` buffers that hold actual pixel RGBA values:

- `pixelBuffers`: `Map<layerId, Uint8ClampedArray>` — the active frame's pixel data for each layer
- `frameSnapshots`: `Map<frameId, { layers, activeLayerId, pixelBuffers }>` — saved state for every non-active frame
- `historyStack`: `HistoryEntry[]` — snapshots for undo/redo (copies of all layer buffers)
- `clipboard`: `Uint8ClampedArray | null` — cut/copy buffer
- `selectionMask`: `Uint8Array | null` — lasso mask bit-array

Pixel data must **never** go through React state because:

- A 256×256 RGBA buffer is 262,144 bytes. Copying that through `setState` on every mouse-move frame would be catastrophic for performance.
- Canvas drawing needs to happen at 60fps. React re-renders are triggered by state changes. Drawing only needs `redraw()` — a direct canvas API call — not a re-render.

### The Store

The store is implemented as a React context powered by `useReducer`. It is the **only** source of truth for metadata, and it also _owns_ (but does not put in state) all the pixel refs.

```
JellySpriteStoreContext
  ├── state            — reducer state (metadata only)
  ├── dispatch         — send actions to change metadata
  └── refs             — object of stable refs for pixel data and canvas elements
       ├── pixelBuffers     : { [layerId]: Uint8ClampedArray }
       ├── frameSnapshots   : { [frameId]: FrameSnapshot }
       ├── historyStack     : HistoryEntry[]
       ├── historyIndex     : number
       ├── clipboard        : Uint8ClampedArray | null
       ├── selectionMask    : Uint8Array | null
       ├── canvasEl         : HTMLCanvasElement
       ├── offscreenEl      : HTMLCanvasElement
       └── redraw           : () => void   (set after useCanvas initializes)
```

The `refs` object is created once with `useRef({...})` and is stable — it never causes re-renders when its contents change. Components and hooks reach it via context.

### How Actions Work

When a user does something like switching layers, this is the complete flow:

1. The UI component calls `dispatch({ type: 'SET_ACTIVE_LAYER', payload: layerId })`
2. The reducer returns a new state with `activeLayerId: layerId`
3. React re-renders the `JellySpriteProvider` subtree
4. The `useEffect` in the provider that watches `activeLayerId` runs:
   - It sets `refs.pixelBuffers` is already correct (we just switched which one is "active")
   - It calls `refs.redraw()` to update the canvas display
5. All panel components that read from `useJellySpriteStore()` see the updated state and re-render their relevant parts

When a user draws a stroke, this is the complete flow:

1. `onMouseDown` fires → drawing engine starts writing pixels directly to `refs.pixelBuffers[activeLayerId]` → calls `refs.redraw()` on every move
2. **Zero React re-renders happen during the stroke**
3. `onMouseUp` fires → drawing engine dispatches `{ type: 'STROKE_COMPLETE' }`
4. The reducer records nothing special in state for the pixels themselves (they're already in the ref), but it does: increment history pointer, set `canUndo: true`, trigger thumbnail update
5. A thumbnail `useEffect` in the provider runs and updates `frameThumbnails[activeFrameId]` in state
6. **One React re-render** happens, updating the frame thumbnail in the filmstrip panel

### Frame Switching — the Critical Flow

This is where the previous architecture had bugs. Here is the correct, explicit, transactional flow:

When `switchToFrame(newIdx)` is called:

1. **Save current frame**: copy `refs.pixelBuffers` into `refs.frameSnapshots[currentFrameId]` along with current `layers` and `activeLayerId` from state. This is a shallow reference save — the buffers themselves are not copied, just the reference. We get a copy when we need to render a non-active frame (thumbnails, onion skin).

2. **Dispatch**: `dispatch({ type: 'SWITCH_FRAME', payload: { newIdx, newFrameId } })` — the reducer sets `activeFrameIdx`, and fetches the new frame's `layers` and `activeLayerId` from the snapshot.

3. **Load new frame pixels**: a `useEffect([activeFrameIdx])` in the provider runs. It reads the frame snapshot for the new frame ID and assigns `refs.pixelBuffers = snapshot.pixelBuffers`. This is the one place where `pixelBuffers` is reassigned — atomically, in response to a committed state change.

4. **Redraw**: `refs.redraw()` is called.

The crucial property: `refs.pixelBuffers` is **always** the pixel data for the currently active frame, as determined by `state.activeFrameIdx`. They can never drift apart because the only place `pixelBuffers` is reassigned is inside the effect that responds to `activeFrameIdx` changing.

### Canvas Rendering

The render function (`redraw`) is a plain function stored in `refs.redraw`. It:

- Reads `refs.pixelBuffers` for the active frame layers
- Reads `refs.frameSnapshots` for onion skin (prev/next frames)
- Reads current metadata (layers, zoom, gridVisible, selection, etc.) from a `stateRef.current` that is kept in sync every render
- Composites all visible layers onto the offscreen canvas
- Draws overlays (grid, frame grid, selection ants, lasso path, onion skins, reference image, tile preview)
- Scales and blits to the visible canvas

**It does NOT close over any React state directly.** It reads everything from `refs.stateRef.current` which is updated every render with `stateRef.current = state`. This way the render function never goes stale.

### The Drawing Engine

The drawing engine is a single file that exports one function: `createDrawingEngine(refs, getState)`. It returns `{ onMouseDown, onMouseMove, onMouseUp, onMouseLeave }`.

- It reads current tool/brush settings via `getState()` (which returns `stateRef.current`)
- It writes pixels directly to `refs.pixelBuffers[getState().activeLayerId]`
- It calls `refs.redraw()` directly after every pixel write
- On `mouseUp`, it calls `refs.pushHistory()` (a ref function that snapshots all buffers into the history stack) and `refs.dispatch({ type: 'STROKE_COMPLETE' })`

The drawing engine has **no React hooks**. It is plain JavaScript. It can be tested in isolation. It receives everything it needs through the `refs` and `getState` parameters.

### What Each File Does

```
src/features/jelly-sprite/
│
├── store/
│   ├── jellySpriteReducer.js     — pure reducer function + action type constants
│   ├── jellySpriteInitialState.js — default state object
│   └── JellySpriteProvider.jsx   — useReducer + ref creation + context provision
│                                    + all the useEffects that react to state changes
│                                    (frame switch, active layer change, thumbnail updates)
│
├── engine/
│   ├── drawingEngine.js          — createDrawingEngine(refs, getState) → mouse handlers
│   ├── pixelOps.js               — stampBrush, floodFill, bresenhamLine, rasterRect,
│   │                               rasterEllipse, applyTransform (flip/rotate)
│   ├── canvasRenderer.js         — createRenderer(refs, getState) → redraw()
│   ├── compositeEngine.js        — compositeLayersToCanvas(layers, pixelBuffers, canvas)
│   └── selectionEngine.js        — applyMagicWand, buildLassoMask, selectionClip
│
├── hooks/
│   ├── useJellySpriteStore.js    — useContext(JellySpriteStoreCtx) with error guard
│   ├── useCanvas.js              — attaches canvasRef, creates offscreen, calls createRenderer,
│   │                               stores refs.redraw — returns canvasRef only
│   └── useKeyboardShortcuts.js   — window keydown listener, reads actionsRef
│
├── panels/
│   ├── LeftToolbar.jsx           — tool buttons, symmetry, zoom, grid, transform, history
│   ├── RightPanel.jsx            — tabbed panel container
│   ├── tabs/
│   │   ├── ColorTab.jsx          — FG/BG swatches, color picker, recent history
│   │   ├── PaletteTab.jsx        — palette manager
│   │   ├── BrushTab.jsx          — brush shape, size, opacity, fill mode, selection ops
│   │   ├── LayersTab.jsx         — layer list, add/delete/merge/flatten, per-layer controls
│   │   ├── CanvasTab.jsx         — resize controls, anchor picker
│   │   ├── ViewTab.jsx           — reference image, tile preview
│   │   └── MoreTab.jsx           — workspace integration, export button
│   └── ExportModal.jsx           — export options, trigger downloads
│
├── CanvasArea.jsx                — the <canvas> element + mouse event wiring
├── JellySprite.jsx               — top-level: wraps everything in JellySpriteProvider
├── jellySprite.constants.js      — TOOL_GROUPS, BRUSH_TYPES, BLEND_MODES, CANVAS_SIZES, etc.
├── jellySprite.utils.js          — hexToRgba, rgbaToHex, bresenhamLine, etc. (pure functions)
└── JellySprite.css               — all styles
```

---

## Complete Feature List (the rebuild target)

### Drawing Tools

- Pencil — freehand with interpolation between mouse positions
- Eraser — same mechanics as pencil, paints transparent
- Fill Bucket — 4-connected flood fill at click point
- Color Picker — reads pixel at click, sets FG color
- Line — Bresenham with live preview before mouseUp
- Rectangle — outline or filled, live preview
- Ellipse — outline or filled, live preview
- Spray — random scatter within radius
- Rect Select — drag to set bounding box selection
- Lasso Select — freehand path, converted to mask on mouseUp
- Magic Wand — color-flood select from click point
- Move Selection — drag selected pixel region

### Brush Properties

- 7 brush shapes: Round, Square, Diamond, Cross, Pixel (always 1×1), Dither 25%, Dither 50%
- Size: 1–32px
- Opacity: 1–100% (multiplies into stroke, not layer opacity)
- Outline vs Filled toggle for rect/ellipse tools

### Symmetry Painting

- Horizontal mirror (paints mirrored X simultaneously)
- Vertical mirror (paints mirrored Y simultaneously)
- Both active = 4-way symmetry

### Selection Operations

- Copy, Paste (with internal clipboard buffer)
- Crop canvas to selection bounds
- Delete contents of selection
- Deselect
- Marching ants animation (dashed animated border)
- Lasso mask constrains all draw operations inside selection

### Transform (operates on active layer, or full canvas if no selection)

- Flip horizontal
- Flip vertical
- Rotate 90° clockwise
- Rotate 90° counter-clockwise

### Layer System (per frame — each frame has its own independent layer stack)

- Add layer
- Delete layer (blocked if only one remains)
- Duplicate layer (deep copy of pixel data and mask)
- Move layer up / down in stack
- Rename layer
- Toggle visibility
- Per-layer opacity (0–100%)
- Per-layer blend mode (Normal, Multiply, Screen, Overlay, Add/Lighter, Dodge, Burn, Hard Light, Soft Light, Difference, Exclusion)
- Merge layer down (alpha-correct over-compositing into layer below)
- Flatten all layers to single layer
- Layer masks: grayscale Uint8Array, add/remove, toggle mask editing mode (draws to mask instead of pixels)

### History

- Undo (max 50 steps)
- Redo
- Each entry: full deep copy of all layer pixel buffers + all mask buffers
- Clear layer: fills active layer with transparent, pushes history

### Color System

- Foreground / Background dual swatch
- Swap FG ↔ BG
- Foreground alpha (separate from brush opacity, combined at paint time)
- Full color picker: HSV wheel + hex input + RGB sliders
- Recent color history: last 10 used colors

### Palette Manager

- Built-in palettes (DoomJelly 32 palette + any others)
- Click palette swatch to set FG color
- Add current FG color to active palette
- Remove color from palette
- Create new empty palette
- Delete custom palette (builtins protected)
- Rename palette
- Set full color list (for import)
- Export palette as `.hex` file (one hex value per line, no #)

### Frame & Animation System

- Add frame (blank, new default layer)
- Duplicate frame (deep copy all layers + pixel data)
- Delete frame (blocked if only one remains)
- Rename frame
- Switch frame (saves current state, loads target state atomically)
- Each frame independently stores: layer stack, active layer ID, all pixel buffers, all mask buffers
- Frame thumbnails: composite PNG data URL, regenerated after every completed stroke

### Playback

- Play / Stop
- FPS control
- Onion skinning: previous frame overlaid red tint, next frame overlaid blue tint, 30% opacity each

### Canvas & View

- Preset canvas sizes: 64×64, 128×128, 256×128, 256×256
- Custom canvas size: any width/height 1–1024px
- 9-point anchor picker for resize (determines where existing pixels land in new canvas)
- Pixel content preserved on resize (with anchor offset applied)
- Pixel grid overlay (visible only at zoom ≥ 4×)
- Frame grid overlay (sprite boundary lines from frameConfig)
- Zoom: 1×–16×

### Reference Image

- Load from file
- Toggle visibility on/off
- Opacity control (5–100%)
- Remove reference

### Tile Preview

- Secondary canvas showing the sprite tiled 2×2 or 3×3
- Updates live as you draw

### Export

- PNG: active frame, all visible layers composited, full resolution
- Sprite sheet PNG: all frames in a grid, configurable columns, padding, optional frame name labels
- Frames ZIP: each frame as a separate PNG named with zero-padded index
- Palette HEX: export active palette as `.hex` text file

### Workspace Integration

- "Send to Animator": composites active frame to PNG data URL, dispatches to ProjectContext
- "From Animator": imports sprite sheet image from ProjectContext into active layer
- Auto-saves to project (via ProjectContext dispatch) after every completed stroke

### Keyboard Shortcuts

| Key                   | Action                    |
| --------------------- | ------------------------- |
| P                     | Pencil                    |
| E                     | Eraser                    |
| F                     | Fill                      |
| I                     | Color picker              |
| L                     | Line                      |
| R                     | Rectangle                 |
| O                     | Ellipse                   |
| A                     | Spray                     |
| M                     | Rect select               |
| W                     | Magic wand                |
| V                     | Move                      |
| X                     | Swap FG/BG colors         |
| + / =                 | Zoom in                   |
| -                     | Zoom out                  |
| Ctrl+Z                | Undo                      |
| Ctrl+Y / Ctrl+Shift+Z | Redo                      |
| Ctrl+C                | Copy selection            |
| Ctrl+V                | Paste                     |
| Ctrl+D / Esc          | Deselect                  |
| ← / →                 | Previous / Next frame     |
| Space                 | Play / Stop               |
| Delete                | Delete selection contents |

---

## Rebuild Milestones

### M1 — Store Skeleton

**What:** Define the complete shape of the state, the reducer, all action types, and the Provider component. No rendering yet — just the data architecture.

**Files to create:**

- `store/jellySpriteInitialState.js` — the default state object with every field named and given a sensible default. This file doubles as the authoritative reference for "what is in state."
- `store/jellySpriteActions.js` — export a const for every action type string (e.g. `export const SET_TOOL = 'SET_TOOL'`). Never use raw strings in dispatch calls.
- `store/jellySpriteReducer.js` — the pure reducer function. At this stage, implement the simple cases: SET_TOOL, SET_BRUSH_TYPE, SET_BRUSH_SIZE, SET_BRUSH_OPACITY, SET_FG_COLOR, SET_BG_COLOR, SET_FG_ALPHA, SET_ZOOM, SET_GRID_VISIBLE, SET_FRAME_GRID_VISIBLE, SET_FILL_SHAPES, SET_SYMMETRY_H, SET_SYMMETRY_V, SET_PANEL_TAB, SET_CANVAS_SIZE, SET_ACTIVE_LAYER, SET_SELECTION, SET_EDITING_MASK.
- `store/JellySpriteProvider.jsx` — creates the `useReducer`, creates the `refs` object (just the shape, not filled in yet: `{ pixelBuffers: {}, frameSnapshots: {}, historyStack: [], historyIndex: -1, clipboard: null, selectionMask: null, canvasEl: null, offscreenEl: null, redraw: null, stateRef: { current: null } }`), provides both via context. Also exports `export const JellySpriteStoreCtx = createContext(null)`.
- `hooks/useJellySpriteStore.js` — `const { state, dispatch, refs } = useContext(JellySpriteStoreCtx)`. Throws if used outside provider.

**How it connects:** Everything in milestones M2–M16 will consume `useJellySpriteStore()`. Getting the shape right now means no refactoring of the API surface later.

**Done when:** The provider wraps a placeholder `<div>JellySprite coming soon</div>` and the app builds without errors.

---

### M2 — Core Canvas Rendering

**What:** A visible canvas that can redraw itself from pixel data in refs.

**Files to create:**

- `engine/compositeEngine.js` — exports `compositeLayersToCanvas(layers, pixelBuffers, maskBuffers, offscreenCanvas)`. Takes the layer metadata array, the pixel buffer map, the mask buffer map, and a pre-created offscreen canvas element. Iterates layers in order (bottom to top), skips invisible ones, applies layer mask if present (multiply alpha by mask value), creates ImageData, applies globalAlpha and blendMode (canvas composite operation), draws each layer onto the offscreen canvas.
- `engine/canvasRenderer.js` — exports `createRenderer({ refs, getState })`. This function returns a `redraw()` closure. Inside `redraw()`, it reads `getState()` for all render-time metadata (layers, zoom, gridVisible, frameGridVisible, onionSkinning, frameConfig, selection, etc.) and reads pixel data from `refs.pixelBuffers`, `refs.frameSnapshots`. It calls `compositeLayersToCanvas` for the active frame, then handles: onion skinning (composite prev/next frames from snapshots, tint red/blue, draw at 30% opacity before the main frame), grid overlay, frame grid overlay, selection rect / lasso path / marching ants rendering, reference image overlay, tile preview update, and final scaled blit to the visible canvas. Marching ants requires storing the animation frame ID in `refs.marchingAntsRaf` and offset in `refs.marchOffset`.
- `hooks/useCanvas.js` — sets up the canvas ref, creates offscreen element, calls `createRenderer`, stores the returned `redraw` into `refs.redraw`, keeps `refs.stateRef.current = state` updated every render, and keeps `refs.canvasEl` and `refs.offscreenEl` set. Returns just `{ canvasRef }`.

**Files to update:**

- `store/JellySpriteProvider.jsx` — on mount, initialize `refs.pixelBuffers` for the initial layer using `canvasW * canvasH * 4` size, store the initial frame snapshot.
- `store/jellySpriteReducer.js` — add STROKE_COMPLETE action that sets `canUndo: true`, `canRedo: false`, and updates `frameThumbnails` (the thumbnail is passed in the payload since we can't generate it in the reducer — it's a side effect handled in the Provider's useEffect on the STROKE_COMPLETE action).

**How it connects:** After this milestone, if you manually put some pixel values into `refs.pixelBuffers` in the browser console, calling `refs.redraw()` will show them on screen. The canvas is live.

**Done when:** App builds, canvas element renders, a manually injected colored pixel shows up after calling `refs.redraw()`.

---

### M3 — Drawing Engine (Pencil + Eraser only)

**What:** You can actually draw on the canvas. Just pencil and eraser to start so we verify the full data flow end-to-end before adding complexity.

**Files to create:**

- `engine/pixelOps.js` — pure pixel operation functions with no React dependencies:
  - `setPixel(buf, canvasW, x, y, rgba, selectionRect, lassoMask)` — bounds check, selection clip, write RGBA
  - `getPixel(buf, canvasW, x, y)` — returns [r,g,b,a]
  - `stampBrush(buf, canvasW, canvasH, cx, cy, rgba, brushType, brushSize, symmetryH, symmetryV, selectionRect, lassoMask)` — iterate brush footprint based on brushType, call paintWithSymmetry for each pixel
  - `paintWithSymmetry(...)` — stamp at x,y and mirrored positions based on symmetry flags
  - `hexToRgba(hex, alpha)` — convert hex string to [r,g,b,a]
  - `rgbaToHex(r,g,b)` — convert to hex string
- `engine/drawingEngine.js` — exports `createDrawingEngine({ refs, getState, dispatch })`. Returns `{ onMouseDown, onMouseMove, onMouseUp, onMouseLeave }`. Internal state (not React state — just object properties): `isDrawing`, `startPixel`, `lastPixel`, `previewSnap`. For mouseDown: get canvas coords from event using zoom, call `stampBrush` for pencil or eraser, call `refs.redraw()`. For mouseMove: interpolate from lastPixel to current position (Bresenham-style step loop), call `stampBrush` for each step, call `refs.redraw()`. For mouseUp: call `refs.pushHistory()`, dispatch STROKE_COMPLETE with thumbnail data URL.
- `engine/historyEngine.js` — exports functions `pushHistory(refs, state)` (deep copies all buffers in `refs.pixelBuffers` and all masks, pushes to `refs.historyStack`, increments `refs.historyIndex`), `undoHistory(refs)` (decrements index, restores from stack), `redoHistory(refs)` (increments index, restores from stack). Stored directly on `refs` as `refs.pushHistory`, `refs.undoHistory`, `refs.redoHistory` by the Provider setup.

**Files to update:**

- `CanvasArea.jsx` — attach `onMouseDown`, `onMouseMove`, `onMouseUp`, `onMouseLeave` from the drawing engine (obtained via `refs.drawingEngine`) to the canvas element.
- `store/JellySpriteProvider.jsx` — after refs are initialized, call `createDrawingEngine(...)` and store on `refs.drawingEngine`. Connect history functions to refs.

**How it connects:** Mouse events hit `CanvasArea` → forwarded to drawing engine functions stored in `refs` → engine reads tool/brush from `getState()` → writes to `refs.pixelBuffers[activeLayerId]` → calls `refs.redraw()` → canvas updates in real time → mouseUp → `refs.pushHistory()` → dispatch STROKE_COMPLETE → one re-render updates undo button state.

**Done when:** You can draw with pencil and erase. Undo/redo buttons work.

---

### M4 — All Remaining Drawing Tools

**What:** All 12 tools fully implemented.

**Add to `engine/pixelOps.js`:**

- `floodFill(buf, canvasW, canvasH, sx, sy, rgba, selectionRect, lassoMask)` — iterative 4-connected BFS from start pixel, matches start color, replaces with target color
- `sprayBrush(buf, canvasW, canvasH, cx, cy, rgba, brushSize, symmetryH, symmetryV, selectionRect, lassoMask)` — random scatter within radius `brushSize * 3 + 3`, count = `max(4, brushSize * 4)`
- `bresenhamLine(x0, y0, x1, y1, callback)` — classic Bresenham algorithm, calls callback for each pixel
- `rasterRect(x0, y0, x1, y1, filled, callback)` — outline or filled rectangle
- `rasterEllipse(cx, cy, rx, ry, filled, callback)` — midpoint ellipse algorithm

**Add to `engine/selectionEngine.js`:**

- `applyMagicWand(buf, canvasW, canvasH, sx, sy)` → returns `{ selection, lassoMask }` — color-flood fills from start point, tracks bounds, builds selection rect and pixel mask
- `buildLassoMask(path, canvasW, canvasH)` → `Uint8Array` — ray-cast or scanline fill to determine which pixels are inside the lasso path polygon
- `applyMagicWandSelection(...)` and `applyLassoSelection(...)` update `refs.selectionMask` and dispatch SET_SELECTION

**Update `engine/drawingEngine.js`:**

- Add `previewSnap` support: on mouseDown for line/rect/ellipse tools, snapshot current pixels. On mouseMove, restore snapshot then draw preview shape. On mouseUp, commit the shape (no restore, snapshot was temp).
- Add color picker logic: on mouseDown with picker tool, read pixel via `getPixel`, return hex color, dispatch SET_FG_COLOR (and add to color history via PICK_COLOR action).
- Add selection tools: rect select tracks drag bounds and dispatches SET_SELECTION on mouseUp; lasso tracks path in `refs.lassoPath` and calls `buildLassoMask` on mouseUp; magic wand calls `applyMagicWand` on mouseDown.
- Add move tool: on mouseDown, copy selected pixels to temp buffer, clear from canvas. On mouseMove, restore pre-move pixels then blit temp buffer at offset. On mouseUp, commit.

**Done when:** All 12 tools work correctly.

---

### M5 — Brush Shapes + Symmetry

**What:** All 7 brush types work, symmetry painting works.

This is mostly already handled by `stampBrush` in pixelOps, but needs the full implementation of all brush shape conditions (round, square, diamond, cross, pixel, dither25, dither50). Also: brush size 1–32, brush opacity combined with fgAlpha at paint time.

Opacity formula: `finalAlpha = Math.round(fgAlpha * (brushOpacity / 100) * 255)` — this is the alpha value passed to stampBrush as part of the rgba tuple.

The symmetry logic in `paintWithSymmetry` handles H, V, and both. When editing a layer mask (`state.editingMaskId` is set), pixel writes go to `refs.maskBuffers[editingMaskId]` instead of `refs.pixelBuffers[activeLayerId]`.

**Done when:** All brush types, sizes, opacities, and symmetry combinations work correctly.

---

### M6 — Layer System

**What:** Full layer management — add, delete, duplicate, move, rename, visibility, opacity, blend mode, merge, flatten, layer masks.

**Add to reducer:**

- ADD_LAYER: adds new layer object to state.layers, initializes pixel buffer in refs
- DELETE_LAYER: removes from state.layers, deletes from refs.pixelBuffers
- DUPLICATE_LAYER: clones layer metadata + deep copies pixel buffer
- MOVE_LAYER_UP / MOVE_LAYER_DOWN: reorders state.layers array
- UPDATE_LAYER: patch any fields on a layer object (name, visible, opacity, blendMode, hasMask)
- MERGE_LAYER_DOWN: alpha-compositing blend with layer below in pixelOps, then remove merged layer
- FLATTEN_ALL: composite all visible layers into one new buffer, replace layers array with one entry
- ADD_LAYER_MASK: creates new `Uint8Array(canvasW * canvasH).fill(255)` in refs.maskBuffers, sets layer.hasMask
- REMOVE_LAYER_MASK: deletes from refs.maskBuffers, clears layer.hasMask
- SET_EDITING_MASK: sets state.editingMaskId

**How layer rendering works with masks:** `compositeLayersToCanvas` checks `refs.maskBuffers[layer.id]`. If present, it creates a copy of the pixel data and multiplies each pixel's alpha channel by `maskBuffer[pixelIndex] / 255` before drawing.

**Done when:** All layer operations work, layer panel fully functional.

---

### M7 — History (Undo/Redo)

**What:** 50-step undo/redo with full snapshots.

This is mostly implemented in `historyEngine.js` from M3, but now it needs to correctly handle the full complexity of multiple layers and masks:

`pushHistory` deep-copies: all entries in `refs.pixelBuffers`, all entries in `refs.maskBuffers`, the current `state.layers` array, and `state.activeLayerId`. The history stack entry shape: `{ pixelBuffers: { [layerId]: Uint8ClampedArray }, maskBuffers: { [layerId]: Uint8Array }, layers: [...], activeLayerId }`.

`undoHistory` restores by: `.set()` into existing buffers where they exist (avoids allocation), creates new buffers if a layer now exists that didn't before, dispatches RESTORE_HISTORY action with the saved layers array and activeLayerId so the UI (layer list) updates.

The RESTORE_HISTORY reducer case: replaces `state.layers` and `state.activeLayerId` from snapshot, updates `canUndo` and `canRedo` flags.

**Done when:** Undo/redo works across layer changes, brush strokes, fills, and transforms. Limited to 50 steps — oldest entries pruned from the bottom of the stack.

---

### M8 — Frame System

**What:** Multiple frames, frame add/delete/duplicate/rename, frame switching.

**Reducer additions:** ADD_FRAME, DELETE_FRAME, DUPLICATE_FRAME, RENAME_FRAME, SWITCH_FRAME (updates activeFrameIdx and layers/activeLayerId from snapshot), UPDATE_FRAME_THUMBNAIL.

**The frame switch flow (detailed):**

1. User calls `actions.switchToFrame(newIdx)` (a function from `useJellySpriteActions()`, a convenience hook over dispatch + refs)
2. Before dispatching, `saveCurrentFrameToSnapshot()` is called: `refs.frameSnapshots[currentFrameId] = { layers: [...state.layers], activeLayerId: state.activeLayerId, pixelBuffers: { ...refs.pixelBuffers } }`. **Note: this is a shallow copy of the pixelBuffers map, not a deep copy.** The Uint8ClampedArray references themselves are shared. This is intentional — the active frame "owns" the live buffers. When we switch back to this frame, we restore those references.
3. Dispatch SWITCH_FRAME. The reducer sets `activeFrameIdx = newIdx` and reads the target frame's `layers` and `activeLayerId` from a payload (the Provider reads the snapshot just before dispatching).
4. A `useEffect([state.activeFrameIdx])` in the Provider runs. It sets `refs.pixelBuffers = refs.frameSnapshots[newFrameId].pixelBuffers`. Now the live buffers point to the new frame's data.
5. `refs.redraw()` is called.

**The deep copy rule:** When do we deep copy vs shallow copy? Shallow copy is safe for frame saves because the active frame is always the only frame being mutated. When we `duplicateFrame`, we deep copy: `new Uint8ClampedArray(srcBuffer)` for every layer.

**Done when:** Frame filmstrip works, add/delete/duplicate/rename frames work, switching frames correctly saves and loads all layer state.

---

### M9 — Playback + Onion Skinning

**What:** Animation playback at configurable FPS, onion skinning.

**Playback:** `startPlayback()` saves current frame to snapshot, sets `refs.playbackFrameIdx = activeFrameIdx`, sets `refs.isPlaying = true`, starts `setInterval(() => { refs.playbackFrameIdx = (refs.playbackFrameIdx + 1) % frameCount; refs.redraw(); }, 1000/fps)`, stores interval ID on `refs.playIntervalId`. Dispatch SET_IS_PLAYING(true) to update UI. `stopPlayback()` clears interval, sets refs.isPlaying = false, dispatches SET_IS_PLAYING(false), calls `refs.redraw()`.

**Renderer change:** In `canvasRenderer`, the frame to display is: `isPlaying ? frames[refs.playbackFrameIdx] : frames[state.activeFrameIdx]`. During playback, all frame data comes from `refs.frameSnapshots`.

**Onion skinning:** In `canvasRenderer`, if `state.onionSkinning && !refs.isPlaying && frames.length > 1`: composite the previous frame (curIdx - 1) from its snapshot, tint red via `source-atop` fill, draw at 30% opacity before drawing the active frame. Same for next frame (curIdx + 1), tinted blue. The tint is applied to a temporary canvas then drawn with low alpha.

**Done when:** Play/stop works, FPS changes take effect, onion skinning shows correctly tinted ghost frames.

---

### M10 — Selection Tools + Transforms

**What:** Rect select, lasso select, magic wand, move tool, copy/paste/crop/delete, flip/rotate.

The selection is stored in state as `{ x, y, w, h, poly? }` where `poly` is present for lasso selections. The `refs.selectionMask` holds the per-pixel Uint8Array for lasso constraints.

**All draw operations check selection:** `setPixel` in pixelOps always clips to selection bounds and lasso mask if a selection is active. This means selection is automatically respected by every drawing tool without special cases in the drawing engine.

**Transform operations (`engine/pixelOps.js`):**

- `flipHorizontal(buf, canvasW, canvasH)` — swap pixel pairs across vertical center line
- `flipVertical(buf, canvasW, canvasH)` — swap pixel pairs across horizontal center line
- `rotate90CW(buf, canvasW, canvasH)` — returns new buffer with dimensions swapped (note: if canvas is non-square, rotation changes dimensions; handle this case)
- `rotate90CCW(...)` — inverse of above

Transform functions operate on the full layer buffer. Selection-aware transforms (operating only on selected region) are a nice-to-have but not required for M10.

**Marching ants:** The animation loop for marching ants runs via `requestAnimationFrame` when a selection is active. It increments `refs.marchOffset = (refs.marchOffset + 1) % 16` and calls `refs.redraw()`. The renderer draws the selection border using `setLineDash([4,4])` and `lineDashOffset = -refs.marchOffset`. The animation RAF ID is stored on `refs.marchingAntsRaf`.

**Done when:** All selection tools work, copy/paste works (paste places clipboard at selection position), transforms work on active layer.

---

### M11 — Canvas Resize

**What:** Preset and custom canvas resize with 9-point anchor preservation of pixel content.

The anchor maps to an offset: For each anchor code (`tl`, `tc`, `tr`, `ml`, `mc`, `mr`, `bl`, `bc`, `br`), compute `(offsetX, offsetY)` — the position in the new canvas where the old canvas content begins. Formula: `offsetX = anchorCol * Math.round((newW - oldW) / 2)`, `offsetY = anchorRow * Math.round((newH - oldH) / 2)` where anchorCol and anchorRow are derived from the 3x3 anchor grid (0, 1, 2 mapped from left/center/right and top/middle/bottom).

The resize process: For each layer, create a new `Uint8ClampedArray(newW * newH * 4)`, then copy pixels from the old buffer at the computed offset. Width of copying loop is `Math.min(oldW, newW)`, height is `Math.min(oldH, newH)`. Similarly for mask buffers. Then dispatch RESIZE_CANVAS which updates `state.canvasW`, `state.canvasH`, and `state.layers` (no ID changes needed). Recreate the offscreen canvas at the new size.

Frame snapshots also need their pixel buffers resized — iterate `refs.frameSnapshots` and resize each frame's layer buffers. This is the complex part.

**Done when:** Canvas resize works correctly with all 9 anchor positions. Pixel content is preserved and offset correctly.

---

### M12 — Export + Workspace Integration

**What:** All 4 export formats, Send to Animator, From Animator.

**Export functions** go in `engine/exportEngine.js`:

- `exportPNG(refs, state)` — composite active frame, trigger download
- `exportSpriteSheet(refs, state, options)` — composite all frames, arrange in grid, add labels if requested, trigger download
- `exportFramesZip(refs, state, projectName)` — use JSZip, composite each frame, add to zip, trigger download of blob URL
- `exportPaletteHex(palettes, activePalette, projectName)` — join hex values, create text blob, trigger download

All composite operations use `compositeLayersToCanvas` from the compositeEngine — no duplication.

**Workspace integration:**

- `sendToAnimator(refs, state, dispatch)` — composites active frame, calls `projectDispatch({ type: 'SET_SPRITE_FORGE_DATA', payload: dataUrl })`
- `importFromAnimator(projectState, refs, dispatch)` — loads `projectState.spriteSheet` URL into an Image, draws it onto a temp canvas, reads ImageData, sets into active layer buffer. Pushes history, dispatches STROKE_COMPLETE.

Auto-save: Dispatch STROKE_COMPLETE handler in the Provider should also call `sendToAnimator` (or a lighter version that just updates the data URL without downloading anything). This ensures the project always has the latest pixel data.

**Done when:** All exports download correct files. Send/receive with the Animator feature works.

---

### M13 — Color System + Palette Manager

**What:** Full color tooling — color picker component, recent history, palette manager with all operations.

The color picker is a UI component (`ui/ColorPicker.jsx`, already exists from the previous implementation — reuse it). It takes `hex` and `alpha` props and calls `onChange(hex, alpha)`.

**Reducer additions:** PICK_COLOR (sets fgColor, adds to colorHistory, caps at 10), SET_FG_COLOR, SET_BG_COLOR, SET_FG_ALPHA, SWAP_COLORS, PALETTE_ADD_COLOR, PALETTE_REMOVE_COLOR, PALETTE_ADD_NEW, PALETTE_DELETE, PALETTE_RENAME, PALETTE_SET_COLORS.

The `PICK_COLOR` action is dispatched from:

1. The color picker component when user changes color manually
2. The drawing engine when using the color picker tool (reads pixel, dispatches)
3. Clicking a palette swatch

**Done when:** Color picker works, palette manager full CRUD works, recent history tracks last 10 colors.

---

### M14 — View Tools (Reference Image + Tile Preview)

**What:** Reference image overlay, tile preview canvas.

**Reference image:** Stored in state as a data URL string (or null). `loadRefImage(file)` reads the file as data URL, dispatches SET_REF_IMAGE. The image element is created and kept in `refs.refImgEl`. The renderer checks `refs.refImgEl && state.refVisible` and draws it at `state.refOpacity`. Visibility and opacity changes update state and call `refs.redraw()`.

**Tile preview:** A secondary `<canvas>` element rendered inside the View tab. It is updated by the renderer at the end of every `redraw()` call — if `state.tileVisible`, the renderer draws the offscreen canvas content tiled `tileCount × tileCount` times onto the tile canvas. The tile canvas is sized to `canvasW * tileCount * zoom` but capped to a max display size via CSS.

**Done when:** Reference image loads, toggles, and opacity slider works live. Tile preview shows 2×2 or 3×3 tiling and updates as you draw.

---

### M15 — Keyboard Shortcuts

**What:** All keyboard shortcuts listed in the feature list.

**`hooks/useKeyboardShortcuts.js`:** A single `useEffect` on mount that attaches a `keydown` listener to `window`. The handler checks `document.activeElement.tagName` — if `INPUT` or `TEXTAREA`, ignore. Otherwise, reads an `actionsRef.current` that is updated every render with the current bound actions. This avoids stale closures while keeping the listener stable.

The actions object: `{ setTool, doUndo, doRedo, swapColors, deselectAll, copySelection, pasteSelection, deleteSelection, prevFrame, nextFrame, togglePlay }`. Each is a function that dispatches or calls the appropriate action.

**Done when:** All keyboard shortcuts work without interfering with text input.

---

### M16 — UI Polish + CSS

**What:** Left toolbar, right panel tabs, all sub-panels, export modal, full CSS.

This milestone is about correctly connecting all the existing panel components to the new store. Each panel component uses `useJellySpriteStore()` to get `state`, `dispatch`, and `refs`. They call action creators (thin wrappers around dispatch) rather than dispatch directly where it reduces boilerplate.

**Brush preview thumbnail (`BrushThumb.jsx`):** A small canvas that renders a preview of the brush shape. It is a pure component that takes `brushId` and `active` props and draws the brush footprint on a tiny canvas using pixelOps. Reuse the existing component.

**Done when:** Every piece of the UI is connected, the feature is fully functional end-to-end, all the items in the feature list work, and the visual styling matches the previous implementation.

---

## Implementation Order Summary

```
M1  → Store skeleton (reducer, actions, provider, context hook)
M2  → Canvas rendering (compositor, renderer, canvas hook)
M3  → Drawing core: pencil + eraser + history
M4  → All remaining drawing tools
M5  → All brush shapes + symmetry
M6  → Layer system
M7  → History (full multi-layer snapshots)
M8  → Frame system
M9  → Playback + onion skinning
M10 → Selections + transforms
M11 → Canvas resize
M12 → Export + workspace integration
M13 → Color + palette
M14 → View tools
M15 → Keyboard shortcuts
M16 → UI polish + CSS
```

Each milestone is a commit. Each milestone leaves the app buildable and runnable. Do not skip commits.

---

## Data Flow Diagram

```
User Input
    │
    ▼
CanvasArea (mouse events)
    │
    ▼
drawingEngine.onMouseDown/Move/Up
    │ reads:  getState() → tool, brush, colors, activeLayerId, selection
    │ writes: refs.pixelBuffers[activeLayerId]  ← DIRECT MUTATION
    │ calls:  refs.redraw()                     ← DIRECT CANVAS UPDATE
    │
    │ on mouseUp:
    │   refs.pushHistory()    ← snapshot into refs.historyStack
    │   dispatch(STROKE_COMPLETE, thumbnailDataUrl)
    │                                │
    ▼                                ▼
refs.pixelBuffers            JellySpriteReducer
(Uint8ClampedArray)              state update:
    │                          canUndo: true
    │                          frameThumbnails updated
    │                                │
    ▼                                ▼
refs.redraw()               React re-render
    │                         UI updates:
    │                         - Undo button enabled
    ▼                         - Frame thumbnail updated
Canvas element
(HTML5 canvas)
```

```
Frame Switch
    │
    ▼
actions.switchToFrame(newIdx)
    │
    ├── saveCurrentFrameToSnapshot()
    │     refs.frameSnapshots[currentId] = {
    │       layers: [...state.layers],
    │       activeLayerId: state.activeLayerId,
    │       pixelBuffers: { ...refs.pixelBuffers }  ← shallow copy of map
    │     }
    │
    └── dispatch(SWITCH_FRAME, { newIdx, newLayers, newActiveLayerId })
              │
              ▼
         Reducer: state.activeFrameIdx = newIdx
                  state.layers = newLayers
                  state.activeLayerId = newActiveLayerId
              │
              ▼
         useEffect([state.activeFrameIdx]) in Provider:
              refs.pixelBuffers = refs.frameSnapshots[newFrameId].pixelBuffers
              refs.redraw()
```

---

## QA Audit — Tool & Panel Verification

> **Purpose:** Confirm every tool and every panel control works correctly with
> the new Option B architecture (store → refs → engine). Work through these
> one item at a time, checking the box only after live testing in the dev server.
> Fix any bug found before moving to the next item. Commit fixes as they land.
>
> **Architecture checklist per item:**
>
> - State reads from `useJellySprite()` / store, not a stale local copy
> - Pixel writes go through `refs.pixelBuffers` (not an orphaned buffer)
> - UI changes dispatch to the store (not `useState` detached from context)
> - `refs.onStrokeComplete()` is called after any stroke (enables undo, updates thumbnail)

---

### Tool Bar (Left column)

#### SELECT group

- [ ] **Rect Select** — drag draws selection rect; marching ants animate; coords appear in Brush tab; Esc/✕ clears
- [ ] **Lasso Select** — freehand path drawn while dragging; releases as closed polygon selection; marching ants; Esc/✕ clears
- [ ] **Magic Wand** — click flood-selects a colour region; selection shown with marching ants; Esc/✕ clears
- [ ] **Move** — with an active selection, drag moves the selected pixels; commits on mouse-up; undo restores

#### DRAW group

- [ ] **Pencil** — paints with current FG colour + opacity; interpolates between mouse positions; undo enabled after stroke; frame thumbnail updates
- [ ] **Eraser** — paints transparent; respects brush size/shape; undo enabled after stroke
- [ ] **Fill Bucket** — flood-fills from click point with FG colour; respects selection boundary if active; undo works
- [ ] **Color Picker** — click sets FG colour to pixel under cursor; adds to recent colour history; no pixel write, no undo entry

#### SHAPE group

- [ ] **Line** — Bresenham line with live preview from mouseDown to current position; commits on mouseUp; undo works
- [ ] **Rectangle** — live preview rect while dragging; outline or filled per Shape Mode toggle; commits on mouseUp; undo works
- [ ] **Ellipse** — live preview ellipse while dragging; outline or filled; commits on mouseUp; undo works
- [ ] **Spray** — random scatter within brush radius while dragging; sizes and density follow brush settings; undo after mouseUp

#### MIRROR section

- [ ] **H mirror (⇔)** — button toggles; active state highlighted; strokes paint mirrored across vertical centre simultaneously
- [ ] **V mirror (⇕)** — button toggles; active state highlighted; strokes paint mirrored across horizontal centre simultaneously
- [ ] **Both active** — 4-way symmetry; all four quadrants receive strokes

#### ZOOM section

- [ ] **− button** — decrements zoom by 1, floor 1×; display updates; canvas rescales
- [ ] **+ button** — increments zoom by 1, ceiling 16×; display updates; canvas rescales
- [ ] **N× label** — always shows a whole number (not NaN)

#### GRID section

- [ ] **Pixel grid (⊞)** — toggles overlay of 1×1 pixel lines; only visible at zoom ≥ 4×; button shows active state
- [ ] **Frame grid (▦)** — toggles overlay of frame-boundary lines; button shows active state

#### TRANSFORM section

- [ ] **Flip H (↔)** — mirrors active layer pixels horizontally; undo works; does NOT change canvas dimensions
- [ ] **Flip V (↕)** — mirrors active layer pixels vertically; undo works
- [ ] **Rotate CW (↻)** — rotates active layer 90° clockwise; square canvas: in-place; non-square: canvas dims swap correctly via resize path
- [ ] **Rotate CCW (↺)** — rotates active layer 90° counter-clockwise; same dimension behaviour as CW

#### HISTORY section

- [ ] **Undo (↩)** — disabled on fresh canvas; enabled after first stroke; restores previous pixel state; canUndo/canRedo flags update
- [ ] **Redo (↪)** — disabled until after an undo; re-applies the undone stroke; disabled again at head of stack
- [ ] **Clear ✕** — fills active layer with transparent; pushes history (so undo restores); confirmation not required (per current design)

---

### Props Panel (Right column)

#### Always-visible top section

- [ ] **FG swatch** — shows current foreground colour + alpha as combined RGBA preview
- [ ] **BG swatch** — shows background colour; clicking it swaps FG ↔ BG (same as ⇄ button and X key)
- [ ] **⇄ swap button** — swaps FG and BG correctly
- [ ] **Color picker** — HSV gradient + hue bar + alpha bar + hex input + RGB sliders all update `fgColor` / `fgAlpha` in the store
- [ ] **Recent colour row** — appears after first colour pick; last 10 colours; clicking sets FG colour; active colour highlighted

#### PALETTE tab

- [ ] **Palette selector** — dropdown lists all palettes; switching palette updates swatch grid
- [ ] **Swatch grid** — clicking a swatch sets FG colour and adds to recent history
- [ ] **+ swatch** — adds current FG colour to active palette
- [ ] **− swatch** — removes clicked colour from palette (builtins protected)
- [ ] **New palette button** — creates empty named palette; becomes active
- [ ] **Delete palette button** — deletes custom palette; disabled for builtins
- [ ] **Rename palette** — inline rename works
- [ ] **Import .hex button** — loads Lospec-format hex file into a new palette
- [ ] **Ramp button** — generates N interpolated steps between two colours and adds to palette
- [ ] **Preset buttons (DoomJelly 32, CGA, Pico-8, NES)** — load that palette

#### BRUSH tab

- [ ] **Brush shape grid** — 7 shapes (Round, Square, Diamond, Cross, Pixel, Dither, 50% Dith); clicking activates; BrushThumb preview updates
- [ ] **Size slider** — 1–32px; disabled and locked to 1 when Pixel brush active; value label updates live
- [ ] **Opacity slider** — 1–100%; value label updates live; affects stroke alpha
- [ ] **Shape Mode section** — only visible when Rect or Ellipse tool active; Outline/Filled toggle works
- [ ] **Selection section** — only visible when a selection is active; shows `x,y — w×h px`; ✕ button deselects
- [ ] **Copy button** — copies selected pixels to clipboard; Paste button enables
- [ ] **Paste button** — pastes clipboard at selection position; disabled when clipboard empty
- [ ] **Crop button** — resizes canvas to selection bounds; selection clears; pixel content preserved
- [ ] **Delete button** — fills selection region with transparent; pushes history

#### LAYERS tab

- [ ] **Layer list** — shows all layers in reverse order (top layer first); active layer highlighted
- [ ] **Click layer row** — sets active layer; pixel writes then go to that layer's buffer
- [ ] **Visibility toggle (👁/⊘)** — hides/shows layer in composite; canvas redraws immediately
- [ ] **Double-click name** — enters inline rename; Enter/blur commits; Escape cancels
- [ ] **↑ / ↓ buttons** — reorder layer in stack; composite order updates immediately
- [ ] **⎘ Duplicate** — deep-copies pixel buffer + metadata; new layer inserted above; undo works
- [ ] **✕ Delete** — removes layer; blocked if only one layer remains; undo works
- [ ] **Blend mode select** — only visible on active layer row; changes composite operation; canvas redraws
- [ ] **Opacity slider** — only visible on active layer row; 0–100%; canvas redraws live
- [ ] **+ Add layer button** — inserts blank layer above active; becomes new active layer
- [ ] **Merge Down** — alpha-composites active layer into the one below; disabled if active is bottom layer
- [ ] **Flatten All** — composites all visible layers into one; disabled if only one layer
- [ ] **+ Add Mask** — creates white mask on active layer; mask chip (⬡) appears on row
- [ ] **Edit Mask toggle** — clicking ⬡ chip enters mask-editing mode; brush strokes write greyscale to mask buffer
- [ ] **Del Mask** — removes mask from layer; mask chip disappears

#### CANVAS tab

- [ ] **Anchor picker** — 9 buttons (3×3 grid); active button highlighted; determines where existing pixels land after resize
- [ ] **Preset size buttons** — 64×64, 128×128, 256×128, 256×256; active preset highlighted when canvas matches; clicking resizes
- [ ] **Custom W / H inputs** — number inputs 1–1024; Enter key applies; Apply (↵) button applies
- [ ] **Resize preserves content** — pixels shifted per anchor; no corruption of pixel data

#### VIEW tab

- [ ] **Load image… button** — file picker accepts images; loaded image appears as ref preview thumbnail
- [ ] **Visible checkbox** — toggles ref image overlay on canvas; canvas redraws immediately
- [ ] **Opacity slider** — 5–100%; canvas redraws live; label shows current %
- [ ] **✕ Remove ref** — clears ref image; controls hide; canvas redraws
- [ ] **2×2 tile button** — shows tiled preview canvas with 2×2 repetitions; updates as you draw
- [ ] **3×3 tile button** — shows tiled preview canvas with 3×3 repetitions; updates as you draw
- [ ] **off button** — hides tile preview canvas

#### MORE tab

- [ ] **← From Animator button** — only visible when project has a sprite sheet; imports sheet into active layer buffer
- [ ] **Send to Animator → button** — composites active frame; sends data URL to ProjectContext; button always visible
- [ ] **⬇ Export… button** — opens Export modal

#### Export modal

- [ ] **PNG — active frame** — downloads composite of all visible layers for active frame
- [ ] **PNG — sprite sheet** — downloads all frames arranged in a grid per column/padding settings
- [ ] **ZIP — all frames** — downloads zip of individually named PNGs per frame
- [ ] **Palette .hex** — downloads active palette as Lospec `.hex` text file
- [ ] **Columns / Padding / Labels inputs** — persist during session; affect sprite sheet output
- [ ] **✕ close / backdrop click** — closes modal without action

#### Frame Strip (Bottom)

- [ ] **▶ Play button** — starts playback; button changes to ■ Stop; onion skin hides during playback
- [ ] **FPS slider** — adjusts playback speed live; range 1–30fps
- [ ] **Frame thumbnails** — shows composite of each frame; clicking switches active frame; thumbnail updates after every stroke
- [ ] **+ Frame** — adds new blank frame; becomes active
- [ ] **Double-click frame name** — inline rename; Enter/blur commits; Escape cancels
- [ ] **Onion skin** — when enabled in playback controls, previous frame tinted red and next frame tinted blue at 30% opacity behind active frame

---

_Last updated: 2026-03-07 — M1–M16 complete. QA audit in progress._
