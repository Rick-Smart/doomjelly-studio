import { useRef, useState, useEffect } from "react";
import { makeLayer } from "../jellySprite.constants";

/**
 * Manages the layer stack, layer pixel data, and layer masks for the
 * currently active frame.
 */
export function useLayerManager({
  canvasW,
  canvasH,
  pushHistoryEntry,
  redraw,
  saveToProject,
}) {
  const initLayer = makeLayer("Layer 1");

  const [layers, setLayers] = useState([initLayer]);
  const [activeLayerId, setActiveLayerId] = useState(initLayer.id);
  const [editingMaskId, setEditingMaskId] = useState(null);

  const layerDataRef = useRef({ [initLayer.id]: null });
  const layerMaskDataRef = useRef({});
  const layersRef = useRef([initLayer]);
  const activeLayerIdRef = useRef(initLayer.id);
  const editingMaskIdRef = useRef(null);

  // Keep stable refs in sync
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);
  useEffect(() => {
    editingMaskIdRef.current = editingMaskId;
  }, [editingMaskId]);

  function addLayer() {
    const newLayer = makeLayer(`Layer ${layersRef.current.length + 1}`);
    layerDataRef.current[newLayer.id] = new Uint8ClampedArray(
      canvasW * canvasH * 4,
    );
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  }

  function deleteLayer(id) {
    if (layersRef.current.length <= 1) return;
    const remaining = layersRef.current.filter((l) => l.id !== id);
    delete layerDataRef.current[id];
    delete layerMaskDataRef.current[id];
    if (editingMaskIdRef.current === id) setEditingMaskId(null);
    setLayers(remaining);
    const newActive =
      id === activeLayerIdRef.current
        ? remaining[remaining.length - 1].id
        : activeLayerIdRef.current;
    setActiveLayerId(newActive);
  }

  function duplicateLayer(id) {
    const src = layersRef.current.find((l) => l.id === id);
    if (!src) return;
    const dup = makeLayer(src.name + " copy");
    const srcData = layerDataRef.current[id];
    layerDataRef.current[dup.id] = srcData
      ? new Uint8ClampedArray(srcData)
      : new Uint8ClampedArray(canvasW * canvasH * 4);
    const srcMask = layerMaskDataRef.current[id];
    if (srcMask) {
      layerMaskDataRef.current[dup.id] = new Uint8Array(srcMask);
      dup.hasMask = true;
    }
    const idx = layersRef.current.findIndex((l) => l.id === id);
    setLayers((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
    setActiveLayerId(dup.id);
  }

  function mergeLayerDown(id) {
    const idx = layersRef.current.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    const below = layersRef.current[idx - 1];
    const topData = layerDataRef.current[id];
    const botData = layerDataRef.current[below.id];
    if (!topData || !botData) return;
    const topLayer = layersRef.current[idx];
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
    delete layerDataRef.current[id];
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setActiveLayerId(below.id);
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function flattenAll() {
    const w = canvasW,
      h = canvasH;
    const flat = new Uint8ClampedArray(w * h * 4);
    layersRef.current.forEach((layer) => {
      if (!layer.visible) return;
      const data = layerDataRef.current[layer.id];
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
    layerDataRef.current = { [baseLayer.id]: flat };
    layerMaskDataRef.current = {};
    setEditingMaskId(null);
    setLayers([baseLayer]);
    setActiveLayerId(baseLayer.id);
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function moveLayerUp(id) {
    const idx = layersRef.current.findIndex((l) => l.id === id);
    if (idx >= layersRef.current.length - 1) return;
    setLayers((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  function moveLayerDown(id) {
    const idx = layersRef.current.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    setLayers((prev) => {
      const next = [...prev];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      return next;
    });
  }

  function updateLayer(id, patch) {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }

  function addLayerMask(layerId) {
    layerMaskDataRef.current[layerId] = new Uint8Array(canvasW * canvasH).fill(
      255,
    );
    updateLayer(layerId, { hasMask: true });
    redraw();
  }

  function removeLayerMask(layerId) {
    delete layerMaskDataRef.current[layerId];
    if (editingMaskIdRef.current === layerId) setEditingMaskId(null);
    updateLayer(layerId, { hasMask: false });
    redraw();
  }

  return {
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
    editingMaskId,
    setEditingMaskId,
    layerDataRef,
    layerMaskDataRef,
    layersRef,
    activeLayerIdRef,
    editingMaskIdRef,
    addLayer,
    deleteLayer,
    duplicateLayer,
    mergeLayerDown,
    flattenAll,
    moveLayerUp,
    moveLayerDown,
    updateLayer,
    addLayerMask,
    removeLayerMask,
  };
}
