/**
 * useDocumentStore — Zustand store for document identity + metadata.
 *
 * Replaces DocumentContext (Sprint 9). State shape and dispatch action types
 * are identical to the old context — all consumers continue to work via the
 * useDocument() alias or by calling useDocumentStore() directly.
 *
 * Persists slim identity fields (id, name, projectId, spriteId) to
 * localStorage under 'dj-project-identity' via Zustand persist middleware.
 * The Zustand format wraps state in { state: ..., version: 1 }. Sessions
 * created before Sprint 9 will hydrate to initial state on first load (their
 * slim identity is stored in the old flat format the persist middleware won't
 * recognize as version 1). This is an acceptable one-time reset for dev.
 *
 * Sprint 9 — Zustand state management.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { initialDocumentState, documentReducer } from "./DocumentContext.jsx";

export const useDocumentStore = create(
  persist(
    (set, get) => ({
      /** Full document state — same shape as DocumentContext's `state`. */
      state: { ...initialDocumentState },
      isDirty: false,

      dispatch(action) {
        const { state, isDirty } = get();
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
        set({ state: documentReducer(state, action), isDirty: isDirtyNext });
      },

      markSaved() {
        set({ isDirty: false });
      },
    }),
    {
      name: "dj-project-identity",
      version: 1,
      // Only persist the slim identity slice — never persist pixel blobs
      partialize: ({ state }) => ({
        state: {
          id: state.id,
          name: state.name,
          projectId: state.projectId,
          spriteId: state.spriteId,
        },
      }),
      // Deep-merge persisted identity into default state so all other fields
      // keep their initialDocumentState defaults after rehydration.
      merge: (persisted, current) => ({
        ...current,
        state: { ...current.state, ...(persisted?.state ?? {}) },
      }),
    },
  ),
);

/**
 * useDocument() — backward-compat alias for useDocumentStore().
 * Returns { state, dispatch, isDirty, markSaved } — same shape as before.
 * All existing callers work without modification.
 */
export const useDocument = useDocumentStore;
