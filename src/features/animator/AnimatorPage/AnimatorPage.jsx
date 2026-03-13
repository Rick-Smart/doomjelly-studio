import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { useProject } from "../../../contexts/ProjectContext";
import { useNotification } from "../../../contexts/NotificationContext";
import { PlaybackProvider } from "../../../contexts/PlaybackContext";
import { Page } from "../../../ui/Page";
import { FrameConfigPanel } from "../FrameConfigPanel";
import { SheetViewerCanvas } from "../SheetViewerCanvas";
import { AnimationSidebar } from "../AnimationSidebar";
import { SequenceBuilder } from "../SequenceBuilder";
import { PreviewCanvas } from "../PreviewCanvas";
import { saveSprite } from "../../../services/projectService";
import { buildAnimatorBody } from "../animatorSerializer";
import { KeyboardHelp } from "../KeyboardHelp";
import { TracksPanel } from "../TracksPanel";
import { generateThumbnail } from "../../../services/imageExportService";
import { useAnimatorKeyboard } from "../hooks/useAnimatorKeyboard";
import { SheetList } from "../SheetList";
import { SplitButton } from "../../../ui/SplitButton";
import { EditableTitle } from "../../../ui/EditableTitle";
import "./AnimatorPage.css";

/**
 * Thin component wrapper so the keyboard hook can live inside PlaybackProvider.
 * Must be rendered as a child of PlaybackProvider (and ProjectContext).
 */
function KeyboardHandler({ onSave, onHelp }) {
  useAnimatorKeyboard({ onSave, onHelp });
  return null;
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
          <SplitButton
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
