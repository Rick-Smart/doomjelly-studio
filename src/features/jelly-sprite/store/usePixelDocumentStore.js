/**
 * usePixelDocumentStore — Zustand store bridging PixelDocument to React.
 *
 * Wraps the PixelDocument class instance (`refs.doc`) so any module can read
 * canvas geometry, layer state, and undo/redo flags via `.getState()` without
 * needing access to React context or the refs object.
 *
 * This replaces refs.stateRef as the source of truth for
 * drawingEngine / canvasRenderer / clipboardOps / selectionOps.
 *
 * Sprint 11 — PixelDocument Store + Sprint 7e Artifact Removal.
 */

import { create } from "zustand";

export const usePixelDocumentStore = create((set, get) => ({
  // ── PixelDocument state (synced via onChange + syncFromDoc) ──────────────
  doc: null,
  frames: [],
  layers: [],
  activeLayerId: null,
  activeFrameIdx: 0,
  canvasW: 0,
  canvasH: 0,
  canUndo: false,
  canRedo: false,

  // ── Internal: unsub handle to avoid duplicate listeners ──────────────────
  _unsub: null,

  // ── Save-data collector (replaces onRegisterCollector callback prop) ──────
  // JellySpriteBody registers its collectSaveData function here on mount.
  // JellySpriteWorkspace calls collect() instead of a callback ref.
  _collectFn: null,
  setCollectFn(fn) {
    set({ _collectFn: fn });
  },
  collect() {
    return get()._collectFn?.() ?? null;
  },

  // ── Connect a PixelDocument instance to this store ───────────────────────
  // Call once on mount after refs.doc is available. Registers an onChange
  // listener that keeps store state in sync with mutations.
  setDoc(doc) {
    // Unsubscribe previous listener if any (guards against double-mount in
    // React StrictMode or future hot-reload scenarios).
    get()._unsub?.();

    const unsub = doc.onChange(() => {
      const d = get().doc;
      if (!d) return;
      set({
        frames: d.frames,
        layers: d.layers,
        activeLayerId: d.activeLayerId,
        activeFrameIdx: d.activeFrameIdx,
        canvasW: d.canvasW,
        canvasH: d.canvasH,
        canUndo: d.canUndo,
        canRedo: d.canRedo,
      });
    });

    set({
      doc,
      _unsub: unsub,
      frames: doc.frames,
      layers: doc.layers,
      activeLayerId: doc.activeLayerId,
      activeFrameIdx: doc.activeFrameIdx,
      canvasW: doc.canvasW,
      canvasH: doc.canvasH,
      canUndo: doc.canUndo,
      canRedo: doc.canRedo,
    });
  },

  // ── Manual sync (call after imperative doc mutations that skip _notify) ───
  // Used after the deserializeJellySprite restore flow which writes directly
  // to refs.doc properties rather than going through notifying methods.
  syncFromDoc() {
    const { doc } = get();
    if (!doc) return;
    set({
      frames: doc.frames,
      layers: doc.layers,
      activeLayerId: doc.activeLayerId,
      activeFrameIdx: doc.activeFrameIdx,
      canvasW: doc.canvasW,
      canvasH: doc.canvasH,
      canUndo: doc.canUndo,
      canRedo: doc.canRedo,
    });
  },

  // ── Undo / Redo passthrough ───────────────────────────────────────────────
  undo() {
    get().doc?.undo();
  },
  redo() {
    get().doc?.redo();
  },
}));
