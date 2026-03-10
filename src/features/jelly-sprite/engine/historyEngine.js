import { MAX_HISTORY } from "../jellySprite.constants.js";
import * as A from "../store/jellySpriteActions.js";

/**
 * Snapshot the current drawing state and push it onto the history stack.
 * Truncates any forward history first (new action invalidates redo).
 */
function pushHistory(refs) {
  const { pixelBuffers, maskBuffers } = refs;
  const state = refs.stateRef.current;

  const snapshot = {
    layers: state.layers, // immutable value — safe to share
    activeLayerId: state.activeLayerId,
    pixelBuffers: {},
    maskBuffers: {},
  };

  for (const [id, buf] of Object.entries(pixelBuffers)) {
    snapshot.pixelBuffers[id] = buf ? new Uint8ClampedArray(buf) : null;
  }
  for (const [id, buf] of Object.entries(maskBuffers)) {
    snapshot.maskBuffers[id] = buf ? new Uint8Array(buf) : null;
  }

  // Truncate forward history
  refs.historyStack = refs.historyStack.slice(0, refs.historyIndex + 1);
  refs.historyStack.push(snapshot);

  // Cap at MAX_HISTORY
  if (refs.historyStack.length > MAX_HISTORY) {
    refs.historyStack.shift();
  }
  refs.historyIndex = refs.historyStack.length - 1;
}

/**
 * Restore from a given history snapshot. Mutates refs.pixelBuffers /
 * refs.maskBuffers in-place and dispatches RESTORE_HISTORY to update
 * the reducer state (layers + activeLayerId + canUndo/canRedo flags).
 */
function applySnapshot(refs, snapshot, dispatch) {
  // Restore pixel buffers
  for (const [id, buf] of Object.entries(snapshot.pixelBuffers)) {
    if (buf) {
      if (!refs.pixelBuffers[id]) {
        refs.pixelBuffers[id] = new Uint8ClampedArray(buf);
      } else {
        refs.pixelBuffers[id].set(buf);
      }
    } else {
      refs.pixelBuffers[id] = null;
    }
  }

  // Restore mask buffers
  for (const [id, buf] of Object.entries(snapshot.maskBuffers)) {
    if (buf) {
      if (!refs.maskBuffers[id]) {
        refs.maskBuffers[id] = new Uint8Array(buf);
      } else {
        refs.maskBuffers[id].set(buf);
      }
    } else {
      refs.maskBuffers[id] = null;
    }
  }

  dispatch({
    type: A.RESTORE_HISTORY,
    payload: {
      layers: snapshot.layers,
      activeLayerId: snapshot.activeLayerId,
      canUndo: refs.historyIndex > 0,
      canRedo: refs.historyIndex < refs.historyStack.length - 1,
    },
  });

  refs.redraw?.();
}

/** Step backwards one history entry. */
function undoHistory(refs, dispatch) {
  if (refs.historyIndex <= 0) return;
  refs.historyIndex--;
  applySnapshot(refs, refs.historyStack[refs.historyIndex], dispatch);
}

/** Step forward one history entry. */
function redoHistory(refs, dispatch) {
  if (refs.historyIndex >= refs.historyStack.length - 1) return;
  refs.historyIndex++;
  applySnapshot(refs, refs.historyStack[refs.historyIndex], dispatch);
}

/**
 * wireHistoryEngine — attach pushHistory / undoHistory / redoHistory
 * to the refs object and record the initial state as snapshot index 0.
 *
 * Call once from useCanvas (after pixel buffers are initialised) or
 * from a dedicated useHistory hook.
 */
export function wireHistoryEngine(refs, dispatch) {
  refs.pushHistory = () => pushHistory(refs);
  refs.undoHistory = () => undoHistory(refs, dispatch);
  refs.redoHistory = () => redoHistory(refs, dispatch);

  // Seed history with the initial blank state so undo never goes below 0
  refs.historyStack = [];
  refs.historyIndex = -1;
  pushHistory(refs);
}

/**
 * seedHistory — reset the history stack and push a single initial snapshot
 * using explicit layers/activeLayerId rather than refs.stateRef.current.
 *
 * Use this whenever refs.stateRef.current may be stale (e.g. right after a
 * frame switch, before React has re-rendered and updated stateRef).
 */
export function seedHistory(refs, layers, activeLayerId) {
  const { pixelBuffers, maskBuffers } = refs;
  const snapshot = {
    layers,
    activeLayerId,
    pixelBuffers: {},
    maskBuffers: {},
  };
  for (const [id, buf] of Object.entries(pixelBuffers)) {
    snapshot.pixelBuffers[id] = buf ? new Uint8ClampedArray(buf) : null;
  }
  for (const [id, buf] of Object.entries(maskBuffers)) {
    snapshot.maskBuffers[id] = buf ? new Uint8Array(buf) : null;
  }
  refs.historyStack = [snapshot];
  refs.historyIndex = 0;
}
