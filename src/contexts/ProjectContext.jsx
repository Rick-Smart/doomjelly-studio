import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

const STORAGE_KEY = "dj-project";

const initialState = {
  id: null,
  projectId: null,
  spriteId: null,
  name: "Untitled Project",
  sheets: [],
  activeSheetId: null,
  spriteSheet: null,
  jellySpriteDataUrl: null,
  // Full JellySprite editor state from jellySpritePersistence (v2 saves).
  // null for new projects and v1 saves.
  jellySpriteState: null,
  // Animator state: { spriteSheet: { dataUrl, width, height, frameW, frameH, cols, rows } }
  // pre-populated from JellySprite save so the Animator can open immediately.
  animatorState: null,
  frameConfig: {
    frameW: 32,
    frameH: 32,
    scale: 2,
    offsetX: 0,
    offsetY: 0,
    gutterX: 0,
    gutterY: 0,
  },
  animations: [],
  activeAnimationId: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_PROJECT": {
      const as = action.payload.animatorState;

      // Hydrate sheets array from saved animatorState
      let sheets = action.payload.sheets ?? [];
      let activeSheetId = action.payload.activeSheetId ?? null;
      if (sheets.length === 0 && as) {
        if (as.sheets?.length) {
          // New multi-sheet format — objectUrl is volatile, clear it
          sheets = as.sheets.map((s) => ({ ...s, objectUrl: null }));
        } else if (as.spriteSheet?.dataUrl) {
          // Legacy single-sheet format
          sheets = [
            {
              id: `${action.payload.id ?? "sheet"}-0`,
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
        action.payload.frameConfig ??
        activeSheet?.frameConfig ??
        as?.frameConfig ??
        (as?.spriteSheet?.frameW && as?.spriteSheet?.frameH
          ? {
              ...initialState.frameConfig,
              frameW: as.spriteSheet.frameW,
              frameH: as.spriteSheet.frameH,
            }
          : initialState.frameConfig);

      return {
        ...initialState,
        ...action.payload,
        sheets,
        activeSheetId,
        animations:
          action.payload.animations ??
          as?.animations ??
          initialState.animations,
        frameConfig,
      };
    }

    case "SET_SPRITE_SHEET": {
      const payload = action.payload;
      if (state.activeSheetId) {
        // Update the active sheet's image metadata
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
      // First sheet ever — auto-create an entry
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
      // payload: [{ id, objectUrl }]
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

    case "SET_PROJECT_NAME":
      return { ...state, name: action.payload };

    case "SET_PROJECT_ID":
      return { ...state, id: action.payload };

    case "SET_JELLY_SPRITE_DATA":
      return { ...state, jellySpriteDataUrl: action.payload };

    case "SET_SPRITE_ID":
      return { ...state, spriteId: action.payload };

    case "RESTORE_SNAPSHOT":
      return { ...state, ...action.payload };

    case "RESET_PROJECT":
      return { ...initialState, id: crypto.randomUUID() };

    default:
      return state;
  }
}

// Actions that should push a history entry before applying.
const UNDOABLE_ACTIONS = new Set([
  "ADD_ANIMATION",
  "DELETE_ANIMATION",
  "DUPLICATE_ANIMATION",
  "RENAME_ANIMATION",
  "UPDATE_ANIMATION",
  "SET_FRAME_CONFIG",
]);

// Snapshot only the content fields that undoable actions modify.
function snapshot(state) {
  return {
    animations: state.animations,
    activeAnimationId: state.activeAnimationId,
    frameConfig: { ...state.frameConfig },
  };
}

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [state, rawDispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...init, ...JSON.parse(saved) } : init;
    } catch {
      return init;
    }
  });

  // Stable ref to current state so history callbacks never go stale.
  const stateRef = useRef(state);
  stateRef.current = state;

  // History is stored in a ref (no re-renders needed) + two booleans in state
  // (drive canUndo/canRedo without exposing the full stack).
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
    } else if (
      action.type === "SET_SPRITE_SHEET" ||
      action.type === "SET_PROJECT_NAME"
    ) {
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

  useEffect(() => {
    // Don't persist dataUrl/objectUrl blobs — they can be huge and don't survive
    // sessions well. Strip binary fields from sheets[]; only keep metadata.
    // spriteSheet.dataUrl is also stripped (already done below).
    const { spriteSheet, ...rest } = state;
    const persistable = {
      ...rest,
      sheets: state.sheets.map(({ dataUrl: _d, objectUrl: _o, ...s }) => s),
      spriteSheet: spriteSheet
        ? {
            filename: spriteSheet.filename,
            width: spriteSheet.width,
            height: spriteSheet.height,
          }
        : null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  }, [state]);

  return (
    <ProjectContext.Provider
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
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
