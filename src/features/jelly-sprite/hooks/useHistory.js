import { useRef, useState } from "react";
import { MAX_HISTORY } from "../jellySprite.constants";

/**
 * Manages undo/redo history using full pixel snapshots.
 * Must be told about the current pixel and mask data refs so it can
 * snapshot and restore them.
 */
export function useHistory({
  layerDataRef,
  layerMaskDataRef,
  activeLayerIdRef,
  pixelsRef,
}) {
  const historyRef = useRef([]);
  const histIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function snapshotHistory() {
    const pixels = {};
    for (const [id, data] of Object.entries(layerDataRef.current)) {
      pixels[id] = data ? new Uint8ClampedArray(data) : null;
    }
    const masks = {};
    for (const [id, data] of Object.entries(layerMaskDataRef.current)) {
      masks[id] = data ? new Uint8Array(data) : null;
    }
    return { pixels, masks };
  }

  function pushHistoryEntry() {
    const snap = snapshotHistory();
    const h = historyRef.current.slice(0, histIdxRef.current + 1);
    h.push(snap);
    if (h.length > MAX_HISTORY) h.shift();
    historyRef.current = h;
    histIdxRef.current = h.length - 1;
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(false);
  }

  function restoreHistory(snap) {
    const pixels = snap.pixels ?? snap;
    const masks = snap.masks ?? {};
    for (const [id, data] of Object.entries(pixels)) {
      if (data) {
        if (!layerDataRef.current[id]) {
          layerDataRef.current[id] = new Uint8ClampedArray(data);
        } else {
          layerDataRef.current[id].set(data);
        }
      }
    }
    for (const [id, data] of Object.entries(masks)) {
      if (data) {
        if (!layerMaskDataRef.current[id]) {
          layerMaskDataRef.current[id] = new Uint8Array(data);
        } else {
          layerMaskDataRef.current[id].set(data);
        }
      }
    }
    pixelsRef.current = layerDataRef.current[activeLayerIdRef.current];
  }

  function resetHistory() {
    historyRef.current = [snapshotHistory()];
    histIdxRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }

  return {
    historyRef,
    histIdxRef,
    canUndo,
    canRedo,
    setCanUndo,
    setCanRedo,
    snapshotHistory,
    pushHistoryEntry,
    restoreHistory,
    resetHistory,
  };
}
