import { create } from "zustand";
import { initialAnimatorState, animatorReducer } from "./AnimatorContext.jsx";
import { useDocumentStore } from "./useDocumentStore.js";

// ---------------------------------------------------------------------------
// Undo/redo helpers (mirrored from AnimatorContext internals)
// ---------------------------------------------------------------------------
const UNDOABLE_ACTIONS = new Set([
  "ADD_ANIMATION",
  "DELETE_ANIMATION",
  "DUPLICATE_ANIMATION",
  "RENAME_ANIMATION",
  "UPDATE_ANIMATION",
  "SET_FRAME_CONFIG",
]);

function snapshot(s) {
  return {
    animations: s.animations,
    activeAnimationId: s.activeAnimationId,
    frameConfig: { ...s.frameConfig },
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useAnimatorStore = create((set, get) => ({
  // All animator domain fields at top level
  ...initialAnimatorState,
  canUndo: false,
  canRedo: false,
  isDirty: false,
  _past: [],
  _future: [],

  dispatch(action) {
    const {
      _past,
      _future,
      isDirty,
      canUndo: _cu,
      canRedo: _cr,
      dispatch: _d,
      undo: _u,
      redo: _r,
      markSaved: _ms,
      ...domainState
    } = get();

    let past = _past;
    let future = _future;
    let dirty = isDirty;

    if (UNDOABLE_ACTIONS.has(action.type)) {
      past = [...past.slice(-49), snapshot(domainState)];
      future = [];
      dirty = true;
    } else if (
      action.type === "LOAD_PROJECT" ||
      action.type === "RESET_PROJECT"
    ) {
      past = [];
      future = [];
      dirty = false;
    } else if (action.type === "SET_SPRITE_SHEET") {
      dirty = true;
    }

    const next = animatorReducer(domainState, action);

    // Cross-store sync: push updated animations to DocumentStore as tags
    if (next.animations !== domainState.animations) {
      useDocumentStore
        .getState()
        .dispatch({ type: "SET_TAGS", payload: next.animations });
    }

    set({
      ...next,
      _past: past,
      _future: future,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      isDirty: dirty,
    });
  },

  undo() {
    const {
      _past,
      _future,
      dispatch: _d,
      undo: _u,
      redo: _r,
      markSaved: _ms,
      canUndo: _cu,
      canRedo: _cr,
      isDirty,
      ...domainState
    } = get();
    if (_past.length === 0) return;
    const prev = _past.at(-1);
    const past = _past.slice(0, -1);
    const future = [snapshot(domainState), ..._future.slice(0, 49)];
    set({
      ...domainState,
      ...prev,
      _past: past,
      _future: future,
      canUndo: past.length > 0,
      canRedo: true,
      isDirty,
    });
  },

  redo() {
    const {
      _past,
      _future,
      dispatch: _d,
      undo: _u,
      redo: _r,
      markSaved: _ms,
      canUndo: _cu,
      canRedo: _cr,
      isDirty,
      ...domainState
    } = get();
    if (_future.length === 0) return;
    const next = _future[0];
    const past = [..._past.slice(-49), snapshot(domainState)];
    const future = _future.slice(1);
    set({
      ...domainState,
      ...next,
      _past: past,
      _future: future,
      canUndo: true,
      canRedo: future.length > 0,
      isDirty,
    });
  },

  markSaved() {
    set({ isDirty: false });
  },
}));
