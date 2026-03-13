# Drawing Engine — Tool Architecture Contract

Rules governing all code inside `src/features/jelly-sprite/engine/` and `src/features/jelly-sprite/hooks/`.  
Violations introduce state desynchronisation, stale-dimension crashes, and tearing between the three Zustand stores.

---

## Store Architecture Overview

Three stores compose the JellySprite runtime:

| Store                                                        | Source of truth for                                                           | How engine code reads it                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `usePixelDocumentStore` (Zustand)                            | `canvasW`, `canvasH`, `layers`, `activeLayerId`, `activeFrameIdx`             | `usePixelDocumentStore.getState()` — synchronous, always fresh           |
| `useToolStore` (Zustand + persist)                           | active tool, brush params, primary/secondary colour, view state (zoom, grid…) | `useToolStore.getState()` — synchronous, always fresh                    |
| `useJellySpriteStore` (React useReducer bridged via context) | frames, undo/redo flags, canvas size (mirror), playback                       | **Engine code must not touch this.** It is for React UI components only. |

The `refs` object is the engine's mutable workspace:

| `refs` field            | Purpose                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `refs.doc`              | `PixelDocument` instance — owns `pixelBuffers`, `maskBuffers`, `frameSnapshots`, `historyStack`            |
| `refs.drawingEngine`    | `drawingEngine` factory return value; pointer events route here                                            |
| `refs.redraw`           | Unified `redraw()` function from `canvasRenderer.js`                                                       |
| `refs.pushHistory`      | Snapshot current pixel state; wired by `wireHistoryEngine`                                                 |
| `refs.onStrokeComplete` | Called on stroke end — pushes history AND updates thumbnails + UI flags                                    |
| `refs.selection`        | Current selection rect `{x, y, w, h}` (or `null`)                                                          |
| `refs.editingMaskId`    | Layer ID whose mask is currently being edited (or `null`) — synced by JellySprite render body every render |

---

## Rules

### T1 — Read canvas dimensions from `usePixelDocumentStore.getState()`

```js
// ✅ Correct
const { canvasW, canvasH, activeLayerId } = usePixelDocumentStore.getState();

// ❌ Wrong — refs.doc.canvasW may be out of sync during resize transitions
const { canvasW } = refs.doc;

// ❌ Wrong — closing over canvasW from an outer React render scope makes it stale
function myTool(refs, canvasW, canvasH) {
  /* canvasW is stale after resize */
}
```

`usePixelDocumentStore.getState()` is synchronous and always returns the current committed state. Never close over or cache `canvasW`/`canvasH` across calls.

---

### T2 — Write pixels directly to `refs.doc.pixelBuffers[layerId]`

```js
// ✅ Correct
const buf = refs.doc.pixelBuffers[activeLayerId];
buf[idx] = value;

// ❌ Wrong — copying the buffer breaks the live reference; mutations won't appear
const localCopy = refs.doc.pixelBuffers[activeLayerId];
localCopy[idx] = value; // ← this is still the live buffer, fine — DON'T store it past a stroke
```

`pixelBuffers` is replaced atomically during resize (a whole new `{}` object). Never cache a buffer reference across asynchronous boundaries (rAF, setTimeout, async/await). Re-read `refs.doc.pixelBuffers[layerId]` at the start of each tool operation.

---

### T3 — Never dispatch to the JellySprite reducer from engine code

```js
// ✅ Correct — use refs side-effects only
refs.redraw?.();
refs.onStrokeComplete?.();

// ❌ Wrong — engine code dispatching to the React reducer creates coupling and
//   double-render paths. historyEngine.js's RESTORE_HISTORY is the sole exception.
import { useJellySpriteStore } from '../store/useJellySpriteStore.js';
useJellySpriteStore.getState().dispatch({ type: 'SET_LAYERS', ... });
```

**Exception:** `historyEngine.js` dispatches `RESTORE_HISTORY` after undo/redo because layer metadata must be re-synced to the React reducer state. No other engine file may dispatch.

---

### T4 — Never import React in engine files

Engine files (`engine/`, `engine/tools/`) are pure JavaScript modules. They must not import from `react` or use React hooks.

```js
// ❌ Wrong
import { useRef, useCallback } from "react";
```

If you need a mutable container, receive it through `refs`. If you need a callback dependency, receive it as a function argument.

---

### T5 — Read `editingMaskId` from `refs.editingMaskId`, not from stores

```js
// ✅ Correct
const editingMaskId = refs.editingMaskId;

// ❌ Wrong — this field is not in either Zustand store
const { editingMaskId } = usePixelDocumentStore.getState(); // doesn't exist
```

`refs.editingMaskId` is written by `JellySprite.jsx` in its render body on every render, so it is always current. The engine's `getEngineState(refs)` helper already merges it alongside the Zustand reads.

---

### T6 — Trigger renders via `refs.redraw?.()`, never directly

```js
// ✅ Correct
refs.redraw?.();

// ❌ Wrong — calling the renderer factory directly bypasses the refs indirection
//   and breaks if the renderer is swapped or not yet mounted
createRenderer(refs).redraw();
```

`refs.redraw` is set by `canvasRenderer.js` on mount and reset whenever the renderer is rebuilt. The `?.` guard is intentional — engine code may be called before the renderer is attached on first mount.

---

### T7 — Save history via `refs.onStrokeComplete ?? refs.pushHistory`

```js
// ✅ Correct — onStrokeComplete pushes history AND updates thumbnails + UI flags
refs.onStrokeComplete?.();

// ✅ Also correct for bare history push (no thumbnail/UI update needed)
refs.pushHistory?.();

// ❌ Wrong — bypasses the wired chain; thumbnail and canUndo/canRedo won't update
refs.doc.pushHistory();
```

`refs.onStrokeComplete` is `pushHistoryEntryStubRef.current` from `JellySprite.jsx` — it chains `refs.pushHistory()`, `updateThumbnailForActiveFrame()`, and `SET_CAN_UNDO/REDO` dispatches. Call it at the end of each completed stroke. The drawing engine uses `refs.onStrokeComplete ?? refs.pushHistory` as its default.

---

### T8 — Call `syncFromDoc()` only after ALL buffer mutations are complete

```js
// ✅ Correct — Zustand updated after refs.doc is fully consistent
refs.doc.pixelBuffers = freshBuffers;
refs.doc.canvasW = nw;
usePixelDocumentStore.getState().syncFromDoc();

// ❌ Wrong — Zustand sees canvasW=nw but pixelBuffers are still at old size;
//   any redraw() triggered by a Zustand subscriber will crash in ImageData
usePixelDocumentStore.getState().syncFromDoc();
refs.doc.pixelBuffers = freshBuffers; // ← too late
```

`syncFromDoc()` is a manual sync for cases where `refs.doc` was mutated without calling `_notify()`. After `syncFromDoc()`, any call to `redraw()` — however triggered — will read the new Zustand dimensions against `refs.doc.pixelBuffers`. Both must agree before `syncFromDoc()` is called. This is the root cause of the Sprint-16 resize crash (T8 violation).

---

### T9 — Use `getEngineState(refs)` as the single state snapshot in `drawingEngine.js`

`getEngineState` merges `useToolStore.getState()`, `usePixelDocumentStore.getState()`, and `refs.editingMaskId` into one object at the start of each pointer event handler. Do not spread individual store reads across handler bodies; call `getEngineState(refs)` once and destructure.

---

### T10 — `compositeLayersToCanvas` receives correctly-sized buffers

`compositeEngine.js` constructs `new ImageData(buf, w, h)` where `w` and `h` come from `target.width`/`target.height` (`refs.offscreenEl`). Callers are responsible for ensuring every buffer in `pixelBuffers` has length `4 * w * h` before calling `compositeLayersToCanvas`. The in-file size guard (added Sprint 16) skips mismatched layers silently as a last resort — it is **not** a substitute for correct buffer management, only a crash safety net.

---

## Applying the rules: quick checklist for new tool code

1. Does the tool read canvas geometry? → `usePixelDocumentStore.getState()`. ✅
2. Does the tool write pixels? → `refs.doc.pixelBuffers[activeLayerId]`, re-read each call. ✅
3. Does the tool need to see the current colour/brush? → `useToolStore.getState()`. ✅
4. Does the tool need to know if a mask is being edited? → `refs.editingMaskId`. ✅
5. Does the tool finish a stroke? → call `refs.onStrokeComplete ?? refs.pushHistory`. ✅
6. Does the tool need to re-render? → `refs.redraw?.()`. ✅
7. Does the file import `react`? → Remove it. ✅
8. Does the file import `jellySpriteActions`? → Remove it (historyEngine.js is the only exception). ✅
