import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import "./EditorPage.css";

/**
 * Keyboard shortcuts — lives inside PlaybackProvider so it can access both
 * PlaybackContext (play/pause/seek) and ProjectContext (undo/redo/save).
 */
function KeyboardHandler({ onSave, onHelp }) {
  const { state, undo, redo, canUndo, canRedo } = useProject();
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
    onSave,
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

export function EditorPage() {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useProject();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const imageUrl = state.spriteSheet?.objectUrl ?? null;
  const [leftOpen, setLeftOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const data = serialiseProject(state);
      if (!state.id) dispatch({ type: "SET_PROJECT_ID", payload: data.id });
      await saveProjectToStorage(data);
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
          <button
            className="editor-toolbar__btn editor-toolbar__btn--primary"
            onClick={handleSave}
            disabled={saving}
            title="Save project to Projects list"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </button>
        </>
      }
      scrollable={false}
      padding={false}
    >
      <div className="editor">
        {/* ── Left panel: importer + frame config ── */}
        <aside
          className={`editor__left${leftOpen ? "" : " editor__left--collapsed"}`}
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

        {/* ── Main: sheet viewer canvas ── */}
        <div className="editor__canvas-area">
          <SheetViewerCanvas imageUrl={imageUrl} />
        </div>

        {/* ── Right panel: preview + animations + sequence ── */}
        <aside className="editor__right">
          <PlaybackProvider>
            <KeyboardHandler
              onSave={handleSave}
              onHelp={() => setHelpOpen(true)}
            />
            <PreviewCanvas />
            <div className="editor__right-divider" />
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
