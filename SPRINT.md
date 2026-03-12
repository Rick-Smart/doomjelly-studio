# DoomJelly Studio — Data Stability Sprint

**Branch:** `feature/jelly-sprite-improvements`  
**Session date:** March 12, 2026  
**Last commit:** `8b456b3` — pinned tracks, CSS repair

---

## Why this sprint exists

Every new feature has been fighting the same class of bugs: blank screens on
navigation, sprite sheets going stale after a route change, unsaved work
silently lost on unmount, state that lives in two places that drift out of sync.
This sprint eliminates those entire classes of bugs permanently so future
features can be built on a stable foundation.

---

## Live bugs found (already broken TODAY)

### Bug 1 — Auto-save on Animator unmount is dead

`AnimatorPage.jsx` cleanup `useEffect` calls `getSheetDataUrl(st)` — that
function does **not exist**. It was renamed to `buildAnimatorBody`. The auto-save
silently throws and nothing is written. Unsaved work is already lost on
navigate-away.

**File:** `src/features/animator/AnimatorPage/AnimatorPage.jsx`  
**Fix:** Replace the cleanup effect body with a correct call to
`buildAnimatorBody(stateRef.current)`.

---

### Bug 2 — Full base64 sheet images written to localStorage on every keystroke

`ProjectContext` strips `spriteSheet.dataUrl` before persisting, but it persists
the entire `sheets[]` array _unchanged_. Every sheet entry contains a `dataUrl`
field — a full base64-encoded PNG. On every state change (animation frame drag,
rename, anything) a multi-megabyte JSON blob is serialised to localStorage.
localStorage quota in most browsers is 5 MB. Once hit, the write silently fails
and the entire context save stops working.

**File:** `src/contexts/ProjectContext.jsx` — `useEffect` persistence block  
**Fix:** Strip `dataUrl` from every sheet before persisting, same as is already
done for `spriteSheet.dataUrl`.

```js
// In the persistence useEffect, change the persistable construction to:
const persistable = {
  ...rest,
  sheets: state.sheets.map(({ dataUrl: _d, objectUrl: _o, ...s }) => s),
  spriteSheet: spriteSheet
    ? {
        filename: spriteSheet.filename,
        width: spriteSheet.width,
        height: spriteSheet.height,
      }
    : null,
};
```

---

### Bug 3 — First JellySprite save doesn't update the URL

When a blank sprite is created and saved for the first time,
`JellySpriteWorkspace.handleSave` dispatches `SET_PROJECT_ID` but never calls
`navigate('/jelly-sprite/' + id, { replace: true })`. The URL stays
`/jelly-sprite` with no ID. A refresh = blank canvas because the URL has no
identity to reload from.

**File:** `src/features/jelly-sprite/JellySpriteWorkspace.jsx` — `handleSave`  
**Fix:** After `saveSprite` resolves, if the URL doesn't already have the ID,
call `navigate('/jelly-sprite/' + id, { replace: true })`.

---

### Bug 4 — "Edit in JellySprite" from Animator navigates with no ID

`AnimatorPage.handleEditInJellySprite` calls `navigate("/jelly-sprite")` with
no sprite ID. `state.id` exists at this point. Refresh from JellySprite after
this = lost context + blank canvas.

**File:** `src/features/animator/AnimatorPage/AnimatorPage.jsx`  
**Fix:** Change to `navigate('/jelly-sprite/' + state.id)`.

---

### Bug 5 — ProtectedRoute renders `null` during auth check

While Supabase is restoring a session, `ProtectedRoute` returns `null` — no
layout, no loading state. Every protected route shows a blank white screen for
200–500ms on initial load (worse over slow connections).

**File:** `src/router/ProtectedRoute.jsx`  
**Fix:**

```jsx
if (loading)
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
        Loading…
      </span>
    </div>
  );
```

---

## The 10 Rules

These are the permanent contract. Every feature going forward follows them.

### Rule 1 — URL is identity for every editor

`/animator` → `/animator/:spriteId`  
`/jelly-sprite` → `/jelly-sprite/:spriteId` (route already exists)

A page always knows what it's editing from the URL alone. Refresh always works.
Sharing a URL always works.

### Rule 2 — `dataUrl` is the canonical image; `objectUrl` is a render cache

- `dataUrl` (base64) is always saved to `animatorBody.sheets[].dataUrl`
- `objectUrl` (`blob:`) is _never_ stored — it's always recreated from `dataUrl` on mount
- A single restore `useEffect` on AnimatorPage does: `dataUrl → blob → objectUrl → RESTORE_SHEET_URLS`
- Sheets with no `dataUrl` show a "stale" warning; they don't crash

### Rule 3 — Drop `state.spriteSheet`; use a computed active-sheet selector

`state.spriteSheet` is removed from `ProjectContext`. Code that reads it switches
to:

```js
const activeSheet =
  state.sheets.find((s) => s.id === state.activeSheetId) ?? null;
```

This removes an entire class of sync bugs — there's one source of truth, not two.

**Consumers to update:**

- `AnimatorPage.jsx` — `imageUrl`, `handleSave` canvas size, `handleEditInJellySprite`
- `SheetViewerCanvas.jsx`
- `SequenceBuilder.jsx`
- `KeyboardHandler` (the inline function in AnimatorPage)
- `FrameConfigPanel` (check if it reads spriteSheet)

### Rule 4 — `await handleSave()` before any navigation

`handleSave` returns a Promise. Any caller that navigates after saving must
`await` it. The auto-save on unmount is replaced by a `beforeunload` guard
(warn user of unsaved changes) — async fire-and-forget on unmount is not
reliable.

### Rule 5 — One canonical `animatorBody` format (no legacy in new saves)

New saves write exactly:

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
  "animations": [],
  "frameConfig": {}
}
```

The legacy `spriteSheet` top-level field is no longer written. `LOAD_PROJECT`
keeps its migration code so old saves still open.

### Rule 6 — Strip ALL binary data before localStorage persistence

localStorage = metadata + IDs only.  
IDB/Supabase = all binary data (pixel buffers, base64 images).  
The `sheets[]` array in `ProjectContext` must have `dataUrl` stripped before
every localStorage write (same as `spriteSheet` is already stripped).

### Rule 7 — JellySprite first-save updates the URL

After first `saveSprite` in JellySpriteWorkspace, if `spriteId` param doesn't
match the saved ID, call `navigate('/jelly-sprite/' + id, { replace: true })`.

### Rule 8 — ProtectedRoute always renders something during load

Never return `null`. Show a minimal loading indicator. One component, one-line
fix.

### Rule 9 — IDB is the local source of truth; localStorage index is expendable

A failed localStorage index write must never swallow a successful IDB write.
The index must be wrapped so failure is logged but not thrown. The index can
always be rebuilt from IDB if it's ever corrupt or missing.

### Rule 10 — `navigate('/tool')` without spriteId is banned

Every navigation to an editor _must_ carry the spriteId:

- `navigate('/animator/' + spriteId)` ✅
- `navigate('/jelly-sprite/' + spriteId)` ✅
- `navigate('/animator')` ❌ — will cause blank screen on refresh

---

## Challenged design assumptions

### "All imports/exports from Projects only"

**Challenge:** Forces a 4-step context switch for a 1-step creative action (swap
a PNG in the current Animator session). The rule should be:

- **Projects** = CRUD (create, rename, delete, organize sprites)
- **Tools** = input for the current session (file picker, add sheet)

These are different jobs. Tools can have a "Load PNG" action for the current
session without that being an "import" feature that belongs to Projects.
The current restriction punishes the creative workflow.

**Recommendation:** Keep export in Projects only (it's a delivery action).
Restore "load a PNG into the current session" in the Animator as a session-local
action, separate from the concept of creating/persisting a sprite.

---

### One `ProjectContext` shared across all editors

**Challenge:** `LOAD_PROJECT` resets everything. If you have 3 sheets and 5
animations open in the Animator and navigate to JellySprite, the Animator
state is wiped. With Rule 10 in place (URL identity), the Animator will
self-reload its state when you come back — but only because of the route param.
Without it, this is silent data loss.

**Longer term:** Split into `AnimatorContext` and `JellySpriteContext` (each
manages its own working state), plus a thin `ActiveSpriteContext` carrying
`{ id, name, projectId }` as the shared navigation identity.

This sprint doesn't implement the split — it's too large. But Rules 1–10 make
the single-context model safe by ensuring URL identity always acts as the save
point.

---

### Supabase fallback to IDB is a feature

**Challenge:** When Supabase is enabled but `projectId` is null, `saveSprite`
silently writes to IDB instead of Supabase. The user sees "Saved ✓". The data
never reaches the cloud. Opening on another device = lost work, no warning.

**Recommendation:** If Supabase is enabled and `projectId` is null, either:
a) Auto-assign to a special "Uncategorized" project (best UX), or  
 b) Show a hard error: "This sprite isn't in a project — assign it first."

Silent data routing to the wrong backend is a data integrity hole.

---

### Sprites don't declare which tools have data for them

Currently, "Edit in JellySprite" and "Open in Animator" are shown for all
sprites. The UI guesses from null checks whether data exists.

**Recommendation:** Add a `tools` metadata field on the sprite record:

```json
{ "tools": { "jelly": true, "animator": false } }
```

Set this on save. Use it to enable/disable the correct "Open in…" buttons in
Projects, rather than doing runtime null checks on large data blobs just to
decide whether to show a button.

---

## Implementation order

Complete these as separate commits so each step is independently testable.

| #      | What                                                              | Files                                                | Priority          |
| ------ | ----------------------------------------------------------------- | ---------------------------------------------------- | ----------------- |
| **1**  | Fix dead auto-save (Bug 1)                                        | `AnimatorPage.jsx`                                   | 🔴 Data loss      |
| **2**  | Strip `dataUrl` from localStorage (Bug 2)                         | `ProjectContext.jsx`                                 | 🔴 Quota crash    |
| **3**  | Add `/animator/:spriteId` route + self-load                       | `routes.jsx`, `AnimatorPage.jsx`, `ProjectsPage.jsx` | 🔴 Foundation     |
| **4**  | JellySprite first-save → navigate to URL (Bug 3)                  | `JellySpriteWorkspace.jsx`                           | 🟠 Refresh safety |
| **5**  | "Edit in JellySprite" carries ID (Bug 4)                          | `AnimatorPage.jsx`                                   | 🟠 Cross-tool nav |
| **6**  | ProtectedRoute loading state (Bug 5)                              | `ProtectedRoute.jsx`                                 | 🟡 UX polish      |
| **7**  | Drop `state.spriteSheet`, use computed selector (Rule 3)          | `ProjectContext.jsx` + 4 consumers                   | 🟠 Sync bugs      |
| **8**  | Guaranteed `dataUrl` on every sheet save (Rule 2)                 | `buildAnimatorBody` in `AnimatorPage.jsx`            | 🟠 Stale sheets   |
| **9**  | `await handleSave()` before navigate (Rule 4)                     | Both workspace files                                 | 🟡 Partial writes |
| **10** | Supabase fallback → explicit error or auto-project (Assumption 3) | `projectService.js`                                  | 🟡 Data integrity |
| **11** | Single canonical `animatorBody` format (Rule 5)                   | `buildAnimatorBody`, `LOAD_PROJECT` migration        | 🟢 Cleanup        |

---

## Code locations quick-reference

```
src/
  router/
    routes.jsx                  — Route definitions (add /animator/:spriteId here)
    ProtectedRoute.jsx          — Bug 5 fix here
  contexts/
    ProjectContext.jsx          — Bug 2, Rule 3 (drop spriteSheet), Rule 6
  features/
    animator/
      AnimatorPage/
        AnimatorPage.jsx        — Bug 1, Bug 4, Rules 2/3/4/5
    jelly-sprite/
      JellySpriteWorkspace.jsx  — Bug 3, Rule 7
    projects/
      ProjectsPage.jsx          — Rule 10 (all navigate calls)
  services/
    projectService.js           — Rule 9 (IDB index error handling), Rule 10
```

---

## State shape reference (current + target)

### Current `ProjectContext` state fields

```js
{
  id, projectId, spriteId, name,
  sheets: [{ id, filename, objectUrl, dataUrl, width, height, frameConfig }],
  activeSheetId,
  spriteSheet: { objectUrl, filename, width, height },  // ← DUPLICATE of active sheet, TARGET: REMOVE
  jellySpriteDataUrl, jellySpriteState, animatorState,
  frameConfig, animations, activeAnimationId
}
```

### Target state (after Rule 3)

```js
{
  id, projectId, name,
  sheets: [{ id, filename, objectUrl, width, height, frameConfig }],  // dataUrl stripped from localStorage
  activeSheetId,
  // NO spriteSheet — use: state.sheets.find(s => s.id === state.activeSheetId)
  jellySpriteDataUrl, jellySpriteState, animatorState,
  frameConfig, animations, activeAnimationId
}
```

### `animatorBody` format (target — new saves only)

```js
{
  sheets: [{ id, filename, dataUrl, width, height, frameConfig }],
  activeSheetId,
  animations: [...],
  frameConfig: { frameW, frameH, scale, offsetX, offsetY, gutterX, gutterY }
  // NO legacy spriteSheet field in new saves — LOAD_PROJECT migration handles old saves
}
```

---

## What was delivered in this session (not yet committed)

- `SheetList` component in AnimatorPage (read-only sheet display)
- `SheetList` CSS in AnimatorPage.css
- `handleAddSheetToAnimator` in ProjectsPage — adds a second sprite's sheet to
  the current Animator session without replacing it
- `+ Sheet` button per sprite card in Projects (disabled when no Animator session)
- `ADD_SHEET` reducer now preserves `dataUrl` from payload
- `state` added to `useProject()` destructure in ProjectsPage

---

## Git instructions for tomorrow

```bash
# Verify what's staged
git status

# If everything looks good, commit the session work
git commit -m "session: SheetList UI, add-sheet-to-animator, stability audit notes"

# Start tomorrow on step 1 of the sprint
# (Bug 1 — fix dead auto-save in AnimatorPage)
```
