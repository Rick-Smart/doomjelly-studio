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

function snapshot(state) {
  return {
    animations: state.animations,
    activeAnimationId: state.activeAnimationId,
    frameConfig: { ...state.frameConfig },
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useAnimatorStore = create((set, get) => ({
  state: { ...initialAnimatorState },
  canUndo: false,
  canRedo: false,
  isDirty: false,
  _past: [],
  _future: [],

  dispatch(action) {
    const { state, _past, _future, isDirty } = get();

    let past = _past;
    let future = _future;
    let dirty = isDirty;

    if (UNDOABLE_ACTIONS.has(action.type)) {
      past = [...past.slice(-49), snapshot(state)];
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

    const next = animatorReducer(state, action);

    // Cross-store sync: push updated animations to DocumentStore as tags
    if (next.animations !== state.animations) {
      useDocumentStore
        .getState()
        .dispatch({ type: "SET_TAGS", payload: next.animations });
    }

    set({
      state: next,
      _past: past,
      _future: future,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      isDirty: dirty,
    });
  },

  undo() {
    const { state, _past, _future } = get();
    if (_past.length === 0) return;
    const prev = _past.at(-1);
    const past = _past.slice(0, -1);
    const future = [snapshot(state), ..._future.slice(0, 49)];
    set({
      state: { ...state, ...prev },
      _past: past,
      _future: future,
      canUndo: past.length > 0,
      canRedo: true,
    });
  },

  redo() {
    const { state, _past, _future } = get();
    if (_future.length === 0) return;
    const next = _future[0];
    const past = [..._past.slice(-49), snapshot(state)];
    const future = _future.slice(1);
    set({
      state: { ...state, ...next },
      _past: past,
      _future: future,
      canUndo: true,
      canRedo: future.length > 0,
    });
  },

  markSaved() {
    set({ isDirty: false });
  },
}));

// Drop-in alias — all useAnimator() consumers continue to work unchanged
export const useAnimator = useAnimatorStore;
