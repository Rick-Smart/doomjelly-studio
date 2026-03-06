# DoomJelly Studio — Project Roadmap

**Last updated:** 2026-03-06 (M9 complete)  
**Status key:** ✅ Done · 🔄 In Progress · 🔵 Next · ⬜ Pending · 💭 Wishlist

---

## ⚡ NEXT SESSION — Start Here

**P2 items worth tackling next:**

- Resizable panel dividers (ResizablePanel component)
- Preview background custom color picker
- Drag-to-reorder frames (SequenceBuilder)

---

## M9: Polish P1 + Canvas Zoom/Pan (complete)

- Save-success toast wired in `EditorPage.handleSave`
- `useLocalStorage(key, init)` hook — `useState` backed by localStorage, JSON serialised
- `useDebounce(value, ms)` hook — debounced value with configurable delay
- Replace sprite sheet without clearing animations (hidden file input in `SpriteImporter`)
- Canvas zoom (scroll wheel, + / − buttons) and pan (Space+drag or middle-click drag) in `SheetViewerCanvas`
- Zoom controls UI overlay (bottom-right: +, %, −) with reset-on-click

---

## M8: Polish P1 items (complete)

- `DUPLICATE_ANIMATION` reducer action (undoable, inserts copy after original, activates it)
- Duplicate button (⎘) added to each animation row in `AnimationSidebar`
- Total animation duration display in `SequenceBuilder` header: `Nt · Xms` at 60fps
- `canvas/sprite.js` export format added to `exportService` — generates ES module `export const animations = {...}` with unquoted keys
- `ExportPanel` updated to use per-format `serialize` + `ext` — download button label and filename extension are format-aware
- Save error toast wired in `EditorPage.handleSave`

---

## M7: Settings Page + Notifications (complete)

- `NotificationContext` + `ToastList` UI component — `showToast(message, type, duration)`
- `NotificationProvider` wraps full app in `App.jsx`; toasts render globally fixed bottom-right
- `?` keyboard shortcut wired in `EditorPage` → opens `KeyboardHelp` modal
- `KeyboardHelp` imported and rendered in `EditorPage`
- Error toasts wired in `EditorPage` (load failure) and `ProjectsPage` (import failure)
- `/settings` route added; **Settings** nav link in `AppShell`
- `SettingsPage` — three panels: Appearance (theme cards), Editor Defaults (frame size + export format, persisted to `dj-prefs`), Keyboard Shortcuts reference

- `projectService.js` — serialise/deserialise `.doomjelly.json`, download, file picker load, localStorage index
- `ProjectContext` — added `SET_PROJECT_ID` action
- `EditorPage` toolbar — Save (serialises + saves to localStorage + downloads file) and Open (file picker → hydrate context) buttons via `Page` component actions slot
- `ProjectsPage` — full UI: list saved projects, open, delete (with ConfirmDialog), download export, new project (inline name form), import file
- All pages now use the `Page` component (title + actions header)
- All feature components in their own folder (`EditorPage/`, `FrameRow/`)

## M3 Polish (complete)

- `FrameRow` extracted as a reusable component with its own folder + CSS (`SequenceBuilder/FrameRow/`)
- All `seq-frame__*` styles moved to `FrameRow.css`; `SequenceBuilder.css` owns only `seq-builder__*`
- Column-header bar added above frame list (aligns exactly with data columns)
- Per-row "TICKS" / "OFFSET" labels removed (header row is the key now)
- Offset inputs: `dx [□][□] dy` flanking layout with touching joined inputs
- `NumberInput` accepts `className` prop
- `IconButton` danger variant (red border + bold, fills red on hover)

---

## Architecture Decisions (Locked)

| Decision         | Choice                                                      |
| ---------------- | ----------------------------------------------------------- |
| Framework        | Vite + React 19                                             |
| Routing          | React Router v7                                             |
| State            | React Context + useReducer                                  |
| Folder structure | Feature-based (`src/features/`, `src/ui/`, `src/contexts/`) |
| Auth             | Dev bypass via `VITE_AUTH_BYPASS=true`; Supabase when ready |
| Database         | localStorage stub → Supabase Postgres                       |
| File storage     | Object URL stub → Supabase Storage                          |
| Theme            | `data-theme` on `<html>`, CSS custom properties per theme   |
| Min viewport     | 1024px (tablet landscape and up)                            |
| Deploy           | GitHub Pages via GitHub Actions on push to `main`           |

---

## Priority Tiers

- **P0** — Core MVP. Nothing else ships without these.
- **P1** — High value, needed before public use.
- **P2** — Rounds out the tool, important but deferrable.
- **P3** — Future / nice to have / post-launch.

---

## Page & Feature Breakdown

---

### ✅ App Shell & Routing

**Status:** Done  
**Route:** wraps all protected pages  
**File:** `src/features/layout/AppShell.jsx`

| Feature                               | Status | Priority |
| ------------------------------------- | ------ | -------- |
| Header with logo + title              | ✅     | P0       |
| Top nav (Editor / Projects)           | ✅     | P0       |
| Theme selector dropdown               | ✅     | P1       |
| Signed-in user display                | ✅     | P1       |
| Sign out button                       | ✅     | P1       |
| React Router protected routes         | ✅     | P0       |
| `VITE_AUTH_BYPASS` dev mode           | ✅     | P0       |
| GitHub Actions deploy-pages.yml       | ✅     | P0       |
| Keyboard shortcut overlay (press `?`) | ✅     | P2       |
| Notification / toast system           | ⬜     | P2       |
| Global error boundary                 | ⬜     | P2       |

---

### ✅ Editor Page — Sprite Sheet Importer

**Route:** `/editor`  
**File:** `src/features/editor/SpriteImporter/`  
**Depends on:** ProjectContext `SET_SPRITE_SHEET`, storage service

| Feature                                                  | Status | Priority |
| -------------------------------------------------------- | ------ | -------- |
| Drag-and-drop PNG onto drop zone                         | ✅     | P0       |
| File picker fallback (`<input type="file">`)             | ✅     | P0       |
| Object URL creation + natural dimension read             | ✅     | P0       |
| Display: filename, pixel dimensions                      | ✅     | P0       |
| Display: calculated cell count given frame config        | ✅     | P0       |
| Replace sheet (re-import) without losing animations      | ⬜     | P1       |
| Sheet stays loaded in-session (object URL)               | ✅     | P0       |
| Persist filename/dimensions across refresh (no dataUrl)  | ✅     | P0       |
| Warn user when refreshing that sheet must be re-imported | ⬜     | P1       |

---

### ✅ Editor Page — Frame Config Panel

**File:** `src/features/editor/FrameConfigPanel/`  
**Depends on:** ProjectContext `SET_FRAME_CONFIG`

| Feature                                                    | Status | Priority |
| ---------------------------------------------------------- | ------ | -------- |
| Frame W / Frame H number inputs                            | ✅     | P0       |
| Scale input (0.5–8×)                                       | ✅     | P0       |
| Offset X / Offset Y inputs                                 | ✅     | P0       |
| Gutter X / Gutter Y inputs                                 | ✅     | P0       |
| Reset to defaults button                                   | ✅     | P0       |
| All inputs live-update canvas immediately                  | ✅     | P0       |
| Collapsible panel (sheet hidden when working on sequence)  | ⬜     | P1       |
| Auto-detect frame size (analyze pixel data for boundaries) | 💭     | P3       |
| Saved per-project in ProjectContext                        | ✅     | P0       |

---

### ✅ Editor Page — Sheet Viewer Canvas

**File:** `src/features/editor/SheetViewerCanvas/`  
**Depends on:** sprite image object URL, frame config, ProjectContext

| Feature                                                                                              | Status | Priority |
| ---------------------------------------------------------------------------------------------------- | ------ | -------- |
| Render sprite sheet at configured scale                                                              | ✅     | P0       |
| `imageSmoothingEnabled = false`                                                                      | ✅     | P0       |
| Grid overlay showing cell boundaries (gutter-aware)                                                  | ✅     | P0       |
| Yellow highlight on hovered cell                                                                     | ✅     | P0       |
| Click cell → add frame to active animation sequence                                                  | ✅     | P0       |
| Right-click cell → remove last occurrence of that cell                                               | ✅     | P0       |
| Drag-select rectangular region → add all cells in rect                                               | ✅     | P1       |
| Blue cell count badge overlay (# times cell is in sequence)                                          | ✅     | P1       |
| Highlighted state for cells already in sequence                                                      | ✅     | P1       |
| Canvas resizes with panel                                                                            | ⬜     | P1       |
| Pan (Space+drag or middle-click) for large sheets                                                    | ✅     | P2       |
| Zoom (scroll wheel + overlay buttons, reset on click)                                                | ✅     | P2       |
| Grid lines visible at all zoom levels and in all themes                                              | ✅     | P2       |
| Keyboard: `Esc` to deselect, `A` to select all                                                       | ⬜     | P2       |
| Custom Grid — drag individual grid lines to arbitrary positions for uneven/non-uniform sprite sheets | 💭     | P3       |

---

### ✅ Editor Page — Animation Sidebar

**File:** `src/features/editor/AnimationSidebar/`  
**Depends on:** ProjectContext animations array

| Feature                                     | Status | Priority |
| ------------------------------------------- | ------ | -------- |
| List all animations for current project     | ✅     | P0       |
| Click to set active animation               | ✅     | P0       |
| Add new animation button                    | ✅     | P0       |
| Delete animation (with confirm)             | ✅     | P0       |
| Rename animation (inline double-click edit) | ✅     | P1       |
| Duplicate animation                         | ✅     | P1       |
| Drag to reorder animations                  | ⬜     | P2       |
| Frame count shown per animation             | ✅     | P1       |
| Onboarding empty state CTA                  | ✅     | P1       |

---

### ✅ Editor Page — Sequence Builder

**File:** `src/features/editor/SequenceBuilder/`  
**Depends on:** active animation frames, ProjectContext `UPDATE_ANIMATION`

| Feature                                                        | Status | Priority |
| -------------------------------------------------------------- | ------ | -------- |
| Ordered list of frames for active animation                    | ✅     | P0       |
| Per-frame thumbnail (drawn from sheet canvas)                  | ✅     | P0       |
| Per-frame cell coordinates display (col, row)                  | ✅     | P0       |
| Per-frame ticks input (duration in ticks)                      | ✅     | P0       |
| Bulk ticks input — change all frames at once                   | ✅     | P0       |
| Per-frame dx/dy nudge offset (±64px, highlights when non-zero) | ✅     | P1       |
| Reorder frame up/down buttons                                  | ✅     | P0       |
| Delete frame button                                            | ✅     | P0       |
| Drag to reorder frames                                         | ⬜     | P2       |
| Active frame highlighted (synced with scrub slider)            | ✅     | P1       |
| Import frames from existing JSON                               | ⬜     | P2       |
| Total animation duration display                               | ✅     | P1       |

---

### ✅ Editor Page — Preview Canvas

**File:** `src/features/editor/PreviewCanvas/`  
**Depends on:** active animation frames, sprite sheet image, frame config, rAF loop

| Feature                                                        | Status | Priority |
| -------------------------------------------------------------- | ------ | -------- |
| rAF-based playback loop                                        | ✅     | P0       |
| `imageSmoothingEnabled = false`                                | ✅     | P0       |
| Render current frame correctly with dx/dy offset               | ✅     | P0       |
| Playback mode: Loop                                            | ✅     | P0       |
| Playback mode: Ping-pong                                       | ✅     | P0       |
| Playback mode: Play once (stops on last frame)                 | ✅     | P0       |
| Play / Pause button                                            | ✅     | P0       |
| Speed multiplier (0.25×–4×, preview only, no effect on export) | ✅     | P1       |
| Scrub slider — manual frame stepping                           | ✅     | P1       |
| Frame counter display (e.g. "Frame 3 / 8")                     | ✅     | P1       |
| Onion skin toggle (prev frame at 30% opacity behind current)   | ✅     | P1       |
| Background: checkerboard                                       | ✅     | P0       |
| Background: solid black                                        | ✅     | P0       |
| Background: solid white                                        | ✅     | P0       |
| Background: custom color picker                                | ⬜     | P2       |
| Preview scale control (1×, 2×, 4×)                             | ✅     | P1       |
| Preview panel resizable                                        | ⬜     | P2       |

---

### 🔄 Editor Page — Layout

**File:** `src/features/editor/EditorPage.jsx`

| Feature                                                        | Status | Priority |
| -------------------------------------------------------------- | ------ | -------- |
| Three-column layout: sidebar / sheet viewer / sequence+preview | ✅     | P0       |
| Collapsible left panel (sprite importer + frame config)        | ✅     | P1       |
| Resizable panel dividers                                       | ⬜     | P2       |
| Responsive to window resize                                    | ⬜     | P1       |
| Keyboard shortcuts: Space = play/pause, arrow keys = scrub     | ⬜     | P2       |

---

### ✅ Projects Page

**Route:** `/projects`  
**File:** `src/features/projects/ProjectsPage.jsx`  
**Depends on:** db service, ProjectContext

| Feature                                                         | Status | Priority |
| --------------------------------------------------------------- | ------ | -------- |
| List all saved projects                                         | ✅     | P1       |
| Create new project (name prompt)                                | ✅     | P1       |
| Open project (loads into ProjectContext + redirects to /editor) | ✅     | P1       |
| Rename project                                                  | ⬜     | P1       |
| Delete project with confirmation                                | ✅     | P1       |
| Last modified date per project                                  | ✅     | P1       |
| Animation count + frame count per project                       | ⬜     | P2       |
| Project thumbnail (first frame of first animation)              | ⬜     | P2       |
| Save current project to .doomjelly.json (download file)         | ✅     | P1       |
| Load .doomjelly.json from file picker                           | ✅     | P1       |
| Drag & drop .doomjelly.json onto page to load                   | ⬜     | P2       |
| Empty state (no projects yet CTA)                               | ✅     | P1       |
| Recent projects (quick-access, localStorage)                    | ⬜     | P2       |

---

### ✅ Export Panel

**File:** `src/features/export/`  
**Depends on:** active project, all animations, frame config  
**Note:** Can live as a modal/drawer accessible from the Editor

| Feature                                             | Status | Priority |
| --------------------------------------------------- | ------ | -------- |
| Export format selector                              | ✅     | P1       |
| Generic JSON array (`[{ x, y, w, h, duration }]`)   | ✅     | P1       |
| Phaser 3 JSON atlas format                          | ✅     | P1       |
| Canvas/sprite.js format (AZDES UI_TOOLS convention) | ✅     | P2       |
| LDtk entity definition format                       | ⬜     | P3       |
| Preview of generated JSON in-panel                  | ✅     | P1       |
| Copy to clipboard button                            | ✅     | P1       |
| Download as file button                             | ✅     | P1       |
| Export single animation                             | ✅     | P1       |
| Export all animations (zip)                         | ⬜     | P2       |
| Include spritesheet image in export zip             | ⬜     | P2       |

---

### ✅ Timeline View

**File:** `src/features/editor/TimelineView/`  
**Depends on:** active animation frames, preview canvas scrub  
**Note:** Toggleable via List / Timeline buttons in the Frames panel header

| Feature                                    | Status | Priority |
| ------------------------------------------ | ------ | -------- |
| Horizontal scrollable timeline             | ✅     | P2       |
| Frame cells with thumbnails                | ✅     | P2       |
| Frame width proportional to ticks          | ✅     | P2       |
| Playhead that scrubs with animation        | ✅     | P2       |
| Click frame to select + edit               | ✅     | P2       |
| Drag to reorder                            | ⬜     | P3       |
| Zoom in/out timeline                       | ⬜     | P3       |
| Toggle between list view and timeline view | ✅     | P2       |

> **Revisit:** Drag-to-reorder frames in timeline view (P3) and zoom in/out not yet implemented — deferred to a later session.

---

### ⬜ Side-by-Side Comparison

**File:** `src/features/compare/`

| Feature                                    | Status | Priority |
| ------------------------------------------ | ------ | -------- |
| Select animation A and animation B         | ⬜     | P3       |
| Two preview canvases rendered side by side | ⬜     | P3       |
| Sync playback option                       | ⬜     | P3       |
| Independent playback controls              | ⬜     | P3       |
| Labels showing animation names below each  | ⬜     | P3       |

---

### ⬜ Auth — Login Page

**File:** `src/features/auth/LoginPage.jsx`  
**Status:** UI complete, logic stubbed

| Feature                                         | Status | Priority |
| ----------------------------------------------- | ------ | -------- |
| Login form UI                                   | ✅     | P0       |
| Dev bypass (no login in dev)                    | ✅     | P0       |
| Supabase `signInWithPassword`                   | ⬜     | P3       |
| "Forgot password" email flow                    | ⬜     | P3       |
| OAuth (GitHub / Google)                         | ⬜     | P3       |
| Sign up flow                                    | ⬜     | P3       |
| Session persistence (stay logged in on refresh) | ⬜     | P3       |
| Auth error messages                             | ⬜     | P3       |

---

### ✅ User Settings Page

**Route:** `/settings`  
**File:** `src/features/settings/`

| Feature                             | Status | Priority |
| ----------------------------------- | ------ | -------- |
| Theme picker (all available themes) | ✅     | P2       |
| Default frame size preferences      | ✅     | P2       |
| Default export format preference    | ✅     | P2       |
| Keyboard shortcut reference list    | ✅     | P2       |
| Account info display (email, name)  | ⬜     | P3       |
| Change password                     | ⬜     | P3       |
| Delete account                      | ⬜     | P3       |

---

## UI Component Library (`src/ui/`)

These are shared, theme-aware, reusable components. Build them as needed by features — don't pre-build what isn't needed yet.

| Component                 | Status | Priority | Notes                                                |
| ------------------------- | ------ | -------- | ---------------------------------------------------- |
| `Button`                  | ✅     | P0       | variant + size                                       |
| `Input`                   | ✅     | P0       | label, error, hint                                   |
| `NumberInput`             | ✅     | P0       | step, min, max, label, className, local string state |
| `Slider`                  | ✅     | P0       | min/max/step, labeled, displayValue                  |
| `Select`                  | ✅     | P0       | styled wrapper, options array                        |
| `Toggle`                  | ✅     | P1       | accessible switch, labelPosition                     |
| `IconButton`              | ✅     | P1       | btn-icon pattern, accessible label                   |
| `Badge`                   | ✅     | P1       | count + variant                                      |
| `EmptyState`              | ✅     | P1       | icon/title/hint/CTA slot                             |
| `Tooltip`                 | ✅     | P1       | CSS-driven, 4 positions, 0.3s delay                  |
| `FileDropZone`            | ✅     | P0       | drag+drop + file picker                              |
| `Page`                    | ✅     | P0       | standard route wrapper, title + actions              |
| `Panel`                   | ✅     | P0       | collapsible titled section                           |
| `Card`                    | ✅     | P1       | surface container, interactive variant               |
| `Toolbar`                 | ✅     | P1       | + ToolbarGroup, ToolbarSeparator                     |
| `Modal`                   | ✅     | P1       | portal, focus trap, Esc to close                     |
| `ConfirmDialog`           | ✅     | P1       | built on Modal + Button                              |
| `Toast` / `Notifications` | ✅     | P1       | success/error/info, auto-dismiss                     |
| `ContextMenu`             | ⬜     | P1       | right-click menu for canvas cells                    |
| `ColorPicker`             | ⬜     | P2       | for preview background custom color                  |
| `Tabs`                    | ⬜     | P2       | tab bar pattern                                      |
| `ResizablePanel`          | ⬜     | P2       | drag-to-resize divider                               |
| `Tag` / `Chip`            | ⬜     | P2       | animation tags (future)                              |
| `ProgressBar`             | ⬜     | P2       | loading state, export progress                       |
| `Kbd`                     | ⬜     | P2       | keyboard shortcut display                            |

---

## Contexts & Services

| Item                                  | File                                   | Status    | Priority |
| ------------------------------------- | -------------------------------------- | --------- | -------- |
| `ThemeContext`                        | `src/contexts/ThemeContext.jsx`        | ✅        | P0       |
| `AuthContext`                         | `src/contexts/AuthContext.jsx`         | ✅ (stub) | P0       |
| `ProjectContext`                      | `src/contexts/ProjectContext.jsx`      | ✅        | P0       |
| `PlaybackContext`                     | `src/contexts/PlaybackContext.jsx`     | ✅        | P1       |
| `NotificationContext`                 | `src/contexts/NotificationContext.jsx` | ✅        | P1       |
| `KeyboardContext` (shortcut registry) | `src/contexts/KeyboardContext.jsx`     | ⬜        | P2       |
| `db` service (localStorage)           | `src/services/db.js`                   | ✅ (stub) | P0       |
| `db` service (Supabase)               | `src/services/db.js`                   | ⬜        | P3       |
| `storage` service (object URL)        | `src/services/storage.js`              | ✅ (stub) | P0       |
| `storage` service (Supabase)          | `src/services/storage.js`              | ⬜        | P3       |
| `exportFormats` service               | `src/services/exportFormats.js`        | ⬜        | P1       |
| `historyService` (undo/redo)          | `src/services/history.js`              | ⬜        | P2       |

---

## Custom Hooks (`src/hooks/`)

| Hook                          | Purpose                          | Status | Priority |
| ----------------------------- | -------------------------------- | ------ | -------- |
| `useCanvas(ref)`              | Setup canvas ctx, handle resize  | ✅     | P0       |
| `useDropZone(onFile)`         | Drag+drop file handling          | ✅     | P0       |
| `useAnimationLoop(cb)`        | rAF loop with pause/resume       | ✅     | P0       |
| `useLocalStorage(key, init)`  | Typed localStorage getter/setter | ⬜     | P1       |
| `useDebounce(value, ms)`      | Debounce live inputs             | ⬜     | P1       |
| `useKeyboard(map)`            | Register keyboard shortcuts      | ⬜     | P2       |
| `useHistory(state, dispatch)` | Undo/redo stack                  | ⬜     | P2       |
| `useResizablePanel()`         | Panel resize logic               | ⬜     | P2       |

---

## Themes

| Theme            | Status | Priority | Notes                       |
| ---------------- | ------ | -------- | --------------------------- |
| `dark` (default) | ✅     | P0       | Deep blue-gray, blue accent |
| `light`          | ⬜     | P2       | Clean light mode            |
| `synthwave`      | ⬜     | P3       | Purple/pink neon on dark    |
| `solarized-dark` | ⬜     | P3       | Classic Solarized           |
| `mocha`          | ⬜     | P3       | Warm brown tones            |

---

## Export Formats — Spec Reference

### Generic JSON

```json
{
  "name": "walk",
  "frames": [{ "x": 0, "y": 0, "w": 32, "h": 32, "duration": 100 }]
}
```

### Phaser 3 Atlas

```json
{
  "textures": [
    {
      "image": "sheet.png",
      "format": "RGBA8888",
      "frames": [
        {
          "filename": "walk/0",
          "frame": { "x": 0, "y": 0, "w": 32, "h": 32 },
          "duration": 100,
          "rotated": false,
          "trimmed": false,
          "spriteSourceSize": { "x": 0, "y": 0, "w": 32, "h": 32 },
          "sourceSize": { "w": 32, "h": 32 }
        }
      ]
    }
  ]
}
```

### canvas/sprite.js (UI_TOOLS convention)

```js
export const animations = {
  walk: {
    frames: [{ col: 0, row: 0, ticks: 6, dx: 0, dy: 0 }],
    loop: true,
    pingpong: false,
  },
};
```

---

## Supabase Schema (future)

```sql
-- Managed by Supabase Auth
-- users table is auto-created

create table projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table project_data (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects on delete cascade,
  json_blob   jsonb not null,
  updated_at  timestamptz default now()
);

-- Sprite sheets stored in Supabase Storage bucket: 'sprites'
-- Path pattern: {user_id}/{project_id}/{filename}
```

All tables protected with Row Level Security:

```sql
alter table projects enable row level security;
create policy "Users can only access own projects"
  on projects for all using (auth.uid() = user_id);
```

---

## Milestone Plan

| Milestone                  | Contents                                                                                  | Target      |
| -------------------------- | ----------------------------------------------------------------------------------------- | ----------- |
| **M0: Shell**              | App shell, routing, contexts, services, deploy                                            | ✅ Complete |
| **M1: Sheet Viewer**       | Importer, frame config, canvas+grid, hover, click-to-add                                  | ✅ Complete |
| **M1.5: UI Library**       | 14 shared components: Modal, Toolbar, Page, Panel, Card, etc.                             | ✅ Complete |
| **M2: Sequence + Preview** | Sequence builder, preview rAF loop, playback modes                                        | ✅ Complete |
| **M3: Full Editor**        | Right-click remove, drag-select, onion skin, dx/dy offset, scrub sync, FrameRow component | ✅ Complete |
| **M4: Projects**           | Save/load .doomjelly.json, projects page, db service                                      | ✅ Complete |
| **M5: Export**             | All export formats, preview panel, copy/download                                          | ✅ Complete |
| **M6: Polish**             | Timeline, keyboard shortcuts, themes, undo/redo                                           | 🔵 Now      |
| **M7: Backend**            | Supabase auth + db + storage swap-in                                                      | Future      |
| **M8: Collaboration**      | Multi-user, sharing, public galleries                                                     | Future      |

---

## Known Gaps / Open Questions

- [ ] Should animations store frame duration in **ticks** (game loop units) or **milliseconds**? Ticks chosen for now (matches lab), but need a ticks→ms conversion factor configurable per project.
- [ ] Should the timeline view replace or supplement the list view?
- [ ] LDtk format: needs research into exact enum/tileset reference format.
- [ ] Undo/redo: implement at ProjectContext dispatch level or per-feature?
- [ ] Large sprite sheets (e.g. 4096×4096): need virtual scrolling on the canvas viewer or WebGL?
- [ ] Should the sheet importer support sprite sheet slicing automatically by detecting transparent gutters?

---

_This file is gitignored — local only. Update it as decisions are made and features ship._
