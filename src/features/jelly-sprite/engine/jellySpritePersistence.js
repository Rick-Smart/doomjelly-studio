// base64 helpers

function uint8ToBase64(arr) {
  if (!arr || arr.length === 0) return "";
  // Batch the bytes to avoid call-stack limits on large sprites
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < arr.length; i += CHUNK) {
    binary += String.fromCharCode(...arr.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToUint8Clamped(b64) {
  if (!b64) return null;
  const binary = atob(b64);
  const out = new Uint8ClampedArray(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function base64ToUint8(b64) {
  if (!b64) return null;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// Serialize

/**
 * Snapshots the entire JellySprite state into a plain JSON-serialisable object.
 *
 * @param {object} refs   - The live refs object from JellySpriteProvider
 * @param {object} ss     - The current JellySprite reducer state
 * @param {object} frames - The frames array (framesRef.current)
 * @returns {object} Serialized state for inclusion in the project file.
 */
export function serializeJellySprite(refs, ss, frames) {
  const serializedFrames = (frames ?? ss.frames ?? [])
    .map((frame) => {
      const snap = refs.frameSnapshots?.[frame.id];
      if (!snap) return null;

      const pixelBuffers = {};
      for (const [layerId, buf] of Object.entries(snap.pixelBuffers ?? {})) {
        pixelBuffers[layerId] = uint8ToBase64(buf);
      }

      const maskBuffers = {};
      for (const [layerId, buf] of Object.entries(snap.maskBuffers ?? {})) {
        if (buf) maskBuffers[layerId] = uint8ToBase64(buf);
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
    canvasW: ss.canvasW,
    canvasH: ss.canvasH,
    zoom: ss.zoom,
    tool: ss.tool,
    brushType: ss.brushType,
    brushSize: ss.brushSize,
    brushOpacity: ss.brushOpacity,
    brushHardness: ss.brushHardness ?? 100,
    fillShapes: ss.fillShapes,
    symmetryH: ss.symmetryH,
    symmetryV: ss.symmetryV,
    fgColor: ss.fgColor,
    bgColor: ss.bgColor,
    fgAlpha: ss.fgAlpha,
    colorHistory: ss.colorHistory ?? [],
    palettes: ss.palettes ?? {},
    activePalette: ss.activePalette,
    fps: ss.fps,
    onionSkinning: ss.onionSkinning,
    gridVisible: ss.gridVisible,
    frameGridVisible: ss.frameGridVisible,
    frameConfig: ss.frameConfig ?? null,
    refImage: ss.refImage ?? null,
    refOpacity: ss.refOpacity,
    refVisible: ss.refVisible,
    tileVisible: ss.tileVisible,
    tileCount: ss.tileCount,
    activeFrameIdx: ss.activeFrameIdx,
    frames: serializedFrames,
  };
}

// Deserialize

/**
 * Restores JellySprite state from a previously-serialized object.
 *
 * This function:
 *  1. Decodes all base64 pixel / mask buffers.
 *  2. Populates refs.frameSnapshots, refs.pixelBuffers, refs.maskBuffers.
 *  3. Returns a plain object with the reducer-state fields that should be
 *     dispatched (caller owns the dispatch calls).
 *
 * @param {object} data  - The object produced by serializeJellySprite
 * @param {object} refs  - The live refs object from JellySpriteProvider
 * @returns {{ storeState, frames, activeFrameIdx, activeLayerId, layers, pixelBuffers, maskBuffers }}
 *   storeState  : all scalar/plain-value fields ready for a batch dispatch
 *   frames      : decoded frame metadata (id/name) array in order
 *   activeFrameIdx : which frame should be active
 *   activeLayerId  : which layer should be active (on the active frame)
 *   layers      : layer metadata array for the active frame
 *   pixelBuffers : decoded { [layerId]: Uint8ClampedArray } for the active frame
 *   maskBuffers  : decoded { [layerId]: Uint8Array } for the active frame
 */
export function deserializeJellySprite(data, refs) {
  if (!data || !Array.isArray(data.frames) || data.frames.length === 0) {
    return null;
  }

  const canvasW = data.canvasW ?? 32;
  const canvasH = data.canvasH ?? 32;

  // Decode all frame snapshots into refs.frameSnapshots
  const newSnapshots = {};
  const frameList = [];

  for (const frameData of data.frames) {
    const pixBufs = {};
    for (const [lid, b64] of Object.entries(frameData.pixelBuffers ?? {})) {
      const decoded = base64ToUint8Clamped(b64);
      pixBufs[lid] = decoded ?? new Uint8ClampedArray(canvasW * canvasH * 4);
    }

    const maskBufs = {};
    for (const [lid, b64] of Object.entries(frameData.maskBuffers ?? {})) {
      const decoded = base64ToUint8(b64);
      if (decoded) maskBufs[lid] = decoded;
    }

    newSnapshots[frameData.id] = {
      layers: frameData.layers,
      activeLayerId: frameData.activeLayerId,
      pixelBuffers: pixBufs,
      maskBuffers: maskBufs,
      pixelData: pixBufs, // legacy alias
    };

    frameList.push({ id: frameData.id, name: frameData.name });
  }

  // Commit to refs
  refs.frameSnapshots = newSnapshots;

  const activeFrameIdx = Math.min(
    data.activeFrameIdx ?? 0,
    frameList.length - 1,
  );
  const activeFrameId = frameList[activeFrameIdx]?.id;
  const activeSnap = newSnapshots[activeFrameId];

  refs.pixelBuffers = activeSnap?.pixelBuffers ?? {};
  refs.maskBuffers = activeSnap?.maskBuffers ?? {};

  return {
    storeState: {
      canvasW,
      canvasH,
      zoom: data.zoom,
      tool: data.tool,
      brushType: data.brushType,
      brushSize: data.brushSize,
      brushOpacity: data.brushOpacity,
      fillShapes: data.fillShapes,
      symmetryH: data.symmetryH,
      symmetryV: data.symmetryV,
      fgColor: data.fgColor,
      bgColor: data.bgColor,
      fgAlpha: data.fgAlpha,
      colorHistory: data.colorHistory ?? [],
      palettes: data.palettes ?? {},
      activePalette: data.activePalette,
      fps: data.fps,
      onionSkinning: data.onionSkinning,
      gridVisible: data.gridVisible,
      frameGridVisible: data.frameGridVisible,
      frameConfig: data.frameConfig,
      refImage: data.refImage ?? null,
      refOpacity: data.refOpacity,
      refVisible: data.refVisible,
      tileVisible: data.tileVisible,
      tileCount: data.tileCount,
    },
    frames: frameList,
    activeFrameIdx,
    activeLayerId: activeSnap?.activeLayerId,
    layers: activeSnap?.layers ?? [],
    pixelBuffers: activeSnap?.pixelBuffers ?? {},
    maskBuffers: activeSnap?.maskBuffers ?? {},
  };
}
