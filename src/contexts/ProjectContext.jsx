import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

/**
 * Project state shape:
 * {
 *   id: string | null,
 *   name: string,
 *   spriteSheet: { dataUrl, filename, width, height } | null,
 *   frameConfig: { frameW, frameH, scale, offsetX, offsetY, gutterX, gutterY },
 *   animations: [{ id, name, frames: [] }],
 *   activeAnimationId: string | null,
 * }
 */

const STORAGE_KEY = "dj-project";

const initialState = {
  id: null,
  name: "Untitled Project",
  spriteSheet: null,
  spriteForgeDataUrl: null,
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
    case "LOAD_PROJECT":
      return { ...initialState, ...action.payload };

    case "SET_SPRITE_SHEET":
      return { ...state, spriteSheet: action.payload };

    case "SET_FRAME_CONFIG":
      return {
        ...state,
        frameConfig: { ...state.frameConfig, ...action.payload },
      };

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

    case "SET_SPRITE_FORGE_DATA":
      return { ...state, spriteForgeDataUrl: action.payload };

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

  const dispatch = useCallback((action) => {
    if (UNDOABLE_ACTIONS.has(action.type)) {
      const h = histRef.current;
      histRef.current = {
        past: [...h.past.slice(-49), snapshot(stateRef.current)],
        future: [],
      };
      setCanUndo(true);
      setCanRedo(false);
    } else if (
      action.type === "LOAD_PROJECT" ||
      action.type === "RESET_PROJECT"
    ) {
      histRef.current = { past: [], future: [] };
      setCanUndo(false);
      setCanRedo(false);
    }
    rawDispatch(action);
  }, []);

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
    // Don't persist dataUrl blobs — they can be huge and don't survive sessions well.
    // Store everything except spriteSheet.dataUrl; the user re-imports the sheet.
    const { spriteSheet, ...rest } = state;
    const persistable = {
      ...rest,
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
      value={{ state, dispatch, undo, redo, canUndo, canRedo }}
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
