# DoomJelly Studio — Plan

**Last updated:** 2026-03-08
**Status key:** ✅ Complete · 🔵 Next · ⬜ Pending · 💭 Wishlist

---

## 🔵 Next — Real Database / Storage Backend

**Why:** Project data currently lives in the browser (IndexedDB for bodies, localStorage for the index). This is fine for solo dev work but can't support multi-device, sharing, or any server-side features.

**Target stack:** Supabase (Postgres + Storage)

| What                       | Details                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Project bodies             | Supabase Postgres via `projectService.js` — only the `idbPut/idbGet/idbDelete` internals need swapping |
| Thumbnails                 | Store alongside index row in Postgres (small base64 PNG)                                               |
| Sprite sheets / pixel data | Supabase Storage bucket                                                                                |
| Auth                       | Already stubbed — `VITE_AUTH_BYPASS=true` for dev; Supabase Auth when ready                            |

**Scope of change:** Only `src/services/projectService.js` internals. The rest of the app calls `saveProjectToStorage`, `loadProjectFromStorage`, `deleteProjectFromStorage` and never cares what's underneath.

---

## 🔵 Next — Planned Refactors

### PR-1 — Extract selection logic out of `drawingEngine.js`

`drawingEngine.js` currently owns all selection tool logic inline. As the selection system grew (per-pixel masks, add/subtract combining, marching ants, move tool), this became the largest concern in the file.

**Target structure:**

| New file                     | Contents                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/selectionUtils.js`   | Pure functions: `buildRectMask`, `buildLassoMask`, `combineMasks`, `boundsFromMask`, `translateMask`. No refs — all take plain args, return plain values. |
| `engine/tools/selectTool.js` | Pointer handlers for `select-rect`, `select-lasso`, `select-wand`. Reads/writes `refs.selectionMask`, calls `setSelection`.                               |
| `engine/tools/moveTool.js`   | Pointer handlers for `move` tool. Owns `movePixels`, `moveOrigin`, `previewSnap` locals. Translates mask on pointer-up.                                   |
| `engine/drawingEngine.js`    | Becomes thin routing only — delegates to the right tool module.                                                                                           |

**Contract to preserve:**

- `setSelection(val, fromMove)` signature unchanged
- `refs.selectionMask` always at current canvas coords after move pointer-up
- Marching ants outline follows moved pixels correctly

---

## ⬜ Pending Features

### Sprite Forge

- [ ] **Wand tolerance UI** — already wired to store; polish the Wand Options panel
- [ ] **Lasso crop** — crop canvas to lasso selection bounding box
- [ ] **Gradient fill tool** — linear/radial gradient within selection or canvas
- [ ] **Text tool** — stamp pixel text (bitmap fonts)
- [ ] **Custom brush shapes** — import PNG as brush stamp
- [ ] **Color replace tool** — replace one color globally or within selection
- [ ] **More blend modes** — Darken, Lighten, Hard Light, Soft Light, Difference
- [ ] **Layer groups / folders** — nest layers under collapsible groups
- [ ] **Per-frame FPS overrides** — each frame can have its own delay
- [ ] **Indexed color mode** — restrict canvas to active palette, no out-of-palette pixels
- [ ] **Asset library panel** — save/reuse stamp assets across projects

### Animator

- [ ] **Preview at native scale** — option to zoom preview canvas to 1×/2×/4×
- [ ] **Easing curves** — per-frame easing for dx/dy offset interpolation
- [ ] **Event timeline** — tag specific frames with game event names (for code integration)
- [ ] **Bone / rigging** — simple pivot-point rigging for character animations

### App / Platform

- [ ] **Project templates** — start from a preset (character sheet, tile set, icon set, etc.)
- [ ] **Cloud sync** — auto-save to Supabase on change
- [ ] **Collaboration** — shared project editing (real-time via Supabase Realtime)
- [ ] **In-app Lospec palette browser** — search/import directly without leaving the app
- [ ] **Sprite preview widget** — embeddable preview link for sharing animations

---

## 💭 Wishlist

- WebGL renderer — move compositing off the CPU for very large canvases
- PWA / offline mode — installable, works without internet
- Mobile / touch support — full pointer event support on tablets
- Plugin API — allow community tools / export formats

---

## ✅ Shipped

### M20 (current sprint — 2026-03-08)

- **Animated GIF export** — export all frames at project FPS as `.gif` (uses `gifenc`, no worker files needed; blob URL download)
- **Export download fix** — `triggerDownload` now appends anchor to DOM before `.click()` (Firefox/Edge fix); PNG and sprite sheet switched from `data:` URL to `toBlob() + URL.createObjectURL()` (Chrome 65+ fix)
- **IndexedDB project storage** — project bodies moved from `localStorage` (5 MB limit) to IndexedDB; small index (IDs, names, dates, thumbnails) stays in localStorage
- **Magic wand tolerance + contiguous/non-contiguous mode** — `wandTolerance` (0–255, default 15) and `wandContiguous` toggle wired to store, drawing engine, and Wand Options UI in selection tab
- **Brush overhaul** — opacity now uses Porter-Duff "over" alpha (no more overwrite); eraser reduces alpha by strength; `brushHardness` (0–100, cosine feather falloff); 4 new brush shapes: Star, Ring, Slash, BSlash; updated BrushThumb previews
- **Canvas resize mask fix** — `resizeMaskBuffer()` uses `Uint8Array(nw*nh)` with single-channel indices (masks are 1-byte/pixel, not 4)

### M19 — Sprite Forge Power Tools

- Full **HSV + RGB + Hex** inline colour picker panel
- Foreground / background colour slots with swap (`X` key)
- Recent colour history row (last 10 used colours)
- User-built custom palettes — add/remove/reorder, name, multiple palettes
- Import Lospec palettes (`.hex`)
- Colour ramp generator — pick two colours → N interpolated steps
- Line, rectangle, ellipse tools (outlined or filled)
- Symmetry mode — mirror strokes across H / V / both axes
- Named layers, drag-to-reorder, hide/lock, per-layer opacity, blend modes (Normal, Multiply, Screen, Add, Overlay)
- Merge down / flatten all
- Frame strip — add / duplicate / delete / reorder frames
- Onion skinning
- Looping playback preview at configurable FPS
- Rectangular selection, lasso, magic wand — move, copy, paste, delete contents
- Add / subtract selection modes
- Flip H/V, rotate 90° CW/CCW, canvas resize (9-point anchor), crop to selection
- Tile preview panel (2×2 / 3×3)
- Reference image overlay
- Export: PNG (active frame), sprite sheet (configurable), frames ZIP, palette `.hex`

### M18 — Sprite Forge MVP + Dual Workspace

- `/jelly-sprite` and `/editor` workspaces as separate nav items
- `JellySpriteWorkspace` — Page with editable title and Save button
- Pixel art canvas — pencil / eraser / flood fill / colour picker tools
- 32-colour fixed palette + native colour input
- Undo/redo — 50-step history stack
- Zoom 1–12× · pixel grid · frame boundary grid
- Four canvas size presets
- Cross-workspace flow: Send to Animator, From Animator, Edit in Forge

### M17 — Export Bundle + Nav Rename

- Export All bundle tab — `.zip` containing JSON + atlas + strips in one click
- Nav "Editor" renamed to "Animator"
- Projects as landing page — `/` redirects to `/projects`
- Logo links to Projects

### M16 — UX Polish

- Project thumbnails (base64 PNG in localStorage index)
- Animation + frame count on project cards
- "Recent" section heading
- Collapsible FrameConfigPanel

### M15 — Preview Resize + Responsive + Drag & Drop

- Preview panel resizable (drag handle, persisted)
- Responsive CSS clamps on panels
- Drag & drop `.doomjelly.json` onto Projects page
- Rename project

### M14 — Image Export: Packed Atlas + Animation Strips

- Export panel: JSON / Packed Atlas / Animation Strips tabs
- Packed Atlas — unique cells → tight grid PNG + JSON
- Animation Strips — per-animation horizontal strip PNG + JSON
- JSZip added

### M13 — Canvas Fit-to-Panel + Keyboard Shortcuts

- `fitToContainer()` replaces zoom-reset
- `Esc` deselects, `A` fills animation from sheet

### M12 — Custom Theme Editor

- Custom theme + 9-variable colour picker, background image upload
- All built-in themes updated

### M11 — Drag-to-Reorder Frames

### M10 — Resizable Panel Dividers

### M9 — Polish P1 + Canvas Zoom/Pan

### M8 — Polish P1

### M7 — Settings Page + Notifications + Projects Page

- `NotificationContext` + `ToastList`
- `/settings` route
- `ProjectsPage` — list, open, delete, download, import, new project
- `projectService.js` — serialise/deserialise `.doomjelly.json`

---

## Architecture Decisions (Locked)

| Decision                  | Choice                                                            |
| ------------------------- | ----------------------------------------------------------------- |
| Framework                 | Vite + React 19                                                   |
| Routing                   | React Router v7                                                   |
| State                     | React Context + useReducer                                        |
| Folder structure          | Feature-based (`src/features/`, `src/ui/`, `src/contexts/`)       |
| Auth                      | Dev bypass via `VITE_AUTH_BYPASS=true`; Supabase when ready       |
| Project storage (current) | IndexedDB (bodies) + localStorage (index) via `projectService.js` |
| Project storage (planned) | Supabase Postgres — only `projectService.js` internals change     |
| File storage              | Object URL stub → Supabase Storage                                |
| Theme                     | `data-theme` on `<html>`, CSS custom properties per theme         |
| Min viewport              | 1024px (tablet landscape+)                                        |
| Deploy                    | GitHub Pages via GitHub Actions on push to `main`                 |
