import { create } from "zustand";
import { useDocumentStore } from "./useDocumentStore.js";

// ── Animator initial state (inlined from AnimatorContext.jsx — Sprint 12) ────
const DEFAULT_FRAME_CONFIG = {
  frameW: 32,
  frameH: 32,
  scale: 2,
  offsetX: 0,
  offsetY: 0,
  gutterX: 0,
  gutterY: 0,
};

const initialAnimatorState = {
  sheets: [],
  activeSheetId: null,
  frameConfig: { ...DEFAULT_FRAME_CONFIG },
  animations: [],
  activeAnimationId: null,
};

// ── Animator reducer (inlined from AnimatorContext.jsx — Sprint 12) ──────────
function animatorReducer(state, action) {
  switch (action.type) {
    case "LOAD_PROJECT": {
      const payload = action.payload;
      const as = payload.animatorState;

      let sheets = payload.sheets ?? [];
      let activeSheetId = payload.activeSheetId ?? null;
      if (sheets.length === 0 && as) {
        if (as.sheets?.length) {
          sheets = as.sheets.map((s) => ({ ...s, objectUrl: null }));
        } else if (as.spriteSheet?.dataUrl) {
          sheets = [
            {
              id: `${payload.id ?? "sheet"}-0`,
              filename: as.spriteSheet.filename ?? "sheet.png",
              objectUrl: null,
              dataUrl: as.spriteSheet.dataUrl,
              width: as.spriteSheet.width,
              height: as.spriteSheet.height,
              frameConfig: as.frameConfig ?? null,
            },
          ];
        }
      }
      if (!activeSheetId && sheets.length > 0) activeSheetId = sheets[0].id;

      const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
      const frameConfig =
        payload.frameConfig ??
        activeSheet?.frameConfig ??
        as?.frameConfig ??
        (as?.spriteSheet?.frameW && as?.spriteSheet?.frameH
          ? {
              ...DEFAULT_FRAME_CONFIG,
              frameW: as.spriteSheet.frameW,
              frameH: as.spriteSheet.frameH,
            }
          : DEFAULT_FRAME_CONFIG);

      return {
        ...initialAnimatorState,
        sheets,
        activeSheetId,
        frameConfig,
        animations:
          payload.animations ??
          as?.animations ??
          initialAnimatorState.animations,
        activeAnimationId:
          payload.activeAnimationId ?? initialAnimatorState.activeAnimationId,
      };
    }

    case "RESET_PROJECT":
      return { ...initialAnimatorState };

    case "SET_SPRITE_SHEET": {
      const payload = action.payload;
      if (state.activeSheetId) {
        const sheets = state.sheets.map((s) =>
          s.id === state.activeSheetId
            ? {
                ...s,
                objectUrl: payload.objectUrl,
                filename: payload.filename,
                width: payload.width,
                height: payload.height,
              }
            : s,
        );
        return { ...state, sheets };
      }
      const newId = crypto.randomUUID();
      const newSheet = {
        id: newId,
        ...payload,
        frameConfig: state.frameConfig,
      };
      return {
        ...state,
        sheets: [newSheet],
        activeSheetId: newId,
      };
    }

    case "SET_FRAME_CONFIG": {
      const updatedConfig = { ...state.frameConfig, ...action.payload };
      const sheets = state.activeSheetId
        ? state.sheets.map((s) =>
            s.id === state.activeSheetId
              ? { ...s, frameConfig: updatedConfig }
              : s,
          )
        : state.sheets;
      return { ...state, frameConfig: updatedConfig, sheets };
    }

    case "ADD_SHEET": {
      const { id, filename, objectUrl, dataUrl, width, height } =
        action.payload;
      const newSheet = {
        id,
        filename,
        objectUrl,
        dataUrl: dataUrl ?? null,
        width,
        height,
        frameConfig: { ...state.frameConfig },
      };
      return {
        ...state,
        sheets: [...state.sheets, newSheet],
        activeSheetId: newSheet.id,
      };
    }

    case "REMOVE_SHEET": {
      const remaining = state.sheets.filter((s) => s.id !== action.payload);
      const wasActive = state.activeSheetId === action.payload;
      const nextActiveId = wasActive
        ? (remaining[0]?.id ?? null)
        : state.activeSheetId;
      const nextActive = remaining.find((s) => s.id === nextActiveId) ?? null;
      return {
        ...state,
        sheets: remaining,
        activeSheetId: nextActiveId,
        frameConfig: nextActive?.frameConfig ?? state.frameConfig,
      };
    }

    case "SET_ACTIVE_SHEET": {
      const sheet = state.sheets.find((s) => s.id === action.payload);
      if (!sheet) return state;
      return {
        ...state,
        activeSheetId: action.payload,
        frameConfig: sheet.frameConfig ?? state.frameConfig,
      };
    }

    case "RESTORE_SHEET_URLS": {
      const urlMap = new Map(
        action.payload.map(({ id, objectUrl }) => [id, objectUrl]),
      );
      const sheets = state.sheets.map((s) =>
        urlMap.has(s.id) ? { ...s, objectUrl: urlMap.get(s.id) } : s,
      );
      return { ...state, sheets };
    }

    case "ADD_ANIMATION": {
      const anim = action.payload;
      return {
        ...state,
        animations: [...state.animations, anim],
        activeAnimationId: anim.id,
      };
    }

    case "DELETE_ANIMATION": {
      const remaining = state.animations.filter((a) => a.id !== action.payload);
      const nextActive =
        state.activeAnimationId === action.payload
          ? (remaining[0]?.id ?? null)
          : state.activeAnimationId;
      return { ...state, animations: remaining, activeAnimationId: nextActive };
    }

    case "RENAME_ANIMATION":
      return {
        ...state,
        animations: state.animations.map((a) =>
          a.id === action.payload.id ? { ...a, name: action.payload.name } : a,
        ),
      };

    case "DUPLICATE_ANIMATION": {
      const original = state.animations.find((a) => a.id === action.payload);
      if (!original) return state;
      const copy = {
        ...original,
        id: crypto.randomUUID(),
        name: `${original.name} (copy)`,
        frames: original.frames.map((f) => ({ ...f })),
      };
      const idx = state.animations.indexOf(original);
      const animations = [
        ...state.animations.slice(0, idx + 1),
        copy,
        ...state.animations.slice(idx + 1),
      ];
      return { ...state, animations, activeAnimationId: copy.id };
    }

    case "SET_ACTIVE_ANIMATION":
      return { ...state, activeAnimationId: action.payload };

    case "UPDATE_ANIMATION":
      return {
        ...state,
        animations: state.animations.map((a) =>
          a.id === action.payload.id ? { ...a, ...action.payload } : a,
        ),
      };

    case "RESTORE_SNAPSHOT":
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

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
