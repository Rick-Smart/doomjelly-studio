import { useState } from "react";
import { SpriteImporter } from "./SpriteImporter";
import { FrameConfigPanel } from "./FrameConfigPanel";
import { SheetViewerCanvas } from "./SheetViewerCanvas";
import { AnimationSidebar } from "./AnimationSidebar";
import { SequenceBuilder } from "./SequenceBuilder";
import { PreviewCanvas } from "./PreviewCanvas";
import "./EditorPage.css";

export function EditorPage() {
  const [imageUrl, setImageUrl] = useState(null);
  const [leftOpen, setLeftOpen] = useState(true);

  return (
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
            <SpriteImporter onSheetLoaded={(url) => setImageUrl(url)} />
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
        <PreviewCanvas />
        <div className="editor__right-divider" />
        <AnimationSidebar />
        <div className="editor__right-divider" />
        <SequenceBuilder />
      </aside>
    </div>
  );
}
