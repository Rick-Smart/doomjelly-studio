# DoomJelly Studio — Sprint Tracker

**Branch:** `feature/jelly-sprite-improvements`  
**Architecture reference:** `ARCHITECTURE.md` — read this first before starting any sprint.  
**Last updated:** March 13, 2026

---

## Sprint status

| Sprint   | Name                               | Status                   |
| -------- | ---------------------------------- | ------------------------ |
| Sprint 0 | Data Stability                     | ✅ Complete (`92997f7`)  |
| Sprint 1 | Foundation Cleanup                 | ✅ Complete (`b5fda67`)  |
| Sprint 2 | Monolith Decomposition             | ✅ Complete (`d8033f9`)  |
| Sprint 3 | Feature Contract Enforcement       | ✅ Complete (`86e3b26`)  |
| Sprint 4 | Context Decomposition              | ✅ Complete (`ac647ed`)  |
| Sprint 5 | State Finalization                 | ✅ Complete (`625e694`)  |
| Sprint 6 | Unified Document Model             | 🔄 In progress (6a done) |
| Sprint 7 | JellySprite PixelDocument Refactor | 🔲 Not started           |
| Sprint 8 | TypeScript Migration               | 🔲 Not started           |
| Sprint 9 | Zustand State Management           | 🔲 Not started           |

---

## Sprint Governance

### On refactors

Major refactors are always on the table. A sprint can replace a subsystem
entirely if that produces a better result than an incremental migration. The
goal is the best version of the app, not the version with the least code
changed.

Before each sprint, explicitly challenge the design assumptions it rests on:

- Is the abstraction this sprint builds on top of actually correct?
- Would a clean rewrite be shorter than the migration path?
- Does the planned work move toward or away from the unified document model?

Record the outcome: which assumptions were challenged, which were kept, which
were replaced, and why. This history is as valuable as the code.

### On compatibility shims

Shims (re-export wrappers, legacy action aliases, backward-compat dispatch
paths) are permitted for **one sprint cycle** while consumers migrate. They
must be resolved the next sprint. An unresolved shim that survives two sprints
becomes a design debt line item.

### On scope

Sprints can be as large or as small as the problem demands. Feature complexity
is the scope signal, not time or line count. A sprint that replaces one file
is as valid as one that restructures five contexts.

---

## ✅ Sprint 0 — Data Stability (COMPLETE)

**Why it existed:** Every new feature was fighting the same class of bugs: blank
screens on navigation, sprite sheets going stale after a route change, unsaved
work silently lost on unmount, state that lived in two places and drifted out
of sync. Sprint 0 eliminated those entire bug classes permanently.

---

## Live bugs found (already broken TODAY)

### Bugs fixed

| #     | Bug                                                               | Commit    | Files                      |
| ----- | ----------------------------------------------------------------- | --------- | -------------------------- |
| Bug 1 | Dead auto-save (`getSheetDataUrl` → `buildAnimatorBody`)          | `908ba2d` | `AnimatorPage.jsx`         |
| Bug 2 | Full base64 sheets written to localStorage on every keystroke     | `908ba2d` | `ProjectContext.jsx`       |
| Bug 3 | JellySprite first-save didn't update URL → refresh = blank canvas | `908ba2d` | `JellySpriteWorkspace.jsx` |
| Bug 4 | "Edit in JellySprite" navigated without ID                        | `908ba2d` | `AnimatorPage.jsx`         |
| Bug 5 | `ProtectedRoute` returned `null` during auth check → blank flash  | `908ba2d` | `ProtectedRoute.jsx`       |

### Rules implemented

| #       | Rule                                                                       | Commit    | Files                                                                            |
| ------- | -------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------- |
| Rule 1  | URL = identity: `/animator/:spriteId` added + self-load                    | `908ba2d` | `routes.jsx`, `AnimatorPage.jsx`                                                 |
| Rule 2  | `dataUrl` canonical; `objectUrl` rebuilt on mount                          | `908ba2d` | `AnimatorPage.jsx`                                                               |
| Rule 3  | Drop `state.spriteSheet`; use `selectActiveSheet()` in all 5 consumers     | `92997f7` | `AnimatorPage`, `SequenceBuilder`, `TracksPanel`, `PreviewCanvas`, `ExportPanel` |
| Rule 4  | `await handleSave()` before navigate in `handleEditInJellySprite`          | `92997f7` | `AnimatorPage.jsx`                                                               |
| Rule 5  | No legacy `spriteSheet` field in `buildAnimatorBody` new saves             | `92997f7` | `AnimatorPage.jsx`                                                               |
| Rule 6  | Strip `dataUrl` + `objectUrl` from `sheets[]` in localStorage              | `908ba2d` | `ProjectContext.jsx`                                                             |
| Rule 7  | JellySprite first-save → `navigate('/jelly-sprite/' + id, {replace:true})` | `908ba2d` | `JellySpriteWorkspace.jsx`                                                       |
| Rule 8  | `ProtectedRoute` shows loading UI, never `null`                            | `908ba2d` | `ProtectedRoute.jsx`                                                             |
| Rule 9  | IDB index writes wrapped in `try/catch` — failure is non-throwing          | `92997f7` | `projectService.js`                                                              |
| Rule 10 | All `navigate('/animator')` calls → `navigate('/animator/:spriteId')`      | `908ba2d` | `ProjectsPage.jsx`, `AnimatorPage.jsx`                                           |

---

## ✅ Sprint 1 — Foundation Cleanup (COMPLETE `b5fda67`)

**Goal:** Eliminate duplication, ship shared infrastructure, add lazy loading.
No new user-visible features. Every item here unblocks Sprint 2.

### 1a — CSS design tokens (Rule 18)

Add to `src/index.css`:

```css
:root {
  --accent-tint-soft: color-mix(in srgb, var(--accent) 10%, var(--surface2));
  --accent-tint-mid: color-mix(in srgb, var(--accent) 14%, var(--surface2));
  --accent-tint-strong: color-mix(in srgb, var(--accent) 22%, var(--surface2));
  --cell-min-w: 44px; /* TimelineView + TracksPanel share this */
  --track-label-w: 130px;
  --danger: #f87171;
}
```

Replace all `color-mix(in srgb, var(--accent) ...` literals across all CSS files
with the appropriate token. Unify `CELL_MIN_W` — `TimelineView` says `44`,
`TracksPanel` says `48`; align to `44` and reference `--cell-min-w`.

**Files:** `src/index.css`, all animator CSS files

---

### 1b — Extract `FrameThumb` shared component (Rule 11)

Three identical canvas-render components exist under different names:

- `FrameThumb` in `FrameRow/FrameRow.jsx`
- `TimelineThumb` in `TimelineView.jsx`
- `FrameThumb` in `TracksPanel.jsx`

All accept `{ src, col, row, frameW, frameH, offsetX, offsetY, gutterX, gutterY }`
and render a `<canvas>` of fixed thumbnail size.

Extract to `src/features/animator/shared/FrameThumb.jsx`. Delete the three
inline copies.

**Files:** New `animator/shared/FrameThumb.jsx`, `FrameRow.jsx`, `TimelineView.jsx`, `TracksPanel.jsx`

---

### 1c — Extract `useDragReorder` hook (Rule 11)

Three identical drag-state + splice patterns exist in:

- `SequenceBuilder.jsx`
- `TimelineView.jsx` (inside `TimelineRow`)
- `TracksPanel.jsx` (inside `TrackRow`)

Extract to `src/hooks/useDragReorder.js`:

```js
// Returns { dragIdx, dropIdx, getDragProps(i), onDrop }
export function useDragReorder(items, onReorder) { ... }
```

**Files:** New `src/hooks/useDragReorder.js`, three consumers

---

### 1d — Add `compact` prop to `NumberInput` and `Select` (Rule 4 — UI contract)

Both components are overridden via parent-context CSS in at least 3 places each
(`SequenceBuilder`, `FrameRow`, `PreviewCanvas`). Add a `compact` prop that
applies a built-in size variant, then remove the external overrides.

```jsx
<NumberInput compact label="Ticks" ... />
<Select size="compact" ... />
```

**Files:** `src/ui/NumberInput/`, `src/ui/Select/`, `SequenceBuilder.css`, `FrameRow.css`, `PreviewCanvas.css`

---

### 1e — Fix accent color in SheetViewerCanvas canvas (Rule 18)

`SheetViewerCanvas.jsx` hardcodes `rgba(59, 130, 246, ...)` for hover/selection
highlight — Tailwind blue that duplicates `var(--accent)`. The grid-line color
already reads from `getComputedStyle`. Apply the same pattern to the accent:

```js
const accent = getComputedStyle(document.documentElement)
  .getPropertyValue("--accent")
  .trim();
```

**Files:** `src/features/animator/SheetViewerCanvas/SheetViewerCanvas.jsx`

---

### 1f — Route-level lazy loading (Rule 17)

Wrap every feature page in `React.lazy()` in `routes.jsx`:

```jsx
const AnimatorPage = lazy(() => import("../features/animator"));
const JellySpriteWorkspace = lazy(() => import("../features/jelly-sprite"));
const ProjectsPage = lazy(() => import("../features/projects"));
const SettingsPage = lazy(() => import("../features/settings"));
```

Wrap the `<Routes>` in `<Suspense fallback={<div className="page-loading" />}>`.
Add `index.js` barrels to each feature that doesn't have one.

**Files:** `src/router/routes.jsx`, feature `index.js` barrels

---

### 1g — Create `src/features/animator/selectors.js` (Rule 13)

Centralise computed selector functions that are currently duplicated inline
across all animator sub-components:

```js
export const selectActiveSheet = (state) =>
  state.sheets.find((s) => s.id === state.activeSheetId) ?? null;

export const selectActiveAnimation = (state) =>
  state.animations.find((a) => a.id === state.activeAnimationId) ?? null;

export const selectFrameCount = (state) =>
  selectActiveAnimation(state)?.frames.length ?? 0;
```

**Files:** New `src/features/animator/selectors.js`

---

### Sprint 1 commit order

```
1. CSS tokens + CELL_MIN_W unification
2. FrameThumb extraction
3. useDragReorder hook
4. NumberInput + Select compact prop
5. SheetViewerCanvas accent fix
6. Selectors file
7. Route lazy loading + index barrels
```

---

## ✅ Sprint 2 — Monolith Decomposition (COMPLETE `d8033f9`)

`AnimatorPage.jsx` trimmed from 814 lines → ~150 lines (layout only).  
`projectService.js` split into 6 focused modules. 222 modules, clean build.

### 2a — Extract `buildAnimatorBody` → `animatorSerializer.js`

Move the async serializing function out of `AnimatorPage.jsx` into its own
module. It's a pure async function with no React dependencies.

```
src/features/animator/animatorSerializer.js
```

**Files:** New `animatorSerializer.js`, `AnimatorPage.jsx` (import only)

---

### 2b — Extract `KeyboardHandler` → `useAnimatorKeyboard` hook

The ~95-line `KeyboardHandler` renderless component inside `AnimatorPage.jsx`
becomes a hook:

```js
// src/features/animator/hooks/useAnimatorKeyboard.js
export function useAnimatorKeyboard({ onClearFrames, onAutoFrame, ... }) { ... }
```

**Files:** New `hooks/useAnimatorKeyboard.js`, `AnimatorPage.jsx` (call hook instead)

---

### 2c — Extract `SheetList` → standalone component directory

`SheetList` is currently ~85 lines of JSX inline in `AnimatorPage.jsx`. Extract
to its own directory with its own CSS.

```
src/features/animator/SheetList/
  SheetList.jsx
  SheetList.css
  index.js
```

**Files:** New `SheetList/`, `AnimatorPage.jsx` (import only)

---

### 2d — Extract `SplitSaveButton` → standalone component

`SplitSaveButton` (~75 lines) is a reusable UI pattern (save button with
dropdown menu). Extract to `src/ui/SplitButton/` since it has no feature-specific
logic — it accepts `onSave`, `saving`, `saved`, `isDirty`, `menuItems` as props.

```
src/ui/SplitButton/
  SplitButton.jsx
  SplitButton.css
  index.js
```

**Files:** New `src/ui/SplitButton/`, `AnimatorPage.jsx` (import only)

---

### 2e — Extract `EditableTitle` → `src/ui/EditableTitle/`

`EditableTitle` (~40 lines inline) is used in both `AnimatorPage` and
`JellySpriteWorkspace`. Belongs in `src/ui/`.

**Files:** New `src/ui/EditableTitle/`, both workspaces (import only)

---

### 2f — Split `projectService.js` into focused modules

`projectService.js` (~460 lines) mixes 4 concerns. Split into:

```
src/services/
  idb.js              Raw IDB wrapper (openDB, idbGet, idbPut, idbDelete)
  supabaseApi.js      Raw Supabase calls
  sprites.js          Sprite CRUD, dual-backend routing, index management
  projects.js         Project CRUD, dual-backend routing
  serialization.js    serialiseSprite/Project, downloadSprite, legacy shims
```

`projectService.js` becomes a re-export barrel for backwards compatibility
during the transition.

**Files:** 5 new service files, `projectService.js` (re-export only)

---

### Sprint 2 commit order

```
1. Extract animatorSerializer.js
2. Extract useAnimatorKeyboard hook
3. Extract SheetList component
4. Extract SplitButton to src/ui/
5. Extract EditableTitle to src/ui/
6. Split projectService.js (idb + supabaseApi first, then sprites + projects)
```

---

## ✅ Sprint 3 — Feature Contract Enforcement (COMPLETE `86e3b26`)

**Goal:** Make the Rules machine-enforceable. Add ESLint rules. Promote shared
engine utilities. Begin moving toward the unified document model.

### 3a — Add feature isolation ESLint rule (Rule 11)

Install `eslint-plugin-import` and configure:

```js
// eslint.config.js
"import/no-restricted-paths": ["error", {
  zones: [
    { target: "./src/features/animator/**", from: "./src/features/jelly-sprite/**" },
    { target: "./src/features/jelly-sprite/**", from: "./src/features/animator/**" },
    { target: "./src/engine/**", from: "./src/features/**" },
    { target: "./src/services/**", from: "./src/features/**" },
    { target: "./src/ui/**", from: "./src/features/**" },
  ]
}]
```

---

### 3b — Promote shared engine utilities (Rule 14)

Create `src/engine/frameUtils.js` with the grid math functions that are
currently either duplicated or buried in `jelly-sprite/engine/`:

```js
// src/engine/frameUtils.js
export function cellToPixel(col, row, frameConfig) { ... }
export function pixelToCell(x, y, frameConfig) { ... }
export function frameCount(sheetW, sheetH, frameConfig) { ... }
export function frameRect(col, row, frameConfig) { ... }
```

---

### 3c — Add `tools` metadata field to sprite records (Challenged Assumption 4)

```json
{ "tools": { "animator": true, "jelly": false } }
```

Set on save. Use in `ProjectsPage` to enable/disable "Open in Animator" and
"Edit in JellySprite" buttons instead of doing runtime null-checks on data blobs.

**Files:** `projectService.js`, `ProjectsPage.jsx`

---

### 3d — Supabase auto-project assignment (Challenged Assumption 3)

When Supabase is enabled and `projectId` is null, `saveSprite` currently silently
writes to IDB. This is silent data routing to the wrong backend — the user sees
"Saved ✓" but the data never reaches the cloud.

Fix: auto-assign to an "Uncategorized" project when no `projectId` is provided.
Create the project if it doesn't exist. Show a one-time toast explaining where
the save went.

**Files:** `projectService.js` (sprites.js after Sprint 2 split)

---

### Sprint 3 commit order

```
1. ESLint import/no-restricted-paths config
2. src/engine/frameUtils.js
3. tools metadata field on sprite records
4. Supabase auto-project assignment
```

---

## Challenged design assumptions (reference)

These are open design decisions that were examined during Sprint 0 and will be
acted on in future sprints.

### "All imports/exports from Projects only"

**Decision:** Keep export in Projects only (delivery action). Restore
"load a PNG into the current session" in the Animator as a session-local
action — separate from creating/persisting a sprite. These are different jobs.

### "One `ProjectContext` shared across all editors"

**Decision:** Fix in Sprint 4. Split into `ActiveSpriteContext` (identity) +
`AnimatorContext` (animator state + undo/redo). `useProject()` shim preserved.

---

## ✅ Sprint 4 — Context Decomposition (`ac647ed`)

**Goal:** Eliminate the god-context. Every re-render triggered by an animation
timeline update currently propagates to AppShell, ProjectsPage, and the JellySprite
editor. The split also makes the Aseprite-style unified document model possible
in Sprint 5 — each context becomes a clean seam on the document.

---

### Problem: The current monolith

`ProjectContext` holds two completely unrelated concerns:

**Identity / navigation** — used by AppShell, ProjectsPage, JellySpriteWorkspace:

```
id, name, projectId, spriteId
```

**Animator editor state** — used by the 9 animator components and ExportPanel:

```
sheets, activeSheetId, frameConfig, animations, activeAnimationId
+ undo/redo history, canUndo, canRedo, isDirty
```

**JellySprite editor state** — used by JellySprite, JellySpriteWorkspace:

```
jellySpriteState, jellySpriteDataUrl
```

Every animation frame push (`UPDATE_ANIMATION`) triggers a render in AppShell
and both JellySprite components even though they read none of those fields.

---

### The split

```
ProjectContext (keep, slim down)
  → id, name, projectId, spriteId
  → jellySpriteState, jellySpriteDataUrl
  → LOAD_PROJECT, RESET_PROJECT, SET_PROJECT_NAME, SET_SPRITE_ID,
    SET_JELLY_SPRITE_DATA
  → useProject()   ← backward-compat shim; still exports { state, dispatch }

AnimatorContext (new)
  → sheets, activeSheetId, frameConfig
  → animations, activeAnimationId
  → undo/redo/canUndo/canRedo/isDirty/markSaved
  → useAnimator()
```

`AnimatorContext` reads identity (`id`, `name`) from `ProjectContext` so it can
build save payloads without prop-drilling.

**Key constraint:** `useProject()` must keep working unchanged for all current
callers during the migration. After Sprint 4 all animator consumers are migrated
to `useAnimator()` and the fields are removed from `ProjectContext`.

---

### 4a — Create `AnimatorContext` with its own reducer

**File:** `src/contexts/AnimatorContext.jsx`

State:

```js
{
  sheets: [],
  activeSheetId: null,
  frameConfig: { frameW:32, frameH:32, scale:2, offsetX:0, offsetY:0, gutterX:0, gutterY:0 },
  animations: [],
  activeAnimationId: null,
}
```

Actions to migrate from `ProjectContext`:

- `SET_SPRITE_SHEET`, `ADD_SHEET`, `REMOVE_SHEET`, `SET_ACTIVE_SHEET`,
  `RESTORE_SHEET_URLS`, `SET_FRAME_CONFIG`
- `ADD_ANIMATION`, `DELETE_ANIMATION`, `RENAME_ANIMATION`, `DUPLICATE_ANIMATION`,
  `SET_ACTIVE_ANIMATION`, `UPDATE_ANIMATION`

Undo/redo history lives here (same logic, just moved).

`LOAD_PROJECT` is handled in **both** contexts: `ProjectContext` gets identity
fields; `AnimatorContext` gets sheets + animations.

Export hook: `useAnimator()` — throws if used outside `AnimatorProvider`.

---

### 4b — Slim down `ProjectContext`

Remove from `ProjectContext`'s reducer and `initialState`:

- `sheets`, `activeSheetId`, `spriteSheet` (already dead — Rule 3)
- `frameConfig`, `animations`, `activeAnimationId`
- `animatorState` (legacy hydration field, no longer needed post-load)
- All animator action cases

Keep:

- `id`, `name`, `projectId`, `spriteId`
- `jellySpriteState`, `jellySpriteDataUrl`
- `LOAD_PROJECT` (identity + jelly fields only)
- `RESET_PROJECT`, `SET_PROJECT_NAME`, `SET_SPRITE_ID`, `SET_JELLY_SPRITE_DATA`

`localStorage` persistence key `dj-project` changes to persist only the slim
identity slice. The animator state is **session-only in memory** (it is fully
reconstructed from IDB on load via `LOAD_PROJECT`).

---

### 4c — Migrate all animator consumers to `useAnimator()`

Replace `useProject()` with `useAnimator()` in:

- `AnimationSidebar`, `AnimatorPage`, `FrameConfigPanel`, `PreviewCanvas`,
  `SequenceBuilder`, `SheetList`, `SheetViewerCanvas`, `SpriteImporter`,
  `TimelineView`, `TracksPanel`, `useAnimatorKeyboard`
- `ExportPanel` (reads only animator fields)

`ProjectsPage` stays on `useProject()` — it only needs `state.id`.

---

### 4d — Wire `AnimatorProvider` into the tree

Mount order in `App.jsx` (or wherever providers are composed):

```jsx
<ProjectProvider>
  {" "}
  ← identity + jelly state
  <AnimatorProvider>
    {" "}
    ← animator state (can read ProjectContext for id/name)
    <PlaybackProvider>{children}</PlaybackProvider>
  </AnimatorProvider>
</ProjectProvider>
```

`AnimatorProvider`'s `LOAD_PROJECT` dispatch is triggered by `AnimatorPage`'s
load effect — same as today, just a different context.

---

### Sprint 4 commit order

```
1. AnimatorContext.jsx + useAnimator() hook
2. Slim ProjectContext (remove animator fields)
3. Migrate animator consumers (4c)
4. Wire AnimatorProvider into App.jsx
5. Verify: npm run build + manual smoke test
```

---

**Decision:** Fix in Sprint 3d. Silent data routing to the wrong backend is a
data integrity hole.

### "Sprites don't declare which tools have data"

**Decision:** Fix in Sprint 3c via `tools` metadata field.

---

## Architecture quick-reference

See `ARCHITECTURE.md` for the full specification.

**18 Rules (summary):**

| #   | Rule                                                                        |
| --- | --------------------------------------------------------------------------- |
| 1   | URL = identity. `/tool/:spriteId` always. No ID-less editor routes.         |
| 2   | `dataUrl` canonical. `objectUrl` is a rebuild cache, never persisted.       |
| 3   | No `state.spriteSheet`. Use `selectActiveSheet(state)` from `selectors.js`. |
| 4   | `await handleSave()` before any navigation.                                 |
| 5   | One canonical `animatorBody` format. No legacy fields in new saves.         |
| 6   | Strip all binary data from localStorage. IDB holds binary.                  |
| 7   | First-save always updates URL with `navigate(url, {replace:true})`.         |
| 8   | `ProtectedRoute` always renders something. Never `null`.                    |
| 9   | IDB is truth. localStorage index writes are non-throwing.                   |
| 10  | `navigate('/tool')` without spriteId is banned.                             |
| 11  | Features never import from other features.                                  |
| 12  | Every feature exports through `index.js` only.                              |
| 13  | Derived values used by 2+ components live in `selectors.js`.                |
| 14  | `src/engine/` functions are pure — no React, no DOM.                        |
| 15  | `src/services/` are I/O only — no hooks, no JSX.                            |
| 16  | Undoable operations batch via transactions (one dispatch = one undo step).  |
| 17  | Route-level lazy loading for all feature pages.                             |
| 18  | CSS design tokens for all repeated values. No hardcoded color literals.     |

---

## Code locations quick-reference

```
src/
  engine/                        Layer 0 — pure functions (Sprint 3b)
  services/                      Layer 1 — I/O (Sprint 2f splits this)
  contexts/
    ProjectContext.jsx            State management (reducer split Sprint 2+)
    PlaybackContext.jsx
  hooks/
    useDragReorder.js             NEW in Sprint 1c
    useScrollIntoView.js          NEW in Sprint 1c (optional)
  ui/                            Layer 4 — generic components
    NumberInput/                  compact prop in Sprint 1d
    Select/                       size prop in Sprint 1d
    SplitButton/                  NEW in Sprint 2d
    EditableTitle/                NEW in Sprint 2e
  features/
    animator/
      index.js                    Barrel (Sprint 1f)
      selectors.js                NEW in Sprint 1g
      animatorSerializer.js       NEW in Sprint 2a
      shared/
        FrameThumb.jsx            NEW in Sprint 1b
      hooks/
        useAnimatorKeyboard.js    NEW in Sprint 2b
      SheetList/                  Extracted in Sprint 2c
      AnimatorPage/               Shrinks to ~150 lines by Sprint 2
      ... (all other panels)
    jelly-sprite/
      index.js                    Barrel (Sprint 1f)
    projects/
      index.js                    Barrel (Sprint 1f)
  router/
    routes.jsx                    Lazy loading in Sprint 1f
    ProtectedRoute.jsx            ✅ Done (Rule 8)
```

---

## ✅ Sprint 5 — State Finalization (`625e694`)

**Goal:** Complete Rule 3 enforcement. `state.spriteSheet` is a redundant mirror
of the active sheet that was kept during the Sprint 4 migration as a shim. Every
component that needs the active sheet should call `selectActiveSheet(state)` from
`selectors.js`. This sprint removes the extra field and all the bookkeeping code
that kept it in sync.

**Why now:** Sprint 4 established `AnimatorContext` as the clean owner of
animator state. Before Sprint 6 layers on top, the reducer must be free of
derived state mutations. A reducer that computes `spriteSheet` in 5+ case
branches is deriving state eagerly — that belongs in a selector.

---

### Problem

```js
// AnimatorContext initialState (current)
export const initialAnimatorState = {
  sheets: [],
  activeSheetId: null,
  spriteSheet: null,   // ← @deprecated shim; = selectActiveSheet(state) fields
  frameConfig: { ... },
  animations: [],
  activeAnimationId: null,
};
```

Every sheet mutation case (`SET_SPRITE_SHEET`, `ADD_SHEET`, `REMOVE_SHEET`,
`SET_ACTIVE_SHEET`, `RESTORE_SHEET_URLS`, `LOAD_PROJECT`) manually recomputes
and stores `spriteSheet`. Two consumers (`SpriteImporter`, `TimelineView`)
destructure it directly from state.

---

### 5a — Remove `spriteSheet` from `AnimatorContext`

**File:** `src/contexts/AnimatorContext.jsx`

1. Remove `spriteSheet: null` from `initialAnimatorState`.
2. In each reducer case, delete the `spriteSheet:` field from the returned
   object: `LOAD_PROJECT`, `SET_SPRITE_SHEET`, `ADD_SHEET`, `REMOVE_SHEET`,
   `SET_ACTIVE_SHEET`, `RESTORE_SHEET_URLS`.
3. Keep the `SET_SPRITE_SHEET` action — it still correctly updates `sheets[]`.

---

### 5b — Update consumers to use `selectActiveSheet`

**File:** `src/features/animator/SpriteImporter/SpriteImporter.jsx`

```js
// Before
const { sheets, activeSheetId, spriteSheet, frameConfig } = state;
// ...
if (spriteSheet?.objectUrl) URL.revokeObjectURL(spriteSheet.objectUrl);
// dep array: [dispatch, spriteSheet]

// After
import { selectActiveSheet } from "../selectors";
// ...
const { sheets, activeSheetId, frameConfig } = state;
const activeSheet = selectActiveSheet(state);
// ...
if (activeSheet?.objectUrl) URL.revokeObjectURL(activeSheet.objectUrl);
// dep array: [dispatch, activeSheet]
```

**File:** `src/features/animator/TimelineView/TimelineView.jsx`

```js
// Before
const { animations, activeAnimationId, spriteSheet, frameConfig } = state;
const src = spriteSheet?.objectUrl ?? null;

// After
import { selectActiveSheet } from "../selectors";
// ...
const { animations, activeAnimationId, frameConfig } = state;
const src = selectActiveSheet(state)?.objectUrl ?? null;
```

---

### Sprint 5 commit order

```
1. AnimatorContext: remove spriteSheet from initialState + all reducer cases
2. SpriteImporter + TimelineView: use selectActiveSheet
3. Verify: npm run build
4. Commit: "refactor: Sprint 5 — remove spriteSheet derived state (Rule 3)"
```

---

## � Sprint 6 — Unified Document Model (6a complete)

**Goal:** JellySprite and Animator stop being two separate editors that
hand a save blob back and forth. Instead they become two live **views** of a
single shared document. This is the Aseprite model: one `Sprite` object holds
`frames[]`, `layers[]`, `cels[]`, and `tags[]`. The JellySprite panel renders
it; the Animator panel sequences it. No save-and-reload handoff needed.

**Prerequisite:** Sprint 5 complete (clean reducer).

---

### Motivation

The current handoff:

```
JellySpriteWorkspace
  → collectSaveData()
  → serialiseProject() → { spriteSheet: <blob> }
  → saveProjectToStorage()
  → navigate('/animator/:id')
  → AnimatorPage loads → LOAD_PROJECT → sheets[] restored
```

This means every "Edit in JellySprite" round-trip goes through IDB. Pixel changes
in JellySprite are _invisible_ to the Animator until the user saves. There is no
live connection.

### The unified model

```js
// One shared document in a new DocumentContext (or merged AnimatorContext)
{
  id: string,
  name: string,
  // ---------- pixel data ----------
  layers: [{ id, name, visible, cells: [{ frameIndex, pixels }] }],
  // ---------- frames ----------
  frames: [{ id, duration }],          // ordered
  // ---------- sequences / tags ----------
  tags: [{ id, name, from, to, loop }], // named frame ranges
  // ---------- canvas config ----------
  canvasWidth: number,
  canvasHeight: number,
}
```

`JellySprite` renders: `layers + frames + cells` → pixel canvas
`Animator` renders: `tags + frames + sheets[]` → timeline + preview

Both read from the same context. Mutations in either update the same state.
No serialisation across an IDB fence to switch views.

---

### Migration path (incremental — no big bang)

**6a — Add `DocumentContext`**

- Single document reducer owning the unified shape above.
- `JellySpriteContext` and `AnimatorContext` become thin facades that select
  their slice via `useDocument()`.

**6b — JellySprite reads document**

- Replace the internal `JellySpriteProvider` pixel state with slices of
  `DocumentContext`.
- `collectSaveData()` becomes `exportDocument()` — serialises the live context.

**6c — Animator reads document**

- `AnimatorContext` reads `tags` (→ `animations`) and `frames` directly from
  `DocumentContext`.
- The `LOAD_PROJECT` dual-dispatch shrinks to a single `LOAD_DOCUMENT`.

**6d — Unify save/load**

- One `saveDocument()` / `loadDocument()` service that serialises
  `DocumentContext` state to IDB.
- Navigate-to-animator no longer needs a save: both views are always live.

**6e — Remove handoff artifacts**

- Delete `serialiseProject()`, `animatorBody`, `jellySpriteState` blob, the
  "Edit in JellySprite" save-before-navigate guard.

---

### Sprint 6 status and revised scope

**6a — DocumentContext created** `a338424` ✅  
`src/contexts/DocumentContext.jsx` — unified document shape with `frames[]`,
`layers[]`, `tags[]`, `canvasW/H`, and JellySprite blobs. `ProjectContext` is
a 2-line re-export shim (must be resolved in 6b per shim governance rule).

**Design assumption challenged and kept:** The original Sprint 6 plan called
for JellySprite to be migrated _onto_ DocumentContext's state (replacing its
internal `JellySpriteProvider`). After reading the JellySprite internals, this
was challenged: JellySprite's `refs.frameSnapshots` is the true pixel document,
living outside React entirely. Migrating it onto DocumentContext would mean
storing pixel buffers in React state — a catastrophic performance regression.

**Revised Sprint 6 scope (metadata sync, not pixel migration):**

- **6b** — JellySprite pushes metadata to DocumentContext (`frames[]`, `layers[]`,
  `canvasW/H`) using `useEffect` on state changes. Pixel data stays in `refs`.
  `ProjectContext` shim resolved.
- **6c** — Animator pushes its `animations[]` to DocumentContext as `tags[]`
  when animations change. `LOAD_PROJECT` dual-dispatch cleaned up.
- **6d** — Create `src/services/documentService.js` with `saveDocument()` /
  `loadDocument()`. Both workspaces route through it. Remove the separate
  `animatorBody` / `jellyBody` split save paths.
- **6e** — Remove handoff artifacts: `serialiseProject()`, the
  `SET_JELLY_SPRITE_DATA` data-URL paste on "Edit in JellySprite", and the
  `onRegisterCollector` callback from `JellySprite.jsx`.

**The full pixel unification** (JellySprite `refs` → DocumentContext) is
blocked by the JellySprite architecture issues documented in Sprint 7. Sprint
6b-6e unify the _metadata layer_; Sprint 7 unifies the _data layer_.

### Sprint 6 commit order

```
1. 6b — JellySprite → DocumentContext metadata sync; ProjectContext shim resolved
2. 6c — Animator → DocumentContext tags sync
3. 6d — documentService.js unified save/load
4. 6e — Remove handoff artifacts
5. Verify: npm run build + smoke test
6. Commit: "feat: Sprint 6 — unified document model (metadata layer)"
```

---

## 🔲 Sprint 7 — JellySprite PixelDocument Refactor

### Framework and architecture assessment

Before Sprint 7 is implemented, the following question was formally evaluated:
**Is React + Vite the right foundation for an app of this type and scale?**

#### What this app is

DoomJelly Studio is a **pixel art editor** with animation sequencing. Its two
core operations — real-time pixel painting and frame playback — are both
completely incompatible with React's update model. A paint stroke at 60fps
touches 50–500 pixels per event. A react state update per pixel would destroy
performance. This is why JellySprite already bypasses React entirely for all
pixel operations using a raw `refs` object.

The Animator's playback is already abstracted into `PlaybackContext` which
uses `setInterval`, not state updates, for frame advancement.

**The diagnosis:** React was chosen correctly as the UI shell. The problem is
that JellySprite mixed the pixel engine _into_ the React component tree. React
is not doing the drawing — it was never supposed to. The architecture needs to
make that separation explicit, not fight it.

#### Is Vite the right bundler?

Yes, unconditionally. Vite's HMR, ESM-first dev server, and Rollup production
build are the best available for a React SPA of this scale. No reason to change.

#### Is online-only (browser + Supabase) the right delivery model?

Out of scope: the user acknowledged "besides the fact it's online only." This
is a product decision, not an architecture one. Noted: if offline/desktop is
ever needed, Tauri (Rust shell + existing Vite frontend) adds a native layer
without rebuilding the app. Electron is the heavier alternative.

#### Is React 19 the right UI framework?

Yes, with one caveat. React 19 is correct for this UI shell. The mistake is
not React — it's storing mutable performance-critical state (pixel buffers,
history stacks, canvas refs, engine functions) _in the component tree_.

The correct model:

- **React** owns: navigation, panels, toolbars, dialogs, notifications, auth
- **Non-React class** owns: pixel buffers, history, frame snapshots, serialization
- **React refs** own: canvas DOM elements (read-only bridge)

This is exactly the pattern Excalidraw and Figma's web renderer use. They have
a non-React "Scene" object that owns all document data. React renders UI around
it but never holds the data.

#### Should we rebuild from scratch?

No. The foundation is correct. The `services/`, `contexts/`, `engine/` layering
is already well-structured. The bug classes from Sprints 0-5 are eliminated.
The remaining problem is contained to one feature: JellySprite's internal
state model. That is Sprint 7's job — extract the pixel engine from the
component tree into a standalone `PixelDocument` class.

#### Verdict: continue on React 19 + Vite, fix the pixel engine architecture

No framework migration needed. Sprint 8 (TypeScript) and Sprint 9 (Zustand)
are architectural improvements to the existing stack, not replacements.

---

### Sprint 7 goal

Extract JellySprite's pixel engine out of the React component tree into a
standalong `PixelDocument` class. This resolves every architectural problem
identified in the pre-sprint 7 assessment:

| Problem                                   | Root cause                              | Fix                                  |
| ----------------------------------------- | --------------------------------------- | ------------------------------------ |
| `JellySprite.jsx` = 1,535 lines           | Business logic in a view component      | Move to `PixelDocument`              |
| `refs.redraw` is a dead stub at mount     | Provider depends on consumer            | `PixelDocument` owns redraw          |
| Serialization needs both `refs` and `ss`  | Two parallel state systems              | `PixelDocument.serialize()`          |
| `canUndo`/`canRedo` split between systems | History stack in refs, flags in reducer | `PixelDocument` owns all history     |
| 40-field flat initial state               | Six concerns in one object              | Three owners (see below)             |
| `onRegisterCollector` callback            | State unreachable from outside          | `PixelDocument` is directly readable |

### The three-owner model

```
PixelDocument (plain JS class — no React)
  → frames[], layers[], pixelBuffers, maskBuffers
  → frameSnapshots (per-frame pixel + layer state)
  → historyStack, historyIndex
  → undo(), redo(), canUndo, canRedo
  → addFrame(), removeFrame(), switchFrame()
  → addLayer(), removeLayer(), reorderLayers()
  → serialize() → { version, frames, layers, pixelData }
  → static deserialize(data) → PixelDocument

ToolContext (thin React context)
  → tool, brushType, brushSize, brushOpacity, brushHardness
  → fgColor, bgColor, fgAlpha, colorHistory, relatedColors
  → palettes, activePalette
  → symmetryH, symmetryV, fillShapes
  → gridVisible, zoom, panelTab
  → Persisted to localStorage independently

CanvasController (thin React component)
  → Holds canvas DOM refs
  → Receives pointer events → calls PixelDocument methods
  → Listens for PixelDocument.onChange → triggers redraw or React state update
  → Connects PixelDocument to DocumentContext (pushes frames[]/layers[] on change)
```

`JellySprite.jsx` becomes a layout component (~100 lines) that wires
`ToolContext`, `CanvasController`, and panel components together.

### 7a — Create `PixelDocument` class

**File:** `src/features/jelly-sprite/engine/PixelDocument.js`

Pure JS class. No imports from React. Testable in Node.

```js
export class PixelDocument {
  constructor({ canvasW, canvasH, frames, layers }) { ... }

  // Frame operations
  addFrame(name) { ... }
  removeFrame(frameId) { ... }
  switchFrame(frameIdx) { ... }    // saves current, loads target

  // Layer operations
  addLayer(name) { ... }
  removeLayer(layerId) { ... }
  reorderLayers(layerIds) { ... }

  // History
  pushHistory() { ... }            // snapshot current buffers
  undo() { ... }                   // restore + fire onChange
  redo() { ... }
  get canUndo() { ... }
  get canRedo() { ... }

  // Serialization
  serialize() { ... }              // → { version, frames, layers, pixelData }
  static deserialize(data) { ... } // → PixelDocument

  // Observer
  onChange(handler) { ... }        // called when frames/layers/pixels mutate
}
```

### 7b — Create `ToolContext`

**File:** `src/features/jelly-sprite/store/ToolContext.jsx`

Contains only: tool settings, brush settings, colors, palettes, UI toggles.
Removes those fields from `jellySpriteInitialState` and `jellySpriteReducer`.
Persists to `localStorage` under key `dj-tool-state`.

### 7c — Migrate JellySprite to use `PixelDocument`

Replace all direct `refs.pixelBuffers`, `refs.frameSnapshots`, `refs.historyStack`
usages in `JellySprite.jsx` and `drawingEngine.js` with `PixelDocument` method
calls. Remove the `refs` object from `JellySpriteProvider`.

`JellySpriteProvider` reduces to just providing `ToolContext` — the pixel
document is held in a `useRef` in `JellySprite.jsx` as a stable instance.

### 7d — Connect `PixelDocument` to `DocumentContext`

On every `PixelDocument.onChange` event, push updated `frames[]`, `layers[]`,
and `canvasW/H` into `DocumentContext` via dispatch. This replaces the
`useEffect`-based sync installed in Sprint 6b.

### 7e — Remove `JellySpriteProvider.refs` and `jellySpriteReducer` pixel cases

Delete: all pixel buffer cases from the reducer, the `refs` plain object,
the `onRegisterCollector` prop, the `stateRef` mirror, and all function stubs.

### Sprint 7 commit order

```
1. PixelDocument class (no consumers yet)
2. ToolContext (carved out of jellySpriteReducer)
3. JellySprite.jsx + drawingEngine.js migrated to PixelDocument
4. JellySpriteProvider cleaned up (refs removed)
5. PixelDocument → DocumentContext sync (replaces Sprint 6b useEffect)
6. Verify: npm run build + full smoke test
7. Commit: "refactor: Sprint 7 — PixelDocument extraction"
```

**Challenged assumptions for Sprint 7:**

- Is `PixelDocument` the right abstraction, or should it be a Zustand store?
  — Answer: plain class first; Zustand (Sprint 9) can wrap it if needed. A class
  has zero dependencies and is testable without a test runner that supports hooks.
- Should `drawingEngine.js` be methods on `PixelDocument` or remain separate?
  — Keep separate: `drawingEngine` is a pure pixel-op library; `PixelDocument`
  calls it. Single-responsibility preserved.

---

## 🔲 Sprint 8 — TypeScript Migration

### Why TypeScript, and why now

After Sprint 7, the codebase has three clean seams:

- `PixelDocument` — a plain JS class with a well-defined API
- `ToolContext` — a React context with a flat, enumerable state object
- `DocumentContext` — a reducer context with a schema-stable state shape

These seams are the ideal TypeScript starting points. The split-state bugs that
have plagued this project (the `refs` / reducer split, the `spriteSheet` mirror,
the `jellySpriteState` blob) all would have been caught immediately by the
TypeScript compiler if types existed.

**The cost of not having TypeScript now:**

- No autocomplete on `DocumentContext` state fields — typos silently return `undefined`
- `refs` is typed as `any` (it's a plain object) — type-unsafe mutations everywhere
- `buildAnimatorBody`, `serialiseSprite`, `serializeJellySprite` all accept
  untyped objects — schema drift is invisible until runtime

### 8a — Vite TypeScript config

Add `tsconfig.json` and `tsconfig.node.json`. Update `vite.config.js` → `vite.config.ts`.
Rename `src/main.jsx` → `src/main.tsx`. Enable `strict: true` from day one.

### 8b — Type the service layer first

The services are pure I/O with clear data contracts. Type them first:

```ts
// src/services/types.ts
export interface SpriteRecord { id: string; name: string; ... }
export interface AnimatorBody { sheets: SheetRecord[]; animations: AnimationRecord[]; ... }
export interface JellyBody { version: number; frames: FrameRecord[]; ... }
```

### 8c — Type `DocumentContext`, `AnimatorContext`, `ToolContext`

Give each context a typed state interface and typed dispatch union.

### 8d — Type `PixelDocument`

`PixelDocument.ts` — the class already has a clean API; typing it is mostly
adding return types and property types.

### 8e — Type the UI components

Component props interfaces. Start with shared `ui/` components — they have the
stablest prop contracts.

### Sprint 8 commit order

```
1. tsconfig + Vite config
2. Service layer types
3. Context types (Document, Animator, Tool)
4. PixelDocument types
5. UI component prop types
6. Verify: tsc --noEmit passes
7. Commit: "chore: Sprint 8 — TypeScript migration"
```

---

## 🔲 Sprint 9 — Zustand State Management

### Why Zustand, and why after TypeScript

The React Context + useReducer pattern was the right choice for this project
through Sprint 7. It required no dependencies and matched the project's scale.
By Sprint 7 the state is decomposed into three clean contexts
(`DocumentContext`, `AnimatorContext`, `ToolContext`) and a non-React
`PixelDocument` class.

The remaining React Context pain points:

- Every dispatch triggers a render in all consumers, even when the specific
  field they read didn't change (React Context has no selector support)
- `AnimatorContext`'s undo/redo clones the entire state on every history entry —
  fine for shallow objects, expensive for deeply nested animation arrays
- Testing context-connected components requires wrapping them in providers

Zustand solves all three:

- Selector-based subscriptions — `const tool = useToolStore(s => s.tool)` only
  re-renders when `tool` changes
- Sliced stores can share state without provider nesting
- Stores are importable directly in tests without a provider wrapper

**Note:** Zustand does NOT replace `PixelDocument`. `PixelDocument` stays as
a plain class. Zustand wraps it — the store holds a `PixelDocument` instance
and exposes its operations as store actions.

### 9a — Replace `ToolContext` with `useToolStore`

Smallest first. `ToolContext` is purely serializable data with no side effects.

```js
export const useToolStore = create(persist(
  (set) => ({ tool: 'pencil', brushSize: 1, fgColor: '#000000', ... }),
  { name: 'dj-tool-state' }
));
```

### 9b — Replace `AnimatorContext` with `useAnimatorStore`

```js
export const useAnimatorStore = create((set, get) => ({
  sheets: [], activeSheetId: null, animations: [], ...
  dispatch: (action) => set(animatorReducer(get(), action)),
  undo: () => { ... },
  redo: () => { ... },
}));
```

### 9c — Wrap `PixelDocument` in `usePixelDocumentStore`

```js
export const usePixelDocumentStore = create((set, get) => ({
  doc: null,          // PixelDocument instance
  frames: [],         // mirror for React — updated by doc.onChange
  layers: [],
  canUndo: false,
  canRedo: false,
  init: (data) => { ... },
  undo: () => get().doc?.undo(),
  redo: () => get().doc?.redo(),
}));
```

### 9d — Replace `DocumentContext` with `useDocumentStore`

Identity fields (`id`, `name`, `projectId`, `spriteId`) become a Zustand slice.
Remove the `DocumentProvider` from `App.jsx`.

### Sprint 9 commit order

```
1. Install zustand
2. useToolStore (replace ToolContext)
3. useAnimatorStore (replace AnimatorContext + useAnimator hook)
4. usePixelDocumentStore (wrap PixelDocument)
5. useDocumentStore (replace DocumentContext)
6. Remove all Provider wrappers from App.jsx
7. Verify: npm run build + full smoke test
8. Commit: "refactor: Sprint 9 — Zustand state management"
```
