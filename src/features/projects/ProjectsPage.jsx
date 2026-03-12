import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../../contexts/ProjectContext";
import { useNotification } from "../../contexts/NotificationContext";
import { Page } from "../../ui/Page";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import {
  exportJellySheet,
  exportAnimatorSheet,
  exportGif,
  loadImage,
} from "./spriteExport";
import {
  listProjects,
  createProject,
  deleteProject,
  renameProject,
  listSprites,
  loadSprite,
  saveSprite,
  deleteSprite,
  renameSprite,
  pickAndLoadSpriteFile,
} from "../../services/projectService";
import "./ProjectsPage.css";

export function ProjectsPage() {
  const { state, dispatch } = useProject();
  const { showToast } = useNotification();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [sprites, setSprites] = useState({});
  const [loadingSprites, setLoadingSprites] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const renameRef = useRef(null);

  const [newProjectMode, setNewProjectMode] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const newProjectRef = useRef(null);

  const [addSpriteProjectId, setAddSpriteProjectId] = useState(null);

  // Export modal
  const [exportTarget, setExportTarget] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFullData, setExportFullData] = useState(null);
  const [exportError, setExportError] = useState(null);

  // Upload sheet modal
  const [uploadSheetTarget, setUploadSheetTarget] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadImgDims, setUploadImgDims] = useState(null);
  const [uploadFrameW, setUploadFrameW] = useState(32);
  const [uploadFrameH, setUploadFrameH] = useState(32);
  const [uploadName, setUploadName] = useState("");
  const [uploadSaving, setUploadSaving] = useState(false);
  const uploadFileInputRef = useRef(null);

  useEffect(() => {
    listProjects().then(setProjects).catch(console.error);
  }, []);

  async function refreshProjects() {
    const list = await listProjects();
    setProjects(list);
  }

  async function loadSpritesForProject(projectId) {
    setLoadingSprites((prev) => ({ ...prev, [projectId]: true }));
    try {
      const list = await listSprites(projectId);
      setSprites((prev) => ({ ...prev, [projectId]: list }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSprites((prev) => ({ ...prev, [projectId]: false }));
    }
  }

  function toggleExpand(projectId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
        if (!sprites[projectId]) loadSpritesForProject(projectId);
      }
      return next;
    });
  }

  async function handleOpenSprite(spriteId) {
    try {
      const data = await loadSprite(spriteId);
      dispatch({ type: "LOAD_PROJECT", payload: { ...data, id: spriteId } });
      navigate(`/jelly-sprite/${spriteId}`);
    } catch (err) {
      console.error(err);
      showToast("Failed to open sprite.", "error");
    }
  }

  async function handleOpenInAnimator(spriteId) {
    try {
      const data = await loadSprite(spriteId);
      dispatch({ type: "LOAD_PROJECT", payload: { ...data, id: spriteId } });
      navigate("/animator");
    } catch (err) {
      console.error(err);
      showToast("Failed to open sprite in Animator.", "error");
    }
  }

  async function handleAddSheetToAnimator(sprite) {
    if (!state.id) {
      showToast(
        "Open a sprite in the Animator first, then add more sheets.",
        "info",
      );
      return;
    }
    try {
      const data = await loadSprite(sprite.id);
      const as = data.animatorState;
      // Prefer first entry from multi-sheet format, then legacy single-sheet
      const sheetEntry = as?.sheets?.[0] ?? null;
      const dataUrl = sheetEntry?.dataUrl ?? as?.spriteSheet?.dataUrl ?? null;
      if (!dataUrl) {
        showToast(
          `"${sprite.name}" has no sheet image. Open it in the Animator and save it first.`,
          "error",
        );
        return;
      }
      const width = sheetEntry?.width ?? as?.spriteSheet?.width;
      const height = sheetEntry?.height ?? as?.spriteSheet?.height;
      const filename = sheetEntry?.filename ?? sprite.name + ".png";
      // Convert dataUrl → live objectUrl
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const objectUrl = URL.createObjectURL(blob);
      dispatch({
        type: "ADD_SHEET",
        payload: {
          id: crypto.randomUUID(),
          filename,
          objectUrl,
          dataUrl,
          width,
          height,
        },
      });
      navigate("/animator");
    } catch (err) {
      console.error(err);
      showToast("Failed to add sheet to Animator.", "error");
    }
  }

  async function handleDeleteProject(id) {
    try {
      await deleteProject(id);
    } catch (err) {
      console.error(err);
      showToast("Failed to delete project.", "error");
    }
    setDeleteTarget(null);
    setExpanded((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setSprites((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    refreshProjects();
  }

  async function handleDeleteSprite(id, projectId) {
    try {
      await deleteSprite(id);
    } catch (err) {
      console.error(err);
      showToast("Failed to delete sprite.", "error");
    }
    setDeleteTarget(null);
    setSprites((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).filter((s) => s.id !== id),
    }));
  }

  async function handleCreateProject(e) {
    e.preventDefault();
    const name = newProjectName.trim() || "Untitled Project";
    try {
      const project = await createProject(name);
      setProjects((prev) => [project, ...prev]);
      setExpanded((prev) => new Set([...prev, project.id]));
      setSprites((prev) => ({ ...prev, [project.id]: [] }));
    } catch (err) {
      console.error(err);
      showToast("Failed to create project.", "error");
    }
    setNewProjectMode(false);
    setNewProjectName("");
  }

  async function handleRenameCommit() {
    if (!renaming) return;
    const { type, id, draft } = renaming;
    const name = draft.trim();
    setRenaming(null);
    if (!name) return;
    try {
      if (type === "project") {
        await renameProject(id, name);
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name } : p)),
        );
      } else {
        await renameSprite(id, name);
        setSprites((prev) => {
          const next = { ...prev };
          for (const pid of Object.keys(next)) {
            next[pid] = next[pid].map((s) =>
              s.id === id ? { ...s, name } : s,
            );
          }
          return next;
        });
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to rename.", "error");
    }
  }

  function startRename(type, id, currentName, e) {
    e?.stopPropagation();
    setRenaming({ type, id, draft: currentName });
    setTimeout(() => renameRef.current?.select(), 0);
  }

  async function handleAddSpriteBlank(projectId) {
    const spriteId = crypto.randomUUID();
    dispatch({
      type: "LOAD_PROJECT",
      payload: {
        id: spriteId,
        projectId,
        name: "Untitled Sprite",
        type: "jelly-sprite",
        animations: [],
        frameConfig: {
          frameW: 32,
          frameH: 32,
          scale: 2,
          offsetX: 0,
          offsetY: 0,
          gutterX: 0,
          gutterY: 0,
        },
        jellySpriteDataUrl: null,
        jellySpriteState: null,
      },
    });
    setAddSpriteProjectId(null);
    navigate(`/jelly-sprite/${spriteId}`);
  }

  async function handleAddSpriteImport(projectId) {
    setAddSpriteProjectId(null);
    try {
      const data = await pickAndLoadSpriteFile();
      const spriteId = data.id ?? crypto.randomUUID();
      const sprite = { ...data, id: spriteId, projectId };
      await saveSprite(sprite, data.thumbnail ?? undefined);
      dispatch({
        type: "LOAD_PROJECT",
        payload: { ...sprite, type: "jelly-sprite" },
      });
      loadSpritesForProject(projectId);
      navigate(`/jelly-sprite/${spriteId}`);
    } catch (err) {
      if (err.message !== "No file selected") {
        console.error(err);
        showToast("Failed to import sprite file.", "error");
      }
    }
  }

  async function handleExportOpen(sprite, projectId) {
    setExportTarget({ ...sprite, projectId });
    setExportFullData(null);
    setExportError(null);
    setExportLoading(true);
    try {
      const data = await loadSprite(sprite.id);
      setExportFullData(data);
    } catch (err) {
      console.error(err);
      setExportError("Failed to load sprite data.");
    } finally {
      setExportLoading(false);
    }
  }

  function closeExportModal() {
    setExportTarget(null);
    setExportFullData(null);
    setExportError(null);
  }

  async function handleExportOption(type) {
    if (!exportFullData) return;
    const name = exportTarget?.name || "sprite";
    try {
      if (type === "jelly") {
        await exportJellySheet(name, exportFullData.jellySpriteState);
      } else if (type === "animator") {
        await exportAnimatorSheet(name, exportFullData.animatorState);
      } else if (type === "gif") {
        await exportGif(name, exportFullData.jellySpriteState);
      }
    } catch (err) {
      setExportError(err.message);
    }
  }

  function handleUploadFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadImgDims(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setUploadImgDims({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function closeUploadModal() {
    setUploadSheetTarget(null);
    setUploadFile(null);
    setUploadImgDims(null);
    setUploadName("");
    setUploadFrameW(32);
    setUploadFrameH(32);
  }

  async function handleUploadSheetConfirm() {
    if (!uploadFile || !uploadImgDims) return;
    setUploadSaving(true);
    const cols = Math.max(1, Math.floor(uploadImgDims.w / uploadFrameW));
    const rows = Math.max(1, Math.floor(uploadImgDims.h / uploadFrameH));
    const frameCount = cols * rows;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(uploadFile);
    });
    // Create thumbnail from first frame
    let thumbnail = null;
    try {
      const sheetImg = await loadImage(dataUrl);
      const tc = document.createElement("canvas");
      tc.width = uploadFrameW;
      tc.height = uploadFrameH;
      tc.getContext("2d").drawImage(
        sheetImg,
        0,
        0,
        uploadFrameW,
        uploadFrameH,
        0,
        0,
        uploadFrameW,
        uploadFrameH,
      );
      thumbnail = tc.toDataURL("image/png");
    } catch {
      // thumbnail stays null
    }
    const spriteSheet = {
      dataUrl,
      width: uploadImgDims.w,
      height: uploadImgDims.h,
      frameW: uploadFrameW,
      frameH: uploadFrameH,
      cols,
      rows,
      frameCount,
    };
    const { projectId, spriteId } = uploadSheetTarget;
    try {
      if (spriteId) {
        const existing = await loadSprite(spriteId);
        await saveSprite(
          {
            ...existing,
            id: spriteId,
            projectId,
            jellyBody: existing.jellySpriteState ?? null,
            animatorBody: { spriteSheet },
          },
          existing.thumbnail ?? thumbnail ?? undefined,
        );
        loadSpritesForProject(projectId);
        showToast("Sprite sheet updated.", "success");
        closeUploadModal();
      } else {
        const newId = crypto.randomUUID();
        const name = uploadName.trim() || "Untitled Sprite";
        await saveSprite(
          {
            id: newId,
            projectId,
            name,
            frameCount,
            canvasW: uploadFrameW,
            canvasH: uploadFrameH,
            jellyBody: null,
            animatorBody: { spriteSheet },
          },
          thumbnail ?? undefined,
        );
        loadSpritesForProject(projectId);
        dispatch({
          type: "LOAD_PROJECT",
          payload: {
            id: newId,
            projectId,
            name,
            animatorState: { spriteSheet },
          },
        });
        closeUploadModal();
        navigate("/animator");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to upload sprite sheet.", "error");
    } finally {
      setUploadSaving(false);
    }
  }

  const fmt = (iso) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <Page
      title="Projects"
      actions={
        <button
          className="projects-btn projects-btn--primary"
          onClick={() => {
            setNewProjectMode(true);
            setNewProjectName("");
            setTimeout(() => newProjectRef.current?.focus(), 0);
          }}
        >
          + New Project
        </button>
      }
    >
      {newProjectMode && (
        <form className="projects-new-form" onSubmit={handleCreateProject}>
          <input
            ref={newProjectRef}
            className="projects-new-input"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name…"
          />
          <button type="submit" className="projects-btn projects-btn--primary">
            Create
          </button>
          <button
            type="button"
            className="projects-btn"
            onClick={() => setNewProjectMode(false)}
          >
            Cancel
          </button>
        </form>
      )}

      {projects.length === 0 && !newProjectMode ? (
        <div className="projects-empty">
          <p className="projects-empty__icon">🪄</p>
          <p className="projects-empty__title">No projects yet</p>
          <p className="projects-empty__hint">
            Create a project to organize your sprites.
          </p>
        </div>
      ) : (
        <ul className="projects-accordion">
          {projects.map((project) => {
            const isOpen = expanded.has(project.id);
            const isRenamingProject =
              renaming?.type === "project" && renaming.id === project.id;
            const projectSprites = sprites[project.id] ?? [];

            return (
              <li
                key={project.id}
                className={`projects-accordion__item${isOpen ? " projects-accordion__item--open" : ""}`}
              >
                <div className="projects-accordion__header">
                  <button
                    className="projects-accordion__toggle"
                    onClick={() => toggleExpand(project.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="projects-accordion__arrow">
                      {isOpen ? "▾" : "▸"}
                    </span>
                    {isRenamingProject ? (
                      <input
                        ref={renameRef}
                        className="projects-rename-input projects-rename-input--inline"
                        value={renaming.draft}
                        onChange={(e) =>
                          setRenaming((r) => ({ ...r, draft: e.target.value }))
                        }
                        onBlur={handleRenameCommit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameCommit();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="projects-accordion__name">
                        {project.name}
                      </span>
                    )}
                    {isOpen && !loadingSprites[project.id] && (
                      <span className="projects-accordion__count">
                        {projectSprites.length} sprite
                        {projectSprites.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                  <div className="projects-accordion__actions">
                    <button
                      className="projects-btn projects-btn--sm"
                      onClick={(e) =>
                        startRename("project", project.id, project.name, e)
                      }
                    >
                      Rename
                    </button>
                    <button
                      className="projects-btn projects-btn--sm projects-btn--danger"
                      onClick={() =>
                        setDeleteTarget({
                          type: "project",
                          id: project.id,
                          name: project.name,
                        })
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="projects-accordion__body">
                    {loadingSprites[project.id] ? (
                      <p className="projects-accordion__loading">Loading…</p>
                    ) : (
                      <>
                        {projectSprites.length > 0 && (
                          <ul className="projects-sprites">
                            {projectSprites.map((sprite) => {
                              const isRenamingSprite =
                                renaming?.type === "sprite" &&
                                renaming.id === sprite.id;
                              return (
                                <li
                                  key={sprite.id}
                                  className="projects-sprite-card"
                                >
                                  {sprite.thumbnail && (
                                    <img
                                      className="projects-sprite-card__thumb"
                                      src={sprite.thumbnail}
                                      alt=""
                                      aria-hidden
                                    />
                                  )}
                                  <div className="projects-sprite-card__info">
                                    {isRenamingSprite ? (
                                      <input
                                        ref={renameRef}
                                        className="projects-rename-input"
                                        value={renaming.draft}
                                        onChange={(e) =>
                                          setRenaming((r) => ({
                                            ...r,
                                            draft: e.target.value,
                                          }))
                                        }
                                        onBlur={handleRenameCommit}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            handleRenameCommit();
                                          if (e.key === "Escape")
                                            setRenaming(null);
                                        }}
                                      />
                                    ) : (
                                      <span className="projects-sprite-card__name">
                                        {sprite.name}
                                      </span>
                                    )}
                                    <span className="projects-sprite-card__stats">
                                      {sprite.animCount ?? 0} anim ·{" "}
                                      {sprite.frameCount ?? 0} frames
                                    </span>
                                    {sprite.updatedAt && (
                                      <span className="projects-sprite-card__date">
                                        {fmt(sprite.updatedAt)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="projects-sprite-card__actions">
                                    <button
                                      className="projects-btn projects-btn--sm"
                                      onClick={() =>
                                        startRename(
                                          "sprite",
                                          sprite.id,
                                          sprite.name,
                                        )
                                      }
                                    >
                                      Rename
                                    </button>
                                    <button
                                      className="projects-btn projects-btn--sm projects-btn--danger"
                                      onClick={() =>
                                        setDeleteTarget({
                                          type: "sprite",
                                          id: sprite.id,
                                          projectId: project.id,
                                          name: sprite.name,
                                        })
                                      }
                                    >
                                      Delete
                                    </button>
                                    <button
                                      className="projects-btn projects-btn--sm"
                                      onClick={() =>
                                        handleExportOpen(sprite, project.id)
                                      }
                                      title="Export sprite"
                                    >
                                      Export ↓
                                    </button>
                                    <button
                                      className="projects-btn projects-btn--sm"
                                      onClick={() =>
                                        handleOpenInAnimator(sprite.id)
                                      }
                                      title="Open sprite sheet in Animator (replaces current session)"
                                    >
                                      Animator ↗
                                    </button>
                                    <button
                                      className="projects-btn projects-btn--sm"
                                      disabled={!state.id}
                                      onClick={() =>
                                        handleAddSheetToAnimator(sprite)
                                      }
                                      title={
                                        state.id
                                          ? "Add this sprite's sheet to the current Animator session"
                                          : "Open a sprite in the Animator first"
                                      }
                                    >
                                      + Sheet
                                    </button>
                                    <button
                                      className="projects-btn projects-btn--sm projects-btn--primary"
                                      onClick={() =>
                                        handleOpenSprite(sprite.id)
                                      }
                                    >
                                      Edit ✏️
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <div className="projects-accordion__add-row">
                          <button
                            className="projects-btn projects-btn--add-sprite"
                            onClick={() => setAddSpriteProjectId(project.id)}
                          >
                            + Add Sprite
                          </button>
                          <button
                            className="projects-btn projects-btn--add-sprite"
                            onClick={() =>
                              setUploadSheetTarget({
                                projectId: project.id,
                                spriteId: null,
                                spriteName: "",
                              })
                            }
                          >
                            + Upload Sheet
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {deleteTarget && (
        <ConfirmDialog
          isOpen
          onClose={() => setDeleteTarget(null)}
          title={`Delete ${deleteTarget.type}?`}
          message={`"${deleteTarget.name}" will be permanently removed.`}
          confirmLabel="Delete"
          onConfirm={() =>
            deleteTarget.type === "project"
              ? handleDeleteProject(deleteTarget.id)
              : handleDeleteSprite(deleteTarget.id, deleteTarget.projectId)
          }
        />
      )}

      {addSpriteProjectId && (
        <div
          className="projects-modal-overlay"
          onClick={() => setAddSpriteProjectId(null)}
        >
          <div className="projects-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="projects-modal__title">Add Sprite</h2>
            <p className="projects-modal__desc">
              How would you like to add a sprite to this project?
            </p>
            <div className="projects-modal__options">
              <button
                className="projects-modal__option"
                onClick={() => handleAddSpriteBlank(addSpriteProjectId)}
              >
                <span className="projects-modal__option-icon">✏️</span>
                <span className="projects-modal__option-label">
                  Start in JellySprite
                </span>
                <span className="projects-modal__option-hint">
                  Open a blank canvas in the sprite editor
                </span>
              </button>
              <button
                className="projects-modal__option"
                onClick={() => handleAddSpriteImport(addSpriteProjectId)}
              >
                <span className="projects-modal__option-icon">📂</span>
                <span className="projects-modal__option-label">
                  Import file
                </span>
                <span className="projects-modal__option-hint">
                  Load a .doomjelly.json sprite file
                </span>
              </button>
            </div>
            <button
              className="projects-btn"
              onClick={() => setAddSpriteProjectId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Export modal ── */}
      {exportTarget && (
        <div className="projects-modal-overlay" onClick={closeExportModal}>
          <div
            className="projects-modal projects-modal--export"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="projects-modal__header">
              <h2 className="projects-modal__title">
                Export: {exportTarget.name}
              </h2>
              <button
                className="projects-modal__close"
                onClick={closeExportModal}
              >
                ✕
              </button>
            </div>
            {exportLoading ? (
              <p className="projects-modal__status">Loading…</p>
            ) : (
              <div className="projects-export-options">
                {(() => {
                  const jellyFrames =
                    exportFullData?.jellySpriteState?.frames ?? [];
                  const hasFlat = jellyFrames.some((f) => f.flatImage);
                  const hasAnimator =
                    !!exportFullData?.animatorState?.spriteSheet?.dataUrl;
                  const gifFrames = jellyFrames.filter(
                    (f) => f.flatImage,
                  ).length;
                  return (
                    <>
                      <button
                        className="projects-export-option"
                        disabled={!hasFlat}
                        onClick={() => handleExportOption("jelly")}
                        title={
                          hasFlat
                            ? ""
                            : "Save the sprite in JellySprite first to generate frame data"
                        }
                      >
                        <span className="projects-export-option__label">
                          PNG — JellySprite sheet
                        </span>
                        <span className="projects-export-option__hint">
                          All frames from the pixel editor
                        </span>
                      </button>
                      <button
                        className="projects-export-option"
                        disabled={!hasAnimator}
                        onClick={() => handleExportOption("animator")}
                        title={
                          hasAnimator
                            ? ""
                            : "Open in Animator and set up animations first"
                        }
                      >
                        <span className="projects-export-option__label">
                          PNG + JSON — Animator sheet
                        </span>
                        <span className="projects-export-option__hint">
                          Sprite sheet with animation metadata
                        </span>
                      </button>
                      <button
                        className="projects-export-option"
                        disabled={gifFrames < 2}
                        onClick={() => handleExportOption("gif")}
                        title={
                          gifFrames < 2
                            ? "Requires at least 2 saved frames"
                            : ""
                        }
                      >
                        <span className="projects-export-option__label">
                          GIF — Animated
                        </span>
                        <span className="projects-export-option__hint">
                          Animated GIF from pixel frames
                        </span>
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
            {exportError && (
              <p className="projects-modal__error">{exportError}</p>
            )}
            <button className="projects-btn" onClick={closeExportModal}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Upload sheet modal ── */}
      {uploadSheetTarget && (
        <div className="projects-modal-overlay" onClick={closeUploadModal}>
          <div
            className="projects-modal projects-modal--upload"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="projects-modal__header">
              <h2 className="projects-modal__title">
                {uploadSheetTarget.spriteId
                  ? `Update sheet: ${uploadSheetTarget.spriteName}`
                  : "Upload Sprite Sheet"}
              </h2>
              <button
                className="projects-modal__close"
                onClick={closeUploadModal}
              >
                ✕
              </button>
            </div>
            {!uploadSheetTarget.spriteId && (
              <div className="projects-upload-row">
                <label className="projects-upload-label">Sprite name</label>
                <input
                  className="projects-upload-input"
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Untitled Sprite"
                />
              </div>
            )}
            <input
              ref={uploadFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={handleUploadFileChange}
            />
            <button
              className="projects-upload-drop"
              onClick={() => uploadFileInputRef.current?.click()}
            >
              {uploadFile ? (
                <span>
                  📄 {uploadFile.name}
                  {uploadImgDims
                    ? ` (${uploadImgDims.w} × ${uploadImgDims.h} px)`
                    : ""}
                </span>
              ) : (
                <span>Click to browse for an image…</span>
              )}
            </button>
            {uploadFile && (
              <>
                <div className="projects-upload-row">
                  <label className="projects-upload-label">
                    Frame width (px)
                  </label>
                  <input
                    className="projects-upload-number"
                    type="number"
                    min={1}
                    value={uploadFrameW}
                    onChange={(e) =>
                      setUploadFrameW(Math.max(1, Number(e.target.value)))
                    }
                  />
                </div>
                <div className="projects-upload-row">
                  <label className="projects-upload-label">
                    Frame height (px)
                  </label>
                  <input
                    className="projects-upload-number"
                    type="number"
                    min={1}
                    value={uploadFrameH}
                    onChange={(e) =>
                      setUploadFrameH(Math.max(1, Number(e.target.value)))
                    }
                  />
                </div>
                {uploadImgDims && (
                  <p className="projects-upload-preview">
                    {Math.floor(uploadImgDims.w / uploadFrameW)} ×{" "}
                    {Math.floor(uploadImgDims.h / uploadFrameH)} ={" "}
                    {Math.floor(uploadImgDims.w / uploadFrameW) *
                      Math.floor(uploadImgDims.h / uploadFrameH)}{" "}
                    frames
                  </p>
                )}
              </>
            )}
            <div className="projects-modal__footer">
              <button className="projects-btn" onClick={closeUploadModal}>
                Cancel
              </button>
              <button
                className="projects-btn projects-btn--primary"
                disabled={!uploadFile || !uploadImgDims || uploadSaving}
                onClick={handleUploadSheetConfirm}
              >
                {uploadSaving
                  ? "Saving…"
                  : uploadSheetTarget.spriteId
                    ? "Update Sheet"
                    : "Create Sprite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
