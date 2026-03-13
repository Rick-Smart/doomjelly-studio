# DoomJelly Studio — Sprint Tracker

**Branch:** `feature/jelly-sprite-improvements`  
**Architecture reference:** `ARCHITECTURE.md` — read this first before starting any sprint.  
**Last updated:** March 12, 2026

---

## Sprint status

| Sprint   | Name                         | Status                  |
| -------- | ---------------------------- | ----------------------- |
| Sprint 0 | Data Stability               | ✅ Complete (`92997f7`) |
| Sprint 1 | Foundation Cleanup           | ✅ Complete (`b5fda67`) |
| Sprint 2 | Monolith Decomposition       | 🔲 Ready to start       |
| Sprint 3 | Feature Contract Enforcement | 🔲 Blocked on Sprint 2  |

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

## 🔲 Sprint 2 — Monolith Decomposition (~860 lines, 17 imports) into focused,

independently-editable components. Target: `AnimatorPage.jsx` becomes layout
only — ~150 lines.

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

## 🔲 Sprint 3 — Feature Contract Enforcement

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

**Decision:** Defer full split to Sprint 4+. Rules 1–10 make the single-context
model safe through URL identity. Long term: `AnimatorContext` + `JellySpriteContext`

- thin `ActiveSpriteContext({ id, name, projectId })` as shared navigation identity.

### "Supabase fallback to IDB is transparent"

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
