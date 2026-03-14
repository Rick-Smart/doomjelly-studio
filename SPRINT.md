# DoomJelly Studio — Sprint Tracker

**Branch:** `feature/jelly-sprite-improvements`  
**Architecture reference:** `JELLYSPRITE_ARCHITECTURE.md`  
**Last updated:** March 13, 2026

---

## Quick Navigation

|                                                                            |                                              |
| -------------------------------------------------------------------------- | -------------------------------------------- |
| [Sprint Status Dashboard](#sprint-status-dashboard)                        | Current state of all sprints                 |
| [Sprint Governance](#sprint-governance)                                    | Policies, shim rules, start/close checklists |
| [Sprint Close Checklist](#sprint-close-checklist)                          | Enforcement greps to run before every close  |
| [Rules 1–20 Reference](#rules-120-reference)                               | Architecture laws + enforcement notes        |
| [Sprint 17 — Next](#sprint-17--ink-system-lock-alpha--shading-ink)         | Next sprint full detail                      |
| [Sprint 16 — Last Completed](#sprint-16--crash-fix-dead-code--rough-edges) | Bugs fixed, changes, audit                   |
| [Sprint 15](#sprint-15--data-model-normalization)                          | Collapsed summary                            |
| [Sprint History (0–12)](#sprint-history-012)                               | Collapsed summaries for completed work       |

---

## Sprint Status Dashboard

| Sprint    | Name                                 | Status                  |
| --------- | ------------------------------------ | ----------------------- |
| Sprint 0  | Data Stability                       | ✅ Complete (`92997f7`) |
| Sprint 1  | Foundation Cleanup                   | ✅ Complete (`b5fda67`) |
| Sprint 2  | Monolith Decomposition               | ✅ Complete (`d8033f9`) |
| Sprint 3  | Feature Contract Enforcement         | ✅ Complete (`86e3b26`) |
| Sprint 4  | Context Decomposition                | ✅ Complete (`ac647ed`) |
| Sprint 5  | State Finalization                   | ✅ Complete (`625e694`) |
| Sprint 6  | Unified Document Model               | ✅ Complete (`5be735c`) |
| Sprint 7  | JellySprite PixelDocument Refactor   | ✅ Complete (`15ee57a`) |
| Sprint 8a | Rule Violation Fixes                 | ✅ Complete (`dc32ace`) |
| Sprint 8  | TypeScript Migration                 | ✅ Complete (`d302053`) |
| Sprint 9  | Zustand State Management             | ✅ Complete (`388f043`) |
| Sprint 10 | Store Consumer Migration             | ✅ Complete (`8ed4bd7`) |
| Sprint 11 | PixelDocument Store + 7e Cleanup     | ✅ Complete (`806493b`) |
| Sprint 12 | Service Layer Cleanup                | ✅ Complete (`fb89db4`) |
| Sprint 13 | Navigation Integrity + Creative Flow | ✅ Complete (`aaa3e58`) |
| Sprint 14 | Full Ruleset Compliance Pass (CSS)   | ✅ Complete (`81bd5ec`) |
| Sprint 15 | Data Model Normalization             | ✅ Complete (`1d6f081`) |
| Sprint 16 | Crash Fix, Dead Code & Rough Edges   | ✅ Complete (`536a1f4`) |
| Sprint 17 | Ink System (Lock Alpha + Shading)    | 🔲 Not started          |
| Sprint 18 | Drawing Quality + Onion Skin Upgrade | 🔲 Not started          |
| Sprint 19 | Color Adjustments                    | 🔲 Not started          |
| Sprint 20 | Drawing Tool Expansion               | 🔲 Not started          |
| Sprint 21 | Advanced Timeline                    | 🔲 Not started          |

---

## Sprint Governance

### On refactors

Major refactors are always on the table. A sprint can replace a subsystem entirely if that produces a better result than an incremental migration. Before each sprint, challenge the design assumptions it rests on:

- Is the abstraction this sprint builds on top of actually correct?
- Would a clean rewrite be shorter than the migration path?
- Does the planned work move toward or away from the unified document model?

Record which assumptions were challenged, kept, and replaced — this history is as valuable as the code.

### On compatibility shims

Shims (re-export wrappers, legacy action aliases, backward-compat dispatch paths) are permitted for **one sprint cycle** while consumers migrate. They must be resolved the next sprint. An unresolved shim that survives two sprints is a design debt line item.

### On scope

Sprints can be as large or small as the problem demands. Feature complexity is the scope signal, not time or line count. A sprint that replaces one file is as valid as one that restructures five contexts.

### Sprint start checklist

Before beginning any sprint:

1. Mark the sprint `🔄 In progress` in the status table above
2. Update `**Last updated:**` in the file header
3. Formally challenge the design assumptions the sprint rests on — record the outcome in the sprint section
4. Confirm all enforcement checks from the previous sprint are satisfied

### Sprint close checklist

Before marking any sprint complete:

1. Mark the sprint `✅ Complete (\`commit-hash\`)` in the status table
2. Record the commit hash in the sprint section header
3. Update `**Last updated:**` in the file header
4. **Run every grep in the [Sprint Close Checklist](#sprint-close-checklist)** — not just rules whose scope was touched
5. Log any deferred items as named line items in the next sprint section

---

## Sprint Close Checklist

Run every check from the repo root. A sprint is not done until all checks are green.

```bash
# Rule 1 — no bare /animator or /jelly-sprite destination
grep -rn "navigate('/animator')\|navigate(\"/animator\")\|navigate('/jelly-sprite')\|navigate(\"/jelly-sprite\")" src/

# Rule 3 — no state.spriteSheet access
grep -rn "state\.spriteSheet" src/

# Rule 4 — await save before navigate (manual review required)
grep -n "navigate(" src/features/animator/AnimatorPage/AnimatorPage.jsx
grep -n "navigate(" src/features/jelly-sprite/JellySpriteWorkspace.jsx

# Rule 5 — no legacy spriteSheet written by services
grep -rn "\"spriteSheet\"" src/services/

# Rule 6 — no dataUrl/objectUrl in localStorage
grep -n "dataUrl\|objectUrl" src/services/localIndex.js src/services/storage.js

# Rule 10 — broader bare editor navigate check
grep -rn "navigate.*['\"/]animator['\"/]\b\|navigate.*['\"/]jelly-sprite['\"/]\b" src/

# Rule 11 — no cross-feature imports
grep -rn "from.*features/animator" src/features/jelly-sprite/
grep -rn "from.*features/jelly-sprite" src/features/animator/
grep -rn "from.*features/projects" src/features/animator/ src/features/jelly-sprite/

# Rule 12 — no deep-path imports from router/layout/App
grep -rn "features/[a-zA-Z-]*/[A-Z]" src/router/ src/layout/ src/App.jsx

# Rule 14 — src/engine pure (no React/DOM)
grep -rn "from.*react\|useRef\|useEffect\|document\.\|window\." src/engine/

# Rule 15 — services I/O only (no React hooks)
grep -rn "from.*react\|showToast\|dispatch(" src/services/

# Rule 17 — no static page imports in routes.jsx
grep -n "^import.*Page" src/router/routes.jsx

# Rule 18 — no raw hex in src/ui/ CSS
grep -rn "#[0-9a-fA-F]\{3,6\}\b" src/ui/ --include="*.css"
# Also check feature CSS (spirit of rule):
grep -rn "#[0-9a-fA-F]\{3,6\}\b" src/features/ --include="*.css"

# Rule 20 — every src/ui/ dir has index.js
for dir in src/ui/*/; do [ ! -f "${dir}index.js" ] && echo "MISSING: $dir"; done

# Build gate
npm run build
```

> **Rule 4 note:** Grep finds `navigate(` calls but cannot verify the async await chain. For every `navigate(` in an editor file, manually confirm it is either: (a) preceded by `await handleSave()` in the same code path, or (b) a redirect that cannot lose user work (e.g. error recovery to `/projects`).

---

## Rules 1–20 Reference

**Current status:** ✅ All 20 rules compliant as of `4ed5a9b` (post-Sprint 13 audit).

### Quick reference table

| #   | Rule summary                                                                                                            | Enforcement                                                                   | Introduced |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------- |
| 1   | Editor URLs always carry `:spriteId` — `/animator` as destination is banned                                             | bare navigate grep → 0                                                        | Sprint 0   |
| 2   | `dataUrl` canonical; `objectUrl` rebuilt on mount, never persisted                                                      | `grep "objectUrl" src/services/` → 0                                          | Sprint 0   |
| 3   | No `state.spriteSheet`; always use `selectActiveSheet(state)`                                                           | `grep "state\.spriteSheet" src/` → 0                                          | Sprint 0   |
| 4   | `await handleSave()` before any navigation out of an editor                                                             | manual: trace all `navigate(` in editor files                                 | Sprint 0   |
| 5   | No `spriteSheet` field in new saves from `buildAnimatorBody`                                                            | `grep '"spriteSheet"' src/services/` → 0                                      | Sprint 0   |
| 6   | `dataUrl`/`objectUrl` stripped before localStorage; binary in IDB only                                                  | `grep "dataUrl\|objectUrl" src/services/localIndex.js` → 0                    | Sprint 0   |
| 7   | First save → `navigate('/tool/' + id, { replace: true })`                                                               | check new first-save paths for `replace: true`                                | Sprint 0   |
| 8   | `ProtectedRoute` always renders; never returns `null`                                                                   | `grep "return null" src/router/ProtectedRoute.jsx` → 0                        | Sprint 0   |
| 9   | IDB is truth; all localStorage writes wrapped in `try/catch`                                                            | every `localStorage.set` must be inside a try block                           | Sprint 0   |
| 10  | `navigate('/tool')` without spriteId banned; use `/projects` fallback                                                   | bare navigate grep → 0                                                        | Sprint 0   |
| 11  | Features never import from other features                                                                               | cross-feature import greps → 0                                                | Sprint 3   |
| 12  | Every feature exports through `index.js` barrel only — no deep-path imports from outside                                | `grep "features/[a-z-]*/[A-Z]" src/router/` → 0                               | Sprint 1   |
| 13  | Derived values used by 2+ components live in `selectors.js`                                                             | check new `.find(` / `.filter(` in components for duplication                 | Sprint 1   |
| 14  | `src/engine/` functions are pure — no React, no DOM                                                                     | `grep "from.*react\|document\." src/engine/` → 0                              | Sprint 3   |
| 15  | `src/services/` I/O only — no React hooks, no toasts, no dispatch                                                       | `grep "from.*react\|showToast" src/services/` → 0                             | Sprint 2   |
| 16  | Undoable user actions listed in `UNDOABLE_ACTIONS`; each exclusion documented                                           | comment at the set listing inclusions + exclusions                            | Sprint 7   |
| 17  | All feature pages use `React.lazy()` in `routes.jsx`                                                                    | `grep "^import.*Page" src/router/routes.jsx` → 0                              | Sprint 1   |
| 18  | No raw hex / `color-mix()` literals in component CSS — use tokens from `src/index.css`                                  | `grep "#[0-9a-fA-F]\{3,6\}" src/ui/ --include="*.css"` → 0                    | Sprint 1   |
| 19  | Store migration completeness: grep old vars, check whole-object pass-through, build gate, smoke-test                    | manual                                                                        | Sprint 10  |
| 20  | Extract to `src/ui/` at second usage; feature-internal stays in feature dir; every `src/ui/` component needs `index.js` | `grep "#[0-9a-fA-F]" src/ui/ --include="*.css"` → 0; dir check for `index.js` | Sprint 2   |

### Rule detail

---

**Rule 1 — URL = identity**  
Every editor URL must carry a `spriteId`. A route without one must never load an editor. Sharing or refreshing the URL must always work. `/animator` as a navigation destination is banned — use `/animator/:id` or fall back to `/projects`.

---

**Rule 2 — `dataUrl` is canonical; `objectUrl` is a transient cache**  
`objectUrl` is created from `dataUrl` on mount via a single `useEffect`. Never persisted. If `objectUrl` is missing but `dataUrl` exists, trigger the restore effect rather than crashing. The animator reducer's `LOAD_PROJECT` sets `objectUrl: null` on all incoming sheets.

---

**Rule 3 — No `state.spriteSheet`; always `selectActiveSheet(state)`**  
`state.spriteSheet` was a redundant derived mirror and is removed. All consumers call `selectActiveSheet(state)` from `src/features/animator/selectors.js`. The `LOAD_PROJECT` case retains a migration branch for old saves only.

---

**Rule 4 — `await handleSave()` before any navigation**  
Any navigation that leaves an editor must `await` the save first. Fire-and-forget saves are banned — pixel work is in-memory only and would be lost. `handleSave()` must return the persisted id so callers can navigate to it. A bare `handleSave()` (no `await`) followed by immediate `navigate()` is a violation.

---

**Rule 5 — One canonical `animatorBody` save format**  
New saves never write a `spriteSheet` field. Shape: `{ sheets[], activeSheetId, animations[], frameConfig }`. `LOAD_PROJECT` keeps a migration branch for legacy saves that had `spriteSheet`.

---

**Rule 6 — Binary data stays in IDB**  
`localStorage` stores only metadata IDs. Before every write, `sheets[]` entries must have `dataUrl` and `objectUrl` stripped. `src/services/localIndex.js` writes only slim index records.

---

**Rule 7 — First-save updates URL**  
When a new document is saved for the first time (no existing `spriteId`), the save handler must call `navigate('/tool/' + id, { replace: true })` so the history entry reflects the real URL and refresh works.

---

**Rule 8 — `ProtectedRoute` always renders**  
During the auth loading state, `ProtectedRoute` renders a loading indicator, never `null`. Returning `null` causes a blank-flash and breaks Suspense boundaries.

---

**Rule 9 — localStorage writes are non-throwing**  
IDB is truth. All localStorage writes wrapped in `try/catch` so quota errors or private-browsing restrictions never surface as save failures. IDB failures should propagate; localStorage failures must be swallowed.

---

**Rule 10 — No bare editor navigates**  
Every navigation to an editor must carry the spriteId. When the ID is unavailable, navigate to `/projects` or show an error — never navigate to a bare `/animator` or `/jelly-sprite`.

---

**Rule 11 — Features never import from other features**  
Cross-feature imports create circular dependency risk. All shared logic must live in `src/engine/`, `src/services/`, `src/hooks/`, or `src/ui/`. `import { x } from "../../jelly-sprite/..."` inside `src/features/animator/` is a violation.

---

**Rule 12 — Every feature exports through `index.js` barrel only**  
The `index.js` barrel is the public API. Routes and layout files reference only the barrel, never internal paths. `import { AnimatorPage } from "../features/animator"` ✅ — `import { AnimatorPage } from "../features/animator/AnimatorPage/AnimatorPage"` ❌.

---

**Rule 13 — Derived values used by 2+ components live in `selectors.js`**  
Any derived state computed identically by more than one component lives in `selectors.js` inside its feature. Components never duplicate `.find()` or `.filter()` logic for shared data. **Deferred (Sprint 14a):** `selectors.js` should move to `src/contexts/` so `ExportPanel` can use it without violating Rule 11.

---

**Rule 14 — `src/engine/` functions are pure**  
Functions in `src/engine/` accept plain JS objects and return plain JS objects. No `useRef`, no `document`, no `window`, no React imports. Note: `src/features/*/engine/` subdirectories may use DOM APIs for canvas rendering — Rule 14 applies only to `src/engine/`.

---

**Rule 15 — `src/services/` are I/O only**  
Nothing in `src/services/` uses React hooks, JSX, or `document` APIs. Services return Promises only. Toast triggers happen in the calling component after the Promise resolves, never inside the service.

---

**Rule 16 — Undoable operations batch via `UNDOABLE_ACTIONS`**  
User actions that should produce a single undo step are listed in `UNDOABLE_ACTIONS`. Sheet operations (`ADD_SHEET`, `REMOVE_SHEET`, `SET_SPRITE_SHEET`) are excluded — snapshotting binary blob data is impractical. Navigation and lifecycle actions are correctly excluded. Any new mutation action must declare its undo decision as a comment in the set.

---

**Rule 17 — Route-level lazy loading for all feature pages**  
Every feature page is wrapped in `React.lazy()` in `routes.jsx`. No static top-level page imports.

---

**Rule 18 — CSS design tokens for all repeated values**  
No component CSS file contains raw hex color literals or `color-mix()` values that duplicate existing tokens. All values must reference tokens from `src/index.css`.

Current tokens: `--accent-tint-soft/mid/strong/xsoft-t/faint/mid-t/soft-t`, `--cell-min-w`, `--track-label-w`, `--danger`, `--danger-hover`, `--success`, `--warning`, `--text-disabled`, `--surface-alt`, `--color-on-accent`, `--accent-separator`.

---

**Rule 19 — Store migration completeness**  
Before a store consumer migration is declared complete: (1) grep all references to the old hook's variable and confirm each is accounted for; (2) check for any whole-object pass-through; (3) `npm run build` must pass; (4) runtime smoke-test every migrated route.

---

**Rule 20 — UI extraction at second usage**  
Extract a UI pattern into `src/ui/` when it appears identically in two or more distinct files. The first usage is a prototype; the second reveals the correct shared API. Do not extract speculatively. Feature-internal patterns stay in the feature directory.

Every `src/ui/` component requires: `ComponentName.jsx`, `ComponentName.css` (tokens only — Rule 18), `index.js` barrel with named exports.

---

## Sprint 17 — Ink System (Lock Alpha + Shading Ink)

**Status:** 🔲 Not started  
**Origin:** Aseprite parity audit (March 2026). Lock alpha and shading ink are the two highest-ROI drawing modes missing from JellySprite. Both are isolated to the drawing engine layer and require no architectural change — just a new scalar in ToolStore and a rendering branch in pixelOps.

### Design assumptions challenged

| Assumption                                                         | Verdict                                                                                                                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The drawing engine only needs one paint mode (alpha-composite)     | ❌ Wrong for retro pixel art. Lock alpha (recolor without changing transparency) and shading ink (shift pixels along a palette ramp) are daily-use tools. |
| Ink mode should be a per-tool setting                              | ⚠️ Debatable. Aseprite makes it global (context bar). Simpler — go global for now; per-tool is a future refinement.                                       |
| Palette ramp selection for shading needs a separate data structure | ✅ Correct. The shading ramp is a user-selected ordered subset of palette colors. Store as `shadingRamp: string[]` in ToolStore.                          |

### Tasks

#### 17a — Add `inkMode` to ToolStore ✅ (pending)

Add `inkMode: "simple" | "lock-alpha" | "shading"` to `tool.types.ts`, `jellySpriteActions.js`, `jellySpriteReducer.js`, `jellySpriteInitialState.js`, and the Zustand `useToolStore`. Default: `"simple"`.

Also add `shadingRamp: string[]` (ordered palette color selection used by shading ink) to the same stores. Default: `[]`.

#### 17b — Lock Alpha ink in drawing engine ✅ (pending)

When `inkMode === "lock-alpha"`: strokes replace only the RGB channels of existing pixels. Alpha is read from the layer buffer, not the brush. Pixels with `alpha === 0` are never touched — the ink cannot paint on transparent areas.

Implementation: in `compositePixelConstrained` / `stampBrush` in `pixelOps.js`, add an `inkMode` branch. If `lock-alpha`: write `[srcR, srcG, srcB, existingA]` — only when `existingA > 0`.

#### 17c — Shading ink ✅ (pending)

The shading ink shifts a pixel's color one step along `shadingRamp` on each stroke pass. Left-click moves the pixel toward the start of the ramp (darker); right-click toward the end (lighter). A pixel whose color is not in the ramp is not affected.

- Add `SET_SHADING_RAMP` action dispatched from palette panel when user shift-clicks to select a run of palette swatches.
- In `drawingEngine.js` `applyBrushAt`, when `inkMode === "shading"`: read the pixel's current color, find its index in `shadingRamp`, increment/decrement, write the new palette color.
- The shading ramp selection UI lives in the Palette tab: shift-click a swatch to start the ramp, shift-click another to extend it.

#### 17d — Ink picker UI ✅ (pending)

Add an ink-mode row to `LeftToolbar.jsx` below the existing tool groups (or as a compact 3-button row in the Draw section). Three buttons: `S` (simple), `⍻` (lock alpha), `◑` (shading). Active mode highlighted.

For shading ink, show a visual ramp strip in the Palette panel when that mode is active so the user can see the selected gradient.

### Rules compliance

| Rule                 | Impact                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| 14 — engine pure     | All ink logic goes in `pixelOps.js` / `drawingEngine.js`. ToolStore holds the mode scalar only. |
| 3 — no derived state | `shadingRamp` is explicit user data, not derived from palette.                                  |

### Enforcement greps (run before close)

```bash
# inkMode must never be read outside the engine layer
grep -rn "inkMode" src/ | grep -v "store\|engine\|toolbar\|panel"

# shadingRamp must not be mutated outside ToolStore actions
grep -rn "shadingRamp" src/ | grep -v "store\|engine\|panel"

# Build gate
npm run build
```

### Commit order

```
1. 17a — inkMode + shadingRamp in ToolStore
2. 17b — Lock Alpha ink in pixelOps + drawingEngine
3. 17c — Shading ink in drawingEngine + palette ramp selection UI
4. 17d — Ink picker UI in LeftToolbar
5. npm run build + enforcement greps
6. Commit: "feat: Sprint 17 — ink system (lock alpha + shading)"
```

---

## Sprint 18 — Drawing Quality + Onion Skin Upgrade

**Status:** 🔲 Not started  
**Origin:** Aseprite parity audit. Pixel perfect mode and onion skin improvements are independent of Sprint 17 and lower-risk — both are rendering-only changes with no schema impact.

### Design assumptions challenged

| Assumption                                       | Verdict                                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pixel perfect is complex to implement            | ✅ False. The algorithm is a post-stroke filter: walk the bresenham line and remove any pixel that has two already-painted neighbours at a corner — about 20 lines. |
| Onion skin depth should be a per-frame concept   | ❌ Wrong. It's a global view preference, same as Aseprite. Store in ToolStore as `onionPrev: number`, `onionNext: number`.                                          |
| Red/blue tint requires a second compositing pass | ✅ True but cheap — draw prev frames with a red color-matrix, next frames with blue (canvas globalCompositeOperation + CSS filter, or tint in compositeEngine).     |

### Tasks

#### 18a — Pixel Perfect freehand mode

Add `pixelPerfect: boolean` to ToolStore (default `false`). When enabled during freehand pencil strokes: after each new pixel is stamped, check if the previous pixel forms an "L-bend" with the one before it (two pixels that could both be removed without breaking connectivity). If so, erase the redundant one. This is the canonical pixel-perfect algorithm.

Affects: `drawingEngine.js` `onPointerMove` for pencil tool only. No pixelOps changes needed — it's a stroke post-filter.

UI: Toggle button in LeftToolbar pencil-mode section (or auto-show when pencil is active).

#### 18b — Configurable onion skin depth

Add `onionPrev: number` and `onionNext: number` to `jellySpriteInitialState` + actions + reducer. Default `1` each (preserves current behavior). Range 0–5.

In `CanvasArea.jsx` compositing / onion render: render `onionPrev` previous frames at decreasing opacity, `onionNext` next frames at decreasing opacity.

UI: Two number spinners in the frame-strip controls area (visible when onion skinning is on).

#### 18c — Red/blue onion skin tinting

Prev frames tinted red (`rgba(255,0,0,0.4)` overlay), next frames tinted blue (`rgba(0,100,255,0.4)` overlay). Replace the current single-opacity ghost with color-coded ghosts. Classic animation industry convention.

Add `onionTint: boolean` to ToolStore. Default `true`. Toggle button next to the onion toggle.

### Commit order

```
1. 18a — pixel perfect mode in drawingEngine + toolbar toggle
2. 18b — onionPrev / onionNext depth controls
3. 18c — red/blue onion tint
4. npm run build + enforcement greps
5. Commit: "feat: Sprint 18 — pixel perfect + onion skin upgrade"
```

---

## Sprint 19 — Color Adjustments

**Status:** 🔲 Not started  
**Origin:** Aseprite parity audit. Color adjustment operations (HSL, brightness/contrast, replace color) are edit commands applied to a layer's pixel buffer. None require schema changes.

### Design assumptions challenged

| Assumption                                       | Verdict                                                                                                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color adjustments belong in the drawing engine   | ❌ No. They are one-shot buffer transforms, not stroke operations. They belong as standalone pure functions in a new `src/features/jelly-sprite/engine/adjustments.js` file. |
| These need a non-destructive/layer-effect system | 🔲 Deferred. Apply destructively (to the pixel buffer) and push to undo history. Non-destructive adjustment layers are Sprint 22+ territory.                                 |

### Tasks

#### 19a — Hue / Saturation / Lightness

Pure function `adjustHSL(buf, w, h, dH, dS, dL, sel, selMask)`. Converts each pixel to HSL, applies delta, converts back. Respects selection.

UI: Modal (or inline panel) with three sliders. Accessible from a new right-click context menu on the Layers panel or an Edit menu in the canvas toolbar.

#### 19b — Brightness / Contrast

Pure function `adjustBrightnessContrast(buf, w, h, brightness, contrast, sel, selMask)`. Standard per-channel linear remap.

UI: Two sliders in the same adjustment modal/panel as 19a (tabbed or stacked).

#### 19c — Replace Color

Pure function `replaceColor(buf, w, h, fromHex, toHex, tolerance, sel, selMask)`. Walks all pixels; if `colorsMatchTolerance(pixel, from, tol)` → replace with `to`. Tolerance 0–255 slider.

UI: FG/BG color pair display with a swap button + tolerance slider in the adjustment panel.

### Commit order

```
1. 19a — HSL adjustment function + modal UI
2. 19b — Brightness/Contrast (extend the same modal)
3. 19c — Replace Color
4. npm run build + enforcement greps
5. Commit: "feat: Sprint 19 — color adjustments (HSL, brightness, replace color)"
```

---

## Sprint 20 — Drawing Tool Expansion

**Status:** 🔲 Not started  
**Origin:** Aseprite parity audit. Curve, polygon, and gradient tools are the main drawing primitives we lack. Each is an isolated addition to `pixelOps.js` + `drawingEngine.js` + `jellySprite.constants.js`.

### Design assumptions challenged

| Assumption                                    | Verdict                                                                                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Bézier curves require a new interaction model | ✅ True. Click endpoints first, then drag control points in a second phase. Need to add a "control point drag" state to drawingEngine. |
| Gradient needs a new tool or can reuse fill   | ❌ New tool. Fill flood-fills a region; gradient fills it with a ramp. Different interaction (drag to set direction).                  |

### Tasks

#### 20a — Curve tool (cubic Bézier)

Four-point interaction: click start, click end, then drag two control point handles. On commit, rasterize with De Casteljau subdivision into bresenham pixels. Add to TOOL_GROUPS as `{ id: "curve", icon: "⌒", title: "Curve (shift+L)" }`.

#### 20b — Polygon tool

Click to place vertices; double-click or press Enter to close and stroke/fill. Store in-progress vertices in drawingEngine local state. On close, run scanline polygon fill (reuse `buildPolygonMask` already in `selectionUtils.js`). Add to TOOL_GROUPS.

#### 20c — Contour tool

Freehand closed-shape drawing. Like lasso select but draws instead of selects. On pointer-up, auto-closes the path back to the start point and strokes/fills. Mostly reuses the existing lasso path logic.

#### 20d — Gradient fill

Drag to define direction and extent. Two modes: linear and radial. Fills selection (or full canvas) with a smooth ramp from FG to BG color. Rasterizes by computing each pixel's position along the gradient axis.

### Commit order

```
1. 20a — Curve tool
2. 20b — Polygon tool
3. 20c — Contour tool
4. 20d — Gradient fill
5. npm run build + enforcement greps
6. Commit: "feat: Sprint 20 — curve, polygon, contour, gradient tools"
```

---

## Sprint 21 — Advanced Timeline

**Status:** 🔲 Not started  
**Origin:** Aseprite parity audit. Cel-level opacity and linked cels require the most careful design — they touch the pixel document data model. Per-frame ticks editing in the JellySprite frame strip fills the gap between the editor and the Animator.

### Design assumptions challenged

| Assumption                              | Verdict                                                                                                                                                                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Cel opacity can reuse layer opacity     | ❌ Layer opacity is per-layer global. Cel opacity is per (layer, frame) — a 2D grid value. Needs a new `celOpacity: Record<layerId, Record<frameId, number>>` field in the pixelDocument state.                                                                            |
| Linked cels are just a copy on save     | ❌ Wrong. A linked cel is a live reference — editing it in one frame also edits the others. Requires storing a `linkedTo: frameId                                                                                                                                          | null` pointer on the layer-per-frame structure and routing brush writes to all linked frames. |
| Per-frame ticks editing is a big change | ✅ False. JellySprite frames already have an `id` field. Add a `ticks: number` field (default 1) to `makeFrame()`, surface an editable input on double-click in the frame strip, dispatch `UPDATE_FRAME_TICKS`. The Animator already reads ticks from its own frame model. |

### Tasks

#### 21a — Editable per-frame ticks in JellySprite

Add `ticks: number` to each frame in `jellySpriteInitialState` (default `1`). Add `UPDATE_FRAME_TICKS` action. Double-click a frame thumb in `CanvasArea.jsx` to open an inline number input. The global FPS control becomes the "tick rate" (ticks per second), making the two controls orthogonal: FPS sets the clock; ticks per frame sets how many clock steps each frame holds.

#### 21b — Cel opacity

Add `celOpacity: Record<string, Record<string, number>>` to pixelDocument state (keyed by `[layerId][frameId]`, default `1.0`). In `compositeEngine.js`, when blending layer pixels, multiply by `celOpacity[layerId][frameId] ?? 1`. UI: slider in a cel properties popover (right-click on frame thumb while a layer is active).

#### 21c — Linked cels

Add `linkedCel: Record<string, Record<string, string | null>>` to pixelDocument (keyed `[layerId][frameId]`, value is the `frameId` of the source frame). When drawing on a linked cel, route the write to the source frame's buffer too (or vice versa — all cels in a link group stay identical). UI: right-click frame thumb → "Link to previous frame" / "Unlink".

### Commit order

```
1. 21a — per-frame ticks in JellySprite editor
2. 21b — cel opacity
3. 21c — linked cels
4. npm run build + enforcement greps
5. Commit: "feat: Sprint 21 — advanced timeline (ticks, cel opacity, linked cels)"
```

---

## Sprint 16 — Crash Fix, Dead Code & Rough Edges

**Status:** ✅ Complete  
**Origin:** Post-Sprint-15 usability audit + canvas resize crash reported by user.

### Design assumptions challenged

| Assumption                                                                     | Verdict                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `justRestoredRef` fast-path is always safe to take                             | ❌ Wrong. When a saved sprite has the same dimensions as the initial default state, `LOAD_JELLY_STATE` doesn't change `canvasW/H`, so the flag is never cleared. The first user-triggered resize takes the fast path and skips buffer rebuild → `ImageData` crash. |
| `useDrawingTools.js` is still in use                                           | ❌ Dead code. Removed in Phase G. Only two comment references remain in `JellySprite.jsx`.                                                                                                                                                                         |
| Drawing engine code can safely read canvas dimensions from `refs.doc` directly | ⚠️ It can, but must be discouraged. The canonical source is `usePixelDocumentStore.getState()`. Mixing read sources causes stale-dimension crashes during resize. Write formal rules to prevent regression.                                                        |
| `collectSaveData` closure is always fresh                                      | ❌ Wrong. Registered via `useEffect([], [])` so `canvasW/H` are captured at mount time. Late-loaded page data may arrive after mount. See 16c.                                                                                                                     |

### Bugs fixed

| #   | Description                                                                                                                                 | Root cause                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `ImageData` crash when resizing canvas after opening a sprite whose saved dimensions match the initial default (e.g. 32×32 → 32×32 on load) | `justRestoredRef.current` set `true` in restore branch; never cleared because `LOAD_JELLY_STATE` doesn't change `canvasW/H`; next resize hits fast path which skips `freshBuffers` / `pendingResizeDataRef` → mismatch |
| B2  | "Failed to save sprite" `ImageData` crash on save                                                                                           | `generateFrameThumbnail` + `collectSaveData` read `canvasW/H` from the first-render React closure. `setCollectFn` registered on mount so stale dimensions were always used if canvas size differed from initial state. |
| B3  | `LoginPage` — React warning: "Cannot update BrowserRouter while rendering"                                                                  | `navigate("/projects")` called synchronously in render body. Moved to `useEffect([isAuthenticated])`.                                                                                                                  |
| B4  | `useEffect is not defined` error on LoginPage                                                                                               | `useEffect` added to LoginPage but not imported from React.                                                                                                                                                            |
| B5  | 406 errors navigating to Animator as a new/different user                                                                                   | `useDocumentStore` persists the last sprite ID; nav links built from it; `sbLoadSprite` used `.single()` which 406s on 0 rows. Fixed: `.maybeSingle()` + clear persisted ID on auth user change.                       |

### Tasks

#### 16a — Fix canvas resize crash after same-dimension restore ✅

**Root cause:** `justRestoredRef.current` is set `true` in the Phase-2 restore branch so the subsequent `[canvasW, canvasH]` effect (triggered by `LOAD_JELLY_STATE`) can skip the expensive zero-fill. When the saved sprite has the same dimensions as the initial state, `LOAD_JELLY_STATE` does not change `canvasW/H`, so the effect never re-fires and `justRestoredRef` stays `true` forever. The first user-triggered canvas resize then takes the `justRestored` fast path, which resizes `offscreenEl` to the new size but does **not** create `freshBuffers` or apply `pendingResizeDataRef`. `redraw()` is called with `offscreenEl` at `nw×nh` but `refs.doc.pixelBuffers` still at `oldW×oldH×4` → `new ImageData(data, nw, nh)` throws.

**Fix (`JellySprite.jsx`):** Guard the `justRestored` fast path with `!pendingResizeDataRef.current`. If a pending resize exists the user triggered a manual resize after a restore — clear the flag then fall through to the normal resize path so buffers are properly rebuilt.

**Belt-and-suspenders (`compositeEngine.js`):** Add a size guard before `new ImageData(drawData, w, h)` that skips layers whose buffer length doesn't match `4 × w × h`. This catches any future resize/restore timing edge cases silently rather than crashing.

#### 16b — Delete dead `useDrawingTools.js`

`src/features/jelly-sprite/hooks/useDrawingTools.js` was the pre-Phase-G drawing loop. Phase G replaced it with `drawingEngine.js`. The file is no longer imported anywhere (confirmed: only two comment references in `JellySprite.jsx`). Delete it.

#### 16c — Fix stale `collectSaveData` closure

`collectSaveData` is registered in `usePixelDocumentStore` via `useEffect([], [])` at mount time. The closure captures `canvasW`, `canvasH`, and other scalars as they were on the **first render**. If the canvas is resized before the save, `generateFrameThumbnail` inside `collectSaveData` uses the stale dimensions and creates wrong-sized thumbnails (though the browser's `ImageData` constructor would throw or silently produce a blank image).

**Fix:** Replace the captured closure values with live reads inside `collectSaveData`. Use `ss.canvasW` / `ss.canvasH` (from the reducer state object available through the ref pattern) or read `refs.doc.canvasW` / `refs.doc.canvasH` at call time rather than closing over the outer `canvasW`/`canvasH` constants.

#### 16d — Fix `pickAndLoadSpriteFile` cancel hang ✅

When the user opens the sprite-import file picker and cancels, the promise never resolved — the `change` event never fires on cancel and the old implementation had no fallback.

**Fix (`serialization.js`):** Added `window:focus` listener (once) after `input.click()`. When the dialog closes — cancel or confirm — the browser returns focus to the window. After a 300 ms debounce (to allow the `change` event to fire first on confirm), if the promise hasn't settled yet it resolves with `null`. A `settled` flag prevents double-resolution. The old `setTimeout(() => removeChild, 1000)` is replaced by cleanup inside `settle()`.

**Fix (`ProjectsPage.jsx`):** Added `if (!data) return;` guard after `pickAndLoadSpriteFile()` — a `null` result means the user cancelled; skip import silently. Also removed the now-redundant `"No file selected"` error message check.

#### 16e — Cascading delete on project delete ✅

When a project was deleted, sprite **records** in IDB (`SPRITES_STORE`) were never deleted — only the localStorage index entries were removed. On Supabase, only the `projects_v2` row was deleted; `sprites` rows were orphaned (no FK cascade configured).

**Fix (`projects.js`):**

- IDB path: collect orphaned sprite IDs from the sprites index before purging it, then `idbDelete(SPRITES_STORE, id)` for each in parallel.
- Supabase path: call `sbListSprites(projectId)` then `sbDeleteSprite` for each sprite before calling `sbDeleteProject`. Both operations use `.catch(() => {})` guards so a single failing sprite delete doesn't block the project deletion.

#### 16f — Write `TOOL_RULES.md` — drawing engine architecture contract ✅

Formal rules governing all code inside `src/features/jelly-sprite/engine/` and `hooks/`. Prevents future store collisions after architecture changes.

### Rules compliance

| Rule                        | Impact                                                                  |
| --------------------------- | ----------------------------------------------------------------------- |
| 14 — engine pure            | `TOOL_RULES.md` codifies this for the drawing engine layer specifically |
| 19 — migration completeness | Deleting `useDrawingTools.js` removes the last pre-Phase-G drawing code |

### Enforcement greps (run before close)

```bash
# useDrawingTools must be gone
grep -rn "useDrawingTools" src/

# No raw pixelBuffers access outside refs.doc
grep -rn "pixelBuffers\s*=\s*new\|pixelBuffers\[" src/features/jelly-sprite/engine/

# Build gate
npm run build
```

### Commit order

```
1. Fix canvas resize crash — justRestoredRef guard + compositeEngine size guard (16a)
2. Delete useDrawingTools.js (16b)
3. Fix collectSaveData stale closure (16c)
4. Fix pickAndLoadSpriteFile cancel hang (16d)
5. Cascading IDB delete on project delete (16e)
6. Write TOOL_RULES.md (16f)
7. npm run build + enforcement greps
8. Commit: "fix: Sprint 16 — crash fix, dead code & rough edges"
```

### Push record

| Date           | Branch                              | Commits pushed | Range              | Remote                                         |
| -------------- | ----------------------------------- | -------------- | ------------------ | ---------------------------------------------- |
| March 13, 2026 | `feature/jelly-sprite-improvements` | 19             | `e7332ae..536a1f4` | `origin` (GitHub: Rick-Smart/doomjelly-studio) |

---

## Sprint 15 — Data Model Normalization

**Status:** ✅ Complete  
**Origin:** Data model audit — naming schism between save and load paths causes broken exports, overwritten data, and dead legacy code.

### Design assumptions challenged

| Assumption                                                                      | Verdict                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JellySprite should generate and save `animatorBody` (spritesheet) on every save | ❌ Wrong. JellySprite owns `jellyBody`. The Animator owns `animatorBody`. Cross-tool writes destroy the other tool's data (e.g. Animator's animations get erased). |
| `saveSprite` can always write both body columns                                 | ❌ Wrong. Each tool should only update what it owns. `undefined` = "don't touch existing data"; `null` = "explicit clear".                                         |
| `jellySpriteState`/`animatorState` are fine as load-path names                  | ❌ Wrong. Save path uses `jellyBody`/`animatorBody` (matching DB columns). Every boundary crossing requires a rename. One canonical name everywhere.               |
| `AnimatorContext.jsx` and `DocumentContext.jsx` should exist                    | ❌ Both were supposed to be deleted in Sprint 12. Their logic was inlined into the stores. They are dead files.                                                    |
| `body` column in Supabase is needed                                             | ❌ Migration 003 added `jelly_body`/`animator_body`. The `body` column is now dead.                                                                                |
| When the Animator has no `animatorBody`, it shows nothing                       | ❌ The Animator can construct its initial spritesheet from `jellyBody.frames[].flatImage` (frame composite PNGs already stored in jellyBody).                      |

### Bugs fixed

| #   | Description                                                              | Root cause                                                                                              |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| B1  | `exportAnimatorSheet` always throws "No animator sprite sheet saved yet" | Reads `animatorState?.spriteSheet` (Sprint-2-era field); real data is in `animatorBody.sheets[]`        |
| B2  | Export animator button always disabled in ProjectsPage                   | Checks `animatorState?.spriteSheet?.dataUrl` — same dead field                                          |
| B3  | Animator save nulls out `jellyBody` in DB                                | `saveDocument` defaults: `jellyBody = null` wipes existing pixel data on every Animator save            |
| B4  | JellySprite save overwrites Animator's animations with `[]`              | JellySprite writes `animatorBody: { spriteSheet }` — wrong shape AND nukes animations set in Animator   |
| B5  | Upload-new-sprite writes old `animatorBody` shape                        | Passes `animatorBody: { spriteSheet }` (old format) instead of `{ sheets: [...], animations: [], ... }` |
| B6  | `handleAddSheetToAnimator` reads dead field                              | Reads `data.animatorState` (legacy name) — should be `data.animatorBody`                                |

### Tasks

#### 15a — Rename load-path fields throughout (jellySpriteState→jellyBody, animatorState→animatorBody)

- `services/sprites.js:loadSprite` — return `jellyBody`, `animatorBody`
- `services/supabaseApi.js:sbLoadSprite` — same
- `services/documentService.js:loadDocument` — pass through canonical names
- `contexts/useDocumentStore.js` — rename state field and all reducer references
- `contexts/useAnimatorStore.js` — read `payload.animatorBody` in LOAD_PROJECT
- `features/jelly-sprite/JellySprite.jsx` — read `state.jellyBody`
- `services/types.ts` + `contexts/document.types.ts` — update `DocumentRecord` / `DocumentState`
- `services/serialization.js` — rename exported JSON field `jellySpriteState` → `jellyBody`

#### 15b — Partial update: `undefined` = "don't touch" in saveSprite / sbSaveSprite / saveDocument

- `saveDocument` params: `jellyBody = undefined, animatorBody = undefined` (was `null`)
- `saveSprite` / `sbSaveSprite`: if `jellyBody`/`animatorBody` is `undefined` (not in payload), load existing record and merge before writing
- IDB: read-modify-write merge. Supabase: only include changed columns in upsert row.

#### 15c — JellySprite never writes animatorBody

- `JellySpriteWorkspace.jsx:handleSave` — remove `animatorBody` from `saveDocument` call
- `collectSaveData()` still generates the spritesheet (used by export), but it is no longer saved to storage

#### 15d — Animator constructs initial sheet from jellyBody when animatorBody is absent

- `animatorSerializer.js` — add `buildSheetFromJellyBody(jellyBody)` async helper: composites `frames[].flatImage` into a horizontal spritesheet, returns a proper `animatorBody` object
- `AnimatorPage.jsx` load effect — if loaded data has no `animatorBody.sheets` but has `jellyBody.frames`, call `buildSheetFromJellyBody`, inject result into LOAD_PROJECT payload

#### 15e — Fix exportAnimatorSheet + ProjectsPage export enable check

- `spriteExport.js:exportAnimatorSheet` — read `animatorBody.sheets?.[0]` not `animatorState?.spriteSheet`
- `ProjectsPage.jsx` — fix export enable: `animatorBody?.sheets?.length > 0`
- `ProjectsPage.jsx:handleAddSheetToAnimator` — read `data.animatorBody` not `data.animatorState`
- `ProjectsPage.jsx` LOAD_PROJECT dispatch — write correct `animatorBody` shape for upload path
- `ProjectsPage.jsx` other `jellySpriteState`/`animatorState` references — rename

#### 15f — Delete dead context files

- Delete `src/contexts/AnimatorContext.jsx` (logic inlined in useAnimatorStore.js since Sprint 12)
- Delete `src/contexts/DocumentContext.jsx` (logic inlined in useDocumentStore.js since Sprint 12)

#### 15g — Migration 004: drop body column

- `supabase/migrations/004_drop_body_column.sql`

### Rules compliance

| Rule                                 | Impact                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 3 — no state.spriteSheet             | Sprint 15d removes the legacy `as.spriteSheet` read path from LOAD_PROJECT                                    |
| 11 — no cross-feature imports        | JellySprite no longer writes Animator-format data. Clean tool separation.                                     |
| 13 — selectors for shared derivation | No new duplications introduced                                                                                |
| 14 — engine pure                     | `buildSheetFromJellyBody` uses DOM canvas — goes in `animatorSerializer.js` (feature file), not `src/engine/` |
| 15 — services I/O only               | `saveSprite` read-modify-write is pure I/O                                                                    |
| 19 — migration completeness          | Grep `jellySpriteState` and `animatorState` across `src/` → 0 after this sprint                               |

### Enforcement greps (run before close)

```bash
# 0 results expected for all:
grep -rn "jellySpriteState" src/
grep -rn "animatorState" src/
grep -rn "spriteSheet" src/services/ src/features/animator/
grep -rn "AnimatorContext\|DocumentContext" src/
```

### Commit order

```
1. Rename jellySpriteState/animatorState throughout (15a)
2. Partial update in saveSprite + saveDocument (15b)
3. JellySprite stops writing animatorBody (15c)
4. buildSheetFromJellyBody + AnimatorPage load path (15d)
5. Fix exportAnimatorSheet + ProjectsPage export/upload (15e)
6. Delete AnimatorContext.jsx + DocumentContext.jsx (15f)
7. Migration 004 (15g)
8. npm run build + enforcement greps
9. Commit: "fix: Sprint 15 — data model normalization"
```

---

## Sprint 14 — Full Ruleset Compliance Pass

**Status:** 🔴 Not started  
**Origin:** Full codebase Rules 1–20 audit run after Sprint 13 (`4ed5a9b`).

### Design assumptions challenged

| Assumption                                                  | Verdict                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Keep `selectors.js` inside `src/features/animator/`         | ❌ Wrong. `ExportPanel` can't import it without violating Rule 11. Move to `src/contexts/`. |
| Checkerboard raw hex is "rendering not design" — acceptable | ⚠️ Borderline. Rule 18 applies to all CSS. Add tokens and resolve it.                       |
| `#f0a020` amber is a one-off JellySprite colour             | ❌ Wrong. Appears 12+ times with inline `color-mix()`. Needs a named token.                 |

---

### 14a — Move `selectors.js` to the shared context layer (Rule 13)

**Problem:** `src/features/animator/selectors.js` is imported by 8 files inside `src/features/animator/`. `ExportPanel` (in `src/features/export/`) needs `selectActiveSheet` + `selectActiveAnimation` but can't import them without violating Rule 11. It currently re-implements the same `.find()` inline.

**Fix:**

1. Move to `src/contexts/animatorSelectors.js` (alongside `useAnimatorStore.js`)
2. Update all existing imports: `from "../selectors"` → `from "../../../contexts/animatorSelectors.js"`
3. Update `ExportPanel.jsx` to import from the new shared path and remove inline `.find()` duplicates

**Files:** `src/contexts/animatorSelectors.js` (new), 8 animator consumers, `src/features/export/ExportPanel/ExportPanel.jsx`

---

### 14b — Add transparency-checker tokens + replace checkerboard raw hex (Rule 18)

**Problem:** `repeating-conic-gradient(#aaa 0% 25%, #fff 0% 50%)` appears in multiple CSS files with no named tokens.

**Add to `src/index.css`:**

```css
/* Transparency checkerboard — used for canvas/alpha visualisation */
--checker-light: #fff;
--checker-mid: #aaa;
--checker-dark-1: #555;
--checker-dark-2: #333;
```

**Replace in:** `ColorPicker.css` (×2 — alpha slider, preview swatch), `JellySprite.css` (×2 — canvas bg), `FrameRow.css` (×1 — dark variant `#333 #555`).

Also fix `var(--cp-color, #000)` in `ColorPicker.css` → `var(--cp-color, var(--text))`.

**Files:** `src/index.css`, `ColorPicker.css`, `JellySprite.css`, `FrameRow.css`

---

### 14c — Add `--warning-amber` token + replace `#f0a020` in JellySprite.css (Rule 18)

**Problem:** `#f0a020` hard-coded 12+ times in `JellySprite.css`, including inline `color-mix(in srgb, #f0a020 ...)` literals.

**Add to `src/index.css`:**

```css
--warning-amber: #f0a020;
--warning-amber-tint-soft: color-mix(
  in srgb,
  var(--warning-amber) 20%,
  var(--surface2)
);
--warning-amber-tint-mid: color-mix(
  in srgb,
  var(--warning-amber) 18%,
  var(--surface2)
);
--warning-amber-tint-surface: color-mix(
  in srgb,
  var(--warning-amber) 18%,
  var(--surface)
);
```

**Files:** `src/index.css`, `src/features/jelly-sprite/JellySprite.css`

---

### 14d — Feature CSS sweep: `#fff` → `var(--color-on-accent)` (Rule 18)

| File                   | Line(s)                                      | Context            |
| ---------------------- | -------------------------------------------- | ------------------ |
| `AnimationSidebar.css` | 93                                           | accent button text |
| `AnimatorPage.css`     | 40                                           | accent button text |
| `SequenceBuilder.css`  | 63, 156                                      | accent button text |
| `LoginPage.css`        | 55                                           | accent button text |
| `ExportPanel.css`      | 151                                          | accent button text |
| `JellySprite.css`      | 96, 131, 406, 622, 626, 709, 819, 1208, 1234 | filled button text |
| `ProjectsPage.css`     | 269, 284, 532, 547                           | accent button text |
| `SettingsPage.css`     | 330, 345                                     | accent button text |

`SheetList.css` and `SpriteImporter.css` have hex inside `var()` fallbacks only — tokens are defined in `src/index.css` so the hex never renders; strip the fallbacks entirely.

**Files:** 8 feature CSS files above

---

### 14e — ErrorBoundary.css: strip dead var() fallbacks (Rule 18)

All tokens referenced in `ErrorBoundary.css` (e.g. `var(--bg, #1a1a2e)`, `var(--danger, #e05c5c)`) are defined in `src/index.css`. The raw hex fallbacks are dead code. Replace `var(--token, #hex)` → `var(--token)` throughout.

**Files:** `src/ui/ErrorBoundary/ErrorBoundary.css`

---

### 14 commit order

```
1. Move selectors.js → src/contexts/animatorSelectors.js + update all imports (14a)
2. Add --checker-* tokens + replace checkerboard hex in 4 files (14b)
3. Add --warning-amber token + replace #f0a020 in JellySprite.css (14c)
4. Replace #fff with var(--color-on-accent) in 8 feature CSS files (14d)
5. Strip dead var() fallbacks from ErrorBoundary.css (14e)
6. npm run build + full Rules 1–20 enforcement checklist
7. Commit: "fix: Sprint 14 — full ruleset compliance pass"
```

---

## Sprint 13 — Navigation Integrity + Creative Flow

**Commit:** `aaa3e58` ✅ Complete — March 13, 2026

### Design assumptions challenged

| Assumption                                           | Verdict                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| "Editors are self-loading via URL param"             | ✅ Kept — but the load guard was using the wrong store (`documentStore` which persists vs `animatorStore` which doesn't). |
| "ProjectsPage should pre-dispatch before navigating" | ❌ Rejected — editors own their own loading (Rules 1, 7). Pre-dispatch was poisoning the AnimatorPage guard.              |
| "Users start at Projects to open anything"           | ❌ Rejected — the JellySprite → Animator → JellySprite loop must be one click at every step.                              |

### Bugs fixed

| #   | Description                                            | Root cause                                                                               |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| B1  | Animator blank screen after "Animator →" from Projects | Guard checked `documentStore.id` only; animator store (not persisted) stayed empty       |
| B1b | Animator blank on browser refresh at `/animator/:id`   | `documentStore` persists `id` to localStorage; guard fired before animator was populated |
| B2  | JellySprite blank canvas until Save clicked            | Render condition required `state.id` even for new-sprite mode (no URL param)             |
| B3  | `handleAddSheetToAnimator` silently broken             | Dispatched `ADD_SHEET` to `useDocumentStore` which has no such action — silently ignored |

### Changes

| Task                           | File                                 | What changed                                                                                                                                |
| ------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 13a — AnimatorPage load guard  | `AnimatorPage.jsx`                   | Guard now also requires `sheets.length > 0 \|\| animations.length > 0` before skipping load                                                 |
| 13b — ProjectsPage handlers    | `ProjectsPage.jsx`                   | Removed pre-dispatches from `handleOpenInAnimator` + `handleOpenSprite`; fixed `handleAddSheetToAnimator` to dispatch to `useAnimatorStore` |
| 13c — JellySprite blank canvas | `JellySpriteWorkspace.jsx`           | Render condition fixed to `\|\| !spriteId`; `RESET_DOCUMENT` dispatched on new-sprite mount                                                 |
| 13d — AppShell nav link        | `AppShell.jsx`                       | Animator link uses `stateId ? /animator/${stateId} : /animator`                                                                             |
| 13e — Open in Animator button  | `JellySpriteWorkspace.jsx`           | Added toolbar button; `handleOpenInAnimator` saves first (Rule 4) then navigates                                                            |
| 13f — SpritePicker             | New `SpritePicker/`, `SheetList.jsx` | Inline project/sprite tree replaces navigate-away "Open from Projects ↗" link                                                               |
| Rule 4 patch                   | `JellySpriteWorkspace.jsx`           | `handleSave()` now returns persisted id; `handleOpenInAnimator` always saves before navigating                                              |
| Rule 18 patch                  | `SpritePicker.css`                   | Removed raw hex fallbacks from `var()` expressions                                                                                          |

### Rules 1–20 audit (post-commit)

| Rule                               | Result                  | Notes                                                   |
| ---------------------------------- | ----------------------- | ------------------------------------------------------- |
| 1 — URL identity                   | ✅                      |                                                         |
| 2 — dataUrl canonical              | ✅                      |                                                         |
| 3 — no state.spriteSheet           | ✅                      |                                                         |
| **4 — await save before navigate** | **was ❌ → patched ✅** | Two violations in `handleOpenInAnimator` — see below    |
| 5 — canonical save format          | ✅                      |                                                         |
| 6 — no binary in localStorage      | ✅                      |                                                         |
| 7 — first-save URL update          | ✅                      |                                                         |
| 8 — ProtectedRoute renders         | ✅                      |                                                         |
| 9 — localStorage try/catch         | ✅                      |                                                         |
| 10 — no bare editor navigate       | ✅                      |                                                         |
| 11 — no cross-feature imports      | ✅                      | SpritePicker imports from contexts/services only        |
| 12 — barrel exports                | ✅                      | SpritePicker is feature-internal                        |
| 13 — selectors                     | ✅                      | No new duplicate derivations in this sprint             |
| 14 — engine pure                   | ✅                      |                                                         |
| 15 — services I/O only             | ✅                      |                                                         |
| 16 — undoable operations           | ✅                      | No new undoable actions                                 |
| 17 — lazy loading                  | ✅                      | SpritePicker is a component, not a page                 |
| **18 — CSS design tokens**         | **was ⚠️ → patched ✅** | SpritePicker.css had raw hex in var() fallbacks         |
| 19 — migration completeness        | ✅                      | animatorDispatch used in one place only                 |
| 20 — UI extraction                 | ✅                      | SpritePicker used in 1 place → correctly in feature dir |

**Rule 4 violations found and patched (`aaa3e58`):**

- **Violation A:** `handleOpenInAnimator` when `!targetId` — called `await handleSave()` then `return`, so the user saved but stayed in JellySprite. Navigation to Animator never happened.
- **Violation B:** `handleOpenInAnimator` when `targetId` exists — called `navigate()` with no save guard. Unsaved pixel work was abandoned; a subsequent Animator save would write `jellyBody: null`.

**Fix:** `handleSave()` now returns the persisted id (or `null` on failure). `handleOpenInAnimator` always calls `handleSave()` first, then navigates to `/animator/:savedId` only on success.

---

## Sprint History (0–12)

<details>
<summary><strong>Sprint 0 — Data Stability</strong> &nbsp;·&nbsp; <code>92997f7</code></summary>

**Goal:** Eliminate the entire class of data and navigation bugs every new feature was fighting.

**Bugs fixed:**

- Dead auto-save (`getSheetDataUrl` → `buildAnimatorBody`)
- Base64 sheets written to localStorage on every keystroke
- JellySprite first-save not updating URL (refresh = blank canvas)
- "Edit in JellySprite" navigating without ID
- `ProtectedRoute` returning `null` during auth check (blank flash)

**Rules introduced:** Rules 1–10 (see [Rules Reference](#rules-120-reference)).

**Commits:** `908ba2d`, `92997f7`

</details>

---

<details>
<summary><strong>Sprint 1 — Foundation Cleanup</strong> &nbsp;·&nbsp; <code>b5fda67</code></summary>

**Goal:** Eliminate duplication, ship shared infrastructure, add lazy loading. No new user-visible features.

**Deliverables:**

- CSS design tokens added to `src/index.css` (`--accent-tint-*`, `--cell-min-w`, `--danger`, etc.)
- `FrameThumb` shared component extracted (was duplicated in 3 files)
- `useDragReorder` hook extracted (was duplicated in 3 files)
- `compact` prop added to `NumberInput` and `Select` — removed per-callsite CSS overrides
- `SheetViewerCanvas` accent color reads from CSS variable (was hardcoded Tailwind hex)
- `src/features/animator/selectors.js` created — `selectActiveSheet`, `selectActiveAnimation`
- Route-level lazy loading added to `routes.jsx`

**Rules introduced:** 11, 12, 13, 17, 18.

</details>

---

<details>
<summary><strong>Sprint 2 — Monolith Decomposition</strong> &nbsp;·&nbsp; <code>d8033f9</code></summary>

**Goal:** `AnimatorPage.jsx` was 814 lines. Split into focused modules. `projectService.js` split into 6 services.

**Deliverables:**

- `animatorSerializer.js` extracted (async serialization, no React deps)
- `useAnimatorKeyboard.js` hook extracted (~95 lines)
- `SheetList` extracted to its own directory
- `SplitButton` extracted to `src/ui/SplitButton/` (generic save-with-dropdown)
- `EditableTitle` extracted to `src/ui/EditableTitle/`
- `projectService.js` split into: `projects.js`, `sprites.js`, `idb.js`, `localIndex.js`, `serialization.js`, `documentService.js`
- `AnimatorPage.jsx` reduced to ~150 lines (layout only)

**Rules introduced:** 15, 20.

</details>

---

<details>
<summary><strong>Sprint 3 — Feature Contract Enforcement</strong> &nbsp;·&nbsp; <code>86e3b26</code></summary>

**Goal:** Enforce feature isolation and promote shared engine utilities.

**Deliverables:**

- ESLint rule added to enforce Rule 11 (no cross-feature imports)
- `src/engine/frameUtils.js` created — shared pure frame geometry functions
- `tools` metadata field added to sprite records
- Supabase auto-project assignment implemented

**Rules introduced:** 14.

</details>

---

<details>
<summary><strong>Sprint 4 — Context Decomposition</strong> &nbsp;·&nbsp; <code>ac647ed</code></summary>

**Goal:** Split `ProjectContext` monolith into two purpose-built contexts.

**Deliverables:**

- `AnimatorContext` created with its own reducer (`sheets[]`, `animations[]`, undo/redo)
- `DocumentContext` created (shared identity: `id`, `name`, `projectId`)
- `ProjectContext` slimmed to a re-export shim (resolved next sprint)
- All animator consumers migrated to `useAnimator()`
- `AnimatorProvider` wired into the app tree

</details>

---

<details>
<summary><strong>Sprint 5 — State Finalization</strong> &nbsp;·&nbsp; <code>625e694</code></summary>

**Goal:** Remove `state.spriteSheet` derived mirror from `AnimatorContext`.

**Deliverables:**

- `spriteSheet: null` removed from `initialAnimatorState`
- All 6 reducer cases stop computing/storing `spriteSheet`
- `SpriteImporter` and `TimelineView` updated to call `selectActiveSheet(state)`
- Rule 3 fully enforced across all consumers

</details>

---

<details>
<summary><strong>Sprint 6 — Unified Document Model</strong> &nbsp;·&nbsp; <code>5be735c</code></summary>

**Goal:** JellySprite and Animator become two live views of one shared document (metadata layer only).

**Design decision:** Full pixel unification deferred — JellySprite's `refs.frameSnapshots` lives outside React; migrating pixel buffers into `DocumentContext` would cause catastrophic performance regression. Sprint 6 unifies metadata; Sprint 7 unifies the data layer.

**Deliverables:**

- `DocumentContext` created with unified document shape (`frames[]`, `layers[]`, `tags[]`, `canvasW/H`)
- JellySprite pushes metadata to `DocumentContext` on change
- Animator pushes `animations[]` as `tags[]` when animations change
- `src/services/documentService.js` created — `saveDocument()` / `loadDocument()`
- `serialiseProject()` and `SET_JELLY_SPRITE_DATA` handoff artifacts removed

</details>

---

<details>
<summary><strong>Sprint 7 — JellySprite PixelDocument Refactor</strong> &nbsp;·&nbsp; <code>15ee57a</code></summary>

**Goal:** Extract JellySprite's pixel engine out of the React component tree into a standalone `PixelDocument` class.

**Design decision:** React is the correct UI shell. The mistake was storing mutable pixel buffers in the component tree. Correct model: React owns panels/toolbars; `PixelDocument` (plain JS class) owns all pixel data. Same pattern as Excalidraw.

**Deliverables:**

- `PixelDocument.js` class created (`engine/`) — frames, layers, pixel buffers, history, serialization, observer pattern
- `ToolContext` extracted — tool settings, brush, colors, palettes; persisted independently
- `JellySprite.jsx` migrated to call `PixelDocument` methods (was accessing `refs.pixelBuffers` directly)
- `drawingEngine.js` updated to use `PixelDocument`
- `JellySpriteProvider.refs` largely removed
- `PixelDocument` connected to `DocumentContext` via `onChange` observer
- **Deferred (7e):** `onRegisterCollector` prop and `stateRef` mirror retained — unblocked by Sprint 11

| Sub-sprint                                      | Commit               |
| ----------------------------------------------- | -------------------- |
| 7a (PixelDocument class), 7b (ToolContext)      | `dc4c6d9`            |
| 7c (migration), 7d (DocumentContext connection) | `0aee0f8`, `b6c78a8` |

</details>

---

<details>
<summary><strong>Sprint 8a — Rule Violation Fixes</strong> &nbsp;·&nbsp; <code>dc32ace</code></summary>

**Goal:** Fix accumulated rule violations found during Sprint 8 TypeScript work.

**Fixes:**

- `src/features/auth/index.js` barrel created; `LoginPage` converted from static import to `React.lazy()`
- `AnimatorPage.handleEditInJellySprite` + `ProjectsPage` bare `/animator` fallback navigates → `navigate("/projects")`
- New design tokens added: `--danger-hover`, `--success`, `--warning`, `--text-disabled`, `--surface-alt`, `--color-on-accent`, `--accent-separator`
- Inline `color-mix()` literals in `TracksPanel.css` replaced with tokens
- `Toast.css` `#22c55e` → `var(--success)`, `SplitButton.css` `#fff` → `var(--color-on-accent)`
- `state.sheets.find(...)` + `state.animations.find(...)` duplicates in 7 components replaced with selectors

</details>

---

<details>
<summary><strong>Sprint 8 — TypeScript Migration</strong> &nbsp;·&nbsp; <code>d302053</code></summary>

**Goal:** Add type safety at context and service boundaries without mass `.jsx → .tsx` rename.

**Governance decision:** `allowJs: true` + `checkJs: false` — existing `.jsx` files unmodified. `strict: true` applies only to newly authored `.ts`/`.tsx` files.

**Deliverables:**

- `tsconfig.json` + `tsconfig.node.json` configured
- `vite.config.js → .ts`, `main.jsx → .tsx`
- `src/services/types.ts` — `Layer`, `Frame`, `SheetRecord`, `AnimationRecord`, `AnimatorBody`, `JellyBody`, `ProjectRecord`, `SpriteRecord`, `DocumentRecord`
- `src/contexts/document.types.ts`, `animator.types.ts`
- `src/features/jelly-sprite/store/tool.types.ts`
- `PixelDocument.js → PixelDocument.ts` with full type annotations, `tsc --noEmit` passes clean
- `flatted < 3.4.0` DoS vulnerability fixed

</details>

---

<details>
<summary><strong>Sprint 9 — Zustand State Management</strong> &nbsp;·&nbsp; <code>388f043</code></summary>

**Goal:** Replace React Context + useReducer with Zustand for selector-based subscriptions and simpler testing.

**Governance decision:** `usePixelDocumentStore` (wrapping `PixelDocument`) deferred to Sprint 11 — `PixelDocument` is already non-React; migration risk outweighed benefit at this stage.

**Deliverables:**

- `useToolStore.js` — Zustand + persist, replaces `ToolContext` internal logic
- `useDocumentStore.js` — Zustand + persist (slim identity only), replaces `DocumentContext`
- `useAnimatorStore.js` — Zustand (no persist), full undo/redo (max 50 entries), replaces `AnimatorContext`; cross-store sync `animations → tags` via `useDocumentStore.getState()`
- Existing contexts converted to no-op providers + backward-compat re-export shims (resolved Sprint 10)
- `DocumentProvider`, `AnimatorProvider` removed from `App.jsx`
- Build: 236 modules, 0 errors

</details>

---

<details>
<summary><strong>Sprint 10 — Store Consumer Migration</strong> &nbsp;·&nbsp; <code>8ed4bd7</code></summary>

**Goal:** Resolve all Sprint 9 shims (governance: shims survive one sprint only).

**Deliverables:**

- All 13 animator consumers migrated from `useAnimator()` to `useAnimatorStore()`
- All document/project consumers migrated from `useDocument()` to `useDocumentStore()`
- All tool consumers migrated from `useToolContext()` to `useToolStore()`
- Dead context shell files deleted (`AnimatorContext.jsx`, `DocumentContext.jsx`, `ToolContext.jsx`)
- `UNDOABLE_ACTIONS` audit: sheet operations correctly excluded (binary blob snapshots impractical); all exclusions documented
- Rule 19 established: migration completeness protocol (grep, whole-object check, build gate, smoke-test)

</details>

---

<details>
<summary><strong>Sprint 11 — PixelDocument Store + Sprint 7e Cleanup</strong> &nbsp;·&nbsp; <code>806493b</code></summary>

**Goal:** Create `usePixelDocumentStore` (deferred from Sprint 9), then use it to remove the Sprint 7e artifacts that depended on the store not existing.

**Deliverables:**

- `usePixelDocumentStore.js` — Zustand wrapper around `PixelDocument` instance; `frames[]`, `layers[]`, `canUndo`, `canRedo` mirrored into store for React subscriptions; `doc` instance is authoritative (never serialized into Zustand)
- `drawingEngine.js`, `canvasRenderer.js`, `clipboardOps.js`, `selectionOps.js` — `refs.stateRef.current` replaced with `useToolStore.getState()` + `usePixelDocumentStore.getState()`
- `refs.stateRef` mirror removed from `JellySprite.jsx` and `JellySpriteProvider`
- `onRegisterCollector` prop removed; save flow uses `usePixelDocumentStore.getState().collect()` directly
- Sprint 7e fully resolved

</details>

---

<details>
<summary><strong>Sprint 12 — Service Layer Cleanup</strong> &nbsp;·&nbsp; <code>fb89db4</code></summary>

**Goal:** Resolve 10-sprint-old shims in `projectService.js`; inline context reducers into store files.

**Deliverables:**

- `projectService.js` legacy shim functions verified unused and deleted (`pickAndLoadProject`, `loadProjectFromStorage`, `saveProjectToStorage`)
- `ExportPanel` migrated away from `serialiseProject` → uses `serialiseSprite` directly
- `animatorReducer` inlined into `useAnimatorStore.js` (was in deleted `AnimatorContext.jsx` shell)
- `documentReducer` inlined into `useDocumentStore.js` (was in deleted `DocumentContext.jsx` shell)
- Dead context shell files deleted
- Build: 234 modules, 0 errors

</details>
