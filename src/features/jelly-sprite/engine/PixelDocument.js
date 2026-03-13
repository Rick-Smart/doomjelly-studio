/**
 * PixelDocument — plain JS class, zero React imports.
 *
 * Owns all mutable pixel state for a JellySprite document:
 *  • pixel/mask buffers for the active frame
 *  • per-frame snapshots (saved state for each frame)
 *  • per-frame undo/redo history
 *  • frame and layer metadata
 *
 * Everything that touches pixels (drawingEngine, historyEngine, serialization)
 * routes through this class. React components hold a stable instance via useRef
 * and call PixelDocument methods instead of mutating refs directly.
 *
 * Sprint 7a — class created (no consumers yet).
 * Sprint 7c — JellySprite.jsx + drawingEngine.js migrated to use this.
 */

import { MAX_HISTORY, makeLayer, makeFrame } from "../jellySprite.constants.js";

// ── Internal base64 helpers (no outer imports needed) ────────────────────────

function _uint8ToBase64(arr) {
  if (!arr || arr.length === 0) return "";
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < arr.length; i += CHUNK) {
    binary += String.fromCharCode(...arr.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function _base64ToUint8Clamped(b64) {
  if (!b64) return null;
  const binary = atob(b64);
  const out = new Uint8ClampedArray(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function _base64ToUint8(b64) {
  if (!b64) return null;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ── PixelDocument ─────────────────────────────────────────────────────────────

export class PixelDocument {
  /**
   * @param {{ canvasW?: number, canvasH?: number }} [opts]
   */
  constructor({ canvasW = 32, canvasH = 32 } = {}) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;

    // Seed with one blank frame and one blank layer
    const initLayer = makeLayer("Layer 1");
    const initFrame = makeFrame("Frame 1");

    this.frames = [initFrame];
    this.layers = [initLayer];
    this.activeLayerId = initLayer.id;
    this.activeFrameIdx = 0;

    const blank = new Uint8ClampedArray(canvasW * canvasH * 4);

    // Active-frame pixel data (kept in sync with frameSnapshots)
    this.pixelBuffers = { [initLayer.id]: blank };
    this.maskBuffers = {};

    // Per-frame saved state — populated on first frame-switch or save
    this.frameSnapshots = {
      [initFrame.id]: {
        layers: this.layers,
        activeLayerId: initLayer.id,
        pixelBuffers: { [initLayer.id]: new Uint8ClampedArray(blank) },
        maskBuffers: {},
        historyStack: [],
        historyIndex: -1,
      },
    };

    // Per-frame undo/redo
    this.historyStack = [];
    this.historyIndex = -1;

    // onChange observers — notified on any structural mutation
    this._handlers = [];
  }

  // ── Observer ────────────────────────────────────────────────────────────────

  /**
   * Register a change observer. Returns an unsubscribe function.
   * @param {(event: {type: string}, doc: PixelDocument) => void} handler
   * @returns {() => void}
   */
  onChange(handler) {
    this._handlers.push(handler);
    return () => {
      this._handlers = this._handlers.filter((h) => h !== handler);
    };
  }

  _notify(event) {
    for (const h of this._handlers) h(event, this);
  }

  // ── History ─────────────────────────────────────────────────────────────────

  get canUndo() {
    return this.historyIndex > 0;
  }

  get canRedo() {
    return this.historyIndex < this.historyStack.length - 1;
  }

  /**
   * Snapshot the current drawing state and push it onto the history stack.
   * Call this after every completed stroke.
   */
  pushHistory() {
    const snapshot = {
      layers: this.layers, // immutable metadata — safe to share
      activeLayerId: this.activeLayerId,
      pixelBuffers: {},
      maskBuffers: {},
    };

    for (const [id, buf] of Object.entries(this.pixelBuffers)) {
      snapshot.pixelBuffers[id] = buf ? new Uint8ClampedArray(buf) : null;
    }
    for (const [id, buf] of Object.entries(this.maskBuffers)) {
      snapshot.maskBuffers[id] = buf ? new Uint8Array(buf) : null;
    }

    // Truncate forward history (new stroke invalidates redo)
    this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    this.historyStack.push(snapshot);

    if (this.historyStack.length > MAX_HISTORY) {
      this.historyStack.shift();
    }
    this.historyIndex = this.historyStack.length - 1;
  }

  /**
   * Seed the history stack with an explicit initial snapshot.
   * Use after frame-switch or canvas initialisation when reducer state
   * may be stale inside closures.
   */
  seedHistory(layers, activeLayerId) {
    const snapshot = {
      layers,
      activeLayerId,
      pixelBuffers: {},
      maskBuffers: {},
    };
    for (const [id, buf] of Object.entries(this.pixelBuffers)) {
      snapshot.pixelBuffers[id] = buf ? new Uint8ClampedArray(buf) : null;
    }
    for (const [id, buf] of Object.entries(this.maskBuffers)) {
      snapshot.maskBuffers[id] = buf ? new Uint8Array(buf) : null;
    }
    this.historyStack = [snapshot];
    this.historyIndex = 0;
  }

  /** Step backwards. Returns true if an undo was performed. */
  undo() {
    if (!this.canUndo) return false;
    this.historyIndex--;
    this._applyHistorySnapshot(this.historyStack[this.historyIndex]);
    return true;
  }

  /** Step forwards. Returns true if a redo was performed. */
  redo() {
    if (!this.canRedo) return false;
    this.historyIndex++;
    this._applyHistorySnapshot(this.historyStack[this.historyIndex]);
    return true;
  }

  _applyHistorySnapshot(snapshot) {
    for (const [id, buf] of Object.entries(snapshot.pixelBuffers)) {
      if (buf) {
        if (!this.pixelBuffers[id]) {
          this.pixelBuffers[id] = new Uint8ClampedArray(buf);
        } else {
          this.pixelBuffers[id].set(buf);
        }
      } else {
        this.pixelBuffers[id] = null;
      }
    }
    for (const [id, buf] of Object.entries(snapshot.maskBuffers)) {
      if (buf) {
        if (!this.maskBuffers[id]) {
          this.maskBuffers[id] = new Uint8Array(buf);
        } else {
          this.maskBuffers[id].set(buf);
        }
      } else {
        this.maskBuffers[id] = null;
      }
    }
    this.layers = snapshot.layers;
    this.activeLayerId = snapshot.activeLayerId;
    this._notify({ type: "history" });
  }

  // ── Frame operations ────────────────────────────────────────────────────────

  /**
   * Save the current active frame's state into frameSnapshots.
   * Must be called before switching frames or serializing.
   */
  saveCurrentFrame() {
    const frameId = this.frames[this.activeFrameIdx]?.id;
    if (!frameId) return;
    this.frameSnapshots[frameId] = {
      layers: [...this.layers],
      activeLayerId: this.activeLayerId,
      // Shallow copy the maps — the Uint8ClampedArrays are shared (not cloned)
      pixelBuffers: { ...this.pixelBuffers },
      maskBuffers: { ...this.maskBuffers },
      historyStack: this.historyStack,
      historyIndex: this.historyIndex,
    };
  }

  /**
   * Switch to a different frame by index. Saves the current frame first.
   * @param {number} frameIdx
   */
  switchFrame(frameIdx) {
    this.saveCurrentFrame();
    this.activeFrameIdx = frameIdx;

    const frameId = this.frames[frameIdx]?.id;
    const snap = frameId ? this.frameSnapshots[frameId] : null;

    if (snap) {
      this.pixelBuffers = { ...snap.pixelBuffers };
      this.maskBuffers = { ...snap.maskBuffers };
      this.layers = snap.layers;
      this.activeLayerId = snap.activeLayerId;
      this.historyStack = snap.historyStack ?? [];
      this.historyIndex = snap.historyIndex ?? -1;
    } else {
      // New / unknown frame — blank slate
      const newLayer = makeLayer("Layer 1");
      const size = this.canvasW * this.canvasH * 4;
      this.pixelBuffers = {
        [newLayer.id]: new Uint8ClampedArray(size),
      };
      this.maskBuffers = {};
      this.layers = [newLayer];
      this.activeLayerId = newLayer.id;
      this.historyStack = [];
      this.historyIndex = -1;
    }

    this._notify({ type: "frame-switch", frameIdx });
  }

  /**
   * Add a new blank frame and return it.
   * @param {string} [name]
   * @returns {{ id: string, name: string }}
   */
  addFrame(name) {
    const frame = makeFrame(name ?? `Frame ${this.frames.length + 1}`);
    this.frames = [...this.frames, frame];
    this._notify({ type: "frames-changed" });
    return frame;
  }

  /**
   * Remove a frame by id. No-op if only one frame remains.
   * @param {string} frameId
   */
  removeFrame(frameId) {
    if (this.frames.length <= 1) return;
    const idx = this.frames.findIndex((f) => f.id === frameId);
    if (idx === -1) return;

    delete this.frameSnapshots[frameId];
    this.frames = this.frames.filter((f) => f.id !== frameId);

    // Clamp active frame index if it fell off the end
    if (this.activeFrameIdx >= this.frames.length) {
      this.switchFrame(this.frames.length - 1);
    }

    this._notify({ type: "frames-changed" });
  }

  // ── Layer operations ────────────────────────────────────────────────────────

  /**
   * Add a new blank layer and return it.
   * @param {string} [name]
   * @returns {{ id: string, name: string, ... }}
   */
  addLayer(name) {
    const layer = makeLayer(name ?? `Layer ${this.layers.length + 1}`);
    const size = this.canvasW * this.canvasH * 4;
    this.pixelBuffers[layer.id] = new Uint8ClampedArray(size);
    this.layers = [...this.layers, layer];
    this._notify({ type: "layers-changed" });
    return layer;
  }

  /**
   * Remove a layer by id. No-op if only one layer remains.
   * @param {string} layerId
   */
  removeLayer(layerId) {
    if (this.layers.length <= 1) return;
    delete this.pixelBuffers[layerId];
    delete this.maskBuffers[layerId];
    this.layers = this.layers.filter((l) => l.id !== layerId);
    if (this.activeLayerId === layerId) {
      this.activeLayerId = this.layers[0]?.id ?? null;
    }
    this._notify({ type: "layers-changed" });
  }

  /**
   * Reorder layers to match the given ordered id array.
   * @param {string[]} orderedIds
   */
  reorderLayers(orderedIds) {
    const byId = Object.fromEntries(this.layers.map((l) => [l.id, l]));
    this.layers = orderedIds.map((id) => byId[id]).filter(Boolean);
    this._notify({ type: "layers-changed" });
  }

  // ── Serialization ───────────────────────────────────────────────────────────

  /**
   * Produce a JSON-serializable pixel-data snapshot.
   * Does NOT include tool/brush/color state (those live in ToolContext).
   *
   * @returns {{ version: number, canvasW: number, canvasH: number, activeFrameIdx: number, frames: object[] }}
   */
  serialize() {
    // Flush active frame before snapshotting
    this.saveCurrentFrame();

    const frames = this.frames
      .map((frame) => {
        const snap = this.frameSnapshots[frame.id];
        if (!snap) return null;

        const pixelBuffers = {};
        for (const [id, buf] of Object.entries(snap.pixelBuffers ?? {})) {
          pixelBuffers[id] = _uint8ToBase64(buf);
        }

        const maskBuffers = {};
        for (const [id, buf] of Object.entries(snap.maskBuffers ?? {})) {
          if (buf) maskBuffers[id] = _uint8ToBase64(buf);
        }

        return {
          id: frame.id,
          name: frame.name,
          layers: (snap.layers ?? []).map((l) => ({
            id: l.id,
            name: l.name,
            visible: l.visible,
            opacity: l.opacity,
            blendMode: l.blendMode ?? "normal",
            locked: l.locked ?? false,
            hasMask: l.hasMask ?? false,
          })),
          activeLayerId: snap.activeLayerId,
          pixelBuffers,
          maskBuffers,
        };
      })
      .filter(Boolean);

    return {
      version: 3,
      canvasW: this.canvasW,
      canvasH: this.canvasH,
      activeFrameIdx: this.activeFrameIdx,
      frames,
    };
  }

  /**
   * Restore a PixelDocument from a serialized snapshot.
   * @param {object} data — must have { canvasW, canvasH, frames[] }
   * @returns {PixelDocument | null}
   */
  static deserialize(data) {
    if (!data || !Array.isArray(data.frames) || data.frames.length === 0) {
      return null;
    }

    const canvasW = data.canvasW ?? 32;
    const canvasH = data.canvasH ?? 32;

    const doc = new PixelDocument({ canvasW, canvasH });
    // Reset the seed state — we'll populate from the serialized frames
    doc.frames = [];
    doc.frameSnapshots = {};

    for (const frameData of data.frames) {
      const frame = { id: frameData.id, name: frameData.name };
      doc.frames.push(frame);

      const pixBufs = {};
      for (const [lid, b64] of Object.entries(frameData.pixelBuffers ?? {})) {
        pixBufs[lid] =
          _base64ToUint8Clamped(b64) ??
          new Uint8ClampedArray(canvasW * canvasH * 4);
      }

      const maskBufs = {};
      for (const [lid, b64] of Object.entries(frameData.maskBuffers ?? {})) {
        const decoded = _base64ToUint8(b64);
        if (decoded) maskBufs[lid] = decoded;
      }

      doc.frameSnapshots[frame.id] = {
        layers: frameData.layers ?? [],
        activeLayerId: frameData.activeLayerId,
        pixelBuffers: pixBufs,
        maskBuffers: maskBufs,
        historyStack: [],
        historyIndex: -1,
      };
    }

    // Make the stored active frame current
    const activeIdx = Math.min(data.activeFrameIdx ?? 0, doc.frames.length - 1);
    doc.activeFrameIdx = activeIdx;
    const activeFrameId = doc.frames[activeIdx]?.id;
    const snap = doc.frameSnapshots[activeFrameId];
    if (snap) {
      doc.pixelBuffers = { ...snap.pixelBuffers };
      doc.maskBuffers = { ...snap.maskBuffers };
      doc.layers = snap.layers;
      doc.activeLayerId = snap.activeLayerId;
    }

    return doc;
  }
}
