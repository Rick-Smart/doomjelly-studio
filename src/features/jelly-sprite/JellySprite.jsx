import { useRef, useEffect } from "react";
import JSZip from "jszip";
import { useProject } from "../../contexts/ProjectContext";
import "./JellySprite.css";
import * as A from "./store/jellySpriteActions";
import { makeLayer } from "./jellySprite.constants";
import { JellySpriteCtx } from "./JellySpriteContext";
import { JellySpriteProvider } from "./store/JellySpriteProvider";
import { useJellySpriteStore } from "./store/useJellySpriteStore";
import { LeftToolbar } from "./panels/LeftToolbar";
import { CanvasArea } from "./panels/CanvasArea";
import { RightPanel, ExportModal } from "./panels/RightPanel";
import { makeFrame } from "./jellySprite.constants";
import { useCanvas } from "./hooks/useCanvas";
import { wireHistoryEngine } from "./engine/historyEngine";
import { useDrawingTools } from "./hooks/useDrawingTools";

// ── Outer component — just provides the store context ─────────────────────────
export function JellySprite({ onSwitchToAnimator }) {
  return (
    <JellySpriteProvider>
      <JellySpriteBody onSwitchToAnimator={onSwitchToAnimator} />
    </JellySpriteProvider>
  );
}

// ── Inner component — all logic runs inside JellySpriteProvider ───────────────
function JellySpriteBody({ onSwitchToAnimator }) {
  const { state, dispatch } = useProject();
  const { refs, state: ss, dispatch: sd } = useJellySpriteStore();

  // ── Store state (M4) ───────────────────────────────────────────────────────
  const {
    canvasW,
    canvasH,
    zoom,
    tool,
    fillShapes,
    symmetryH,
    symmetryV,
    gridVisible,
    frameGridVisible,
    brushType,
    brushSize,
    brushOpacity,
    resizeAnchor,
    customW,
    customH,
    fgColor,
    bgColor,
    fgAlpha,
    colorHistory,
    palettes,
    activePalette,
    panelTab,
    exportOpen,
    exportFramesPerRow,
    exportPadding,
    exportLabels,
    refImage,
    refOpacity,
    refVisible,
    tileVisible,
    tileCount,
    layers,
    activeLayerId,
    editingMaskId,
    frames,
    activeFrameIdx,
    frameThumbnails,
    isPlaying,
    fps,
    onionSkinning,
    canUndo,
    canRedo,
  } = ss;

  // Dispatch wrappers — keep the same setter names so all callers are unchanged
  const setZoom = (v) => sd({ type: A.SET_ZOOM, payload: v });
  const setTool = (v) => sd({ type: A.SET_TOOL, payload: v });
  const setFillShapes = (v) => sd({ type: A.SET_FILL_SHAPES, payload: v });
  const setSymmetryH = (v) => sd({ type: A.SET_SYMMETRY_H, payload: v });
  const setSymmetryV = (v) => sd({ type: A.SET_SYMMETRY_V, payload: v });
  const setGridVisible = (v) => sd({ type: A.SET_GRID_VISIBLE, payload: v });
  const setFrameGridVisible = (v) =>
    sd({ type: A.SET_FRAME_GRID_VISIBLE, payload: v });
  const setBrushType = (v) => sd({ type: A.SET_BRUSH_TYPE, payload: v });
  const setBrushSize = (v) => sd({ type: A.SET_BRUSH_SIZE, payload: v });
  const setBrushOpacity = (v) => sd({ type: A.SET_BRUSH_OPACITY, payload: v });
  const setFgColor = (v) => sd({ type: A.SET_FG_COLOR, payload: v });
  const setBgColor = (v) => sd({ type: A.SET_BG_COLOR, payload: v });
  const setFgAlpha = (v) => sd({ type: A.SET_FG_ALPHA, payload: v });
  const setActivePalette = (v) =>
    sd({ type: A.SET_ACTIVE_PALETTE, payload: v });
  const setPanelTab = (v) => sd({ type: A.SET_PANEL_TAB, payload: v });
  const setExportOpen = (v) => sd({ type: A.SET_EXPORT_OPEN, payload: v });
  const setExportFramesPerRow = (v) =>
    sd({ type: A.SET_EXPORT_FRAMES_PER_ROW, payload: v });
  const setExportPadding = (v) =>
    sd({ type: A.SET_EXPORT_PADDING, payload: v });
  const setExportLabels = (v) => sd({ type: A.SET_EXPORT_LABELS, payload: v });
  const setRefImage = (v) => sd({ type: A.SET_REF_IMAGE, payload: v });
  const setRefOpacity = (v) => sd({ type: A.SET_REF_OPACITY, payload: v });
  const setRefVisible = (v) => sd({ type: A.SET_REF_VISIBLE, payload: v });
  const setTileVisible = (v) => sd({ type: A.SET_TILE_VISIBLE, payload: v });
  const setTileCount = (v) => sd({ type: A.SET_TILE_COUNT, payload: v });
  const setResizeAnchor = (v) => sd({ type: A.SET_RESIZE_ANCHOR, payload: v });
  const setCustomW = (v) => sd({ type: A.SET_CUSTOM_W, payload: v });
  const setCustomH = (v) => sd({ type: A.SET_CUSTOM_H, payload: v });
  // Canvas size — dispatches both w and h together
  const setCanvasW = (v) =>
    sd({ type: A.SET_CANVAS_SIZE, payload: { w: v, h: canvasH } });
  const setCanvasH = (v) =>
    sd({ type: A.SET_CANVAS_SIZE, payload: { w: canvasW, h: v } });
  // Layer/mask state dispatch wrappers
  const setActiveLayerId = (id) =>
    sd({ type: A.SET_ACTIVE_LAYER, payload: id });
  const setEditingMaskId = (id) =>
    sd({ type: A.SET_EDITING_MASK, payload: id });
  // Frame / playback dispatch wrappers
  const setFps = (v) => sd({ type: A.SET_FPS, payload: v });
  const setOnionSkinning = (v) =>
    sd({ type: A.SET_ONION_SKINNING, payload: v });

  const pendingResizeDataRef = useRef(null);
  const refImgElRef = useRef(null);
  const refOpacityRef = useRef(0.5);
  const refVisibleRef = useRef(true);
  const tileCanvasRef = useRef(null);
  const tileUpdateRef = useRef(null);

  // ── Bridge refs (M5) ───────────────────────────────────────────────────────
  // layerDataRef / layerMaskDataRef are getter/setter proxies so that legacy
  // hooks (useDrawingTools) read and write the same pixel store as the new
  // engine (refs.pixelBuffers / refs.maskBuffers).
  // Assigning `layerDataRef.current = obj` replaces refs.pixelBuffers entirely
  // (correct semantics for frame-switching) rather than mutating in-place.
  const layerDataRef = {
    get current() {
      return refs.pixelBuffers;
    },
    set current(val) {
      refs.pixelBuffers = val;
    },
  };
  const layerMaskDataRef = {
    get current() {
      return refs.maskBuffers;
    },
    set current(val) {
      refs.maskBuffers = val;
    },
  };
  // Stable refs — synced every render so closures never go stale
  const layersRef = useRef(ss.layers);
  const activeLayerIdRef = useRef(ss.activeLayerId);
  const editingMaskIdRef = useRef(ss.editingMaskId);
  const framesRef = useRef(ss.frames);
  const activeFrameIdxRef = useRef(ss.activeFrameIdx);
  const isPlayingRef = useRef(ss.isPlaying);
  const playbackFrameIdxRef = useRef(ss.activeFrameIdx);
  layersRef.current = ss.layers;
  activeLayerIdRef.current = ss.activeLayerId;
  editingMaskIdRef.current = ss.editingMaskId;
  framesRef.current = ss.frames;
  activeFrameIdxRef.current = ss.activeFrameIdx;
  isPlayingRef.current = ss.isPlaying;
  // playbackFrameIdxRef is only advanced by startPlayback — not synced to store

  // playIntervalRef: holds setInterval id for playback (not in React state)
  const playIntervalRef = useRef(null);

  // ── Stub refs — break circular hook dependencies ───────────────────────────
  const pushHistoryEntryStubRef = useRef(() => {});
  const redrawStubRef = useRef(() => {});
  const saveToProjectStubRef = useRef(() => {});

  // ── useCanvas (M2 store-based) ─────────────────────────────────────────────
  const { canvasRef } = useCanvas();

  // Backward-compat refs: useDrawingTools still
  // read these. They are populated by the init useEffect below, exactly as
  // before. The old offscreen canvas and pixel buffers keep the old rendering
  // pipeline working while M3+ migrates drawing into the new store.
  const pixelsRef = useRef(null);
  const offscreenRef = useRef(null);

  // redrawRef + redraw: delegate to refs.redraw (the new store renderer).
  // Old hooks / playback that call redrawRef.current?.() will trigger the
  // new canvas renderer, keeping visuals in sync.
  const redrawRef = useRef(null);
  redrawRef.current = () => refs.redraw?.();
  const redraw = () => refs.redraw?.();

  // ── Frame snapshot store (M6) ──────────────────────────────────────────────
  // refs.frameSnapshots: { [frameId]: { layers, activeLayerId, pixelBuffers, maskBuffers } }
  // Initialised lazily the first time a frame is saved or switched away from.
  // We alias frameDataRef → refs.frameSnapshots so export helpers keep working.
  const frameDataRef = {
    get current() {
      return refs.frameSnapshots;
    },
    set current(val) {
      refs.frameSnapshots = val;
    },
  };

  // ── Frame helpers ──────────────────────────────────────────────────────────
  function saveCurrentFrameToSnapshot() {
    const frameId = framesRef.current[activeFrameIdxRef.current]?.id;
    if (!frameId) return;
    refs.frameSnapshots[frameId] = {
      layers: [...layersRef.current],
      activeLayerId: activeLayerIdRef.current,
      // shallow copy of the map — the Uint8ClampedArrays themselves are shared
      pixelBuffers: { ...refs.pixelBuffers },
      maskBuffers: { ...refs.maskBuffers },
      // legacy alias so export compositeFrameToCanvas still works
      pixelData: refs.pixelBuffers,
    };
  }
  // Alias used by legacy export code
  const saveCurrentFrameToRef = saveCurrentFrameToSnapshot;

  function loadFrameFromSnapshot(frameId) {
    const snap = refs.frameSnapshots[frameId];
    if (!snap) {
      // New frame — initialise blank
      const newLayer = makeLayer("Layer 1");
      const pb = {
        [newLayer.id]: new Uint8ClampedArray(canvasW * canvasH * 4),
      };
      refs.frameSnapshots[frameId] = {
        layers: [newLayer],
        activeLayerId: newLayer.id,
        pixelBuffers: pb,
        maskBuffers: {},
        pixelData: pb,
      };
      refs.pixelBuffers = pb;
      refs.maskBuffers = {};
      pixelsRef.current = pb[newLayer.id];
      sd({ type: A.SET_LAYERS, payload: [newLayer] });
      sd({ type: A.SET_ACTIVE_LAYER, payload: newLayer.id });
      return;
    }
    refs.pixelBuffers = snap.pixelBuffers;
    refs.maskBuffers = snap.maskBuffers ?? {};
    pixelsRef.current = refs.pixelBuffers[snap.activeLayerId] ?? null;
    sd({ type: A.SET_LAYERS, payload: [...snap.layers] });
    sd({ type: A.SET_ACTIVE_LAYER, payload: snap.activeLayerId });
  }

  function generateFrameThumbnail(frameId) {
    const w = canvasW,
      h = canvasH;
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const ctx2 = tmp.getContext("2d");
    const isActive =
      framesRef.current[activeFrameIdxRef.current]?.id === frameId;
    const snap = refs.frameSnapshots[frameId];
    const renderLayers = isActive ? layersRef.current : (snap?.layers ?? []);
    const renderPB = isActive ? refs.pixelBuffers : (snap?.pixelBuffers ?? {});
    renderLayers.forEach((layer) => {
      if (!layer.visible) return;
      const data = renderPB[layer.id];
      if (!data) return;
      const imgData = new ImageData(new Uint8ClampedArray(data), w, h);
      const lt = document.createElement("canvas");
      lt.width = w;
      lt.height = h;
      lt.getContext("2d").putImageData(imgData, 0, 0);
      ctx2.globalAlpha = layer.opacity;
      ctx2.drawImage(lt, 0, 0);
      ctx2.globalAlpha = 1;
    });
    return tmp.toDataURL("image/png");
  }

  function updateThumbnailForActiveFrame() {
    const frameId = framesRef.current[activeFrameIdxRef.current]?.id;
    if (!frameId) return;
    const dataUrl = generateFrameThumbnail(frameId);
    if (dataUrl)
      sd({ type: A.UPDATE_THUMBNAIL, payload: { frameId, dataUrl } });
  }

  // ── Frame operations ───────────────────────────────────────────────────────
  function switchToFrame(newIdx) {
    if (newIdx === activeFrameIdxRef.current) return;
    saveCurrentFrameToSnapshot();
    const newFrameId = framesRef.current[newIdx]?.id;
    if (!newFrameId) return;
    loadFrameFromSnapshot(newFrameId);
    sd({
      type: A.SWITCH_FRAME,
      payload: {
        newIdx,
        layers: refs.frameSnapshots[newFrameId]?.layers ?? layersRef.current,
        activeLayerId:
          refs.frameSnapshots[newFrameId]?.activeLayerId ??
          activeLayerIdRef.current,
      },
    });
    wireHistoryEngine(refs, sd);
    refs.redraw?.();
  }

  function addFrame() {
    saveCurrentFrameToSnapshot();
    const newFrame = makeFrame(`Frame ${framesRef.current.length + 1}`);
    const newLayer = makeLayer("Layer 1");
    const pb = { [newLayer.id]: new Uint8ClampedArray(canvasW * canvasH * 4) };
    refs.frameSnapshots[newFrame.id] = {
      layers: [newLayer],
      activeLayerId: newLayer.id,
      pixelBuffers: pb,
      maskBuffers: {},
      pixelData: pb,
    };
    refs.pixelBuffers = pb;
    refs.maskBuffers = {};
    pixelsRef.current = pb[newLayer.id];
    sd({ type: A.ADD_FRAME, payload: { frame: newFrame, layer: newLayer } });
    wireHistoryEngine(refs, sd);
    refs.redraw?.();
  }

  function duplicateFrame(idx) {
    saveCurrentFrameToSnapshot();
    const srcId = framesRef.current[idx]?.id;
    const src = refs.frameSnapshots[srcId] ?? {
      layers: layersRef.current,
      activeLayerId: activeLayerIdRef.current,
      pixelBuffers: refs.pixelBuffers,
      maskBuffers: refs.maskBuffers,
    };
    const newFrame = makeFrame(framesRef.current[idx].name + " dup");
    const newPB = {};
    const newMB = {};
    const newLayers = src.layers.map((l) => {
      const dup = makeLayer(l.name);
      dup.visible = l.visible;
      dup.opacity = l.opacity;
      const srcBuf = src.pixelBuffers[l.id];
      newPB[dup.id] = srcBuf
        ? new Uint8ClampedArray(srcBuf)
        : new Uint8ClampedArray(canvasW * canvasH * 4);
      if (src.maskBuffers?.[l.id]) {
        newMB[dup.id] = new Uint8Array(src.maskBuffers[l.id]);
        dup.hasMask = true;
      }
      return dup;
    });
    const newActiveLayerId = newLayers[newLayers.length - 1].id;
    refs.frameSnapshots[newFrame.id] = {
      layers: newLayers,
      activeLayerId: newActiveLayerId,
      pixelBuffers: newPB,
      maskBuffers: newMB,
      pixelData: newPB,
    };
    refs.pixelBuffers = newPB;
    refs.maskBuffers = newMB;
    pixelsRef.current = newPB[newActiveLayerId];
    const newIdx = idx + 1;
    sd({
      type: A.DUPLICATE_FRAME,
      payload: {
        newFrame,
        insertIdx: newIdx,
        layers: newLayers,
        activeLayerId: newActiveLayerId,
      },
    });
    wireHistoryEngine(refs, sd);
    refs.redraw?.();
  }

  function deleteFrame(idx) {
    if (framesRef.current.length <= 1) return;
    const delId = framesRef.current[idx]?.id;
    delete refs.frameSnapshots[delId];
    const remaining = framesRef.current.filter((_, i) => i !== idx);
    const newIdx = Math.min(idx, remaining.length - 1);
    loadFrameFromSnapshot(remaining[newIdx].id);
    sd({
      type: A.DELETE_FRAME,
      payload: {
        frameId: delId,
        remainingFrames: remaining,
        newIdx,
        newLayers:
          refs.frameSnapshots[remaining[newIdx].id]?.layers ??
          layersRef.current,
        newActiveLayerId:
          refs.frameSnapshots[remaining[newIdx].id]?.activeLayerId ??
          activeLayerIdRef.current,
      },
    });
    wireHistoryEngine(refs, sd);
    refs.redraw?.();
  }

  function startPlayback() {
    if (framesRef.current.length <= 1) return;
    saveCurrentFrameToSnapshot();
    playbackFrameIdxRef.current = activeFrameIdxRef.current;
    isPlayingRef.current = true;
    playIntervalRef.current = setInterval(() => {
      playbackFrameIdxRef.current =
        (playbackFrameIdxRef.current + 1) % framesRef.current.length;
      refs.redraw?.();
    }, 1000 / ss.fps);
    sd({ type: A.SET_IS_PLAYING, payload: true });
  }

  function stopPlayback() {
    clearInterval(playIntervalRef.current);
    playIntervalRef.current = null;
    isPlayingRef.current = false;
    sd({ type: A.SET_IS_PLAYING, payload: false });
    refs.redraw?.();
  }

  // ── useDrawingTools ────────────────────────────────────────────────────────
  const {
    selection,
    selectionRef,
    lassoPathRef,
    lassoMaskRef,
    marchOffsetRef,
    marchingAntsRef,
    clipboardRef,
    isDrawing,
    onMouseDown: _onMouseDown,
    onMouseMove: _onMouseMove,
    onMouseUp: _onMouseUp,
    onMouseLeave: _onMouseLeave,
    copySelection,
    pasteSelection,
    deleteSelectionContents,
    cropToSelection,
    flipH,
    flipV,
    rotateCW,
    rotateCCW,
    setSelection,
  } = useDrawingTools({
    canvasW,
    canvasH,
    canvasRef,
    zoom,
    pixelsRef,
    layerDataRef,
    layerMaskDataRef,
    editingMaskIdRef,
    activeLayerIdRef,
    tool,
    brushType,
    brushSize,
    brushOpacity,
    fillShapes,
    symmetryH,
    symmetryV,
    fgColor,
    fgAlpha,
    pendingResizeDataRef,
    resizeAnchor,
    pushHistoryEntry: () => pushHistoryEntryStubRef.current(),
    redraw: () => redrawStubRef.current(),
    saveToProject: () => saveToProjectStubRef.current(),
    setCanvasW,
    setCanvasH,
    setSelection: () => {},
  });

  // ── Patch stubs every render ───────────────────────────────────────────────
  function saveToProject() {
    const c = canvasRef.current;
    if (!c) return;
    dispatch({
      type: "SET_SPRITE_FORGE_DATA",
      payload: c.toDataURL("image/png"),
    });
  }
  pushHistoryEntryStubRef.current = () => {
    refs.pushHistory?.();
    updateThumbnailForActiveFrame();
  };
  redrawStubRef.current = redraw;
  saveToProjectStubRef.current = saveToProject;

  // Stop playback if FPS changes while playing
  useEffect(() => {
    if (!isPlayingRef.current) return;
    stopPlayback();
    // Restart on next tick so ss.fps is already updated
    const t = setTimeout(() => startPlayback(), 0);
    return () => clearTimeout(t);
  }, [fps]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Layer actions (M5: dispatch + mutate pixel buffers directly) ──────────
  function addLayer() {
    const newLayer = makeLayer(`Layer ${ss.layers.length + 1}`);
    refs.pixelBuffers[newLayer.id] = new Uint8ClampedArray(
      canvasW * canvasH * 4,
    );
    sd({ type: A.ADD_LAYER, payload: { layer: newLayer } });
  }
  function deleteLayer(id) {
    if (ss.layers.length <= 1) return;
    const remaining = ss.layers.filter((l) => l.id !== id);
    delete refs.pixelBuffers[id];
    delete refs.maskBuffers[id];
    const newActive =
      id === ss.activeLayerId
        ? remaining[remaining.length - 1].id
        : ss.activeLayerId;
    sd({
      type: A.DELETE_LAYER,
      payload: {
        layerId: id,
        remainingLayers: remaining,
        newActiveLayerId: newActive,
      },
    });
  }
  function duplicateLayer(id) {
    const src = ss.layers.find((l) => l.id === id);
    if (!src) return;
    const dup = makeLayer(src.name + " copy");
    const srcData = refs.pixelBuffers[id];
    refs.pixelBuffers[dup.id] = srcData
      ? new Uint8ClampedArray(srcData)
      : new Uint8ClampedArray(canvasW * canvasH * 4);
    const srcMask = refs.maskBuffers[id];
    if (srcMask) {
      refs.maskBuffers[dup.id] = new Uint8Array(srcMask);
      dup.hasMask = true;
    }
    const insertAfterIndex = ss.layers.findIndex((l) => l.id === id);
    sd({
      type: A.DUPLICATE_LAYER,
      payload: { newLayer: dup, insertAfterIndex },
    });
  }
  function mergeLayerDown(id) {
    const idx = ss.layers.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    const below = ss.layers[idx - 1];
    const topData = refs.pixelBuffers[id];
    const botData = refs.pixelBuffers[below.id];
    if (!topData || !botData) return;
    const topLayer = ss.layers[idx];
    for (let i = 0; i < botData.length; i += 4) {
      const ta = (topData[i + 3] / 255) * topLayer.opacity;
      const ba = botData[i + 3] / 255;
      const outA = ta + ba * (1 - ta);
      if (outA === 0) {
        botData[i] = botData[i + 1] = botData[i + 2] = botData[i + 3] = 0;
        continue;
      }
      botData[i] = Math.round(
        (topData[i] * ta + botData[i] * ba * (1 - ta)) / outA,
      );
      botData[i + 1] = Math.round(
        (topData[i + 1] * ta + botData[i + 1] * ba * (1 - ta)) / outA,
      );
      botData[i + 2] = Math.round(
        (topData[i + 2] * ta + botData[i + 2] * ba * (1 - ta)) / outA,
      );
      botData[i + 3] = Math.round(outA * 255);
    }
    delete refs.pixelBuffers[id];
    pushHistoryEntryStubRef.current();
    refs.redraw?.();
    sd({
      type: A.MERGE_LAYER_DOWN,
      payload: { survivingLayerId: below.id, removedLayerId: id },
    });
    saveToProjectStubRef.current();
  }
  function flattenAll() {
    const flat = new Uint8ClampedArray(canvasW * canvasH * 4);
    ss.layers.forEach((layer) => {
      if (!layer.visible) return;
      const data = refs.pixelBuffers[layer.id];
      if (!data) return;
      for (let i = 0; i < flat.length; i += 4) {
        const ta = (data[i + 3] / 255) * layer.opacity;
        const ba = flat[i + 3] / 255;
        const outA = ta + ba * (1 - ta);
        if (outA === 0) continue;
        flat[i] = Math.round((data[i] * ta + flat[i] * ba * (1 - ta)) / outA);
        flat[i + 1] = Math.round(
          (data[i + 1] * ta + flat[i + 1] * ba * (1 - ta)) / outA,
        );
        flat[i + 2] = Math.round(
          (data[i + 2] * ta + flat[i + 2] * ba * (1 - ta)) / outA,
        );
        flat[i + 3] = Math.round(outA * 255);
      }
    });
    const baseLayer = makeLayer("Flattened");
    refs.pixelBuffers = { [baseLayer.id]: flat };
    refs.maskBuffers = {};
    pushHistoryEntryStubRef.current();
    refs.redraw?.();
    sd({ type: A.FLATTEN_ALL, payload: { newLayer: baseLayer } });
    saveToProjectStubRef.current();
  }
  function moveLayerUp(id) {
    sd({ type: A.MOVE_LAYER_UP, payload: id });
    refs.redraw?.();
  }
  function moveLayerDown(id) {
    sd({ type: A.MOVE_LAYER_DOWN, payload: id });
    refs.redraw?.();
  }
  function updateLayer(id, patch) {
    sd({ type: A.UPDATE_LAYER, payload: { layerId: id, patch } });
    if ("visible" in patch || "opacity" in patch || "blendMode" in patch)
      refs.redraw?.();
  }
  function addLayerMask(layerId) {
    refs.maskBuffers[layerId] = new Uint8Array(canvasW * canvasH).fill(255);
    sd({ type: A.ADD_LAYER_MASK, payload: layerId });
    refs.redraw?.();
  }
  function removeLayerMask(layerId) {
    delete refs.maskBuffers[layerId];
    sd({ type: A.REMOVE_LAYER_MASK, payload: layerId });
    refs.redraw?.();
  }

  // Expose minimal refs on window ONLY for useCanvas (renderer reads framesRef,
  // activeFrameIdxRef, isPlayingRef, playbackFrameIdxRef to composite onion
  // skins and playback frames without circular deps).
  useEffect(() => {
    window.__jellyRefs__ = {
      framesRef,
      activeFrameIdxRef,
      isPlayingRef,
      playbackFrameIdxRef,
      onionSkinning,
      frameSnapshots: refs.frameSnapshots,
    };
  }); // no deps — runs every render so values stay current

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  function doUndo() {
    refs.undoHistory?.();
  }

  function doRedo() {
    refs.redoHistory?.();
  }

  function clearCanvas() {
    const activeLayerId = refs.stateRef.current.activeLayerId;
    const buf = refs.pixelBuffers[activeLayerId];
    if (buf) {
      buf.fill(0);
      refs.pushHistory?.();
      refs.redraw?.();
      return;
    }
    // legacy fallback
    pixelsRef.current?.fill(0);
    pushHistoryEntryStubRef.current();
    redraw();
    saveToProject();
  }

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  // M3: prefer the new store-based drawing engine when it's ready.
  // The old _onMouseDown/_onMouseMove (from useDrawingTools) remain as fallback.
  function onMouseDown(e) {
    const eng = refs.drawingEngine;
    const hex = eng ? eng.onPointerDown(e) : _onMouseDown(e);
    if (hex) pickColor(hex);
  }
  function onMouseMove(e) {
    const eng = refs.drawingEngine;
    const hex = eng ? eng.onPointerMove(e) : _onMouseMove(e);
    if (hex) pickColor(hex);
  }
  function onMouseUp(e) {
    const eng = refs.drawingEngine;
    if (eng) eng.onPointerUp(e);
    else _onMouseUp?.(e);
  }
  function onMouseLeave(e) {
    const eng = refs.drawingEngine;
    if (eng) eng.onPointerLeave(e);
    else _onMouseLeave?.(e);
  }

  // ── Colour helpers ─────────────────────────────────────────────────────────
  function pickColor(hex) {
    sd({ type: A.PICK_COLOR, payload: hex });
  }

  // ── Initialise / resize ────────────────────────────────────────────────────
  useEffect(() => {
    const w = canvasW,
      h = canvasH,
      size = w * h * 4;

    // Re-allocate pixel buffers for all current layers (M5: goes into refs directly)
    const freshBuffers = {};
    for (const l of ss.layers) {
      freshBuffers[l.id] = new Uint8ClampedArray(size);
    }
    refs.pixelBuffers = freshBuffers;

    if (pendingResizeDataRef.current) {
      for (const [lid, data] of Object.entries(pendingResizeDataRef.current)) {
        if (refs.pixelBuffers[lid]) refs.pixelBuffers[lid].set(data);
      }
      pendingResizeDataRef.current = null;
    }

    pixelsRef.current =
      refs.pixelBuffers[ss.activeLayerId] ??
      (refs.pixelBuffers[ss.activeLayerId] = new Uint8ClampedArray(size));

    const activeFrameId = framesRef.current[activeFrameIdxRef.current]?.id;
    if (activeFrameId) {
      refs.frameSnapshots[activeFrameId] = {
        layers: [...layersRef.current],
        activeLayerId: activeLayerIdRef.current,
        pixelBuffers: refs.pixelBuffers,
        maskBuffers: refs.maskBuffers,
        pixelData: refs.pixelBuffers,
      };
    }

    offscreenRef.current = document.createElement("canvas");
    offscreenRef.current.width = w;
    offscreenRef.current.height = h;

    function finish() {
      wireHistoryEngine(refs, sd);
      redraw();
    }

    const src = state.JellySpriteDataUrl;
    if (src) {
      const img = new Image();
      img.onload = () => {
        const ctx2 = offscreenRef.current.getContext("2d");
        ctx2.clearRect(0, 0, w, h);
        ctx2.drawImage(img, 0, 0, w, h);
        pixelsRef.current.set(ctx2.getImageData(0, 0, w, h).data);
        refs.pixelBuffers[ss.activeLayerId] = pixelsRef.current;
        finish();
      };
      img.src = src;
    } else {
      finish();
    }
  }, [canvasW, canvasH]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync pixelsRef when active layer changes
  useEffect(() => {
    if (!refs.pixelBuffers[activeLayerId]) {
      refs.pixelBuffers[activeLayerId] = new Uint8ClampedArray(
        canvasW * canvasH * 4,
      );
    }
    pixelsRef.current = refs.pixelBuffers[activeLayerId];
    redraw();
  }, [activeLayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    redraw();
  }, [zoom, gridVisible, frameGridVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refOpacityRef.current = refOpacity;
  }, [refOpacity]);
  useEffect(() => {
    refVisibleRef.current = refVisible;
  }, [refVisible]);

  // Marching ants animation
  useEffect(() => {
    if (!selection) {
      if (marchingAntsRef.current)
        cancelAnimationFrame(marchingAntsRef.current);
      return;
    }
    const animate = () => {
      marchOffsetRef.current = (marchOffsetRef.current + 1) % 16;
      redraw();
      marchingAntsRef.current = requestAnimationFrame(animate);
    };
    marchingAntsRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(marchingAntsRef.current);
  }, [selection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tileVisible) redrawRef.current?.();
  }, [tileVisible, tileCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const actionsRef = useRef({});
  actionsRef.current = {
    doUndo,
    doRedo,
    setTool,
    swapColors: () => sd({ type: A.SWAP_COLORS }),
    deselectAll: () => {
      setSelection(null);
      selectionRef.current = null;
      lassoMaskRef.current = null;
    },
    copySelection: () => copySelection(),
    pasteSelection: () => pasteSelection(),
    deleteSelection: () => deleteSelectionContents(),
    prevFrame: () => {
      if (!isPlayingRef.current)
        switchToFrame(Math.max(0, activeFrameIdxRef.current - 1));
    },
    nextFrame: () => {
      if (!isPlayingRef.current)
        switchToFrame(
          Math.min(framesRef.current.length - 1, activeFrameIdxRef.current + 1),
        );
    },
    togglePlay: () => {
      isPlayingRef.current ? stopPlayback() : startPlayback();
    },
  };

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA"].includes(tag)) return;
      const a = actionsRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        a.doUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        a.doRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        a.deselectAll();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        a.copySelection();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        a.pasteSelection();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectionRef.current
      ) {
        e.preventDefault();
        a.deleteSelection();
      } else if (e.key === "p") a.setTool("pencil");
      else if (e.key === "e") a.setTool("eraser");
      else if (e.key === "f") a.setTool("fill");
      else if (e.key === "l") a.setTool("line");
      else if (e.key === "r") a.setTool("rect");
      else if (e.key === "o") a.setTool("ellipse");
      else if (e.key === "i") a.setTool("picker");
      else if (e.key === "m") a.setTool("select-rect");
      else if (e.key === "w") a.setTool("select-wand");
      else if (e.key === "v") a.setTool("move");
      else if (e.key === "a") a.setTool("spray");
      else if (e.key === "x") a.swapColors();
      else if (e.key === "Escape") a.deselectAll();
      else if (e.key === " ") {
        e.preventDefault();
        a.togglePlay();
      } else if (e.key === ",") a.prevFrame();
      else if (e.key === ".") a.nextFrame();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reference image ────────────────────────────────────────────────────────
  function loadRefImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        refImgElRef.current = img;
        redrawRef.current?.();
      };
      img.src = e.target.result;
      setRefImage(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  function clearRefImage() {
    refImgElRef.current = null;
    setRefImage(null);
    redrawRef.current?.();
  }

  // ── Canvas resize ──────────────────────────────────────────────────────────
  function changeSize(nw, nh) {
    if (nw === canvasW && nh === canvasH) return;
    const hasContent =
      (refs.historyStack?.length ?? 0) > 1 ||
      pixelsRef.current?.some((v) => v !== 0);
    if (
      hasContent &&
      !window.confirm(
        `Resize to ${nw}x${nh}? Pixels outside the new canvas will be clipped.`,
      )
    )
      return;
    const anchorMap = {
      tl: [0, 0],
      tc: [0.5, 0],
      tr: [1, 0],
      ml: [0, 0.5],
      mc: [0.5, 0.5],
      mr: [1, 0.5],
      bl: [0, 1],
      bc: [0.5, 1],
      br: [1, 1],
    };
    const [ax, ay] = anchorMap[resizeAnchor] ?? [0.5, 0.5];
    const offX = Math.round((nw - canvasW) * ax);
    const offY = Math.round((nh - canvasH) * ay);
    const resized = {};
    for (const [lid, data] of Object.entries(layerDataRef.current)) {
      const buf = new Uint8ClampedArray(nw * nh * 4);
      for (let y = 0; y < canvasH; y++) {
        for (let x = 0; x < canvasW; x++) {
          const nx = x + offX,
            ny = y + offY;
          if (nx < 0 || nx >= nw || ny < 0 || ny >= nh) continue;
          const si = (y * canvasW + x) * 4,
            di = (ny * nw + nx) * 4;
          buf[di] = data[si];
          buf[di + 1] = data[si + 1];
          buf[di + 2] = data[si + 2];
          buf[di + 3] = data[si + 3];
        }
      }
      resized[lid] = buf;
    }
    pendingResizeDataRef.current = resized;
    sd({ type: A.SET_CANVAS_SIZE, payload: { w: nw, h: nh } });
  }

  // ── Animator integration ───────────────────────────────────────────────────
  function useInAnimator() {
    const c = canvasRef.current;
    if (!c) return;
    const dataUrl = c.toDataURL("image/png");
    dispatch({ type: "SET_SPRITE_FORGE_DATA", payload: dataUrl });
    dispatch({
      type: "SET_SPRITE_SHEET",
      payload: {
        dataUrl,
        objectUrl: dataUrl,
        filename: `${state.name || "sprite"}.png`,
        width: canvasW,
        height: canvasH,
      },
    });
    onSwitchToAnimator?.();
  }

  async function importFromAnimator() {
    const sh = state.spriteSheet;
    if (!sh?.objectUrl) return;
    let src = sh.objectUrl;
    if (!src.startsWith("data:")) {
      try {
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = src;
        });
        const cvs = document.createElement("canvas");
        cvs.width = sh.width;
        cvs.height = sh.height;
        cvs.getContext("2d").drawImage(img, 0, 0);
        src = cvs.toDataURL("image/png");
      } catch {
        return;
      }
    }
    const loadImg = new Image();
    loadImg.onload = () => {
      const ctx = offscreenRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.drawImage(loadImg, 0, 0, canvasW, canvasH);
      pixelsRef.current.set(ctx.getImageData(0, 0, canvasW, canvasH).data);
      pushHistoryEntryStubRef.current();
      redraw();
      saveToProject();
    };
    loadImg.src = src;
  }

  // ── Export helpers ─────────────────────────────────────────────────────────
  function compositeFrameToCanvas(frameId) {
    const w = canvasW,
      h = canvasH;
    const cvs = document.createElement("canvas");
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext("2d");
    const isActive =
      framesRef.current[activeFrameIdxRef.current]?.id === frameId;
    const renderLayers = isActive
      ? layersRef.current
      : (frameDataRef.current[frameId]?.layers ?? []);
    const renderPixelData = isActive
      ? layerDataRef.current
      : (frameDataRef.current[frameId]?.pixelData ?? {});
    renderLayers.forEach((layer) => {
      if (!layer.visible) return;
      const data = renderPixelData[layer.id];
      if (!data) return;
      const imgData = new ImageData(new Uint8ClampedArray(data), w, h);
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      tmp.getContext("2d").putImageData(imgData, 0, 0);
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 1;
    });
    return cvs;
  }

  function triggerDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  function exportPNG() {
    saveCurrentFrameToRef();
    const id = framesRef.current[activeFrameIdxRef.current]?.id;
    if (!id) return;
    triggerDownload(
      compositeFrameToCanvas(id).toDataURL("image/png"),
      `${state.name || "sprite"}.png`,
    );
  }

  function exportSpriteSheet(
    framesPerRow = exportFramesPerRow,
    padding = exportPadding,
    labels = exportLabels,
  ) {
    saveCurrentFrameToRef();
    const allFrames = framesRef.current;
    const fw = canvasW,
      fh = canvasH;
    const cols = Math.min(framesPerRow, allFrames.length);
    const rows = Math.ceil(allFrames.length / cols);
    const labelH = labels ? 12 : 0;
    const sheet = document.createElement("canvas");
    sheet.width = cols * (fw + padding) + padding;
    sheet.height = rows * (fh + padding + labelH) + padding;
    const ctx = sheet.getContext("2d");
    allFrames.forEach((frame, idx) => {
      const col = idx % cols,
        row = Math.floor(idx / cols);
      const x = padding + col * (fw + padding);
      const y = padding + row * (fh + padding + labelH);
      ctx.drawImage(compositeFrameToCanvas(frame.id), x, y);
      if (labels) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.font = "9px monospace";
        ctx.fillText(frame.name || `F${idx + 1}`, x + 2, y + fh + 9);
      }
    });
    triggerDownload(
      sheet.toDataURL("image/png"),
      `${state.name || "sprite"}_sheet.png`,
    );
  }

  async function exportFramesZip() {
    saveCurrentFrameToRef();
    const zip = new JSZip();
    const folder = zip.folder("frames");
    for (let i = 0; i < framesRef.current.length; i++) {
      const frame = framesRef.current[i];
      const b64 = compositeFrameToCanvas(frame.id)
        .toDataURL("image/png")
        .split(",")[1];
      folder.file(
        `${state.name || "sprite"}_frame_${String(i + 1).padStart(3, "0")}.png`,
        b64,
        { base64: true },
      );
    }
    triggerDownload(
      URL.createObjectURL(await zip.generateAsync({ type: "blob" })),
      `${state.name || "sprite"}_frames.zip`,
    );
  }

  function exportPaletteHex() {
    const blob = new Blob(
      [
        (palettes[activePalette] ?? [])
          .map((c) => c.replace("#", ""))
          .join("\n"),
      ],
      { type: "text/plain" },
    );
    triggerDownload(
      URL.createObjectURL(blob),
      `${activePalette.replace(/\s+/g, "_")}.hex`,
    );
  }

  // ── Palette management ─────────────────────────────────────────────────────
  function paletteAddColor(hex) {
    sd({ type: A.PALETTE_ADD_COLOR, payload: hex });
  }
  function paletteRemoveColor(idx) {
    const hex = (palettes[activePalette] ?? [])[idx];
    if (hex !== undefined) sd({ type: A.PALETTE_REMOVE_COLOR, payload: hex });
  }
  function paletteSetColors(colors) {
    sd({
      type: A.PALETTE_SET_COLORS,
      payload: { name: activePalette, colors },
    });
  }
  function paletteAddNew(name) {
    sd({ type: A.PALETTE_ADD_NEW, payload: { name } });
  }
  function paletteDelete(name) {
    sd({ type: A.PALETTE_DELETE, payload: name });
  }
  function paletteRename(oldName, newName) {
    sd({ type: A.PALETTE_RENAME, payload: { oldName, newName } });
  }

  // ── Tile preview ───────────────────────────────────────────────────────────
  tileUpdateRef.current = () => {
    const tc = tileCanvasRef.current,
      off2 = offscreenRef.current;
    if (!tc || !off2 || !tileVisible) return;
    const n = tileCount;
    tc.width = canvasW * n;
    tc.height = canvasH * n;
    const tCtx = tc.getContext("2d");
    tCtx.imageSmoothingEnabled = false;
    tCtx.clearRect(0, 0, tc.width, tc.height);
    for (let row = 0; row < n; row++)
      for (let col = 0; col < n; col++)
        tCtx.drawImage(off2, col * canvasW, row * canvasH);
  };

  // ── Cursor style ───────────────────────────────────────────────────────────
  const selectTools = ["select-rect", "select-lasso", "select-wand"];
  const cursorStyle =
    tool === "picker"
      ? "crosshair"
      : tool === "move"
        ? isDrawing.current
          ? "grabbing"
          : "grab"
        : selectTools.includes(tool)
          ? "crosshair"
          : ["line", "rect", "ellipse"].includes(tool)
            ? "crosshair"
            : "cell";

  // ── Context object ─────────────────────────────────────────────────────────
  const ctx = {
    canvasW,
    canvasH,
    zoom,
    setZoom,
    canvasRef,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    cursorStyle,
    tool,
    setTool,
    fillShapes,
    setFillShapes,
    symmetryH,
    setSymmetryH,
    symmetryV,
    setSymmetryV,
    gridVisible,
    setGridVisible,
    frameGridVisible,
    setFrameGridVisible,
    brushType,
    setBrushType,
    brushSize,
    setBrushSize,
    brushOpacity,
    setBrushOpacity,
    flipH,
    flipV,
    rotateCW,
    rotateCCW,
    doUndo,
    doRedo,
    canUndo,
    canRedo,
    clearCanvas,
    fgColor,
    setFgColor,
    bgColor,
    setBgColor,
    fgAlpha,
    setFgAlpha,
    colorHistory,
    pickColor,
    selection,
    setSelection,
    selectionRef,
    lassoMaskRef,
    clipboardRef,
    copySelection,
    pasteSelection,
    cropToSelection,
    deleteSelectionContents,
    layers,
    activeLayerId,
    setActiveLayerId,
    addLayer,
    deleteLayer,
    duplicateLayer,
    mergeLayerDown,
    moveLayerUp,
    moveLayerDown,
    updateLayer,
    flattenAll,
    redraw,
    editingMaskId,
    setEditingMaskId,
    addLayerMask,
    removeLayerMask,
    frames,
    activeFrameIdx,
    frameThumbnails,
    playbackFrameIdxRef,
    isPlaying,
    fps,
    setFps: (v) => setFps(v),
    onionSkinning,
    setOnionSkinning,
    switchToFrame,
    duplicateFrame,
    deleteFrame,
    addFrame,
    startPlayback,
    stopPlayback,
    resizeAnchor,
    setResizeAnchor,
    customW,
    setCustomW,
    customH,
    setCustomH,
    changeSize,
    palettes,
    activePalette,
    setActivePalette,
    paletteAddColor,
    paletteRemoveColor,
    paletteAddNew,
    paletteDelete,
    paletteRename,
    paletteSetColors,
    panelTab,
    setPanelTab,
    refImage,
    clearRefImage,
    loadRefImage,
    refVisible,
    setRefVisible,
    refVisibleRef,
    refOpacity,
    setRefOpacity,
    refOpacityRef,
    tileVisible,
    setTileVisible,
    tileCount,
    setTileCount,
    tileCanvasRef,
    redrawRef,
    exportOpen,
    setExportOpen,
    exportFramesPerRow,
    setExportFramesPerRow,
    exportPadding,
    setExportPadding,
    exportLabels,
    setExportLabels,
    exportPNG,
    exportSpriteSheet,
    exportFramesZip,
    exportPaletteHex,
    projectState: state,
    importFromAnimator,
    useInAnimator,
  };

  return (
    <JellySpriteCtx.Provider value={ctx}>
      <div className="jelly-sprite">
        <LeftToolbar />
        <CanvasArea />
        <RightPanel />
        <ExportModal />
      </div>
    </JellySpriteCtx.Provider>
  );
}
