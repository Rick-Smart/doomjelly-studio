import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  useCallback,
} from "react";

// Separate key from the old bloated key so stale blobs aren't rehydrated.
const STORAGE_KEY = "dj-project-identity";

// Identity + JellySprite fields only. Animator state lives in AnimatorContext.
const initialState = {
  id: null,
  projectId: null,
  spriteId: null,
  name: "Untitled Project",
  jellySpriteDataUrl: null,
  jellySpriteState: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_PROJECT":
      return {
        ...initialState,
        id: action.payload.id ?? initialState.id,
        projectId: action.payload.projectId ?? initialState.projectId,
        spriteId: action.payload.spriteId ?? initialState.spriteId,
        name: action.payload.name ?? initialState.name,
        jellySpriteState: action.payload.jellySpriteState ?? null,
        jellySpriteDataUrl: action.payload.jellySpriteDataUrl ?? null,
      };
    case "RESET_PROJECT":
      return { ...initialState, id: crypto.randomUUID() };

    case "SET_PROJECT_NAME":
      return { ...state, name: action.payload };

    case "SET_PROJECT_ID":
      return { ...state, id: action.payload };

    case "SET_JELLY_SPRITE_DATA":
      return { ...state, jellySpriteDataUrl: action.payload };

    case "SET_SPRITE_ID":
      return { ...state, spriteId: action.payload };

    default:
      return state;
  }
}

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [state, rawDispatch] = useReducer(reducer, initialState, (init) => {
    try {
      // Read from the new slim key; old key contained blobs and is ignored.
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...init, ...JSON.parse(saved) } : init;
    } catch {
      return init;
    }
  });

  const [isDirty, setIsDirty] = useState(false);

  const dispatch = useCallback((action) => {
    if (
      action.type === "SET_JELLY_SPRITE_DATA" ||
      action.type === "SET_PROJECT_NAME"
    ) {
      setIsDirty(true);
    } else if (
      action.type === "LOAD_PROJECT" ||
      action.type === "RESET_PROJECT"
    ) {
      setIsDirty(false);
    }
    rawDispatch(action);
  }, []);

  const markSaved = useCallback(() => setIsDirty(false), []);

  // Persist only identity metadata — no binary blobs, no animator state.
  useEffect(() => {
    const { id, name, projectId, spriteId } = state;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id, name, projectId, spriteId }),
    );
  }, [state]);

  return (
    <ProjectContext.Provider value={{ state, dispatch, isDirty, markSaved }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
