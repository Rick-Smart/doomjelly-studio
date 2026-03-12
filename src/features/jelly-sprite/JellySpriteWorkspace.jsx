import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProject } from "../../contexts/ProjectContext";
import { useNotification } from "../../contexts/NotificationContext";
import { Page } from "../../ui/Page";
import {
  loadSprite,
  saveSprite,
  serialiseSprite,
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
  const { spriteId } = useParams();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const jellySpriteCollectorRef = useRef(null);

  // Load sprite from URL param on mount (or when URL changes)
  useEffect(() => {
    if (!spriteId) return;
    // Don't reload if context already has this sprite loaded
    if (state.id === spriteId) return;
    loadSprite(spriteId)
      .then((data) => {
        dispatch({ type: "LOAD_PROJECT", payload: { ...data, id: spriteId } });
      })
      .catch((err) => {
        console.error("Failed to load sprite:", err);
        showToast("Failed to load sprite.", "error");
        navigate("/projects");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spriteId]);

  async function handleSave() {
    setSaving(true);
    try {
      const collected = jellySpriteCollectorRef.current?.() ?? null;
      const jellySpriteState = collected?.data ?? null;
      const thumbnail = collected?.thumbnail ?? undefined;
      const spriteSheet = collected?.spriteSheet ?? null;
      const data = serialiseSprite(jellySpriteState, {
        id: spriteId ?? state.id,
        projectId: state.projectId,
        name: state.name,
      });
      const id = data.id;
      if (!state.id) dispatch({ type: "SET_PROJECT_ID", payload: id });
      await saveSprite({
        ...data,
        id,
        // jelly_body: full pixel/layer state (for re-editing in JellySprite)
        jellyBody: jellySpriteState,
        // animator_body: flat sprite sheet (for opening in the Animator)
        animatorBody: spriteSheet ? { spriteSheet } : null,
        // legacy body column kept during transition
        body: data,
        thumbnail,
        projectId: state.projectId ?? data.projectId ?? null,
      });
      setSaved(true);
      showToast("Sprite saved.", "success", 2500);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save sprite:", err);
      showToast("Failed to save sprite.", "error");
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
        {state.id === spriteId ? (
          <JellySprite
            onRegisterCollector={(fn) => {
              jellySpriteCollectorRef.current = fn;
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--color-text-muted, #888)",
              fontSize: "0.9rem",
            }}
          >
            Loading sprite…
          </div>
        )}
      </ErrorBoundary>
    </Page>
  );
}
