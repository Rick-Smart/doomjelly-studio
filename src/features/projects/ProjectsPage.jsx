import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../../contexts/ProjectContext";
import { Page } from "../../ui/Page";
import {
  listProjects,
  loadProjectFromStorage,
  deleteProjectFromStorage,
  pickAndLoadProject,
  saveProjectToStorage,
  serialiseProject,
  downloadProject,
  renameProject,
} from "../../services/projectService";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import "./ProjectsPage.css";

export function ProjectsPage() {
  const { state, dispatch } = useProject();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newNameMode, setNewNameMode] = useState(false);
  const [newName, setNewName] = useState("");
  const newNameRef = useRef(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameRef = useRef(null);

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  async function refresh() {
    setProjects(await listProjects());
  }

  async function handleOpen(id) {
    const data = await loadProjectFromStorage(id);
    dispatch({ type: "LOAD_PROJECT", payload: data });
    navigate("/editor");
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
      navigate("/editor");
    } catch (err) {
      if (err.message !== "No file selected") console.error(err);
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

  function handleSaveCurrent() {
    const data = serialiseProject(state);
    if (!state.id) dispatch({ type: "SET_PROJECT_ID", payload: data.id });
    saveProjectToStorage(data).then(refresh);
    downloadProject(state);
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
    dispatch({ type: "RESET_PROJECT" });
    dispatch({ type: "SET_PROJECT_NAME", payload: name });
    setNewNameMode(false);
    navigate("/editor");
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
      {newNameMode && (
        <form className="projects-new-form" onSubmit={confirmNew}>
          <input
            ref={newNameRef}
            className="projects-new-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name…"
          />
          <button type="submit" className="projects-btn projects-btn--primary">
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
        <ul className="projects-list">
          {projects.map((p) => (
            <li key={p.id} className="projects-card">
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
                <span className="projects-card__date">{fmt(p.savedAt)}</span>
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
    </Page>
  );
}
