import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { useProject } from "../../../contexts/ProjectContext";
import { useNotification } from "../../../contexts/NotificationContext";
import {
  PlaybackProvider,
  usePlayback,
} from "../../../contexts/PlaybackContext";
import { Page } from "../../../ui/Page";
import { FrameConfigPanel } from "../FrameConfigPanel";
import { SheetViewerCanvas } from "../SheetViewerCanvas";
import { AnimationSidebar } from "../AnimationSidebar";
import { SequenceBuilder } from "../SequenceBuilder";
import { PreviewCanvas } from "../PreviewCanvas";
import { saveSprite } from "../../../services/projectService";
import { KeyboardHelp } from "../KeyboardHelp";
import { TracksPanel } from "../TracksPanel";
import { generateThumbnail } from "../../../services/imageExportService";
import "./AnimatorPage.css";

/**
 * Keyboard shortcuts — lives inside PlaybackProvider so it can access both
 * PlaybackContext (play/pause/seek) and ProjectContext (undo/redo/save).
 */
function KeyboardHandler({ onSave, onHelp }) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useProject();
  const { frameIndex, isPlaying, playPlayback, pausePlayback, seekTo } =
    usePlayback();

  const activeAnim = state.animations.find(
    (a) => a.id === state.activeAnimationId,
  );
  const frameCount = activeAnim?.frames.length ?? 0;

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (document.activeElement?.isContentEditable) return;

      if (e.code === "Space") {
        e.preventDefault();
        isPlaying ? pausePlayback() : playPlayback();
        return;
      }
      if (e.code === "ArrowLeft" && frameCount > 0) {
        e.preventDefault();
        pausePlayback();
        seekTo(Math.max(0, frameIndex - 1));
        return;
      }
      if (e.code === "ArrowRight" && frameCount > 0) {
        e.preventDefault();
        pausePlayback();
        seekTo(Math.min(frameCount - 1, frameIndex + 1));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        onHelp?.();
        return;
      }
      if (e.key === "Escape") {
        if (state.activeAnimationId !== null) {
          dispatch({ type: "SET_ACTIVE_ANIMATION", payload: null });
        }
        return;
      }
      if ((e.key === "a" || e.key === "A") && !e.ctrlKey && !e.metaKey) {
        const { activeAnimationId, activeSheetId, sheets, frameConfig } = state;
        const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
        if (!activeAnimationId || !activeSheet) return;
        e.preventDefault();
        const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } =
          frameConfig;
        const stepX = frameW + gutterX;
        const stepY = frameH + gutterY;
        if (!frameW || !frameH || stepX <= 0 || stepY <= 0) return;
        const cols = Math.floor((activeSheet.width - offsetX) / stepX);
        const rows = Math.floor((activeSheet.height - offsetY) / stepY);
        if (cols <= 0 || rows <= 0) return;
        const newFrames = [];
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            newFrames.push({ col, row, ticks: 6, dx: 0, dy: 0 });
          }
        }
        dispatch({
          type: "UPDATE_ANIMATION",
          payload: { id: activeAnimationId, frames: newFrames },
        });
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isPlaying,
    frameIndex,
    frameCount,
    playPlayback,
    pausePlayback,
    seekTo,
    undo,
    redo,
    canUndo,
    canRedo,
    dispatch,
    state.activeAnimationId,
    state.activeSheetId,
    state.sheets,
    state.frameConfig,
    onSave,
    onHelp,
  ]);

  return null;
}

function EditableTitle({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  function start() {
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onChange(trimmed);
    setEditing(false);
  }

  function onKey(e) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="editor-title-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
      />
    );
  }

  return (
    <span
      className="editor-title-text"
      onClick={start}
      title="Click to rename project"
    >
      {value}
    </span>
  );
}

// ── Read-only sheet list ──────────────────────────────────────────────────────
// Sheets are managed from the Projects page. This just shows what's loaded.

function SheetList() {
  const { state, dispatch } = useProject();
  const navigate = useNavigate();
  const { sheets, activeSheetId, frameConfig } = state;

  if (!sheets.length) {
    return (
      <div className="sheet-list">
        <div className="panel-heading">Sprite Sheets</div>
        <p className="sheet-list__empty">
          No sheets loaded.{" "}
          <button
            className="sheet-list__link"
            onClick={() => navigate("/projects")}
          >
            Open a sprite from Projects ↗
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="sheet-list">
      <div className="panel-heading">Sprite Sheets</div>
      <ul className="sheet-list__items">
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheetId;
          const cfg = sheet.frameConfig ?? frameConfig;
          const cols = cfg.frameW
            ? Math.max(
                0,
                Math.floor(
                  (sheet.width - cfg.offsetX + cfg.gutterX) /
                    (cfg.frameW + cfg.gutterX),
                ),
              )
            : 0;
          const rows = cfg.frameH
            ? Math.max(
                0,
                Math.floor(
                  (sheet.height - cfg.offsetY + cfg.gutterY) /
                    (cfg.frameH + cfg.gutterY),
                ),
              )
            : 0;
          return (
            <li
              key={sheet.id}
              className={`sheet-list__row${isActive ? " sheet-list__row--active" : ""}`}
              onClick={() =>
                !isActive &&
                dispatch({ type: "SET_ACTIVE_SHEET", payload: sheet.id })
              }
              title={isActive ? undefined : "Switch to this sheet"}
            >
              <div className="sheet-list__thumb-wrap">
                {sheet.objectUrl ? (
                  <img
                    className="sheet-list__thumb"
                    src={sheet.objectUrl}
                    alt=""
                    aria-hidden
                  />
                ) : (
                  <span className="sheet-list__thumb-placeholder" aria-hidden>
                    ?
                  </span>
                )}
              </div>
              <div className="sheet-list__info">
                <span className="sheet-list__name" title={sheet.filename}>
                  {sheet.filename}
                </span>
                <span className="sheet-list__dims">
                  {sheet.width} × {sheet.height} px
                  {cols && rows ? ` · ${cols * rows} cells` : ""}
                </span>
                {!sheet.objectUrl && (
                  <span className="sheet-list__stale">
                    re-open from Projects to reload
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Sprite sheet persistence helpers ─────────────────────────────────────────

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function sheetToDataUrl(sheet) {
  if (sheet.objectUrl) {
    try {
      const blob = await fetch(sheet.objectUrl).then((r) => r.blob());
      return blobToDataUrl(blob);
    } catch {}
  }
  return sheet.dataUrl ?? null;
}

// Build the full animator body to persist. Async because we convert
// volatile objectUrls → dataUrls for all sheets.
async function buildAnimatorBody(st) {
  if (!st.sheets.length) return null;
  const sheetsWithData = await Promise.all(
    st.sheets.map(async (sheet) => {
      const dataUrl = await sheetToDataUrl(sheet);
      const { objectUrl: _o, ...rest } = sheet;
      return { ...rest, dataUrl };
    }),
  );
  if (!sheetsWithData.some((s) => s.dataUrl)) return null;
  const primary =
    sheetsWithData.find((s) => s.id === st.activeSheetId) ?? sheetsWithData[0];
  return {
    sheets: sheetsWithData,
    activeSheetId: st.activeSheetId,
    animations: st.animations,
    frameConfig: st.frameConfig,
  };
}

function SplitSaveButton({ onSave, saving, saved, isDirty, menuItems }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  const label = saving ? "Saving…" : saved ? "Saved ✓" : "Save";

  return (
    <div className="split-save" ref={wrapRef}>
      <button
        className="split-save__main"
        onClick={onSave}
        disabled={saving}
        title="Save project (Ctrl+S)"
      >
        {label}
        {isDirty && !saving && !saved && (
          <span className="split-save__dot" aria-hidden="true" />
        )}
      </button>
      <button
        className="split-save__chevron"
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        aria-label="More save options"
        aria-expanded={open}
        title="More save options"
      >
        ▾
      </button>
      {open && (
        <div className="split-save__menu" role="menu">
          {menuItems.map((item) =>
            item.separator ? (
              <div key={item.id} className="split-save__sep" role="separator" />
            ) : (
              <button
                key={item.id}
                className="split-save__item"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled) {
                    item.action();
                    setOpen(false);
                  }
                }}
              >
                <span className="split-save__item-label">{item.label}</span>
                {item.hint && (
                  <span className="split-save__item-hint">{item.hint}</span>
                )}
                {item.soon && (
                  <span className="split-save__item-badge">soon</span>
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function AnimatorPage() {
  const { state, dispatch, undo, redo, canUndo, canRedo, isDirty, markSaved } =
    useProject();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const { spriteId: urlSpriteId } = useParams();

  // Derive active sheet from sheets array — single source of truth (Rule 3)
  const activeSheet =
    state.sheets.find((s) => s.id === state.activeSheetId) ??
    state.sheets[0] ??
    null;
  const imageUrl = activeSheet?.objectUrl ?? null;
  useEffect(() => {
    if (!urlSpriteId) return;
    if (state.id === urlSpriteId) return; // already loaded
    import("../../../services/projectService").then(({ loadSprite }) =>
      loadSprite(urlSpriteId)
        .then((data) => {
          if (data)
            dispatch({
              type: "LOAD_PROJECT",
              payload: { ...data, id: urlSpriteId },
            });
          else {
            showToast("Sprite not found.", "error");
            navigate("/projects");
          }
        })
        .catch(() => {
          showToast("Failed to load sprite.", "error");
          navigate("/projects");
        }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSpriteId]);

  const [leftOpen, setLeftOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useLocalStorage("dj-panel-left", 220);
  const [rightWidth, setRightWidth] = useLocalStorage("dj-panel-right", 380);
  const [dragging, setDragging] = useState(false);
  const [previewHeight, setPreviewHeight] = useLocalStorage(
    "dj-panel-preview",
    300,
  );
  const [pinnedTrackIds, setPinnedTrackIds] = useState([]);

  function togglePinnedTrack(id) {
    setPinnedTrackIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // Stable refs so unmount cleanup can access latest state without stale closure.
  const stateRef = useRef(state);
  stateRef.current = state;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Restore volatile objectUrls for all sheets that have a saved dataUrl.
  // frameConfig and animations are already hydrated by the LOAD_PROJECT reducer.
  useEffect(() => {
    const toRestore = state.sheets.filter((s) => !s.objectUrl && s.dataUrl);
    if (!toRestore.length) return;
    Promise.all(
      toRestore.map(async (sheet) => {
        const blob = await fetch(sheet.dataUrl).then((r) => r.blob());
        return { id: sheet.id, objectUrl: URL.createObjectURL(blob) };
      }),
    )
      .then((restorations) =>
        dispatch({ type: "RESTORE_SHEET_URLS", payload: restorations }),
      )
      .catch((err) => {
        console.error("Failed to restore sprite sheets:", err);
        showToast(
          "Could not restore sprite sheets — please re-import.",
          "error",
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save to storage when navigating away so no work is lost.
  useEffect(() => {
    return () => {
      if (!isDirtyRef.current) return;
      const st = stateRef.current;
      buildAnimatorBody(st)
        .then((animatorBody) => {
          if (!animatorBody) return;
          const activeSheet =
            st.sheets.find((s) => s.id === st.activeSheetId) ?? st.sheets[0];
          return saveSprite({
            id: st.id ?? crypto.randomUUID(),
            projectId: st.projectId ?? null,
            name: st.name,
            animatorBody,
            animCount: st.animations.length,
            frameCount: st.animations.reduce((s, a) => s + a.frames.length, 0),
            canvasW: activeSheet?.width ?? 32,
            canvasH: activeSheet?.height ?? 32,
          });
        })
        .catch(console.error);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [saving, setSaving] = useState(false);

  function startLeftResize(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = leftWidth;
    setDragging(true);
    function onMove(e) {
      setLeftWidth(Math.min(480, Math.max(160, startW + (e.clientX - startX))));
    }
    function onUp() {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startRightResize(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = rightWidth;
    setDragging(true);
    function onMove(e) {
      setRightWidth(
        Math.min(560, Math.max(260, startW + (startX - e.clientX))),
      );
    }
    function onUp() {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startPreviewResize(e) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = previewHeight;
    setDragging(true);
    function onMove(e) {
      setPreviewHeight(
        Math.min(560, Math.max(160, startH + (e.clientY - startY))),
      );
    }
    function onUp() {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const [saved, setSaved] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [expandPreview, setExpandPreview] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const spriteId = urlSpriteId ?? state.id ?? crypto.randomUUID();
      if (!state.id) {
        dispatch({ type: "SET_PROJECT_ID", payload: spriteId });
        // Update URL so refresh works after first save
        navigate(`/animator/${spriteId}`, { replace: true });
      }
      const animatorBody = await buildAnimatorBody(state);
      const thumbnail = imageUrl
        ? await generateThumbnail(
            imageUrl,
            state.frameConfig,
            state.animations,
          ).catch(() => undefined)
        : undefined;
      await saveSprite(
        {
          id: spriteId,
          projectId: state.projectId ?? null,
          name: state.name,
          animatorBody,
          animCount: state.animations.length,
          frameCount: state.animations.reduce((s, a) => s + a.frames.length, 0),
          canvasW: activeSheet?.width ?? 32,
          canvasH: activeSheet?.height ?? 32,
        },
        thumbnail,
      );
      markSaved();
      setSaved(true);
      showToast("Project saved.", "success", 2500);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save project:", err);
      showToast("Failed to save project.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditInJellySprite() {
    // Rule 4: save before navigating so no work is lost
    if (isDirty) await handleSave();
    if (activeSheet?.objectUrl) {
      let src = activeSheet.objectUrl;
      if (!src.startsWith("data:")) {
        try {
          const img = new Image();
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
            img.src = src;
          });
          const cvs = document.createElement("canvas");
          cvs.width = activeSheet.width;
          cvs.height = activeSheet.height;
          cvs.getContext("2d").drawImage(img, 0, 0);
          src = cvs.toDataURL("image/png");
        } catch {
          src = null;
        }
      }
      if (src) dispatch({ type: "SET_JELLY_SPRITE_DATA", payload: src });
    }
    const targetId = state.id ?? urlSpriteId;
    navigate(targetId ? `/jelly-sprite/${targetId}` : "/jelly-sprite");
  }

  const saveMenuItems = [
    {
      id: "save",
      label: "Save Project",
      hint: "Ctrl+S",
      action: handleSave,
    },
    { id: "sep1", separator: true },
    {
      id: "pack",
      label: "Pack Animations → Sprite Sheet",
      hint: "Save to project",
      soon: true,
      disabled: true,
      action: () => {},
    },
  ];

  return (
    <Page
      title={
        <EditableTitle
          value={state.name}
          onChange={(name) =>
            dispatch({ type: "SET_PROJECT_NAME", payload: name })
          }
        />
      }
      actions={
        <>
          <button
            className="editor-toolbar__btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            className="editor-toolbar__btn"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            ↪
          </button>
          {state.sheets.length > 0 && (
            <>
              <span className="editor-toolbar__sep" />
              <button
                className="editor-toolbar__btn"
                onClick={handleEditInJellySprite}
                title="Open this sprite sheet in JellySprite to edit"
              >
                Edit in JellySprite ↗
              </button>
            </>
          )}
          <span className="editor-toolbar__sep" />
          <SplitSaveButton
            onSave={handleSave}
            saving={saving}
            saved={saved}
            isDirty={isDirty}
            menuItems={saveMenuItems}
          />
        </>
      }
      scrollable={false}
      padding={false}
    >
      {/* Full-screen drag overlay prevents canvas stealing pointer events */}
      {dragging && <div className="editor__drag-overlay" />}

      <PlaybackProvider>
        <KeyboardHandler onSave={handleSave} onHelp={() => setHelpOpen(true)} />
        <div className="editor-body">
          <div className="editor">
            {/* ── Left panel: importer + frame config ── */}
            <aside
              className={`editor__left${leftOpen ? "" : " editor__left--collapsed"}`}
              style={leftOpen ? { width: leftWidth } : undefined}
            >
              <button
                className="editor__collapse-btn"
                onClick={() => setLeftOpen((o) => !o)}
                title={leftOpen ? "Collapse panel" : "Expand panel"}
                aria-label={
                  leftOpen ? "Collapse left panel" : "Expand left panel"
                }
              >
                {leftOpen ? "‹" : "›"}
              </button>

              {leftOpen && (
                <div className="editor__left-inner">
                  <SheetList />
                  <div className="editor__divider" />
                  <FrameConfigPanel />
                </div>
              )}
            </aside>

            {/* ── Resize handle: left ↔ canvas ── */}
            {leftOpen && (
              <div
                className="editor__resize-handle"
                onMouseDown={startLeftResize}
              />
            )}

            {/* ── Main: sheet viewer OR expanded preview ── */}
            <div className="editor__canvas-area">
              {expandPreview ? (
                <PreviewCanvas
                  expanded
                  onToggleExpand={() => setExpandPreview(false)}
                />
              ) : (
                <SheetViewerCanvas imageUrl={imageUrl} />
              )}
            </div>

            {/* ── Resize handle: canvas ↔ right ── */}
            <div
              className="editor__resize-handle"
              onMouseDown={startRightResize}
            />

            {/* ── Right panel: preview + animations + sequence ── */}
            <aside className="editor__right" style={{ width: rightWidth }}>
              {expandPreview ? (
                <div className="editor__preview-expanded-banner">
                  <span>Preview expanded ↙</span>
                  <button
                    type="button"
                    className="editor__preview-collapse-btn"
                    onClick={() => setExpandPreview(false)}
                    title="Collapse preview back to panel"
                  >
                    ⊠ Collapse
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="editor__preview-wrap"
                    style={{ height: previewHeight }}
                  >
                    <PreviewCanvas
                      onToggleExpand={() => setExpandPreview(true)}
                    />
                  </div>
                  <div
                    className="editor__resize-handle editor__resize-handle--v"
                    onMouseDown={startPreviewResize}
                  />
                </>
              )}
              <AnimationSidebar
                pinnedTrackIds={pinnedTrackIds}
                onTogglePinnedTrack={togglePinnedTrack}
              />
              <div className="editor__right-divider" />
              <SequenceBuilder />
            </aside>
          </div>
          {pinnedTrackIds.length > 0 && (
            <div className="editor__tracks">
              <TracksPanel pinnedTrackIds={pinnedTrackIds} />
            </div>
          )}
        </div>
        {/* editor-body */}
      </PlaybackProvider>
      <KeyboardHelp isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </Page>
  );
}
