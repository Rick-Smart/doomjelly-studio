/**
 * useDocumentStore — Zustand store for document identity + metadata.
 *
 * Sprint 10: All document state fields are flat at the top level. Consumers
 * import useDocumentStore directly and destructure what they need.
 *
 * Persists slim identity fields (id, name, projectId, spriteId) to
 * localStorage under 'dj-project-identity' via Zustand persist middleware.
 *
 * Sprint 9 — Zustand state management.
 * Sprint 10 — Flattened state shape; shim removed.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { initialDocumentState, documentReducer } from "./DocumentContext.jsx";

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
