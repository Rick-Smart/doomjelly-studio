import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { useProject } from "../../../contexts/ProjectContext";
import { useNotification } from "../../../contexts/NotificationContext";
import {
  PlaybackProvider,
  usePlayback,
} from "../../../contexts/PlaybackContext";
import { Page } from "../../../ui/Page";
import { SpriteImporter } from "../SpriteImporter";
import { FrameConfigPanel } from "../FrameConfigPanel";
import { SheetViewerCanvas } from "../SheetViewerCanvas";
import { AnimationSidebar } from "../AnimationSidebar";
import { SequenceBuilder } from "../SequenceBuilder";
import { PreviewCanvas } from "../PreviewCanvas";
import {
  serialiseProject,
  pickAndLoadProject,
  saveProjectToStorage,
} from "../../../services/projectService";
import { ExportPanel } from "../../export/ExportPanel";
import { KeyboardHelp } from "../KeyboardHelp";
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
        const { activeAnimationId, spriteSheet, frameConfig } = state;
        if (!activeAnimationId || !spriteSheet) return;
        e.preventDefault();
        const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } =
          frameConfig;
        const stepX = frameW + gutterX;
        const stepY = frameH + gutterY;
        if (!frameW || !frameH || stepX <= 0 || stepY <= 0) return;
        const cols = Math.floor((spriteSheet.width - offsetX) / stepX);
        const rows = Math.floor((spriteSheet.height - offsetY) / stepY);
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
    state.spriteSheet,
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

export function AnimatorPage() {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useProject();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const imageUrl = state.spriteSheet?.objectUrl ?? null;
  const [leftOpen, setLeftOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useLocalStorage("dj-panel-left", 220);
  const [rightWidth, setRightWidth] = useLocalStorage("dj-panel-right", 380);
  const [dragging, setDragging] = useState(false);
  const [previewHeight, setPreviewHeight] = useLocalStorage(
    "dj-panel-preview",
    220,
  );

  // When a sprite is opened from Projects via "Animator ↗", state.animatorState
  // is pre-populated with the assembled sprite sheet from JellySprite.
  // Restore it so the user doesn't need to re-import the image.
  useEffect(() => {
    const as = state.animatorState;
    if (!as?.spriteSheet?.dataUrl) return;
    // Only restore if there's no sheet already loaded in context
    if (state.spriteSheet?.objectUrl) return;
    const { dataUrl, width, height, frameW, frameH } = as.spriteSheet;
    // Convert the stored data URL to a blob URL so SpriteImporter behaves
    // identically to a freshly imported file
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        dispatch({
          type: "SET_SPRITE_SHEET",
          payload: {
            objectUrl,
            filename: `${state.name}.png`,
            width,
            height,
          },
        });
        // Pre-fill frame config from the sprite sheet dimensions
        if (frameW && frameH) {
          dispatch({
            type: "SET_FRAME_CONFIG",
            payload: {
              frameW,
              frameH,
              scale: 2,
              offsetX: 0,
              offsetY: 0,
              gutterX: 0,
              gutterY: 0,
            },
          });
        }
      })
      .catch((err) => {
        console.error("Failed to restore animator sprite sheet:", err);
        showToast(
          "Could not restore sprite sheet — please re-import.",
          "error",
        );
      });
    // Run once on mount only
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
        Math.min(480, Math.max(100, startH + (e.clientY - startY))),
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
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const data = serialiseProject(state);
      if (!state.id) dispatch({ type: "SET_PROJECT_ID", payload: data.id });
      const imageUrl = state.spriteSheet?.objectUrl ?? null;
      const thumbnail = imageUrl
        ? await generateThumbnail(
            imageUrl,
            state.frameConfig,
            state.animations,
          ).catch(() => undefined)
        : undefined;
      await saveProjectToStorage(data, thumbnail);
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

  async function handleOpen() {
    try {
      const data = await pickAndLoadProject();
      await saveProjectToStorage(data);
      dispatch({ type: "LOAD_PROJECT", payload: data });
    } catch (err) {
      if (err.message !== "No file selected") {
        console.error("Failed to load project:", err);
        showToast("Failed to load project file.", "error");
      }
    }
  }

  async function handleEditInJellySprite() {
    const sh = state.spriteSheet;
    if (sh?.objectUrl) {
      let src = sh.objectUrl;
      if (!src.startsWith("data:")) {
        try {
          const img = new Image();
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
            img.src = src;
          });
          const cvs = document.createElement("canvas");
          cvs.width = sh.width;
          cvs.height = sh.height;
          cvs.getContext("2d").drawImage(img, 0, 0);
          src = cvs.toDataURL("image/png");
        } catch {
          src = null;
        }
      }
      if (src) dispatch({ type: "SET_JELLY_SPRITE_DATA", payload: src });
    }
    navigate("/jelly-sprite");
  }

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
          <span className="editor-toolbar__sep" />
          <button
            className="editor-toolbar__btn"
            onClick={handleOpen}
            title="Open .doomjelly.json file"
          >
            Open
          </button>
          <button
            className="editor-toolbar__btn"
            onClick={() => setExportOpen(true)}
            title="Export animations as JSON"
          >
            Export
          </button>
          {state.spriteSheet && (
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
          <button
            className="editor-toolbar__btn editor-toolbar__btn--primary"
            onClick={handleSave}
            disabled={saving}
            title="Save project"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </button>
        </>
      }
      scrollable={false}
      padding={false}
    >
      {/* Full-screen drag overlay prevents canvas stealing pointer events */}
      {dragging && <div className="editor__drag-overlay" />}

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
            aria-label={leftOpen ? "Collapse left panel" : "Expand left panel"}
          >
            {leftOpen ? "‹" : "›"}
          </button>

          {leftOpen && (
            <div className="editor__left-inner">
              <SpriteImporter />
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

        {/* ── Main: sheet viewer canvas ── */}
        <div className="editor__canvas-area">
          <SheetViewerCanvas imageUrl={imageUrl} />
        </div>

        {/* ── Resize handle: canvas ↔ right ── */}
        <div className="editor__resize-handle" onMouseDown={startRightResize} />

        {/* ── Right panel: preview + animations + sequence ── */}
        <aside className="editor__right" style={{ width: rightWidth }}>
          <PlaybackProvider>
            <KeyboardHandler
              onSave={handleSave}
              onHelp={() => setHelpOpen(true)}
            />
            <div
              className="editor__preview-wrap"
              style={{ height: previewHeight }}
            >
              <PreviewCanvas />
            </div>
            <div
              className="editor__resize-handle editor__resize-handle--v"
              onMouseDown={startPreviewResize}
            />
            <AnimationSidebar />
            <div className="editor__right-divider" />
            <SequenceBuilder />
          </PlaybackProvider>
        </aside>
      </div>
      <ExportPanel isOpen={exportOpen} onClose={() => setExportOpen(false)} />
      <KeyboardHelp isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </Page>
  );
}
