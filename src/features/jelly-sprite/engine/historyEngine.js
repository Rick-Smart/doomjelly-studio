import * as A from "../store/jellySpriteActions.js";

/**
 * Dispatch the post-undo/redo React state update and trigger a redraw.
 * Reads current history state from refs.doc (PixelDocument).
 */
function syncHistoryToReact(refs, dispatch) {
  dispatch({
    type: A.RESTORE_HISTORY,
    payload: {
      layers: refs.doc.layers,
      activeLayerId: refs.doc.activeLayerId,
      canUndo: refs.doc.canUndo,
      canRedo: refs.doc.canRedo,
    },
  });
  refs.redraw?.();
}

/**
 * wireHistoryEngine — attach pushHistory / undoHistory / redoHistory
 * to the refs object. Each delegates to refs.doc (PixelDocument).
 *
 * Call after pixel buffers are initialised so the initial snapshot captures
 * valid data.
 */
export function wireHistoryEngine(refs, dispatch) {
  refs.pushHistory = () => refs.doc.pushHistory();
  refs.undoHistory = () => {
    if (!refs.doc.undo()) return;
    syncHistoryToReact(refs, dispatch);
  };
  refs.redoHistory = () => {
    if (!refs.doc.redo()) return;
    syncHistoryToReact(refs, dispatch);
  };

  // Seed initial blank state so canUndo starts false
  refs.doc.historyStack = [];
  refs.doc.historyIndex = -1;
  refs.doc.pushHistory();
}

/**
 * seedHistory — reset the PixelDocument history stack using explicit
 * layers/activeLayerId rather than relying on doc.layers (which may be
 * stale right after a frame switch, before React re-renders).
 *
 * Call after frame-switch, canvas resize, or full-state restore.
 */
export function seedHistory(refs, layers, activeLayerId) {
  refs.doc.seedHistory(layers, activeLayerId);
}
