import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../../../contexts/ProjectContext";
import { PlaybackProvider } from "../../../contexts/PlaybackContext";
import { Page } from "../../../ui/Page";
import { SpriteImporter } from "../SpriteImporter";
import { FrameConfigPanel } from "../FrameConfigPanel";
import { SheetViewerCanvas } from "../SheetViewerCanvas";
import { AnimationSidebar } from "../AnimationSidebar";
import { SequenceBuilder } from "../SequenceBuilder";
import { PreviewCanvas } from "../PreviewCanvas";
import {
  serialiseProject,
  downloadProject,
  pickAndLoadProject,
  saveProjectToStorage,
} from "../../../services/projectService";
import { ExportPanel } from "../../export/ExportPanel";
import "./EditorPage.css";

export function EditorPage() {
  const { state, dispatch } = useProject();
  const navigate = useNavigate();
  const imageUrl = state.spriteSheet?.objectUrl ?? null;
  const [leftOpen, setLeftOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const data = serialiseProject(state);
      // Ensure the project has an id in context
      if (!state.id) dispatch({ type: "SET_PROJECT_ID", payload: data.id });
      await saveProjectToStorage(data);
      downloadProject(state);
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
      }
    }
  }

  return (
    <Page
      title={state.name}
      actions={
        <>
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
            title="Save project and download .doomjelly.json"
          >
            {saving ? "Saving…" : "Save"}
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
            <PreviewCanvas />
            <div className="editor__right-divider" />
            <AnimationSidebar />
            <div className="editor__right-divider" />
            <SequenceBuilder />
          </PlaybackProvider>
        </aside>
      </div>
      <ExportPanel isOpen={exportOpen} onClose={() => setExportOpen(false)} />
    </Page>
  );
}
