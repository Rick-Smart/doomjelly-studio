import { useRef, useState, useEffect } from "react";
import { makeFrame, makeLayer } from "../jellySprite.constants";

/**
 * Manages the frames array, frame data persistence (saving/loading layer
 * state per frame), playback loop, onion skin, and thumbnails.
 */
export function useFramePlayback({
  canvasW,
  canvasH,
  layerDataRef,
  layerMaskDataRef,
  layersRef,
  activeLayerIdRef,
  pixelsRef,
  redrawRef,
  setLayers,
  setActiveLayerId,
  snapshotHistory,
  historyRef,
  histIdxRef,
  setCanUndo,
  setCanRedo,
}) {
  const initFrame = makeFrame("Frame 1");

  const [frames, setFrames] = useState([initFrame]);
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(8);
  const [onionSkinning, setOnionSkinning] = useState(false);
  const [frameThumbnails, setFrameThumbnails] = useState({});

  const framesRef = useRef([initFrame]);
  const activeFrameIdxRef = useRef(0);
  const isPlayingRef = useRef(false);
  const playbackFrameIdxRef = useRef(0);
  const playIntervalRef = useRef(null);

  // frameDataRef: { frameId: { layers, activeLayerId, pixelData } }
  const frameDataRef = useRef({
    [initFrame.id]: {
      layers: layersRef.current,
      activeLayerId: activeLayerIdRef.current,
      pixelData: null,
    },
  });

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);
  useEffect(() => {
    activeFrameIdxRef.current = activeFrameIdx;
  }, [activeFrameIdx]);

  // Expose refs on window so useCanvas can reach them without circular deps.
  useEffect(() => {
    window.__frameDataRef__ = frameDataRef;
    window.__jellyRefs__ = {
      framesRef,
      activeFrameIdxRef,
      isPlayingRef,
      playbackFrameIdxRef,
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Playback interval
  useEffect(() => {
    if (!isPlaying || framesRef.current.length <= 1) {
      clearInterval(playIntervalRef.current);
      return;
    }
    playIntervalRef.current = setInterval(() => {
      playbackFrameIdxRef.current =
        (playbackFrameIdxRef.current + 1) % framesRef.current.length;
      redrawRef.current?.();
    }, 1000 / fps);
    return () => clearInterval(playIntervalRef.current);
  }, [isPlaying, fps]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Thumbnail generator ────────────────────────────────────────────────────
  function generateFrameThumbnail(frameId) {
    const w = canvasW,
      h = canvasH;
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const ctx = tmp.getContext("2d");
    const isActiveFrame =
      framesRef.current[activeFrameIdxRef.current]?.id === frameId;
    const renderLayers = isActiveFrame
      ? layersRef.current
      : (frameDataRef.current[frameId]?.layers ?? []);
    const renderPixelData = isActiveFrame
      ? layerDataRef.current
      : (frameDataRef.current[frameId]?.pixelData ?? {});
    renderLayers.forEach((layer) => {
      if (!layer.visible) return;
      const data = renderPixelData[layer.id];
      if (!data) return;
      const imgData = new ImageData(new Uint8ClampedArray(data), w, h);
      const ltmp = document.createElement("canvas");
      ltmp.width = w;
      ltmp.height = h;
      ltmp.getContext("2d").putImageData(imgData, 0, 0);
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(ltmp, 0, 0);
      ctx.globalAlpha = 1;
    });
    return tmp.toDataURL("image/png");
  }

  function updateThumbnailForActiveFrame() {
    const activeFrameId = framesRef.current[activeFrameIdxRef.current]?.id;
    if (!activeFrameId) return;
    const thumb = generateFrameThumbnail(activeFrameId);
    if (thumb)
      setFrameThumbnails((prev) => ({ ...prev, [activeFrameId]: thumb }));
  }

  // ── Frame persistence ──────────────────────────────────────────────────────
  function saveCurrentFrameToRef() {
    const frameId = framesRef.current[activeFrameIdxRef.current]?.id;
    if (!frameId) return;
    frameDataRef.current[frameId] = {
      layers: [...layersRef.current],
      activeLayerId: activeLayerIdRef.current,
      pixelData: layerDataRef.current,
    };
  }

  function loadFrameFromRef(frameId) {
    const data = frameDataRef.current[frameId];
    if (!data) {
      const newLayer = makeLayer("Layer 1");
      const pixelData = {
        [newLayer.id]: new Uint8ClampedArray(canvasW * canvasH * 4),
      };
      frameDataRef.current[frameId] = {
        layers: [newLayer],
        activeLayerId: newLayer.id,
        pixelData,
      };
      layerDataRef.current = pixelData;
      pixelsRef.current = pixelData[newLayer.id];
      setLayers([newLayer]);
      setActiveLayerId(newLayer.id);
      return;
    }
    layerDataRef.current = data.pixelData;
    pixelsRef.current = layerDataRef.current[data.activeLayerId] ?? null;
    setLayers([...data.layers]);
    setActiveLayerId(data.activeLayerId);
  }

  // ── Frame operations ───────────────────────────────────────────────────────
  function switchToFrame(newIdx) {
    if (newIdx === activeFrameIdxRef.current) return;
    saveCurrentFrameToRef();
    const newFrameId = framesRef.current[newIdx]?.id;
    if (!newFrameId) return;
    loadFrameFromRef(newFrameId);
    setActiveFrameIdx(newIdx);
  }

  function addFrame() {
    saveCurrentFrameToRef();
    const newFrame = makeFrame(`Frame ${framesRef.current.length + 1}`);
    const newLayer = makeLayer("Layer 1");
    const pixelData = {
      [newLayer.id]: new Uint8ClampedArray(canvasW * canvasH * 4),
    };
    frameDataRef.current[newFrame.id] = {
      layers: [newLayer],
      activeLayerId: newLayer.id,
      pixelData,
    };
    const newIdx = framesRef.current.length;
    setFrames((prev) => [...prev, newFrame]);
    layerDataRef.current = pixelData;
    pixelsRef.current = pixelData[newLayer.id];
    setLayers([newLayer]);
    setActiveLayerId(newLayer.id);
    setActiveFrameIdx(newIdx);
    historyRef.current = [snapshotHistory()];
    histIdxRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }

  function duplicateFrame(idx) {
    saveCurrentFrameToRef();
    const srcId = framesRef.current[idx].id;
    const srcData = frameDataRef.current[srcId];
    const newFrame = makeFrame(framesRef.current[idx].name + " dup");
    const newPixelData = {};
    const newLayers = (srcData?.layers ?? layersRef.current).map((l) => {
      const dup = makeLayer(l.name);
      dup.visible = l.visible;
      dup.opacity = l.opacity;
      const srcBuf = srcData?.pixelData[l.id] ?? layerDataRef.current[l.id];
      newPixelData[dup.id] = srcBuf
        ? new Uint8ClampedArray(srcBuf)
        : new Uint8ClampedArray(canvasW * canvasH * 4);
      return dup;
    });
    const newActiveLayerId = newLayers[newLayers.length - 1].id;
    frameDataRef.current[newFrame.id] = {
      layers: newLayers,
      activeLayerId: newActiveLayerId,
      pixelData: newPixelData,
    };
    const newIdx = idx + 1;
    setFrames((prev) => {
      const next = [...prev];
      next.splice(newIdx, 0, newFrame);
      return next;
    });
    layerDataRef.current = newPixelData;
    pixelsRef.current = newPixelData[newActiveLayerId];
    setLayers(newLayers);
    setActiveLayerId(newActiveLayerId);
    setActiveFrameIdx(newIdx);
  }

  function deleteFrame(idx) {
    if (framesRef.current.length <= 1) return;
    const delId = framesRef.current[idx].id;
    delete frameDataRef.current[delId];
    const remaining = framesRef.current.filter((_, i) => i !== idx);
    const newIdx = Math.min(idx, remaining.length - 1);
    setFrames(remaining);
    loadFrameFromRef(remaining[newIdx].id);
    setActiveFrameIdx(newIdx);
    historyRef.current = [snapshotHistory()];
    histIdxRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }

  function startPlayback() {
    if (framesRef.current.length <= 1) return;
    saveCurrentFrameToRef();
    playbackFrameIdxRef.current = activeFrameIdxRef.current;
    isPlayingRef.current = true;
    setIsPlaying(true);
  }

  function stopPlayback() {
    clearInterval(playIntervalRef.current);
    isPlayingRef.current = false;
    setIsPlaying(false);
    redrawRef.current?.();
  }

  return {
    frames,
    setFrames,
    activeFrameIdx,
    setActiveFrameIdx,
    isPlaying,
    fps,
    setFps,
    onionSkinning,
    setOnionSkinning,
    frameThumbnails,
    framesRef,
    activeFrameIdxRef,
    isPlayingRef,
    playbackFrameIdxRef,
    frameDataRef,
    saveCurrentFrameToRef,
    loadFrameFromRef,
    switchToFrame,
    addFrame,
    duplicateFrame,
    deleteFrame,
    startPlayback,
    stopPlayback,
    generateFrameThumbnail,
    updateThumbnailForActiveFrame,
  };
}
