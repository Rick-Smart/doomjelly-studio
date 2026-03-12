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
