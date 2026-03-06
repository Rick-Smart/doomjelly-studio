import { useState } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { EmptyState } from "../../../ui/EmptyState";
import { IconButton } from "../../../ui/IconButton";
import { ConfirmDialog } from "../../../ui/ConfirmDialog";
import "./AnimationSidebar.css";

export function AnimationSidebar() {
  const { state, dispatch } = useProject();
  const { animations, activeAnimationId } = state;

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  function addAnimation() {
    const id = crypto.randomUUID();
    dispatch({
      type: "ADD_ANIMATION",
      payload: { id, name: "New Animation", frames: [] },
    });
    setEditingId(id);
    setEditName("New Animation");
  }

  function startRename(anim, e) {
    e.stopPropagation();
    setEditingId(anim.id);
    setEditName(anim.name);
  }

  function commitRename() {
    if (editingId && editName.trim()) {
      dispatch({
        type: "RENAME_ANIMATION",
        payload: { id: editingId, name: editName.trim() },
      });
    }
    setEditingId(null);
  }

  function handleRenameKey(e) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setEditingId(null);
  }

  return (
    <div className="anim-sidebar">
      <div className="anim-sidebar__header">
        <span className="panel-heading">Animations</span>
        {animations.length > 0 && (
          <IconButton
            icon="+"
            title="Add animation"
            onClick={addAnimation}
            size="sm"
          />
        )}
      </div>

      {animations.length === 0 ? (
        <div className="anim-sidebar__onboard">
          <p className="anim-sidebar__onboard-text">
            Create an animation, then click cells on the sprite sheet to add
            frames to it.
          </p>
          <button className="anim-sidebar__cta" onClick={addAnimation}>
            + New Animation
          </button>
        </div>
      ) : (
        <ul className="anim-sidebar__list">
          {animations.map((anim) => (
            <li
              key={anim.id}
              className={`anim-sidebar__item${anim.id === activeAnimationId ? " anim-sidebar__item--active" : ""}`}
              onClick={() =>
                dispatch({ type: "SET_ACTIVE_ANIMATION", payload: anim.id })
              }
            >
              {editingId === anim.id ? (
                <input
                  className="anim-sidebar__rename"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={handleRenameKey}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="anim-sidebar__name"
                  onDoubleClick={(e) => startRename(anim, e)}
                  title="Double-click to rename"
                >
                  {anim.name}
                </span>
              )}
              <span className="anim-sidebar__meta">{anim.frames.length}f</span>
              <IconButton
                icon="⎘"
                title="Duplicate animation"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "DUPLICATE_ANIMATION", payload: anim.id });
                }}
              />
              <IconButton
                icon="×"
                title="Delete animation"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(anim);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          dispatch({ type: "DELETE_ANIMATION", payload: deleteTarget.id });
          setDeleteTarget(null);
        }}
        title="Delete Animation"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
