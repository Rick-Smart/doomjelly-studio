import {
  createContext,
  useContext,
  useReducer,
  useRef,
  useState,
  useCallback,
} from "react";

// ---------------------------------------------------------------------------
// Initial state — all animator-owned fields.
// ---------------------------------------------------------------------------
const DEFAULT_FRAME_CONFIG = {
  frameW: 32,
  frameH: 32,
  scale: 2,
  offsetX: 0,
  offsetY: 0,
  gutterX: 0,
  gutterY: 0,
};

export const initialAnimatorState = {
  sheets: [],
  activeSheetId: null,
  /** @deprecated — kept for components still reading state.spriteSheet; derived from activeSheet. */
  spriteSheet: null,
  frameConfig: { ...DEFAULT_FRAME_CONFIG },
  animations: [],
  activeAnimationId: null,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
function reducer(state, action) {
  switch (action.type) {
    case "LOAD_PROJECT": {
      const payload = action.payload;
      const as = payload.animatorState;

      // Hydrate sheets array from saved animatorState (legacy compat)
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

      const spriteSheet = activeSheet
        ? {
            objectUrl: activeSheet.objectUrl,
            filename: activeSheet.filename,
            width: activeSheet.width,
            height: activeSheet.height,
          }
        : null;

      return {
        ...initialAnimatorState,
        sheets,
        activeSheetId,
        spriteSheet,
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
        return { ...state, spriteSheet: payload, sheets };
      }
      const newId = crypto.randomUUID();
      const newSheet = {
        id: newId,
        ...payload,
        frameConfig: state.frameConfig,
      };
      return {
        ...state,
        spriteSheet: payload,
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
        spriteSheet: { objectUrl, filename, width, height },
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
        spriteSheet: nextActive
          ? {
              objectUrl: nextActive.objectUrl,
              filename: nextActive.filename,
              width: nextActive.width,
              height: nextActive.height,
            }
          : remaining.length === 0
            ? null
            : state.spriteSheet,
        frameConfig: nextActive?.frameConfig ?? state.frameConfig,
      };
    }

    case "SET_ACTIVE_SHEET": {
      const sheet = state.sheets.find((s) => s.id === action.payload);
      if (!sheet) return state;
      return {
        ...state,
        activeSheetId: action.payload,
        spriteSheet: {
          objectUrl: sheet.objectUrl,
          filename: sheet.filename,
          width: sheet.width,
          height: sheet.height,
        },
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
      const activeSheet = sheets.find((s) => s.id === state.activeSheetId);
      return {
        ...state,
        sheets,
        spriteSheet: activeSheet
          ? { ...state.spriteSheet, objectUrl: activeSheet.objectUrl }
          : state.spriteSheet,
      };
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
// Undo/redo helpers
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
// Context + Provider
// ---------------------------------------------------------------------------
const AnimatorContext = createContext(null);

export function AnimatorProvider({ children }) {
  const [state, rawDispatch] = useReducer(reducer, initialAnimatorState);

  const stateRef = useRef(state);
  stateRef.current = state;

  const histRef = useRef({ past: [], future: [] });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const dispatch = useCallback((action) => {
    if (UNDOABLE_ACTIONS.has(action.type)) {
      const h = histRef.current;
      histRef.current = {
        past: [...h.past.slice(-49), snapshot(stateRef.current)],
        future: [],
      };
      setCanUndo(true);
      setCanRedo(false);
      setIsDirty(true);
    } else if (
      action.type === "LOAD_PROJECT" ||
      action.type === "RESET_PROJECT"
    ) {
      histRef.current = { past: [], future: [] };
      setCanUndo(false);
      setCanRedo(false);
      setIsDirty(false);
    } else if (action.type === "SET_SPRITE_SHEET") {
      setIsDirty(true);
    }
    rawDispatch(action);
  }, []);

  const markSaved = useCallback(() => setIsDirty(false), []);

  const undo = useCallback(() => {
    const h = histRef.current;
    if (h.past.length === 0) return;
    const prev = h.past[h.past.length - 1];
    histRef.current = {
      past: h.past.slice(0, -1),
      future: [snapshot(stateRef.current), ...h.future.slice(0, 49)],
    };
    setCanUndo(h.past.length > 1);
    setCanRedo(true);
    rawDispatch({ type: "RESTORE_SNAPSHOT", payload: prev });
  }, []);

  const redo = useCallback(() => {
    const h = histRef.current;
    if (h.future.length === 0) return;
    const next = h.future[0];
    histRef.current = {
      past: [...h.past.slice(-49), snapshot(stateRef.current)],
      future: h.future.slice(1),
    };
    setCanUndo(true);
    setCanRedo(h.future.length > 1);
    rawDispatch({ type: "RESTORE_SNAPSHOT", payload: next });
  }, []);

  return (
    <AnimatorContext.Provider
      value={{
        state,
        dispatch,
        undo,
        redo,
        canUndo,
        canRedo,
        isDirty,
        markSaved,
      }}
    >
      {children}
    </AnimatorContext.Provider>
  );
}

export function useAnimator() {
  const ctx = useContext(AnimatorContext);
  if (!ctx) throw new Error("useAnimator must be used within AnimatorProvider");
  return ctx;
}
