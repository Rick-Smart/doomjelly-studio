import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDocumentStore } from "../../contexts/useDocumentStore.js";
import { useNotification } from "../../contexts/NotificationContext";
import { Page } from "../../ui/Page";
import { loadDocument, saveDocument } from "../../services/documentService";
import { JellySprite } from "./JellySprite";
import { usePixelDocumentStore } from "./store/usePixelDocumentStore";
import { ErrorBoundary } from "../../ui/ErrorBoundary/ErrorBoundary";
import { EditableTitle } from "../../ui/EditableTitle";

export function JellySpriteWorkspace() {
  const {
    dispatch,
    isDirty: _isDirty,
    markSaved: _ms,
    ...state
  } = useDocumentStore();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const { spriteId } = useParams();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load sprite from URL param on mount (or when URL changes)
  useEffect(() => {
    if (!spriteId) {
      // New-sprite mode: reset document identity so title shows "Untitled"
      // instead of a stale name from the previously-persisted session.
      dispatch({ type: "RESET_DOCUMENT" });
      return;
    }
    // Don't reload if context already has this sprite loaded
    if (state.id === spriteId) return;
    loadDocument(spriteId)
      .then((data) => {
        if (!data) throw new Error("Sprite not found");
        dispatch({ type: "LOAD_PROJECT", payload: data });
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
      const collected = usePixelDocumentStore.getState().collect();
      const jellyBody = collected?.data ?? null;
      const thumbnail = collected?.thumbnail ?? null;
      const spriteSheet = collected?.spriteSheet ?? null;

      const { id } = await saveDocument(
        { ...state, id: spriteId ?? state.id },
        {
          jellyBody,
          animatorBody: spriteSheet ? { spriteSheet } : null,
          thumbnail,
        },
      );

      if (!state.id) dispatch({ type: "SET_PROJECT_ID", payload: id });
      // Update URL so refresh always reloads the correct sprite
      if (!spriteId || spriteId !== id) {
        navigate(`/jelly-sprite/${id}`, { replace: true });
      }
      setSaved(true);
      showToast("Sprite saved.", "success", 2500);
      setTimeout(() => setSaved(false), 2000);
      return id; // callers (e.g. handleOpenInAnimator) may need the persisted id
    } catch (err) {
      console.error("Failed to save sprite:", err);
      showToast("Failed to save sprite.", "error");
      return null;
    } finally {
      setSaving(false);
    }
  }

  // Rule 4: always save before navigating away from an editor.
  // Also handles the first-save case where no spriteId exists yet.
  async function handleOpenInAnimator() {
    // Save unconditionally — pixel work lives in-memory and would be lost if
    // the Animator overwrites the record with jellyBody:null on its next save.
    const savedId = await handleSave();
    if (!savedId) return; // save failed — do not navigate
    navigate(`/animator/${savedId}`);
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
        <>
          {(spriteId ?? state.id) && (
            <button
              className="editor-toolbar__btn"
              onClick={handleOpenInAnimator}
              title="Open this sprite in the Animator"
            >
              Open in Animator ↗
            </button>
          )}
          <button
            className="editor-toolbar__btn editor-toolbar__btn--primary"
            onClick={handleSave}
            disabled={saving}
            title="Save project"
          >
            {saving ? "Saving\u2026" : saved ? "Saved \u2713" : "Save"}
          </button>
        </>
      }
      scrollable={false}
      padding={false}
    >
      <ErrorBoundary>
        {state.id === spriteId || !spriteId ? (
          <JellySprite />
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
