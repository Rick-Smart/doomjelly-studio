// DocumentContext.jsx
// Provider is a no-op since Sprint 9 — state lives in useDocumentStore.
// Reducer + initial state are exported for the store to import.
// useDocument() is re-exported from useDocumentStore for backward compat.

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
// Reducer — exported for use by useDocumentStore (Sprint 9)
// ---------------------------------------------------------------------------
export function documentReducer(state, action) {
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
