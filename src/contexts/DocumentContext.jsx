import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  useCallback,
} from "react";

// ---------------------------------------------------------------------------
// Persists only slim identity — no blobs, no pixel data.
// Uses the same key as the old ProjectContext so existing sessions are
// preserved after the migration.
// ---------------------------------------------------------------------------
const STORAGE_KEY = "dj-project-identity";

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
export const initialDocumentState = {
  // Identity (Sprint 4 fields, carried over from ProjectContext)
  id: null,
  name: "Untitled",
  projectId: null,
  spriteId: null,

  // Canvas geometry — populated by JellySprite on load / resize
  canvasW: 32,
  canvasH: 32,

  // Document structure (metadata only; pixel data stays in JellySpriteProvider)
  // Populated incrementally in Sprint 6b (JellySprite → document) and
  // Sprint 6c (Animator → document).
  frames: [], // [{ id, label }]
  layers: [], // [{ id, name, visible, opacity }]
  tags: [], // named frame ranges = Animator animations [{ id, name, from, to, loop }]

  // JellySprite restoration blob (carried from ProjectContext)
  jellySpriteState: null,
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
function reducer(state, action) {
  switch (action.type) {
    // LOAD_DOCUMENT (canonical) — LOAD_PROJECT is a backward-compat alias
    case "LOAD_DOCUMENT":
    case "LOAD_PROJECT":
      return {
        ...initialDocumentState,
        id: action.payload.id ?? initialDocumentState.id,
        name: action.payload.name ?? initialDocumentState.name,
        projectId: action.payload.projectId ?? initialDocumentState.projectId,
        spriteId: action.payload.spriteId ?? initialDocumentState.spriteId,
        canvasW: action.payload.canvasW ?? initialDocumentState.canvasW,
        canvasH: action.payload.canvasH ?? initialDocumentState.canvasH,
        frames: action.payload.frames ?? initialDocumentState.frames,
        layers: action.payload.layers ?? initialDocumentState.layers,
        // tags can be seeded from saved tags or from Animator animations array
        tags:
          action.payload.tags ??
          action.payload.animations ??
          initialDocumentState.tags,
        jellySpriteState: action.payload.jellySpriteState ?? null,
      };

    case "RESET_DOCUMENT":
    case "RESET_PROJECT":
      return { ...initialDocumentState, id: crypto.randomUUID() };

    // Name
    case "SET_DOCUMENT_NAME":
    case "SET_PROJECT_NAME":
      return { ...state, name: action.payload };

    // Identity IDs
    case "SET_DOCUMENT_ID":
    case "SET_PROJECT_ID":
      return { ...state, id: action.payload };

    case "SET_SPRITE_ID":
      return { ...state, spriteId: action.payload };

    // Canvas geometry (JellySprite notifies the document when the canvas
    // is resized so Animator can read the current frame dimensions)
    case "SET_CANVAS_SIZE":
      return {
        ...state,
        canvasW: action.payload.w ?? state.canvasW,
        canvasH: action.payload.h ?? state.canvasH,
      };

    // Document structure — populated in Sprint 6b / 6c
    case "SET_FRAMES":
      return { ...state, frames: action.payload };
    case "SET_LAYERS":
      return { ...state, layers: action.payload };
    case "SET_TAGS":
      return { ...state, tags: action.payload };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------
const DocumentContext = createContext(null);

export function DocumentProvider({ children }) {
  const [state, rawDispatch] = useReducer(
    reducer,
    initialDocumentState,
    (init) => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return init;
        // Merge only slim identity fields — never rehydrate blobs from storage
        const { id, name, projectId, spriteId } = JSON.parse(saved);
        return { ...init, id, name, projectId, spriteId };
      } catch {
        return init;
      }
    },
  );

  const [isDirty, setIsDirty] = useState(false);

  const dispatch = useCallback((action) => {
    if (
      action.type === "SET_DOCUMENT_NAME" ||
      action.type === "SET_PROJECT_NAME"
    ) {
      setIsDirty(true);
    } else if (
      action.type === "LOAD_DOCUMENT" ||
      action.type === "LOAD_PROJECT" ||
      action.type === "RESET_DOCUMENT" ||
      action.type === "RESET_PROJECT"
    ) {
      setIsDirty(false);
    }
    rawDispatch(action);
  }, []);

  const markSaved = useCallback(() => setIsDirty(false), []);

  // Persist slim identity slice to localStorage (no blobs)
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          id: state.id,
          name: state.name,
          projectId: state.projectId,
          spriteId: state.spriteId,
        }),
      );
    } catch {
      // QuotaExceededError — non-fatal; identity survives via URL
    }
  }, [state.id, state.name, state.projectId, state.spriteId]);

  return (
    <DocumentContext.Provider value={{ state, dispatch, isDirty, markSaved }}>
      {children}
    </DocumentContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useDocument() {
  const ctx = useContext(DocumentContext);
  if (!ctx) throw new Error("useDocument must be used within DocumentProvider");
  return ctx;
}
