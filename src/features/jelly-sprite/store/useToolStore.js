/**
 * useToolStore — Zustand store for tool/brush/color/palette/view state.
 *
 * Replaces ToolContext (Sprint 9). State shape and action handling are
 * identical — this is a drop-in replacement; the dispatch action types
 * are unchanged.
 *
 * Persists a slim subset to localStorage under 'dj-tool-state' via
 * Zustand's persist middleware (replaces the manual useEffect in ToolContext).
 *
 * Sprint 9 — Zustand state management.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toolReducer, toolInitialState } from "./ToolContext.jsx";

// Fields that survive page reload (no blobs, no session-only state).
const PERSIST_FIELDS = [
  "tool",
  "brushType",
  "brushSize",
  "brushOpacity",
  "brushHardness",
  "fgColor",
  "bgColor",
  "fgAlpha",
  "colorHistory",
  "relatedColors",
  "palettes",
  "activePalette",
  "gridVisible",
  "frameGridVisible",
  "frameConfig",
  "refOpacity",
  "refVisible",
  "tileCount",
  "panelTab",
  "zoom",
];

export const useToolStore = create(
  persist(
    (set, get) => ({
      ...toolInitialState,

      /**
       * Dispatch a tool action. Passes only the data fields to the
       * pure toolReducer (not the `dispatch` function itself).
       */
      dispatch(action) {
        const { dispatch: _d, ...data } = get();
        set(toolReducer(data, action));
      },
    }),
    {
      name: "dj-tool-state",
      partialize: (state) =>
        Object.fromEntries(PERSIST_FIELDS.map((k) => [k, state[k]])),
    },
  ),
);
