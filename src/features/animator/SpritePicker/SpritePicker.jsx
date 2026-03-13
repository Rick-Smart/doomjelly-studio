import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDocumentStore } from "../../../contexts/useDocumentStore.js";
import { useAnimatorStore } from "../../../contexts/useAnimatorStore.js";
import { listProjects, listSprites } from "../../../services/projectService";
import { loadDocument } from "../../../services/documentService";
import "./SpritePicker.css";

/**
 * Inline project/sprite tree shown in the Animator when no sheets are loaded.
 * Lets the user open any saved sprite directly without navigating to Projects.
 *
 * On sprite selection: loads the document and dispatches LOAD_PROJECT to both
 * useDocumentStore and useAnimatorStore, then navigates to /animator/:id so the
 * new AnimatorPage mount picks up the restored sheets via the [] restore effect.
 */
export function SpritePicker() {
  const { dispatch: docDispatch } = useDocumentStore();
  const { dispatch: animDispatch } = useAnimatorStore();
  const navigate = useNavigate();

  // null = loading, [] = no projects
  const [projects, setProjects] = useState(null);
  // projectId → sprite[] (populated on expand)
  const [sprites, setSprites] = useState({});
  const [expanded, setExpanded] = useState(new Set());
  // spriteId being opened right now
  const [opening, setOpening] = useState(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  async function toggleProject(projectId) {
    const next = new Set(expanded);
    if (next.has(projectId)) {
      next.delete(projectId);
      setExpanded(next);
      return;
    }
    next.add(projectId);
    setExpanded(next);
    if (!sprites[projectId]) {
      const list = await listSprites(projectId).catch(() => []);
      setSprites((prev) => ({ ...prev, [projectId]: list }));
    }
  }

  async function handleOpen(spriteId) {
    if (opening) return;
    setOpening(spriteId);
    try {
      const data = await loadDocument(spriteId);
      if (!data) throw new Error("Sprite not found");
      // Pre-populate both stores before navigating. When the new AnimatorPage
      // mounts at /animator/:id, its [] restore effect will find sheets with
      // dataUrl but no objectUrl and create the objectUrls. The load guard
      // (sheets.length > 0) will then skip the redundant IDB read.
      docDispatch({ type: "LOAD_PROJECT", payload: data });
      animDispatch({ type: "LOAD_PROJECT", payload: data });
      navigate(`/animator/${spriteId}`, { replace: true });
    } catch {
      setOpening(null);
    }
  }

  if (projects === null) {
    return <p className="sprite-picker__status">Loading projects…</p>;
  }

  if (projects.length === 0) {
    return (
      <div className="sprite-picker">
        <p className="sprite-picker__status">No projects yet.</p>
        <button
          className="sprite-picker__link"
          onClick={() => navigate("/projects")}
        >
          Go to Projects to create one ↗
        </button>
      </div>
    );
  }

  return (
    <div className="sprite-picker">
      <p className="sprite-picker__hint">Open a sprite:</p>
      <ul className="sprite-picker__projects">
        {projects.map((project) => {
          const isOpen = expanded.has(project.id);
          const list = sprites[project.id];
          return (
            <li key={project.id} className="sprite-picker__project">
              <button
                className={`sprite-picker__project-btn${isOpen ? " sprite-picker__project-btn--open" : ""}`}
                onClick={() => toggleProject(project.id)}
              >
                <span className="sprite-picker__arrow" aria-hidden>
                  {isOpen ? "▾" : "▸"}
                </span>
                {project.name}
              </button>

              {isOpen && (
                <ul className="sprite-picker__sprites">
                  {list === undefined ? (
                    <li className="sprite-picker__status">Loading…</li>
                  ) : list.length === 0 ? (
                    <li className="sprite-picker__status">No sprites</li>
                  ) : (
                    list.map((sprite) => (
                      <li key={sprite.id}>
                        <button
                          className="sprite-picker__sprite-btn"
                          onClick={() => handleOpen(sprite.id)}
                          disabled={!!opening}
                          title={`Open "${sprite.name}" in Animator`}
                        >
                          {opening === sprite.id ? "Opening…" : sprite.name}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
