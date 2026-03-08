import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../../contexts/ProjectContext";
import { useNotification } from "../../contexts/NotificationContext";
import { Page } from "../../ui/Page";
import {
  serialiseProject,
  saveProjectToStorage,
} from "../../services/projectService";
import { JellySprite } from "./JellySprite";
import { ErrorBoundary } from "../../ui/ErrorBoundary/ErrorBoundary";

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

export function JellySpriteWorkspace() {
  const { state, dispatch } = useProject();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Collector registered by JellySprite on mount — returns the full serialized
  // JellySprite state when called.  We call it right before saving so the
  // snapshot is always current.
  const jellySpriteCollectorRef = useRef(null);

  async function handleSave() {
    setSaving(true);
    try {
      const collected = jellySpriteCollectorRef.current?.() ?? null;
      const jellySpriteState = collected?.data ?? null;
      const thumbnail = collected?.thumbnail ?? undefined;
      const data = serialiseProject(state, jellySpriteState, "jelly-sprite");
      if (!state.id) dispatch({ type: "SET_PROJECT_ID", payload: data.id });
      await saveProjectToStorage(data, thumbnail);
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
        <button
          className="editor-toolbar__btn editor-toolbar__btn--primary"
          onClick={handleSave}
          disabled={saving}
          title="Save project"
        >
          {saving ? "Saving\u2026" : saved ? "Saved \u2713" : "Save"}
        </button>
      }
      scrollable={false}
      padding={false}
    >
      <ErrorBoundary>
        <JellySprite
          onSwitchToAnimator={() => navigate("/editor")}
          onRegisterCollector={(fn) => {
            jellySpriteCollectorRef.current = fn;
          }}
        />
      </ErrorBoundary>
    </Page>
  );
}
