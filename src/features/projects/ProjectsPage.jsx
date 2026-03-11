import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../../contexts/ProjectContext";
import { useNotification } from "../../contexts/NotificationContext";
import { Page } from "../../ui/Page";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
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
  const { dispatch } = useProject();
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
                                      className="projects-btn projects-btn--sm projects-btn--primary"
                                      onClick={() =>
                                        handleOpenSprite(sprite.id)
                                      }
                                    >
                                      Open
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <button
                          className="projects-btn projects-btn--add-sprite"
                          onClick={() => setAddSpriteProjectId(project.id)}
                        >
                          + Add Sprite
                        </button>
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
    </Page>
  );
}

export function ProjectsPage() {
  const { state, dispatch } = useProject();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newNameMode, setNewNameMode] = useState(false);
  const [newName, setNewName] = useState("");
  const newNameRef = useRef(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  async function refresh() {
    setProjects(await listProjects());
  }

  async function handleOpen(id) {
    const data = await loadProjectFromStorage(id);
    dispatch({ type: "LOAD_PROJECT", payload: data });
    navigate(data.type === "jelly-sprite" ? "/jelly-sprite" : "/editor");
  }

  async function handleDelete(id) {
    await deleteProjectFromStorage(id);
    setDeleteTarget(null);
    refresh();
  }

  async function handleImportFile() {
    try {
      const data = await pickAndLoadProject();
      await saveProjectToStorage(data);
      dispatch({ type: "LOAD_PROJECT", payload: data });
      navigate(data.type === "jelly-sprite" ? "/jelly-sprite" : "/editor");
    } catch (err) {
      if (err.message !== "No file selected") console.error(err);
      if (err.message !== "No file selected")
        showToast("Failed to import project file.", "error");
    }
  }

  function handleDragEnter(e) {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragOver(true);
  }

  function handleDragLeave() {
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  }

  async function handleDrop(e) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    const file = Array.from(e.dataTransfer.files).find(
      (f) => f.name.endsWith(".doomjelly.json") || f.name.endsWith(".json"),
    );
    if (!file) {
      showToast("Drop a .doomjelly.json file to import.", "error");
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await saveProjectToStorage(data);
      dispatch({ type: "LOAD_PROJECT", payload: data });
      navigate(data.type === "jelly-sprite" ? "/jelly-sprite" : "/editor");
    } catch (err) {
      console.error(err);
      showToast("Failed to import project file.", "error");
    }
  }

  async function handleDownload(id) {
    const data = await loadProjectFromStorage(id);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.name.replace(/[^a-z0-9_\-]/gi, "_")}.doomjelly.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveCurrent() {
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
      downloadProject(state);
      refresh();
    } catch (err) {
      console.error("Failed to save current project:", err);
      showToast("Failed to save project.", "error");
    }
  }

  function startNew() {
    setNewName("");
    setNewNameMode(true);
    setRenamingId(null);
    setTimeout(() => newNameRef.current?.focus(), 0);
  }

  function startRename(p) {
    setRenamingId(p.id);
    setRenameDraft(p.name);
    setNewNameMode(false);
    setTimeout(() => renameRef.current?.select(), 0);
  }

  async function commitRename(id) {
    const name = renameDraft.trim();
    if (name) await renameProject(id, name);
    setRenamingId(null);
    refresh();
    // If this is the currently open project, sync the context name too
    if (state.id === id && name) {
      dispatch({ type: "SET_PROJECT_NAME", payload: name });
    }
  }

  function onRenameKey(e, id) {
    if (e.key === "Enter") commitRename(id);
    if (e.key === "Escape") setRenamingId(null);
  }

  function confirmNew(e) {
    e.preventDefault();
    const name = newName.trim() || "Untitled Project";
    dispatch({
      type: "LOAD_PROJECT",
      payload: { id: crypto.randomUUID(), name, type: "jelly-sprite" },
    });
    setNewNameMode(false);
    navigate("/jelly-sprite");
  }

  const fmt = (iso) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Page
      title="Projects"
      actions={
        <>
          <button className="projects-btn" onClick={handleImportFile}>
            Open file…
          </button>
          <button className="projects-btn" onClick={handleSaveCurrent}>
            Save current
          </button>
          <button
            className="projects-btn projects-btn--primary"
            onClick={startNew}
          >
            + New project
          </button>
        </>
      }
    >
      <div
        className={`projects-drop-root${isDragOver ? " projects-drop-root--over" : ""}`}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="projects-drop-overlay">
            <span className="projects-drop-overlay__label">
              Drop .doomjelly.json to import
            </span>
          </div>
        )}
        {newNameMode && (
          <form className="projects-new-form" onSubmit={confirmNew}>
            <input
              ref={newNameRef}
              className="projects-new-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name…"
            />
            <button
              type="submit"
              className="projects-btn projects-btn--primary"
            >
              Create
            </button>
            <button
              type="button"
              className="projects-btn"
              onClick={() => setNewNameMode(false)}
            >
              Cancel
            </button>
          </form>
        )}

        {projects.length === 0 ? (
          <div className="projects-empty">
            <p className="projects-empty__icon">🪄</p>
            <p className="projects-empty__title">No saved projects yet</p>
            <p className="projects-empty__hint">
              Save your current project or open a .doomjelly.json file to get
              started.
            </p>
          </div>
        ) : (
          <>
            <div className="projects-section-heading">Recent</div>
            <ul className="projects-list">
              {[...projects]
                .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
                .map((p) => (
                  <li key={p.id} className="projects-card">
                    {p.thumbnail && (
                      <img
                        className="projects-card__thumbnail"
                        src={p.thumbnail}
                        alt=""
                        aria-hidden="true"
                      />
                    )}
                    <div className="projects-card__info">
                      {renamingId === p.id ? (
                        <input
                          ref={renameRef}
                          className="projects-rename-input"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onBlur={() => commitRename(p.id)}
                          onKeyDown={(e) => onRenameKey(e, p.id)}
                        />
                      ) : (
                        <span className="projects-card__name">{p.name}</span>
                      )}
                      <span className="projects-card__date">
                        {fmt(p.savedAt)}
                      </span>
                      {(p.animCount != null || p.frameCount != null) && (
                        <span className="projects-card__stats">
                          {p.animCount ?? 0} animation
                          {p.animCount !== 1 ? "s" : ""} · {p.frameCount ?? 0}{" "}
                          frame{p.frameCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="projects-card__actions">
                      <button
                        className="projects-btn projects-btn--sm"
                        onClick={() => startRename(p)}
                        title="Rename project"
                      >
                        Rename
                      </button>
                      <button
                        className="projects-btn projects-btn--sm"
                        onClick={() => handleDownload(p.id)}
                        title="Download .doomjelly.json"
                      >
                        ↓ Export
                      </button>
                      <button
                        className="projects-btn projects-btn--sm projects-btn--danger"
                        onClick={() => setDeleteTarget(p)}
                      >
                        Delete
                      </button>
                      <button
                        className="projects-btn projects-btn--sm projects-btn--primary"
                        onClick={() => handleOpen(p.id)}
                      >
                        Open
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </>
        )}

        {deleteTarget && (
          <ConfirmDialog
            isOpen={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            title="Delete project?"
            message={`"${deleteTarget?.name}" will be permanently removed from this browser.`}
            confirmLabel="Delete"
            onConfirm={() => handleDelete(deleteTarget.id)}
          />
        )}
      </div>
    </Page>
  );
}
