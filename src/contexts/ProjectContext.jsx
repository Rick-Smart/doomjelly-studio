import { createContext, useContext, useReducer, useEffect } from "react";

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

    case "RESET_PROJECT":
      return { ...initialState, id: crypto.randomUUID() };

    default:
      return state;
  }
}

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...init, ...JSON.parse(saved) } : init;
    } catch {
      return init;
    }
  });

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
    <ProjectContext.Provider value={{ state, dispatch }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
