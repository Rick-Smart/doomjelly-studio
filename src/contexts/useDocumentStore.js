/**
 * useDocumentStore — Zustand store for document identity + metadata.
 *
 * Sprint 10: All document state fields are flat at the top level.
 * Sprint 12: documentReducer and initialDocumentState inlined; DocumentContext.jsx deleted.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Document initial state (inlined from DocumentContext.jsx — Sprint 12) ────
const initialDocumentState = {
  id: null,
  name: "Untitled",
  projectId: null,
  spriteId: null,
  canvasW: 32,
  canvasH: 32,
  frames: [],
  layers: [],
  tags: [],
  jellyBody: null,
};

// ── Document reducer (inlined from DocumentContext.jsx — Sprint 12) ──────────
function documentReducer(state, action) {
  switch (action.type) {
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
        tags:
          action.payload.tags ??
          action.payload.animations ??
          initialDocumentState.tags,
        jellyBody: action.payload.jellyBody ?? null,
      };

    case "RESET_DOCUMENT":
    case "RESET_PROJECT":
      return { ...initialDocumentState, id: crypto.randomUUID() };

    case "SET_DOCUMENT_NAME":
    case "SET_PROJECT_NAME":
      return { ...state, name: action.payload };

    case "SET_DOCUMENT_ID":
    case "SET_PROJECT_ID":
      return { ...state, id: action.payload };

    case "SET_SPRITE_ID":
      return { ...state, spriteId: action.payload };

    case "SET_CANVAS_SIZE":
      return {
        ...state,
        canvasW: action.payload.w ?? state.canvasW,
        canvasH: action.payload.h ?? state.canvasH,
      };

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

export const useDocumentStore = create(
  persist(
    (set, get) => ({
      // All document domain fields at top level
      ...initialDocumentState,
      isDirty: false,

      dispatch(action) {
        const { isDirty, dispatch: _d, markSaved: _m, ...domainState } = get();
        const isDirtyNext =
          action.type === "SET_DOCUMENT_NAME" ||
          action.type === "SET_PROJECT_NAME"
            ? true
            : action.type === "LOAD_DOCUMENT" ||
                action.type === "LOAD_PROJECT" ||
                action.type === "RESET_DOCUMENT" ||
                action.type === "RESET_PROJECT"
              ? false
              : isDirty;
        set({ ...documentReducer(domainState, action), isDirty: isDirtyNext });
      },

      markSaved() {
        set({ isDirty: false });
      },
    }),
    {
      name: "dj-project-identity",
      version: 2,
      // Only persist the slim identity slice — never persist pixel blobs
      partialize: (s) => ({
        id: s.id,
        name: s.name,
        projectId: s.projectId,
        spriteId: s.spriteId,
      }),
      // Merge persisted identity into current state
      merge: (persisted, current) => ({ ...current, ...(persisted ?? {}) }),
    },
  ),
);
