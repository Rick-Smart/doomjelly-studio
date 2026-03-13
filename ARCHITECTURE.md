# DoomJelly Studio — Architecture Reference

**Last updated:** March 12, 2026  
**Branch:** `feature/jelly-sprite-improvements`

This document is the permanent architectural contract for the codebase. Every
new feature, refactor, and sprint must maintain consistency with the rules
defined here. When in doubt, consult this document before writing code.

---

## Design Philosophy

DoomJelly Studio is a creative tool. Stability is not optional — every bug that
loses a user's work, every blank screen on refresh, every silent save failure is
a fundamental product failure. Architectural rules exist to prevent these bugs
by class, not by individual fix.

The primary inspiration for the layer model is
[Aseprite's source structure](https://github.com/aseprite/aseprite/tree/main/src)
— a production-grade C++ sprite editor organized in strict dependency levels
where the document model is zero-dependency, I/O lives in its own tier, the UI
knows about data but data never knows about the UI, and every user action is an
explicit command in a reversible history.

---

## Layer Architecture

Layers are strictly ordered. **Each layer may only import from layers below
it.** Violations create circular dependency risk and make features impossible
to test in isolation.

```
Layer 0  src/engine/
           Pure functions — no React, no DOM, no side effects.
           Accepts plain JS objects. Returns plain JS objects.
           Testable without a browser.

           frameUtils.js       Grid math: col/row ↔ pixel coords, frame counts
           atlasBuilder.js     Pack unique cells into a packed atlas
           animStrips.js       Build per-animation strip images
           serialization.js    Encode/decode sprite documents (pure transform)

Layer 1  src/services/
           I/O only — Promises, no React, no JSX, no DOM.
           Side effects (network, IDB, localStorage) belong here and only here.

           idb.js              Raw IndexedDB wrapper (openDB, idbGet, idbPut, idbDelete)
           supabaseApi.js      Raw Supabase calls (sbSaveSprite, sbLoadSprite, …)
           sprites.js          Sprite CRUD — composes idb + supabaseApi
           projects.js         Project CRUD — composes idb + supabaseApi
           exportService.js    JSON serialization for export formats (Phaser3, generic)
           imageExportService.js  Canvas-based image rendering (atlas, strips, thumbnails)

Layer 2  src/contexts/
           React state — normalized, no derived values.
           Reducers live in separate files. Contexts provide only what components need.

           projectReducer.js   Pure reducer + initialState (no React imports)
           ProjectContext.jsx  Thin provider: useReducer + history wrapper + persistence
           PlaybackContext.jsx Playback controls forwarded via refs
           ThemeContext.jsx    CSS class toggle only
           AuthContext.jsx     Supabase session state

Layer 3  src/hooks/
           Composable hooks — read contexts, call services, encapsulate patterns.
           Never contain JSX. Always return values, not components.

           useLocalStorage.js     (existing)
           useAnimationLoop.js    (existing)
           useCanvas.js           (existing)
           useDragReorder.js      NEW — drag-state + splice reorder pattern
           useScrollIntoView.js   NEW — auto-scroll active item into view

Layer 4  src/ui/
           Generic theme-ready components.
           Zero feature knowledge. Zero context imports (except ThemeContext).
           Every prop is documented in a comment above the component.

           Button, IconButton, Input, NumberInput (+ compact prop), Select (+ size prop),
           Toggle, Slider, Toolbar, Panel (+ collapsible prop), Tooltip,
           Badge, Card, Modal, EmptyState, FileDropZone, Toast, ColorPicker,
           ConfirmDialog, ErrorBoundary, Page

Layer 5  src/features/
           Feature UI — the only place that imports from contexts and renders pages.
           Features NEVER import from other features (Rule 11).
           Each feature exports through index.js only (Rule 12).

           animator/
             index.js               Public API barrel
             shared/
               FrameThumb.jsx       Shared canvas thumbnail (Rule: no duplication)
             AnimatorPage/          Layout only (~150 lines target)
             SheetList/             Sheet switcher (extracted from AnimatorPage)
             SplitSaveButton/       Save + dropdown (extracted from AnimatorPage)
             hooks/
               useAnimatorKeyboard.js   Keyboard shortcuts (extracted from AnimatorPage)
             animatorSerializer.js  buildAnimatorBody helper
             selectors.js           Derived state selectors (Rule 13)
             AnimationSidebar/
             FrameConfigPanel/
             KeyboardHelp/
             PreviewCanvas/
             SequenceBuilder/
             SheetViewerCanvas/
             SpriteImporter/
             TimelineView/
             TracksPanel/

           jelly-sprite/
             index.js
             engine/              Drawing engine (pixel ops, layers, tools)
             store/               JellySprite-specific reducer + context
             hooks/
             panels/
             JellySprite.jsx
             JellySpriteWorkspace.jsx

           projects/
             index.js
             ProjectsPage.jsx

           auth/
             index.js
             LoginPage.jsx

           settings/
             index.js
             SettingsPage/

           export/
             index.js
             ExportPanel/

Layer 6  src/router/
           Route definitions + lazy loading. Nothing else.

           routes.jsx          All pages wrapped in React.lazy()
           ProtectedRoute.jsx  Auth guard — always renders something (never null)

Layer 7  src/
           Entry points only.

           main.jsx            React DOM mount
           App.jsx             Provider composition only (~25 lines max)
```

---

## The 18 Rules

These are the non-negotiable contract. PRs that violate a rule must fix the
violation before merge.

---

### Rule 1 — URL is identity for every editor

Every editor page knows what it is editing from the URL alone.  
Refresh must always work. Sharing a URL must always work.

```
/animator/:spriteId     ✅
/jelly-sprite/:spriteId ✅
/animator               ❌  — banned (no identity)
/jelly-sprite           ❌  — banned (no identity)
```

---

### Rule 2 — `dataUrl` is canonical; `objectUrl` is a render cache

- `dataUrl` (base64) is the durable image. It is always saved to `animatorBody.sheets[].dataUrl`.
- `objectUrl` (`blob:`) is volatile. It is **never** persisted — always recreated from `dataUrl` on mount.
- A single restore `useEffect` per editor does: `dataUrl → blob → objectUrl → RESTORE_SHEET_URLS`.
- A sheet with no `dataUrl` shows a "stale" warning. It never silently crashes.

---

### Rule 3 — No `state.spriteSheet`; use a computed selector

`state.spriteSheet` is a denormalized duplicate of the active sheet and is
a source of sync bugs. All consumers derive the active sheet via the selector:

```js
// src/features/animator/selectors.js
export const selectActiveSheet = (state) =>
  state.sheets.find((s) => s.id === state.activeSheetId) ?? null;
```

Direct `state.spriteSheet` reads in component code are banned.

---

### Rule 4 — `await handleSave()` before any navigation

`handleSave` returns a Promise. Every call site that navigates after a save
must `await` it. Fire-and-forget saves before navigation are banned.

---

### Rule 5 — One canonical `animatorBody` format; no legacy fields in new saves

New saves write exactly:

```json
{
  "sheets": [
    {
      "id": "",
      "filename": "",
      "dataUrl": "",
      "width": 0,
      "height": 0,
      "frameConfig": {}
    }
  ],
  "activeSheetId": "",
  "animations": [],
  "frameConfig": {}
}
```

The legacy `spriteSheet` top-level field is never written in new saves.
`LOAD_PROJECT` keeps its migration code so old saves still open.

---

### Rule 6 — Strip ALL binary data before localStorage persistence

localStorage = metadata + IDs only.  
IDB / Supabase = all binary data (pixel buffers, base64 images).

`sheets[]` must have both `dataUrl` and `objectUrl` stripped before every
localStorage write. Never persist binary blobs to localStorage.

---

### Rule 7 — First-save always updates the URL

After the first `saveSprite` call for a new document, if the URL doesn't
already contain the saved ID, call:

```js
navigate("/tool/" + id, { replace: true });
```

A new document that has been saved must always be reachable by refresh.

---

### Rule 8 — ProtectedRoute always renders something during load

`ProtectedRoute` never returns `null` during auth checks. It renders a minimal
loading indicator. Blank white flashes are a trust signal failure.

---

### Rule 9 — IDB is the local source of truth; localStorage index is expendable

A failed localStorage index write must never swallow a successful IDB write.
All index writes are wrapped in `try/catch`. The index can be rebuilt from IDB
at any time if it is corrupt or missing. IDB writes are the real save.

---

### Rule 10 — `navigate('/tool')` without spriteId is banned

Every navigation to an editor must carry the spriteId:

```js
navigate('/animator/' + spriteId)      ✅
navigate('/jelly-sprite/' + spriteId)  ✅
navigate('/animator')                  ❌
navigate('/jelly-sprite')              ❌
```

---

### Rule 11 — Features never import from other features

Cross-feature coupling creates circular dependency risk and makes individual
features impossible to test or reuse in isolation. All shared logic lives in
`src/engine/`, `src/services/`, `src/hooks/`, or `src/ui/`.

```js
// BANNED — animator importing from jelly-sprite:
import { drawingEngine } from "../../jelly-sprite/engine/drawingEngine";

// CORRECT — both features importing from shared layer:
import { frameToRect } from "../../../engine/frameUtils";
```

---

### Rule 12 — Every feature exports through `index.js`

The `index.js` barrel is the public API of a feature. Routes and other files
reference only the barrel, never internal paths.

```js
// routes.jsx — correct:
import { AnimatorPage } from "../features/animator";

// BANNED — deep import:
import { AnimatorPage } from "../features/animator/AnimatorPage/AnimatorPage";
```

---

### Rule 13 — Selectors for any derived value used by 2+ components

Any derived state that is computed by more than one component lives in
`selectors.js` inside its feature. Components never duplicate `.find()` or
`.filter()` logic for shared data.

```js
// src/features/animator/selectors.js
export const selectActiveSheet = (state) =>
  state.sheets.find((s) => s.id === state.activeSheetId) ?? null;

export const selectActiveAnimation = (state) =>
  state.animations.find((a) => a.id === state.activeAnimationId) ?? null;
```

---

### Rule 14 — Engine functions are pure

Functions in `src/engine/` accept plain JS objects and return plain JS objects.
They contain no `useRef`, no `document`, no `window`, no `console.log`, no DOM
access, no React imports. This makes them testable in isolation and safely
usable across features.

---

### Rule 15 — Services are I/O only

Nothing in `src/services/` uses React hooks, JSX, or `document` APIs.
Services return `Promise`. If a service call should show a toast, that toast is
triggered by the calling component after the Promise resolves, not inside the
service.

---

### Rule 16 — Undoable operations batch via transactions

Any user action that should produce a single undo step batches all its
sub-dispatches so the history captures before/after the full operation, never
a partial intermediate state. Multiple sequential dispatches that belong to
one logical action must be refactored into a single dispatch or a transaction
helper.

---

### Rule 17 — Route-level lazy loading

Every feature page is wrapped in `React.lazy()` in `routes.jsx`. This keeps the
initial bundle size constant as features are added.

```js
const AnimatorPage = lazy(() => import("../features/animator"));
const JellySpriteWorkspace = lazy(() => import("../features/jelly-sprite"));
```

---

### Rule 18 — CSS design tokens for all repeated values

No component CSS file contains raw `color-mix()` literals or magic pixel values
that duplicate existing design tokens. Repeated patterns become named tokens in
`src/index.css`. Canvas 2D context color values are read from
`getComputedStyle(document.documentElement)` — never hardcoded RGBA strings.

```css
/* src/index.css */
:root {
  --accent-tint-soft: color-mix(in srgb, var(--accent) 10%, var(--surface2));
  --accent-tint-mid: color-mix(in srgb, var(--accent) 14%, var(--surface2));
  --accent-tint-strong: color-mix(in srgb, var(--accent) 22%, var(--surface2));
  --cell-min-w: 44px; /* shared across TimelineView and TracksPanel */
  --track-label-w: 130px;
  --danger: #f87171; /* used by Button variant="danger" and SpriteImporter */
}
```

---

## CSS Component Contract

Every component in `src/ui/` follows this contract:

| Requirement               | Detail                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| All colors via CSS tokens | No hardcoded hex/rgb values                                                                       |
| No inline `style=` props  | Exception: dynamic widths/heights from user interaction                                           |
| BEM-ish class names       | `.component-name__element--modifier`                                                              |
| `compact` / `size` prop   | `NumberInput` and `Select` expose a compact variant instead of requiring parent context overrides |
| No feature logic          | UI components accept data via props. They never import from `features/` or call services          |

---

## State Shape Reference

### `ProjectContext` normalized state

```js
{
  id: string | null,
  projectId: string | null,
  name: string,

  // Multi-sheet support
  sheets: [{ id, filename, objectUrl, width, height, frameConfig }],
  // Note: dataUrl is present in memory but stripped from localStorage
  activeSheetId: string | null,

  // NO spriteSheet field — use selectActiveSheet(state) from selectors.js

  // JellySprite pixel state (set by JellySprite, read by save flow)
  jellySpriteDataUrl: string | null,
  jellySpriteState: object | null,
  animatorState: object | null,

  // Animator state
  frameConfig: { frameW, frameH, scale, offsetX, offsetY, gutterX, gutterY },
  animations: [{ id, name, frames: [{ col, row, ticks }] }],
  activeAnimationId: string | null,
}
```

### `animatorBody` canonical save format

```json
{
  "sheets": [
    {
      "id": "...",
      "filename": "...",
      "dataUrl": "...",
      "width": 0,
      "height": 0,
      "frameConfig": {}
    }
  ],
  "activeSheetId": "...",
  "animations": [
    {
      "id": "...",
      "name": "...",
      "frames": [{ "col": 0, "row": 0, "ticks": 6 }]
    }
  ],
  "frameConfig": {
    "frameW": 32,
    "frameH": 32,
    "scale": 2,
    "offsetX": 0,
    "offsetY": 0,
    "gutterX": 0,
    "gutterY": 0
  }
}
```

---

## Long-Term: Unified Document Model

The current architecture has two parallel state systems (JellySprite and
Animator) with an explicit conversion handoff (`jellyBody` → `animatorBody`).

The target is a single `SpriteDocument` that both tools read and write:

```js
// Future: src/engine/SpriteDocument.js
{
  id, name, projectId,

  // Sheets (image data) — owned and edited by Animator tool
  sheets: [{ id, filename, dataUrl, width, height, frameConfig }],
  activeSheetId,

  // Animations — owned and edited by Animator tool
  animations: [{ id, name, frames: [{ col, row, ticks }] }],
  activeAnimationId,
  frameConfig,

  // Pixel drawing state — owned and edited by JellySprite tool
  jellyState: { layers, frames, palette, canvasW, canvasH, ... }
}
```

JellySprite = the drawing tool (writes `jellyState`, generates sheet `dataUrl`).  
Animator = the animation tool (reads `sheets[]`, writes `animations[]`).  
Neither tool converts the other's data — they both read from and write to the
same document. No `animatorBody` / `jellyBody` translation step.

**This unification is several sprints away.** Every architectural decision
between now and then should move toward this model, not away from it.

Immediate implications:

- Split `AnimatorContext` and `JellySpriteContext` instead of the shared `ProjectContext`
- Thin `ActiveSpriteContext` carries `{ id, name, projectId }` as shared navigation identity
- `ProjectContext` becomes the document store; tools subscribe to slices

---

## Patterns NOT Allowed

These patterns are explicitly banned. If you see one appear in a PR, it must be
replaced before merge.

| ❌ Pattern                                                                   | ✅ Correct replacement                              |
| ---------------------------------------------------------------------------- | --------------------------------------------------- |
| `state.spriteSheet` read in a component                                      | `selectActiveSheet(state)` from `selectors.js`      |
| `navigate('/animator')` without spriteId                                     | `navigate('/animator/' + spriteId)`                 |
| `import X from '../../other-feature/...'`                                    | Move shared code to `src/engine/` or `src/hooks/`   |
| `import X from '../Feature/Feature.jsx'`                                     | `import X from '../Feature'` (use barrel)           |
| `color-mix(in srgb, var(--accent) ..., ...)` in CSS                          | `var(--accent-tint-soft)` CSS token                 |
| `rgba(59, 130, 246, ...)` in canvas code                                     | `getComputedStyle(el).getPropertyValue('--accent')` |
| Duplicate `useState(null)/onDragStart` drag pattern                          | `useDragReorder` hook                               |
| Duplicate `scrollIntoView` pattern                                           | `useScrollIntoView` hook                            |
| Duplicate `FrameThumb` canvas component                                      | `src/features/animator/shared/FrameThumb`           |
| `localStorage.setItem(key, JSON.stringify({...sheets}))` with dataUrl intact | Strip dataUrl before persisting                     |
| Fire-and-forget save before `navigate()`                                     | `await handleSave(); navigate(...)`                 |
| `return null` in ProtectedRoute                                              | Return a loading indicator                          |
| Service calling `showToast()`                                                | Return error from service; caller shows toast       |
| `idbPut(...)` without `try/catch` on index writes                            | Wrap index writes in `try/catch`                    |
