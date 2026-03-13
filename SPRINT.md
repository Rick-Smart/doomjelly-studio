# DoomJelly Studio — Sprint Tracker

**Branch:** `feature/jelly-sprite-improvements`  
**Architecture reference:** `ARCHITECTURE.md` — read this first before starting any sprint.  
**Last updated:** March 13, 2026

---

## Sprint status

| Sprint    | Name                               | Status                  |
| --------- | ---------------------------------- | ----------------------- |
| Sprint 0  | Data Stability                     | ✅ Complete (`92997f7`) |
| Sprint 1  | Foundation Cleanup                 | ✅ Complete (`b5fda67`) |
| Sprint 2  | Monolith Decomposition             | ✅ Complete (`d8033f9`) |
| Sprint 3  | Feature Contract Enforcement       | ✅ Complete (`86e3b26`) |
| Sprint 4  | Context Decomposition              | ✅ Complete (`ac647ed`) |
| Sprint 5  | State Finalization                 | ✅ Complete (`625e694`) |
| Sprint 6  | Unified Document Model             | ✅ Complete (`5be735c`) |
| Sprint 7  | JellySprite PixelDocument Refactor | ✅ Complete (`15ee57a`) |
| Sprint 8a | Rule Violation Fixes               | ✅ Complete (`dc32ace`) |
| Sprint 8  | TypeScript Migration               | ✅ Complete (`d302053`) |
| Sprint 9  | Zustand State Management           | ✅ Complete (`388f043`) |
| Sprint 10 | Store Consumer Migration           | ✅ Complete (`8ed4bd7`) |
| Sprint 11 | PixelDocument Store + 7e Cleanup   | 🔄 In progress          |
| Sprint 12 | Service Layer Cleanup              | 🔲 Not started          |

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

### On sprint documentation

This process must be followed at the **start and end of every sprint**:

**Before starting a sprint:**

1. Mark the sprint `🔄 In progress` in the status table above
2. Update `**Last updated:**` in the file header
3. Formally challenge the design assumptions the sprint rests on (see _On refactors_ above) — record the outcome in the sprint section
4. Confirm all enforcement checks from the previous sprint are satisfied before proceeding

**When closing a sprint:**

1. Mark the sprint `✅ Complete (\`commit-hash\`)` in the status table
2. Record the commit hash in the sprint section header
3. Update `**Last updated:**` in the file header
4. Run the Rule 19 completeness checklist for every file touched (build gate + smoke test)
5. Run each rule's enforcement `grep` for every rule whose scope was touched
6. Log any deferred items as named line items in the next sprint section

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

See `ARCHITECTURE.md` for the full specification. This section is the **single
source of truth** for rule compliance — full descriptions, current status, and
known violations are tracked here so every session starts with accurate context.

**Status key:** ✅ Compliant · ⚠️ Partial · ❌ Violated

---

### Rule 1 — URL = identity

Every editor URL must carry a `spriteId`. A route without one must never load
an editor. Sharing or refreshing the URL must always work.

```
/animator/:spriteId      ✅
/jelly-sprite/:spriteId  ✅
/animator                ❌  (banned as a destination)
```

**Status:** ✅ Compliant  
**Introduced:** Sprint 0 (`908ba2d`) — `routes.jsx`, `AnimatorPage.jsx`  
**Notes:** Both tools load their document from the URL param on mount.  
**Enforcement:** Before closing any sprint that touches routing or navigation: `grep -rn "navigate.*'/jelly-sprite'\|navigate.*'/animator'" src/` must return 0 matches. All `<Route>` paths for editors in `routes.jsx` must include `:spriteId`.

---

### Rule 2 — `dataUrl` is canonical; `objectUrl` is a transient cache

`objectUrl` is created from `dataUrl` on mount via a single `useEffect`. It is
never persisted. If `objectUrl` is missing but `dataUrl` exists, trigger the
restore effect rather than crashing.

**Status:** ✅ Compliant  
**Introduced:** Sprint 0 (`908ba2d`) — `AnimatorPage.jsx`, `AnimatorContext.jsx`  
**Notes:** `LOAD_PROJECT` normalises all sheets to `objectUrl: null`. The restore
`useEffect` in `AnimatorPage.jsx` rebuilds them from `dataUrl`.  
**Enforcement:** Before any sprint touching sheet persistence: `grep -rn 'objectUrl' src/services/` must return 0 matches. The animator reducer's `LOAD_PROJECT` case must set `objectUrl: null` on all incoming sheets.

---

### Rule 3 — No `state.spriteSheet`; always `selectActiveSheet(state)`

`state.spriteSheet` was a redundant derived mirror. It is removed. All consumers
call `selectActiveSheet(state)` from `src/features/animator/selectors.js`.

**Status:** ✅ Compliant  
**Introduced:** Sprint 0 (`92997f7`), cleaned up in Sprint 5 (`625e694`)  
**Notes:** `AnimatorContext` reducer has no `spriteSheet` field. `LOAD_PROJECT`
retains a migration branch for old saves only.  
**Enforcement:** `grep -rn 'state\.spriteSheet' src/features/` must return 0 matches. Any sprint touching the animator reducer must confirm no new `spriteSheet` field is introduced outside the legacy migration branch.

---

### Rule 4 — `await handleSave()` before any navigation

Any navigation that leaves an editor must `await` the save first. Fire-and-forget
saves before `navigate()` are banned — they lose data on fast connections.

**Status:** ✅ Compliant  
**Introduced:** Sprint 0 (`92997f7`) — `AnimatorPage.jsx`  
**Notes:** `handleEditInJellySprite`: `if (isDirty) await handleSave()` before
`navigate()`. `JellySpriteWorkspace` saves before navigating to Animator.  
**Enforcement:** In any sprint touching navigation handlers in editor pages: search for every `navigate(` call in the file and confirm any that leave an editor is preceded by `await` of a save function. A bare `handleSave()` (no `await`) followed by immediate `navigate()` is a violation.

---

### Rule 5 — One canonical `animatorBody` save format

New saves never write a `spriteSheet` field. The shape is:
`{ sheets[{id,filename,dataUrl,width,height,frameConfig}], activeSheetId, animations[], frameConfig }`.
`LOAD_PROJECT` keeps a migration branch for old saves that had `spriteSheet`.

**Status:** ✅ Compliant  
**Introduced:** Sprint 0 (`92997f7`) — `AnimatorPage.jsx`, `AnimatorContext.jsx`  
**Enforcement:** Before any sprint modifying `buildAnimatorBody` or its callers: confirm the returned object contains no `spriteSheet` key. `grep -rn '"spriteSheet"' src/services/` must return 0 matches on new write paths.

---

### Rule 6 — Strip all binary data from localStorage; IDB holds binary

`localStorage` stores only metadata IDs. Before every localStorage write,
`sheets[]` entries must have `dataUrl` and `objectUrl` stripped.
`src/services/localIndex.js` writes only slim index records.

**Status:** ✅ Compliant  
**Introduced:** Sprint 0 (`908ba2d`) — `ProjectContext.jsx` → `localIndex.js`  
**Enforcement:** Before any sprint touching save or export: `grep -rn 'dataUrl\|objectUrl' src/services/localIndex.js` must return 0 matches. Every new localStorage write path must be reviewed — if the value being written could contain a blob or base64 string, reject it.

---

### Rule 7 — First-save always updates URL with `navigate(url, {replace:true})`

When a new document is saved for the first time (no `spriteId` in the URL),
the save handler must call `navigate('/tool/' + id, { replace: true })` so
the current history entry reflects the real URL and refresh works.

**Status:** ✅ Compliant  
**Introduced:** Sprint 0 (`908ba2d`) — `JellySpriteWorkspace.jsx`, `AnimatorPage.jsx`  
**Notes:** `JellySpriteWorkspace.jsx:59`, `AnimatorPage.jsx:211`.  
**Enforcement:** In any sprint adding a new first-save flow: confirm the `navigate` call uses `{ replace: true }` and includes the new ID in the path. Search new code for any `navigate(` on a first-save path that lacks `replace: true`.

---

### Rule 8 — `ProtectedRoute` always renders something; never `null`

During the auth loading state, `ProtectedRoute` renders a loading indicator,
not `null`. Returning `null` causes a blank-flash and breaks Suspense boundaries.

**Status:** ✅ Compliant  
**Introduced:** Sprint 0 (`908ba2d`) — `ProtectedRoute.jsx`  
**Notes:** Currently renders a full-screen `div` with "Loading…" text.  
**Enforcement:** In any sprint touching `ProtectedRoute.jsx`: `grep -n 'return null' src/router/ProtectedRoute.jsx` must return 0 matches. The loading branch must return a visible element.

---

### Rule 9 — IDB is truth; localStorage index writes are non-throwing

IDB is the real persistence layer. `localStorage` index writes are a convenience
cache only. All localStorage writes must be wrapped in `try/catch` so a quota
error or private-browsing restriction never surfaces as a save failure.

**Status:** ✅ Compliant  
**Introduced:** Sprint 0 (`92997f7`) — `projectService.js` / `localIndex.js`  
**Fixed:** Sprint 8a — both write functions wrapped in `try/catch`.  
**Enforcement:** In any sprint adding a localStorage write: wrap it in `try/catch`. `grep -n 'localStorage\.set' src/services/` — every match must be inside a try block. IDB failures should propagate; localStorage failures must be silently swallowed.

---

### Rule 10 — `navigate('/tool')` without spriteId is banned

Every navigation to an editor must carry the spriteId. Code must not fall back
to an ID-less editor route when the ID is unavailable — it should navigate to
`/projects` or show an error instead.

**Status:** ✅ Compliant  
**Introduced:** Sprint 0 (`908ba2d`)  
**Fixed:** Sprint 8a — both bare fallback navigates replaced with `navigate("/projects")`:
`AnimatorPage.jsx` (`handleEditInJellySprite`), `ProjectsPage.jsx` (add-sheet-to-animator).

---

### Rule 11 — Features never import from other features

Cross-feature imports create circular dependency risk and prevent individual
features from being tested or reused in isolation. All shared logic lives in
`src/engine/`, `src/services/`, `src/hooks/`, or `src/ui/`.

```js
// BANNED:
import { drawingEngine } from "../../jelly-sprite/engine/drawingEngine";
// CORRECT — import from a shared layer:
import { frameToRect } from "../../../engine/frameUtils";
```

**Status:** ✅ Compliant  
**Introduced:** Sprint 3 (`86e3b26`)  
**Notes:** Audit confirms no cross-feature imports in `src/features/**`.  
**Enforcement:** Before closing any sprint: scan every touched file in `src/features/` for import paths containing `../../` that resolve into a sibling feature directory. Any such import is a violation — the shared code must be promoted to `src/engine/`, `src/services/`, `src/hooks/`, or `src/ui/`.

---

### Rule 12 — Every feature exports through `index.js` only

The `index.js` barrel is the public API of a feature. Routes and other files
reference only the barrel, never internal paths.

```js
// CORRECT:
import { AnimatorPage } from "../features/animator";
// BANNED:
import { AnimatorPage } from "../features/animator/AnimatorPage/AnimatorPage";
```

**Status:** ✅ Compliant  
**Introduced:** Sprint 1 (`b5fda67`)  
**Fixed:** Sprint 8a — `src/features/auth/index.js` barrel created. `routes.jsx`
now imports `LoginPage` via the barrel.  
**Enforcement:** In any sprint adding a new feature component referenced outside its own directory: confirm an `index.js` barrel exists and the external import uses it. `grep -rn "features/[a-z-]*/[A-Z][A-Za-z/]*'" src/router/ src/layout/ src/App.jsx` must return 0 matches (no deep-path imports from outside the feature).

---

### Rule 13 — Derived values used by 2+ components live in `selectors.js`

Any derived state computed identically by more than one component lives in
`selectors.js` inside its feature. Components never duplicate `.find()` or
`.filter()` logic for shared data.

**Status:** ✅ Compliant  
**Introduced:** Sprint 1 (`b5fda67`) — `src/features/animator/selectors.js`  
**Fixed:** Sprint 8a — all inline duplicates replaced with selector calls across
`AnimatorPage.jsx`, `TracksPanel.jsx`, `useAnimatorKeyboard.js`, `SequenceBuilder.jsx`,
`PreviewCanvas.jsx`, `TimelineView.jsx`, `SheetViewerCanvas.jsx`.  
**Enforcement:** In any sprint adding a value derived from animator or document state used by 2+ components: add it to `selectors.js` first. Before closing the sprint, check touched files for inline `.find(` or `.filter(` on shared arrays (`animations`, `sheets`, `frames`) — duplicated derivation logic is a violation.

---

### Rule 14 — `src/engine/` functions are pure

Functions in `src/engine/` accept plain JS objects and return plain JS objects.
No `useRef`, no `document`, no `window`, no DOM access, no React imports.
Currently `src/engine/` contains only `frameUtils.js`. Note: `src/features/*/engine/`
subdirectories (e.g. `jelly-sprite/engine/`) are feature-internal and may use
DOM APIs where required for canvas rendering — Rule 14 applies only to `src/engine/`.

**Status:** ✅ Compliant  
**Introduced:** Sprint 3 (`86e3b26`) — `src/engine/frameUtils.js`  
**Enforcement:** Before closing any sprint adding code to `src/engine/`: `grep -rn 'from.*react\|useRef\|useEffect\|document\.\|window\.' src/engine/` must return 0 matches. Every function must be a pure input→output transformation with no side effects.

---

### Rule 15 — `src/services/` are I/O only

Nothing in `src/services/` uses React hooks, JSX, or `document` APIs. Services
return `Promise`. Toast triggers happen in the calling component after the
Promise resolves, never inside the service.

**Status:** ✅ Compliant  
**Introduced:** Sprint 2 (`d8033f9`)  
**Notes:** Audit confirms no React imports in any `src/services/*.js` file.  
**Enforcement:** Before closing any sprint adding to `src/services/`: `grep -rn 'from.*react\|showToast\|dispatch(' src/services/` must return 0 matches. Services return Promises only — toasts and dispatches belong in the calling component.

---

### Rule 16 — Undoable operations batch via transactions

Any user action that should produce a single undo step batches all its
sub-dispatches so history captures before/after the full operation, never a
partial intermediate state.

**Status:** ✅ Compliant — Sprint 10 audit complete  
**Introduced:** Sprint 7 (`15ee57a`) — `PixelDocument.pushHistory()` / `undo()` / `redo()`  
**Notes:** JellySprite pixel operations go through `PixelDocument` which owns
the history stack — single-operation batching is enforced there. Animator
undo/redo uses `useAnimatorStore` with `UNDOABLE_ACTIONS`. Sprint 10 audit
confirmed all exclusions are intentional: sheet operations (`ADD_SHEET`,
`REMOVE_SHEET`, `SET_SPRITE_SHEET`) excluded because snapshotting binary blob
data is impractical; navigation actions (`SET_ACTIVE_SHEET`,
`SET_ACTIVE_ANIMATION`) and lifecycle actions (`LOAD_PROJECT`,
`RESET_PROJECT`, `RESTORE_SHEET_URLS`) are all correctly excluded.  
**Closed:** Sprint 10 (`10e`)  
**Enforcement:** When adding a new user-facing mutation action to the animator: decide at the time of writing whether it belongs in `UNDOABLE_ACTIONS` and document the decision as a comment next to the set. Any action that mutates animation structure (frames, names, order) must be undoable unless snapshotting would require copying binary blob data.

---

### Rule 17 — Route-level lazy loading for all feature pages

Every feature page is wrapped in `React.lazy()` in `routes.jsx`. This keeps
the initial bundle size constant as features grow.

**Status:** ✅ Compliant  
**Introduced:** Sprint 1 (`b5fda67`) — `routes.jsx`  
**Fixed:** Sprint 8a — `LoginPage` converted to `React.lazy()` via `auth/index.js` barrel.  
**Enforcement:** In any sprint adding a new top-level page: the route in `routes.jsx` must use `React.lazy()` + `<Suspense>`. `grep -n "^import.*Page" src/router/routes.jsx` must return 0 static (non-lazy) page imports.

---

### Rule 18 — CSS design tokens for all repeated values

No component CSS file contains raw `color-mix()` literals or magic pixel
values that duplicate existing design tokens. Repeated patterns become named
tokens in `src/index.css`.

**Tokens in `src/index.css`:** `--accent-tint-soft` (10%), `--accent-tint-mid`
(14%), `--accent-tint-strong` (22%), `--accent-tint-xsoft-t` (5%/transparent),
`--accent-tint-faint` (8%/surface2), `--accent-tint-mid-t` (14%/transparent),
`--accent-tint-soft-t` (10%/transparent), `--cell-min-w` (44px), `--track-label-w`
(130px), `--danger`, `--danger-hover`, `--success`, `--warning`, `--text-disabled`,
`--surface-alt`, `--color-on-accent`, `--accent-separator`.

**Status:** ✅ Compliant  
**Introduced:** Sprint 1 (`b5fda67`)  
**Fixed:** Sprint 8a — new tokens added to `src/index.css` (see above).
All inline `color-mix()` literals in `TracksPanel.css` replaced with tokens.
`Toast.css` `#22c55e` replaced with `var(--success)`.
`SplitButton.css` `#fff` replaced with `var(--color-on-accent)` and border-left
replaced with `var(--accent-separator)`.  
**Enforcement:** In any sprint adding new CSS: before closing, check new `.css` files for raw hex color literals or repeated `color-mix()` values that match an existing token. If a value appears in more than one place, add a named token to `src/index.css` instead.

---

### Rule 19 — Store migration completeness check

Before any store consumer migration is declared complete, the following
checklist must be satisfied for **every file touched**:

1. **Full variable audit** — `grep` the file for every reference to the old
   hook's return variable (e.g. `\bstate\b`, `\bts\b`) and confirm each usage
   is accounted for in the new destructure. A migration that only extracts the
   fields immediately visible at the top of the function may miss downstream
   usages hundreds of lines later.
2. **Whole-object pass-through check** — if the old variable was passed as a
   whole object anywhere (e.g. `projectState: state`, `ctx.value = state`,
   spread into JSX props), the new import must expose an equivalent whole
   object, not just individual scalar extractions.
3. **Build gate** — `npm run build` must succeed with 0 errors after the
   migration, before the sprint task is closed.
4. **Runtime smoke-test** — navigate to every route that was migrated and
   confirm no `ReferenceError` or blank screen occurs.

**Status:** ✅ Compliant  
**Introduced:** Sprint 10 — post-migration `state is not defined` crash in
`JellySpriteBody` caused by extracting only `jellySpriteState` when the
component also used `state` as a whole object (`projectState: state` in the
context value). Rule added to prevent recurrence.

---

### Rule 20 — UI component extraction (reusable component library)

Extract a UI pattern into `src/ui/` when it appears identically (or
near-identically) in **two or more distinct files**. The second real usage
is the extraction trigger. Do not extract speculatively for hypothetical
future use — the first usage is a prototype; the second reveals the correct
shared API.

**Location discipline:**

- Pattern used only within one feature → component lives in
  `src/features/X/` subdirectory
- Pattern used by 2+ features, or used in layout/router/App → extract to
  `src/ui/ComponentName/`

**Structure standard for every `src/ui/` component:**

```
src/ui/ComponentName/
  ComponentName.jsx   component implementation + prop documentation
  ComponentName.css   styles (design tokens only — Rule 18)
  index.js            named export barrel — no default exports
```

**Inline override smell:** When a component is overridden by parent-context
CSS in 2+ call sites, it is missing a `variant`, `size`, or `compact` prop.
Add the prop to the component and remove the external overrides. Do not
accumulate per-callsite CSS patches indefinitely.

**Per-sprint UI debt scan:** Every sprint that touches UI files must briefly
scan the modified files for any inline UI pattern that also appears elsewhere.
Extract it during the same sprint, or log a named item in the sprint section
for the next sprint to action. Undocumented debt is a violation.

**Style compliance:** All new and modified component CSS must use design
tokens from `src/index.css` (Rule 18). No raw hex literals. No `color-mix()`
values that duplicate an existing token.

**Relationship to other rules:**

- Rule 11: components in `src/ui/` satisfy the cross-feature import ban automatically
- Rule 12: every new `src/ui/` component must have an `index.js` barrel
- Rule 18: all component CSS must use design tokens

**Status:** ✅ Compliant (pattern established Sprint 1–2: `FrameThumb`,
`SplitButton`, `EditableTitle`, `useDragReorder`)  
**Introduced:** Sprint 11  
**Enforcement:** In every sprint touching UI files: scan modified files for
duplicated UI patterns. Any pattern appearing in 2+ files without a shared
component is a violation. `grep -rn 'color-mix\|#[0-9a-fA-F]\{3,6\}'
src/ui/` on newly added component CSS must return 0 matches (use tokens).
Every new `src/ui/` component must have an `index.js` barrel before closing
the sprint.

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

## ✅ Sprint 6 — Unified Document Model (COMPLETE `5be735c`)

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

## ✅ Sprint 7 — JellySprite PixelDocument Refactor

| Sub-sprint | Description                                       | Commit     |
| ---------- | ------------------------------------------------- | ---------- |
| 7a         | PixelDocument class created                       | `dc4c6d9`  |
| 7b         | ToolContext extracted from jellySpriteReducer     | `dc4c6d9`  |
| 7c         | Migrate pixel state to PixelDocument (refs.doc)   | `0aee0f8`  |
| 7d         | Connect PixelDocument.onChange to DocumentContext | `b6c78a8`  |
| 7e         | Function stubs → null in JellySpriteProvider      | `b6c78a8`+ |

**7e deferred:** `onRegisterCollector` prop and `stateRef` mirror retained.

- `stateRef` is extensively used by drawingEngine.js (reads tool+canvas state via closure)
- `onRegisterCollector` is needed for JellySpriteWorkspace save flow
- Both can be removed in Sprint 8 when drawingEngine.js is refactored

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

## ✅ Sprint 8 — TypeScript Migration

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

### Sprint 8 — What was done

**Governance decision:** `allowJs: true` + `checkJs: false` preserves all existing
`.jsx` files unmodified. `strict: true` applies only to the `.ts`/`.tsx` files
we author. No mass `.jsx → .tsx` rename. Companion `.types.ts` files deliver type
contracts at context + service boundaries without breaking the entire codebase.

**Files created:**

- `tsconfig.json` — `strict: true`, `allowJs: true`, `checkJs: false`, `noEmit: true`
- `tsconfig.node.json` — composite config for `vite.config.ts`
- `src/services/types.ts` — `Layer`, `Frame`, `FrameConfig`, `SheetRecord`,
  `AnimationRecord`, `AnimatorBody`, `JellyBody`, `JellyFrameRecord`,
  `ProjectRecord`, `SpriteRecord`, `DocumentRecord`
- `src/contexts/document.types.ts` — `DocumentState`, `DocumentAction`, `DocumentContextValue`
- `src/contexts/animator.types.ts` — `AnimatorState`, `AnimatorAction`, `AnimatorContextValue`
- `src/features/jelly-sprite/store/tool.types.ts` — `ToolState`, `ToolAction`, `ToolContextValue`

**Files renamed:**

- `vite.config.js` → `vite.config.ts`
- `src/main.jsx` → `src/main.tsx`
- `src/features/jelly-sprite/engine/PixelDocument.js` → `PixelDocument.ts`

**PixelDocument.ts additions:** explicit property declarations, `HistorySnapshot`,
`FrameSnapshot`, `PixelDocumentEvent`, `PixelDocumentData` interfaces; all method
signatures typed; base64 helpers typed; `tsc --noEmit` passes with zero errors.

**Also fixed:** `flatted < 3.4.0` DoS vulnerability via `npm audit fix`.

---

## ✅ Sprint 9 — Zustand State Management

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

### Sprint 9 — What was done

**Governance decisions:**

- `usePixelDocumentStore` (spec 9c) deferred to Sprint 10 — JellySpriteProvider is feature-internal,
  `refs.doc` is already non-React (plain class). Cost/risk of this migration outweighs the benefit at
  this stage.
- Order change from spec: DocumentStore created before AnimatorStore so AnimatorStore can call
  `useDocumentStore.getState()` for cross-store animation→tags sync with no bridge component.

**Files created:**

- `src/features/jelly-sprite/store/useToolStore.js` — Zustand + persist, wraps `toolReducer`,
  persists 20 tool fields to `dj-tool-state` in localStorage.
- `src/contexts/useDocumentStore.js` — Zustand + persist, nested `state` field preserving
  `useDocument()` API, version 1 with custom merge, persists slim identity only.
- `src/contexts/useAnimatorStore.js` — Zustand (no persist), nested `state` field preserving
  `useAnimator()` API, full undo/redo history (max 50 entries), cross-store sync for
  animations→tags via `useDocumentStore.getState().dispatch(...)`.

**Files modified:**

- `src/features/jelly-sprite/store/ToolContext.jsx` — removed React imports + localStorage logic;
  `ToolProvider` is a no-op; `useToolContext()` is a backward-compat shim over `useToolStore()`.
- `src/contexts/AnimatorContext.jsx` — exported `animatorReducer`; removed Provider + undo/redo
  machinery; `useAnimator()` re-exported from `useAnimatorStore.js`.
- `src/contexts/DocumentContext.jsx` — exported `documentReducer`; removed Provider + localStorage
  effect; `useDocument()` re-exported from `useDocumentStore.js`.
- `src/App.jsx` — removed `DocumentProvider` and `AnimatorProvider` wrappers (now no-ops).
- `src/features/jelly-sprite/JellySprite.jsx` — removed `ToolProvider` wrapper (now a no-op).

**Rule audit:**

- Rule 11 (one store per domain): ✅ — `useToolStore`, `useDocumentStore`, `useAnimatorStore`
- Rule 13 (cross-store via getState, not hooks): ✅ — AnimatorStore uses `useDocumentStore.getState()`
- Rule 15 (no blobs in persist): ✅ — DocumentStore persists only slim identity; ToolStore excludes image data
- Rule 16 (undo coverage): ✅ — UNDOABLE_ACTIONS matches original; sheet operations excluded
  because sheets contain large binary dataUrls
- Rule 17 (backward compat): ✅ — all 13 animator consumers, 8 document consumers, 2 tool consumers
  continue to work without modification via alias exports
- Rule 18 (build clean): ✅ — `npm run build` 236 modules, 0 errors

### Sprint 9 commit order

```
1. Install zustand
2. useToolStore (replace ToolContext internal logic)
3. ToolContext — no-op Provider, useToolContext shim
4. useDocumentStore (replace DocumentContext internal logic)
5. useAnimatorStore (replace AnimatorContext + animation→tags cross-store sync)
6. AnimatorContext — no-op Provider, re-export useAnimator
7. DocumentContext — no-op Provider, re-export useDocument
8. App.jsx — remove DocumentProvider + AnimatorProvider wrappers
9. JellySprite.jsx — remove ToolProvider wrapper
10. Verify: npm run build ✅ — 0 errors
11. Commit: "refactor: Sprint 9 — Zustand state management"
```

---

## ✅ Sprint 10 — Store Consumer Migration

### Why this sprint is mandatory

Sprint 9 introduced six shims under the governance rule that permits shims for
**one sprint cycle only**. Sprint 10 is the resolution sprint.

The six shims are:

| Shim                                       | Location                                   | Consumers                                                                         |
| ------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------- |
| `useToolContext()` backward-compat wrapper | `ToolContext.jsx`                          | `useCanvas.js`, `JellySprite.jsx`                                                 |
| `useDocument()` re-export chain            | `DocumentContext.jsx` → `useDocumentStore` | `AnimatorPage`, `JellySprite`, `JellySpriteWorkspace`, `ProjectsPage`, `AppShell` |
| `useAnimator()` re-export chain            | `AnimatorContext.jsx` → `useAnimatorStore` | 12 animator + ExportPanel                                                         |
| `ToolProvider` no-op                       | `ToolContext.jsx`                          | None (dead export)                                                                |
| `DocumentProvider` no-op                   | `DocumentContext.jsx`                      | None (dead export)                                                                |
| `AnimatorProvider` no-op                   | `AnimatorContext.jsx`                      | None (dead export)                                                                |

The no-op providers have zero external references and can be deleted immediately.
The hook shims require consumer migrations first.

### The key architecture decision: flatten the stores

Sprint 9 wrapped all domain state under a nested `state: {}` field to preserve
the old `useX()` return-value shape (`{ state, dispatch, ... }`). This was
necessary while shims existed. Once shims die, the nesting is purely a
backward-compat artifact and actively harms performance.

**The problem with nested state:**

```js
// Current: every component doing this subscribes to the ENTIRE store slice
const { state, dispatch } = useAnimatorStore();
const { animations } = state; // re-renders on ANY store change
```

**The Zustand-idiomatic pattern we want:**

```js
// After: only re-renders when animations changes
const animations = useAnimatorStore((s) => s.animations);
const dispatch = useAnimatorStore((s) => s.dispatch);
```

Flattening the stores gives every consumer surgical subscription granularity.
This is the primary performance benefit of Zustand that Sprint 9 left unrealized.

### Governance challenge

**Is flattening risky?** — No. The reducers stay unchanged; only the store's
top-level shape changes. The migration is mechanical: every `const { state } =
useAnimatorStore()` → `const { animations, activeAnimationId, ... } =
useAnimatorStore()`. Since we're touching all consumers anyway to kill the
shims, the incremental cost is minimal.

**Should we keep selectors in `selectors.js` or co-locate with stores?** —
Keep `selectors.js`. Selectors are pure functions over the state shape; they
belong in the feature's own `selectors.js` per Rule 13. The store exports
primitive fields; components compose them via selectors where needed.

---

### 10a — Flatten `useDocumentStore`

Move all `state.*` fields to the top level of the store.

```js
// Before
export const useDocumentStore = create(persist((set, get) => ({
  state: { id: null, name: 'Untitled', projectId: null, spriteId: null, ... },
  isDirty: false,
  dispatch(action) { set({ state: documentReducer(get().state, action) }); },
  markSaved() { set({ isDirty: false }); },
}), { ... }));

// After — flat, selector-ready
export const useDocumentStore = create(persist((set, get) => ({
  id: null, name: 'Untitled', projectId: null, spriteId: null,
  canvasW: 32, canvasH: 32, frames: [], layers: [], tags: [],
  isDirty: false,
  dispatch(action) {
    const next = documentReducer(get(), action);
    set({ ...next, isDirty: /* ... */ });
  },
  markSaved() { set({ isDirty: false }); },
}), { partialize: (s) => ({ id: s.id, name: s.name, projectId: s.projectId, spriteId: s.spriteId }) }));
```

Update `documentReducer` import in `DocumentContext.jsx` to reflect that the
reducer now operates on the flat store shape (i.e. the reducer's `state`
parameter is no longer nested inside a wrapper).

**Files:** `src/contexts/useDocumentStore.js`, `src/contexts/DocumentContext.jsx`

---

### 10b — Flatten `useAnimatorStore`

Same pattern. The `_past` / `_future` undo stacks and `canUndo` / `canRedo`
flags are already at the top level; only `state.*` fields move up.

```js
// After — flat
export const useAnimatorStore = create((set, get) => ({
  sheets: [], activeSheetId: null, frameConfig: { ... },
  animations: [], activeAnimationId: null,
  canUndo: false, canRedo: false, isDirty: false,
  _past: [], _future: [],
  dispatch(action) {
    const next = animatorReducer(get(), action);   // operates on flat state
    // ...undo tracking...
    set({ ...next, _past, _future, canUndo, canRedo, isDirty });
  },
  undo() { ... },
  redo() { ... },
  markSaved() { set({ isDirty: false }); },
}));
```

**Files:** `src/contexts/useAnimatorStore.js`

---

### 10c — Migrate all shim consumers

Three groups, smallest first:

**Group 1 — Tool store (2 files)**

`useCanvas.js` and `JellySprite.jsx` currently call `useToolContext()`. Replace
with direct `useToolStore` imports. Tool store is already flat (no nesting
was needed — Sprint 9 spread `toolInitialState` directly).

```js
// Before
import { useToolContext } from "./store/ToolContext";
const { state: ts, dispatch: td } = useToolContext();

// After
import { useToolStore } from "./store/useToolStore";
const tool = useToolStore((s) => s.tool);
const fgColor = useToolStore((s) => s.fgColor);
const td = useToolStore((s) => s.dispatch);
```

**Group 2 — Document store (5 files)**

`AnimatorPage.jsx`, `JellySprite.jsx`, `JellySpriteWorkspace.jsx`,
`ProjectsPage.jsx`, `AppShell.jsx`. Replace `useDocument()` from
`DocumentContext` with `useDocumentStore()` from `useDocumentStore`.

```js
// Before
import { useDocument } from "../../../contexts/DocumentContext";
const { state: projectState, dispatch: projectDispatch } = useDocument();

// After
import { useDocumentStore } from "../../../contexts/useDocumentStore";
const id = useDocumentStore((s) => s.id);
const name = useDocumentStore((s) => s.name);
const projectDispatch = useDocumentStore((s) => s.dispatch);
```

**Group 3 — Animator store (12 files)**

`AnimationSidebar`, `AnimatorPage`, `FrameConfigPanel`, `useAnimatorKeyboard`,
`PreviewCanvas`, `SequenceBuilder`, `SheetList`, `SheetViewerCanvas`,
`SpriteImporter`, `TimelineView`, `TracksPanel`, `ExportPanel`. Replace
`useAnimator()` from `AnimatorContext` with `useAnimatorStore()` from
`useAnimatorStore`.

```js
// Before
import { useAnimator } from "../../../contexts/AnimatorContext";
const { state, dispatch } = useAnimator();
const { animations, activeAnimationId } = state;

// After
import { useAnimatorStore } from "../../../contexts/useAnimatorStore";
const animations = useAnimatorStore((s) => s.animations);
const activeAnimationId = useAnimatorStore((s) => s.activeAnimationId);
const dispatch = useAnimatorStore((s) => s.dispatch);
```

---

### 10d — Delete dead shim exports; reduce context files to reducers only

With all consumers migrated, the three context files can be stripped to
pure reducer + initial state exports. They are depended on by the stores
(which import their reducers), so they cannot be deleted entirely yet —
but all re-exports, no-op providers, and shim hooks are removed.

**`ToolContext.jsx`** after Sprint 10:

```js
// Only exports the reducer and initial state
export const toolInitialState = { ... };
export function toolReducer(state, action) { ... }
// Everything else deleted
```

**`AnimatorContext.jsx`** after Sprint 10:

```js
// Only exports the reducer and initial state
export const initialAnimatorState = { ... };
export function animatorReducer(state, action) { ... }
// No imports, no Provider, no useAnimator
```

**`DocumentContext.jsx`** after Sprint 10:

```js
// Only exports the reducer and initial state
export const initialDocumentState = { ... };
export function documentReducer(state, action) { ... }
// No imports, no Provider, no useDocument
```

An optional follow-on move (`10d+`, can be done in Sprint 11 or 12): inline the
reducers into their store files, then delete the context files altogether.
Not mandatory for 10 — keep the store/reducer split clean until Sprint 11
confirms no regressions.

**Files:** `ToolContext.jsx`, `AnimatorContext.jsx`, `DocumentContext.jsx`

---

### 10e — Rule 16 complete audit

Rule 16 has been marked ⚠️ Partial since Sprint 7. Close it.

Audit every `dispatch()` call across all animator consumers. For each one,
answer: does a user perceive this as a single undoable action? If yes and the
action type is not in `UNDOABLE_ACTIONS`, add it. If no and it is in
`UNDOABLE_ACTIONS`, remove it.

Current `UNDOABLE_ACTIONS`:
`ADD_ANIMATION, DELETE_ANIMATION, DUPLICATE_ANIMATION, RENAME_ANIMATION,`
`UPDATE_ANIMATION, SET_FRAME_CONFIG`

Actions **not** in the set (verify each is correct):

- `ADD_SHEET`, `REMOVE_SHEET` — sheets contain large binary `dataUrl`; undo
  would require snapshotting blobs. Correct to exclude.
- `SET_ACTIVE_SHEET`, `SET_ACTIVE_ANIMATION` — navigation, not mutation. Correct.
- `LOAD_PROJECT`, `RESET_PROJECT` — load/reset clears history. Correct.
- `SET_SPRITE_SHEET` — sets dirty but no history entry (sheet content, not
  animation structure). Verify this is intentional.
- `RESTORE_SHEET_URLS` — re-creates objectUrls on mount, not a user action. Correct.

Update Rule 16 status from ⚠️ to ✅ once audit is documented.

**Files:** `src/contexts/useAnimatorStore.js`, Rule 16 entry in SPRINT.md

---

### Sprint 10 commit order

```
1. Flatten useDocumentStore (10a)
2. Flatten useAnimatorStore (10b)
3. Migrate tool consumers — useCanvas.js + JellySprite.jsx (10c group 1)
4. Migrate document consumers — 5 files (10c group 2)
5. Migrate animator consumers — 12 files (10c group 3)
6. Strip shim exports from ToolContext.jsx, AnimatorContext.jsx, DocumentContext.jsx (10d)
7. Rule 16 audit + status update (10e)
8. Verify: npm run build — 0 errors
9. Commit: "refactor: Sprint 10 — store consumer migration, shim resolution"
```

---

## � Sprint 11 — PixelDocument Store + Sprint 7e Artifact Removal

### Why these items are grouped

The three deferred Sprint 7e artifacts (`refs.stateRef` mirror,
`onRegisterCollector`, `collectSaveData`) all have the same root cause:
the drawing engine and save flow cannot read `PixelDocument` state without
being handed it via a closure. `usePixelDocumentStore` is the Zustand wrapper
that makes `PixelDocument` state readable by any module via `getState()`,
which directly unblocks both artifacts.

They are one problem, not two. Sprint 11 resolves them together.

### How `refs.stateRef` is currently used

`JellySprite.jsx` merges all state fields each render:

```js
refs.stateRef.current = { ...ss, ...ts }; // ss = JellySpriteStore, ts = ToolStore
```

`drawingEngine.js`, `canvasRenderer.js`, `clipboardOps.js`, `selectionOps.js`
then read `refs.stateRef.current` (as `st`) to get both tool settings and
canvas geometry inside pointer-event callbacks.

After Sprint 10, `useToolStore.getState()` gives tool fields without React.
After 11a, `usePixelDocumentStore.getState()` gives canvas fields.
`refs.stateRef` is then fully redundant.

---

### 11a — Create `usePixelDocumentStore`

**File:** `src/features/jelly-sprite/store/usePixelDocumentStore.js`

```js
import { create } from 'zustand';
import { PixelDocument } from '../engine/PixelDocument';

export const usePixelDocumentStore = create((set, get) => ({
  doc: null,
  frames: [],
  layers: [],
  canvasW: 0,
  canvasH: 0,
  canUndo: false,
  canRedo: false,

  init(data) {
    const doc = data ? PixelDocument.deserialize(data) : new PixelDocument(...);
    doc.onChange(() => {
      const { doc } = get();
      set({
        frames: doc.frames,
        layers: doc.layers,
        canUndo: doc.canUndo,
        canRedo: doc.canRedo,
      });
    });
    set({ doc, frames: doc.frames, layers: doc.layers,
          canvasW: doc.canvasW, canvasH: doc.canvasH,
          canUndo: doc.canUndo, canRedo: doc.canRedo });
  },

  undo()  { get().doc?.undo(); },
  redo()  { get().doc?.redo(); },
  serialize() { return get().doc?.serialize() ?? null; },
}));
```

The `doc.onChange` subscription pushes `frames`, `layers`, `canUndo`, `canRedo`
into the Zustand store so React components can subscribe selectively.
`doc` itself is the authoritative pixel state — never serialised into Zustand.

---

### 11b — Remove `refs.stateRef` mirror

Replace every `refs.stateRef.current` read in the drawing engine with direct
store reads:

```js
// Before — in drawingEngine.js, canvasRenderer.js, etc.
const st = refs.stateRef.current; // { tool, fgColor, ..., canvasW, canvasH, ... }

// After
import { useToolStore } from "../store/useToolStore";
import { usePixelDocumentStore } from "../store/usePixelDocumentStore";
const ts = useToolStore.getState();
const ps = usePixelDocumentStore.getState();
```

All field accesses update accordingly. The line `refs.stateRef.current = { ...ss, ...ts }`
in `JellySprite.jsx` is deleted. `refs.stateRef` is removed from `JellySpriteProvider`.

**Files:** `drawingEngine.js`, `canvasRenderer.js`, `clipboardOps.js`,
`selectionOps.js`, `JellySprite.jsx`, `JellySpriteProvider.jsx`

---

### 11c — Remove `onRegisterCollector` / `collectSaveData`

`JellySpriteWorkspace.jsx` currently calls:

```js
onRegisterCollector={(fn) => { collectorRef.current = fn; }}
```

And on save:

```js
const data = collectorRef.current?.();
```

With `usePixelDocumentStore`, the save flow becomes:

```js
import { usePixelDocumentStore } from "../jelly-sprite/store/usePixelDocumentStore";
// ...
const data = usePixelDocumentStore.getState().serialize();
```

No callback prop, no ref, no useEffect. Delete `onRegisterCollector` prop from
`JellySprite.jsx` and `JellySpriteBody`. The `collectSaveData()` function inside
`JellySpriteBody` is replaced by `usePixelDocumentStore.getState().serialize()`.

**Files:** `JellySprite.jsx`, `JellySpriteWorkspace.jsx`

---

### 11d — Wire `usePixelDocumentStore` into the JellySprite load / frame-switch flows

Current JellySprite load flow: `LOAD_PROJECT` dispatch → `JellySprite` mount
effect decodes data and imperatively calls `refs.doc.*` to set up the
`PixelDocument`. This should instead call:

```js
usePixelDocumentStore.getState().init(deserializedData);
```

Frame-switch (`handleFrameSwitch`) calls `refs.doc.saveCurrentFrame()` and
`refs.doc.frameSnapshots[id]` directly. These can remain as-is (they go
through the `PixelDocument` class, which fires `onChange`, which Zustand
captures). No change needed to frame-switch logic.

**Files:** `JellySprite.jsx`

---

### Sprint 11 commit order

```
1. usePixelDocumentStore created (11a)
2. drawingEngine + canvasRenderer: replace refs.stateRef with store.getState() (11b)
3. clipboardOps + selectionOps: same (11b continued)
4. JellySprite.jsx: remove stateRef mirror + refs.stateRef assignment (11b)
5. JellySpriteWorkspace + JellySprite: remove onRegisterCollector (11c)
6. Wire init() into load flow (11d)
7. Verify: npm run build — 0 errors
8. Commit: "refactor: Sprint 11 — usePixelDocumentStore, remove Sprint 7e artifacts"
```

---

## 🔲 Sprint 12 — Service Layer Cleanup

### What remains in the service layer

`projectService.js` was split into five focused modules in Sprint 2. The file
became a re-export barrel for backward compatibility. That was correct. But
it also contains **legacy shim functions** that wrap the split services under
old function names. These shims have survived 10 sprints without being
resolved — that is a critical governance violation.

**Legacy shims in `projectService.js`:**

| Legacy name                           | Maps to                   | Current consumer  |
| ------------------------------------- | ------------------------- | ----------------- |
| `pickAndLoadProject()`                | `pickAndLoadSpriteFile()` | Unused (verify)   |
| `loadProjectFromStorage(id)`          | `loadSprite(id)`          | Unused (verify)   |
| `saveProjectToStorage(data, thumb)`   | `saveSprite(...)`         | Unused (verify)   |
| `deleteProjectFromStorage(id)`        | `deleteSprite(id)`        | Unused (verify)   |
| `serialiseProject(state, jellyState)` | `serialiseSprite(...)`    | `ExportPanel.jsx` |

Two confirmed active consumers:

- `ExportPanel.jsx` — imports `serialiseProject`
- `ProjectsPage.jsx` — imports multiple names from projectService barrel

---

### 12a — Audit `projectService.js` import sites

For each import from `projectService.js`, determine whether the caller needs
the legacy alias or can import directly from the split service module.

```js
// ProjectsPage currently:
import { saveProjectToStorage, loadProjectFromStorage, deleteProjectFromStorage, ... }
  from "../../services/projectService";

// After: import directly from split modules
import { saveSprite, loadSprite, deleteSprite } from "../../services/sprites";
import { listProjects } from "../../services/projects";
```

**Files:** All files that import from `projectService.js`

---

### 12b — Migrate `ExportPanel` away from `serialiseProject`

```js
// Before
import { serialiseProject } from "../../../services/projectService";
const blob = await serialiseProject(projectState, jellySpriteState);

// After
import { serialiseSprite } from "../../../services/serialization";
// Pass jellyState directly
```

**Files:** `src/features/export/ExportPanel/ExportPanel.jsx`

---

### 12c — Remove legacy shim functions from `projectService.js`

Once all consumers are migrated, delete the 5 legacy function bodies from
`projectService.js`. The file remains as a clean re-export barrel for the
split modules — callers that import generic names like `saveSprite` or
`listProjects` are already correct and keep working.

```js
// projectService.js after Sprint 12 — pure re-export barrel only
export * from "./projects.js";
export * from "./sprites.js";
export * from "./serialization.js";
// No legacy shim functions
```

**Files:** `src/services/projectService.js`

---

### 12d — Inline context reducers into store files (optional Sprint 10d follow-on)

If context files were only stripped (not deleted) in Sprint 10, this is the
point where each reducer moves into its store file and the context file is
deleted. Three files become two:

```
ToolContext.jsx + useToolStore.js → useToolStore.js (reducer inlined)
AnimatorContext.jsx + useAnimatorStore.js → useAnimatorStore.js (reducer inlined)
DocumentContext.jsx + useDocumentStore.js → useDocumentStore.js (reducer inlined)
```

This removes the last vestiges of the React Context era from the codebase.

**Files:** `useToolStore.js`, `useAnimatorStore.js`, `useDocumentStore.js`,
then delete `ToolContext.jsx`, `AnimatorContext.jsx`, `DocumentContext.jsx`

---

### Sprint 12 commit order

```
1. Audit projectService.js import sites
2. Migrate ExportPanel to serialization.js directly (12b)
3. Migrate ProjectsPage to split service modules (12a)
4. Remove legacy shim functions from projectService.js (12c)
5. Inline reducers into store files + delete context shells (12d)
6. Verify: npm run build — 0 errors
7. Commit: "refactor: Sprint 12 — service layer cleanup, delete context shells"
```
