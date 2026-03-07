import { useRef, useEffect, useState, useCallback } from "react";
import JSZip from "jszip";
import { useProject } from "../../contexts/ProjectContext";
import { BUILTIN_PALETTES } from "../../ui/PaletteManager";
import "./JellySprite.css";
import {
  MAX_HISTORY,
  MAX_COLOUR_HISTORY,
  BLEND_MODES,
  makeLayer,
  makeFrame,
} from "./jellySprite.constants";
import {
  hexToRgba,
  rgbaToHex,
  buildLassoMask,
  bresenhamLine,
  rasterRect,
  rasterEllipse,
} from "./jellySprite.utils";
import { JellySpriteCtx } from "./JellySpriteContext";
import { LeftToolbar } from "./panels/LeftToolbar";
import { CanvasArea } from "./panels/CanvasArea";
import { RightPanel, ExportModal } from "./panels/RightPanel";

// ── Component ─────────────────────────────────────────────────────────────────
export function JellySprite({ onSwitchToAnimator }) {
  const { state, dispatch } = useProject();

  // Canvas dimensions
  const [canvasW, setCanvasW] = useState(128);
  const [canvasH, setCanvasH] = useState(128);
  const [zoom, setZoom] = useState(4);

  // Tools & display
  const [tool, setTool] = useState("pencil");
  const [fillShapes, setFillShapes] = useState(false);
  const [symmetryH, setSymmetryH] = useState(false);
  const [symmetryV, setSymmetryV] = useState(false);
  const [gridVisible, setGridVisible] = useState(true);
  const [frameGridVisible, setFrameGridVisible] = useState(true);

  // Brush options
  const [brushType, setBrushType] = useState("round");
  const [brushSize, setBrushSize] = useState(1);
  const [brushOpacity, setBrushOpacity] = useState(100);

  // Selection state — {x, y, w, h, poly?} | null; lasso path during drag
  const [selection, setSelection] = useState(null);
  const selectionRef = useRef(null);
  const lassoPathRef = useRef([]); // {x,y} points during lasso drag
  const lassoMaskRef = useRef(null); // Uint8Array[canvasW*canvasH] — per-pixel selection mask
  const marchingAntsRef = useRef(null); // requestAnimationFrame id
  const marchOffsetRef = useRef(0);
  // Move tool state
  const moveOriginRef = useRef(null);
  const movePixelSnapRef = useRef(null);
  // Clipboard: { pixels: Uint8ClampedArray, w, h }
  const clipboardRef = useRef(null);
  // When set, the init/resize useEffect uses this data instead of blank buffers
  const pendingResizeDataRef = useRef(null);
  // 9-point anchor for canvas resize: tl/tc/tr/ml/mc/mr/bl/bc/br
  const [resizeAnchor, setResizeAnchor] = useState("mc");
  const [customW, setCustomW] = useState(128);
  const [customH, setCustomH] = useState(128);

  // Colour — foreground, background, alpha, history
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [fgAlpha, setFgAlpha] = useState(1);
  const [colorHistory, setColorHistory] = useState([]);

  // Palette management
  const [palettes, setPalettes] = useState(BUILTIN_PALETTES);
  const [activePalette, setActivePalette] = useState("DoomJelly 32");

  // Layers
  const initLayer = makeLayer("Layer 1");
  const [layers, setLayers] = useState([initLayer]);
  const [activeLayerId, setActiveLayerId] = useState(initLayer.id);
  const layerDataRef = useRef({ [initLayer.id]: null }); // id → Uint8ClampedArray | null

  // Frames — each frame owns its own layer stack
  const initFrame = makeFrame("Frame 1");
  const [frames, setFrames] = useState([initFrame]);
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  // frameDataRef: {frameId: {layers, activeLayerId, pixelData: {layerId: Uint8ClampedArray}}}
  // For the active frame, pixelData IS layerDataRef.current (aliased, not copied)
  const frameDataRef = useRef({
    [initFrame.id]: {
      layers: [initLayer],
      activeLayerId: initLayer.id,
      pixelData: null,
    },
  });
  // Stable refs that mirror state (used in callbacks/effects that can't capture fresh state)
  const framesRef = useRef([initFrame]);
  const layersRef = useRef([initLayer]);
  const activeLayerIdRef = useRef(initLayer.id);
  const activeFrameIdxRef = useRef(0);

  // Playback & onion skin
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(8);
  const [onionSkinning, setOnionSkinning] = useState(false);
  const onionOpacity = 0.3;
  const isPlayingRef = useRef(false);
  const playbackFrameIdxRef = useRef(0);
  const playIntervalRef = useRef(null);
  const redrawRef = useRef(null); // stable pointer to latest redraw fn

  // Frame thumbnails: {frameId: dataURL}
  const [frameThumbnails, setFrameThumbnails] = useState({});

  // Export modal
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFramesPerRow, setExportFramesPerRow] = useState(4);
  const [exportPadding, setExportPadding] = useState(1);
  const [exportLabels, setExportLabels] = useState(false);

  // Right-panel active tab
  const [panelTab, setPanelTab] = useState("palette");

  // Tile preview
  const [tileVisible, setTileVisible] = useState(false);
  const [tileCount, setTileCount] = useState(2);
  const tileCanvasRef = useRef(null);
  const tileUpdateRef = useRef(null);

  // Reference image overlay
  const [refImage, setRefImage] = useState(null);
  const [refOpacity, setRefOpacity] = useState(0.5);
  const [refVisible, setRefVisible] = useState(true);
  const refImgElRef = useRef(null);
  const refOpacityRef = useRef(0.5);
  const refVisibleRef = useRef(true);

  // Layer masks — per-layer alpha mask (Uint8Array, 1 byte/pixel, 0=hide 255=show)
  const layerMaskDataRef = useRef({});
  const [editingMaskId, setEditingMaskId] = useState(null); // layerId being mask-edited, or null
  const editingMaskIdRef = useRef(null); // stable version of above

  // Undo/redo — stores full {layerData, layers, activeLayerId} snapshots
  const historyRef = useRef([]);
  const histIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Canvas refs
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  // pixelsRef points to the ACTIVE layer's data for backward-compat with drawing code
  const pixelsRef = useRef(null);
  const isDrawing = useRef(false);
  const startPixel = useRef(null); // for line/rect/ellipse preview
  const lastPixel = useRef(null);
  const previewSnap = useRef(null); // pixel snapshot before shape preview

  // Stable ref for keyboard closures
  const actionsRef = useRef({});
  actionsRef.current = {
    doUndo: () => doUndo(),
    doRedo: () => doRedo(),
    setTool,
    swapColors: () => {
      setFgColor(bgColor);
      setBgColor(fgColor);
    },
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

  // ── Init / resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const w = canvasW,
      h = canvasH;
    const size = w * h * 4;

    // Resize all existing layer buffers (clear on resize)
    const newLayerData = {};
    setLayers((prevLayers) => {
      prevLayers.forEach((l) => {
        newLayerData[l.id] = new Uint8ClampedArray(size);
      });
      return prevLayers;
    });
    layerDataRef.current = newLayerData;

    // If a crop/resize pre-computed pixel data, copy it into the fresh buffers
    if (pendingResizeDataRef.current) {
      const pending = pendingResizeDataRef.current;
      for (const [lid, data] of Object.entries(pending)) {
        if (layerDataRef.current[lid]) {
          layerDataRef.current[lid].set(data);
        }
      }
      pendingResizeDataRef.current = null;
    }

    // Sync pixelsRef to active layer
    pixelsRef.current =
      layerDataRef.current[activeLayerId] ??
      (layerDataRef.current[activeLayerId] = new Uint8ClampedArray(size));

    // Wire frameDataRef for the active frame
    const activeFrameId = framesRef.current[activeFrameIdxRef.current]?.id;
    if (activeFrameId) {
      frameDataRef.current[activeFrameId] = {
        layers: [...layersRef.current],
        activeLayerId: activeLayerIdRef.current,
        pixelData: layerDataRef.current,
      };
    }

    offscreenRef.current = document.createElement("canvas");
    offscreenRef.current.width = w;
    offscreenRef.current.height = h;

    function finish() {
      historyRef.current = [snapshotHistory()];
      histIdxRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
      redraw();
    }

    const src = state.JellySpriteDataUrl;
    if (src) {
      const img = new Image();
      img.onload = () => {
        const ctx = offscreenRef.current.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        pixelsRef.current.set(ctx.getImageData(0, 0, w, h).data);
        layerDataRef.current[activeLayerId] = pixelsRef.current;
        finish();
      };
      img.src = src;
    } else {
      finish();
    }
  }, [canvasW, canvasH]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync pixelsRef when active layer changes
  useEffect(() => {
    const w = canvasW,
      h = canvasH;
    if (!layerDataRef.current[activeLayerId]) {
      layerDataRef.current[activeLayerId] = new Uint8ClampedArray(w * h * 4);
    }
    pixelsRef.current = layerDataRef.current[activeLayerId];
    redraw();
  }, [activeLayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    redraw();
  }, [zoom, gridVisible, frameGridVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep stable refs in sync with state
  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);
  useEffect(() => {
    activeFrameIdxRef.current = activeFrameIdx;
  }, [activeFrameIdx]);
  useEffect(() => {
    editingMaskIdRef.current = editingMaskId;
  }, [editingMaskId]);
  useEffect(() => {
    redrawRef.current = redraw;
  }); // always latest
  // Re-draw when tile visibility/count changes so the canvas populates after mount
  useEffect(() => {
    if (tileVisible) redrawRef.current?.();
  }, [tileVisible, tileCount]); // eslint-disable-line react-hooks/exhaustive-deps
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

  // ── Rendering ──────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const off = offscreenRef.current;
    if (!canvas || !off) return;

    const ctx = canvas.getContext("2d");
    const w = canvasW,
      h = canvasH,
      z = zoom;
    const offCtx = off.getContext("2d");

    // Composite a frame's layers onto the offscreen canvas
    function compositeFrame(frameId) {
      const isActive =
        framesRef.current[activeFrameIdxRef.current]?.id === frameId;
      const renderLayers = isActive
        ? layersRef.current
        : (frameDataRef.current[frameId]?.layers ?? []);
      const renderPixelData = isActive
        ? layerDataRef.current
        : (frameDataRef.current[frameId]?.pixelData ?? {});
      offCtx.clearRect(0, 0, w, h);
      renderLayers.forEach((layer) => {
        if (!layer.visible) return;
        const data = renderPixelData[layer.id];
        if (!data) return;
        // Apply layer mask if present
        const mask = layerMaskDataRef.current[layer.id];
        let drawData = data;
        if (mask) {
          const masked = new Uint8ClampedArray(data);
          for (let i = 0; i < mask.length; i++) {
            masked[i * 4 + 3] = Math.round((masked[i * 4 + 3] * mask[i]) / 255);
          }
          drawData = masked;
        }
        const imgData = new ImageData(drawData, w, h);
        const tmp = document.createElement("canvas");
        tmp.width = w;
        tmp.height = h;
        tmp.getContext("2d").putImageData(imgData, 0, 0);
        offCtx.globalAlpha = layer.opacity;
        offCtx.globalCompositeOperation = layer.blendMode ?? "normal";
        offCtx.drawImage(tmp, 0, 0);
        offCtx.globalAlpha = 1;
        offCtx.globalCompositeOperation = "source-over";
      });
    }

    const currentFrames = framesRef.current;
    const dispIdx = isPlayingRef.current
      ? playbackFrameIdxRef.current
      : activeFrameIdxRef.current;
    const displayFrameId = currentFrames[dispIdx]?.id;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Onion skinning (edit mode only, 2+ frames)
    if (onionSkinning && !isPlayingRef.current && currentFrames.length > 1) {
      const curIdx = activeFrameIdxRef.current;
      if (curIdx > 0) {
        compositeFrame(currentFrames[curIdx - 1].id);
        const ghost = document.createElement("canvas");
        ghost.width = w;
        ghost.height = h;
        const gCtx = ghost.getContext("2d");
        gCtx.drawImage(off, 0, 0);
        gCtx.globalCompositeOperation = "source-atop";
        gCtx.fillStyle = "rgba(255,80,80,0.5)";
        gCtx.fillRect(0, 0, w, h);
        ctx.globalAlpha = onionOpacity;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(ghost, 0, 0, w * z, h * z);
        ctx.globalAlpha = 1;
      }
      if (curIdx < currentFrames.length - 1) {
        compositeFrame(currentFrames[curIdx + 1].id);
        const ghost = document.createElement("canvas");
        ghost.width = w;
        ghost.height = h;
        const gCtx = ghost.getContext("2d");
        gCtx.drawImage(off, 0, 0);
        gCtx.globalCompositeOperation = "source-atop";
        gCtx.fillStyle = "rgba(80,80,255,0.5)";
        gCtx.fillRect(0, 0, w, h);
        ctx.globalAlpha = onionOpacity;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(ghost, 0, 0, w * z, h * z);
        ctx.globalAlpha = 1;
      }
    }

    // Main / playback frame
    if (displayFrameId) compositeFrame(displayFrameId);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, w * z, h * z);

    // Reference image overlay
    if (refImgElRef.current && refVisibleRef.current) {
      ctx.globalAlpha = refOpacityRef.current;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(refImgElRef.current, 0, 0, w * z, h * z);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
    }

    if (gridVisible && z >= 4) {
      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= w; x++) {
        ctx.beginPath();
        ctx.moveTo(x * z, 0);
        ctx.lineTo(x * z, h * z);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * z);
        ctx.lineTo(w * z, y * z);
        ctx.stroke();
      }
    }

    if (frameGridVisible) {
      const { frameW, frameH } = state.frameConfig;
      if (frameW > 0 && frameH > 0) {
        ctx.strokeStyle = "rgba(80,120,255,0.4)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= w; x += frameW) {
          ctx.beginPath();
          ctx.moveTo(x * z, 0);
          ctx.lineTo(x * z, h * z);
          ctx.stroke();
        }
        for (let y = 0; y <= h; y += frameH) {
          ctx.beginPath();
          ctx.moveTo(0, y * z);
          ctx.lineTo(w * z, y * z);
          ctx.stroke();
        }
      }
    }

    // Draw live lasso path during drag (before selection is committed)
    if (lassoPathRef.current.length > 1) {
      const pts = lassoPathRef.current;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo((pts[0].x + 0.5) * z, (pts[0].y + 0.5) * z);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo((pts[i].x + 0.5) * z, (pts[i].y + 0.5) * z);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // Draw selection overlay (marching ants)
    const sel = selectionRef.current;
    if (sel) {
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      if (sel.poly && sel.poly.length > 1) {
        // Polygon selection (lasso) — draw along the actual path
        const drawPoly = () => {
          ctx.beginPath();
          ctx.moveTo((sel.poly[0].x + 0.5) * z, (sel.poly[0].y + 0.5) * z);
          for (let i = 1; i < sel.poly.length; i++) {
            ctx.lineTo((sel.poly[i].x + 0.5) * z, (sel.poly[i].y + 0.5) * z);
          }
          ctx.closePath();
          ctx.stroke();
        };
        ctx.lineDashOffset = -marchOffsetRef.current;
        drawPoly();
        ctx.strokeStyle = "#000000";
        ctx.lineDashOffset = -marchOffsetRef.current + 4;
        drawPoly();
      } else {
        // Rect / wand selection
        const { x, y, w: sw, h: sh } = sel;
        ctx.lineDashOffset = -marchOffsetRef.current;
        ctx.strokeRect(x * z + 0.5, y * z + 0.5, sw * z, sh * z);
        ctx.strokeStyle = "#000000";
        ctx.lineDashOffset = -marchOffsetRef.current + 4;
        ctx.strokeRect(x * z + 0.5, y * z + 0.5, sw * z, sh * z);
      }
      ctx.restore();
    }

    // Update tile preview canvas
    tileUpdateRef.current?.();
  }, [
    canvasW,
    canvasH,
    zoom,
    gridVisible,
    frameGridVisible,
    state.frameConfig,
    onionSkinning,
    onionOpacity,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pixel helpers ─────────────────────────────────────────────────────────
  function getPixel(x, y) {
    const i = (y * canvasW + x) * 4,
      p = pixelsRef.current;
    return [p[i], p[i + 1], p[i + 2], p[i + 3]];
  }
  function setPixel(x, y, rgba, buf = pixelsRef.current) {
    if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) return;
    // Clip to selection (bounding box first, then polygon mask)
    const sel = selectionRef.current;
    if (sel) {
      if (x < sel.x || x >= sel.x + sel.w || y < sel.y || y >= sel.y + sel.h)
        return;
      if (lassoMaskRef.current && !lassoMaskRef.current[y * canvasW + x])
        return;
    }
    const i = (y * canvasW + x) * 4;
    buf[i] = rgba[0];
    buf[i + 1] = rgba[1];
    buf[i + 2] = rgba[2];
    buf[i + 3] = rgba[3];
  }
  function colorsMatch(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
  }

  function floodFill(sx, sy, rgba) {
    const target = getPixel(sx, sy);
    if (colorsMatch(target, rgba)) return;
    const queue = [[sx, sy]],
      visited = new Set();
    while (queue.length) {
      const [x, y] = queue.pop();
      const key = y * canvasW + x;
      if (visited.has(key)) continue;
      if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) continue;
      if (!colorsMatch(getPixel(x, y), target)) continue;
      visited.add(key);
      setPixel(x, y, rgba);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  function getCanvasCoords(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(canvasW - 1, Math.floor((e.clientX - rect.left) / zoom)),
      ),
      y: Math.max(
        0,
        Math.min(canvasH - 1, Math.floor((e.clientY - rect.top) / zoom)),
      ),
    };
  }

  // Paint a brush stamp — round, square, diamond, cross, pixel, dither, dither2
  function stampBrush(cx, cy, rgba, buf) {
    // "pixel" brush always paints exactly 1×1 regardless of size
    if (brushType === "pixel") {
      paintWithSymmetry(cx, cy, rgba, buf);
      return;
    }
    const r = Math.max(0, brushSize - 1);
    if (r === 0) {
      paintWithSymmetry(cx, cy, rgba, buf);
      return;
    }
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (brushType === "round" && dx * dx + dy * dy > r * r) continue;
        if (brushType === "diamond" && Math.abs(dx) + Math.abs(dy) > r)
          continue;
        if (brushType === "cross" && dx !== 0 && dy !== 0) continue;
        if (brushType === "dither" && (cx + cy + dx + dy) % 2 !== 0) continue;
        if (brushType === "dither2" && (cx + cy + dx + dy) % 2 === 0) continue;
        paintWithSymmetry(cx + dx, cy + dy, rgba, buf);
      }
    }
  }

  // Spray brush: random scatter in radius
  function sprayBrush(cx, cy, rgba) {
    const r = brushSize * 3 + 3;
    const count = Math.max(4, brushSize * 4);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * r;
      const x = Math.round(cx + Math.cos(angle) * dist);
      const y = Math.round(cy + Math.sin(angle) * dist);
      paintWithSymmetry(x, y, rgba, pixelsRef.current);
    }
  }

  // Apply symmetry: paint mirror pixels too (routes to layer mask when editing)
  function paintWithSymmetry(x, y, rgba, buf) {
    const maskId = editingMaskIdRef.current;
    if (maskId) {
      // Mask-edit mode: pencil reveals (writes rgba[3]), eraser hides (writes 0)
      const mask = layerMaskDataRef.current[maskId];
      if (mask) {
        const applyMask = (px, py) => {
          if (px < 0 || px >= canvasW || py < 0 || py >= canvasH) return;
          mask[py * canvasW + px] = rgba[3];
        };
        applyMask(x, y);
        if (symmetryH) applyMask(canvasW - 1 - x, y);
        if (symmetryV) applyMask(x, canvasH - 1 - y);
        if (symmetryH && symmetryV) applyMask(canvasW - 1 - x, canvasH - 1 - y);
      }
      return;
    }
    setPixel(x, y, rgba, buf);
    if (symmetryH) setPixel(canvasW - 1 - x, y, rgba, buf);
    if (symmetryV) setPixel(x, canvasH - 1 - y, rgba, buf);
    if (symmetryH && symmetryV)
      setPixel(canvasW - 1 - x, canvasH - 1 - y, rgba, buf);
  }

  // ── Drawing ────────────────────────────────────────────────────────────────
  function getActiveRgba() {
    return hexToRgba(fgColor, Math.round(fgAlpha * (brushOpacity / 100) * 255));
  }

  function applyFreehand(x, y) {
    const rgba = getActiveRgba();
    if (tool === "pencil") {
      stampBrush(x, y, rgba, pixelsRef.current);
    } else if (tool === "eraser") {
      stampBrush(x, y, [0, 0, 0, 0], pixelsRef.current);
    } else if (tool === "spray") {
      sprayBrush(x, y, rgba);
    } else if (tool === "fill") {
      floodFill(x, y, rgba);
    } else if (tool === "picker") {
      const [r, g, b, a] = getPixel(x, y);
      if (a > 0) pickColor(rgbaToHex(r, g, b));
    }
  }

  // Shape preview: restore snapshot then draw shape into pixelsRef
  function previewShape(x0, y0, x1, y1) {
    if (!previewSnap.current) return;
    pixelsRef.current.set(previewSnap.current);
    const rgba = getActiveRgba();
    if (tool === "line") {
      bresenhamLine(x0, y0, x1, y1, (px, py) =>
        paintWithSymmetry(px, py, rgba, pixelsRef.current),
      );
    } else if (tool === "rect") {
      rasterRect(x0, y0, x1, y1, fillShapes, (px, py) =>
        paintWithSymmetry(px, py, rgba, pixelsRef.current),
      );
    } else if (tool === "ellipse") {
      const cx = Math.round((x0 + x1) / 2),
        cy = Math.round((y0 + y1) / 2);
      const rx = Math.abs(x1 - x0) / 2,
        ry = Math.abs(y1 - y0) / 2;
      rasterEllipse(
        cx,
        cy,
        Math.round(rx),
        Math.round(ry),
        fillShapes,
        (px, py) => paintWithSymmetry(px, py, rgba, pixelsRef.current),
      );
    } else if (tool === "select-rect") {
      // Preview rect selection — just update selectionRef, don't paint pixels
      const lx = Math.min(x0, x1),
        ty = Math.min(y0, y1);
      const sw = Math.abs(x1 - x0) + 1,
        sh = Math.abs(y1 - y0) + 1;
      selectionRef.current = { x: lx, y: ty, w: sw, h: sh };
    }
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    isDrawing.current = true;
    const { x, y } = getCanvasCoords(e);
    startPixel.current = { x, y };
    lastPixel.current = { x, y };

    if (tool === "move") {
      const sel = selectionRef.current;
      if (sel) {
        moveOriginRef.current = { x, y, selX: sel.x, selY: sel.y };
        // Copy selected pixels for moving
        const buf = new Uint8ClampedArray(sel.w * sel.h * 4);
        for (let dy = 0; dy < sel.h; dy++) {
          for (let dx = 0; dx < sel.w; dx++) {
            const si = ((sel.y + dy) * canvasW + (sel.x + dx)) * 4;
            const di = (dy * sel.w + dx) * 4;
            for (let c = 0; c < 4; c++) buf[di + c] = pixelsRef.current[si + c];
            // Clear source
            for (let c = 0; c < 4; c++) pixelsRef.current[si + c] = 0;
          }
        }
        movePixelSnapRef.current = buf;
        previewSnap.current = new Uint8ClampedArray(pixelsRef.current);
        redraw();
        return;
      }
    }

    if (["line", "rect", "ellipse", "select-rect"].includes(tool)) {
      if (tool === "select-rect") lassoMaskRef.current = null; // clear old lasso mask
      previewSnap.current = new Uint8ClampedArray(pixelsRef.current);
    }

    if (tool === "select-lasso") {
      // Clear any previous lasso mask when starting a new drag
      lassoMaskRef.current = null;
      selectionRef.current = null;
      lassoPathRef.current = [{ x, y }];
      return;
    }

    if (tool === "select-wand") {
      lassoMaskRef.current = null;
      applyMagicWand(x, y);
      return;
    }

    if (!["select-rect", "move"].includes(tool)) {
      applyFreehand(x, y);
      redraw();
    }
  }

  function onMouseMove(e) {
    if (!isDrawing.current) return;
    const { x, y } = getCanvasCoords(e);
    const last = lastPixel.current;

    if (tool === "move" && moveOriginRef.current) {
      const orig = moveOriginRef.current;
      const dx = x - orig.x,
        dy = y - orig.y;
      const newSel = {
        ...selectionRef.current,
        x: orig.selX + dx,
        y: orig.selY + dy,
      };
      // Restore snap, paste pixels at new position
      pixelsRef.current.set(previewSnap.current);
      const buf = movePixelSnapRef.current;
      for (let ddy = 0; ddy < newSel.h; ddy++) {
        for (let ddx = 0; ddx < newSel.w; ddx++) {
          const di = (ddy * newSel.w + ddx) * 4;
          const tx = newSel.x + ddx,
            ty = newSel.y + ddy;
          if (tx < 0 || tx >= canvasW || ty < 0 || ty >= canvasH) continue;
          const si = (ty * canvasW + tx) * 4;
          for (let c = 0; c < 4; c++) pixelsRef.current[si + c] = buf[di + c];
        }
      }
      selectionRef.current = newSel;
      setSelection({ ...newSel });
      redraw();
      return;
    }

    if (tool === "select-lasso") {
      lassoPathRef.current.push({ x, y });
      // Just redraw so the live path is shown — no bounding-box selection yet
      redraw();
      return;
    }

    if (["line", "rect", "ellipse", "select-rect"].includes(tool)) {
      const { x: sx, y: sy } = startPixel.current;
      previewShape(sx, sy, x, y);
      redraw();
    } else if (last && (last.x !== x || last.y !== y)) {
      const ddx = x - last.x,
        ddy = y - last.y;
      const steps = Math.max(Math.abs(ddx), Math.abs(ddy));
      for (let i = 0; i <= steps; i++) {
        applyFreehand(
          Math.round(last.x + (ddx * i) / steps),
          Math.round(last.y + (ddy * i) / steps),
        );
      }
      redraw();
    }
    lastPixel.current = { x, y };
  }

  function onMouseUp(e) {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (tool === "move" && moveOriginRef.current) {
      moveOriginRef.current = null;
      movePixelSnapRef.current = null;
      previewSnap.current = null;
      pushHistoryEntry();
      saveToProject();
      return;
    }

    if (tool === "select-lasso") {
      const pts = lassoPathRef.current;
      lassoPathRef.current = [];
      if (pts.length >= 3) {
        const mask = buildLassoMask(pts, canvasW, canvasH);
        lassoMaskRef.current = mask;
        let minX = canvasW,
          maxX = 0,
          minY = canvasH,
          maxY = 0;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const newSel = {
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
          poly: pts,
        };
        selectionRef.current = newSel;
        setSelection(newSel);
      } else {
        selectionRef.current = null;
        lassoMaskRef.current = null;
        setSelection(null);
      }
      lastPixel.current = null;
      startPixel.current = null;
      return;
    }

    if (tool === "select-rect") {
      const { x, y } = getCanvasCoords(e);
      const { x: sx, y: sy } = startPixel.current;
      const lx = Math.min(sx, x),
        ty = Math.min(sy, y);
      const sw = Math.abs(x - sx) + 1,
        sh = Math.abs(y - sy) + 1;
      const newSel = { x: lx, y: ty, w: sw, h: sh };
      selectionRef.current = newSel;
      setSelection(newSel);
      lastPixel.current = null;
      startPixel.current = null;
      previewSnap.current = null;
      return;
    }

    if (["line", "rect", "ellipse"].includes(tool)) {
      const { x, y } = getCanvasCoords(e);
      const { x: sx, y: sy } = startPixel.current;
      previewShape(sx, sy, x, y);
      previewSnap.current = null;
      redraw();
    }

    lastPixel.current = null;
    startPixel.current = null;
    pushHistoryEntry();
    saveToProject();
  }

  function onMouseLeave() {
    if (!isDrawing.current) return;
    if (["line", "rect", "ellipse"].includes(tool) && previewSnap.current) {
      pixelsRef.current.set(previewSnap.current);
      previewSnap.current = null;
      redraw();
    }
    isDrawing.current = false;
    lastPixel.current = null;
    startPixel.current = null;
    if (
      !["select-rect", "select-lasso", "select-wand", "move"].includes(tool)
    ) {
      pushHistoryEntry();
      saveToProject();
    }
  }

  // Magic wand: flood-select contiguous same-colour region → bounding box selection
  function applyMagicWand(sx, sy) {
    const target = getPixel(sx, sy);
    const visited = new Set();
    const queue = [[sx, sy]];
    let minX = sx,
      maxX = sx,
      minY = sy,
      maxY = sy;
    while (queue.length) {
      const [x, y] = queue.pop();
      const key = y * canvasW + x;
      if (visited.has(key)) continue;
      if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) continue;
      if (!colorsMatch(getPixel(x, y), target)) continue;
      visited.add(key);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    const newSel = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    selectionRef.current = newSel;
    setSelection(newSel);
  }

  // ── History ────────────────────────────────────────────────────────────────
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
    // Update thumbnail for the active frame
    const activeFrameId = framesRef.current[activeFrameIdxRef.current]?.id;
    if (activeFrameId) {
      const thumb = generateFrameThumbnail(activeFrameId);
      if (thumb)
        setFrameThumbnails((prev) => ({ ...prev, [activeFrameId]: thumb }));
    }
  }

  function restoreHistory(snap) {
    // Support both new format {pixels, masks} and old plain format
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
    // Keep pixelsRef pointed at active layer
    pixelsRef.current = layerDataRef.current[activeLayerId];
  }

  function doUndo() {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current--;
    restoreHistory(historyRef.current[histIdxRef.current]);
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(true);
    redraw();
    saveToProject();
  }

  function doRedo() {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current++;
    restoreHistory(historyRef.current[histIdxRef.current]);
    setCanUndo(true);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
    redraw();
    saveToProject();
  }

  // ── Colour helpers ─────────────────────────────────────────────────────────
  function pickColor(hex) {
    setFgColor(hex);
    setColorHistory((h) =>
      [hex, ...h.filter((c) => c !== hex)].slice(0, MAX_COLOUR_HISTORY),
    );
  }

  // ── Transform actions ──────────────────────────────────────────────────────
  function flipH() {
    const w = canvasW,
      h = canvasH,
      p = pixelsRef.current;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < Math.floor(w / 2); x++) {
        const i = (y * w + x) * 4,
          j = (y * w + (w - 1 - x)) * 4;
        for (let c = 0; c < 4; c++) {
          const tmp = p[i + c];
          p[i + c] = p[j + c];
          p[j + c] = tmp;
        }
      }
    }
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function flipV() {
    const w = canvasW,
      h = canvasH,
      p = pixelsRef.current;
    for (let y = 0; y < Math.floor(h / 2); y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4,
          j = ((h - 1 - y) * w + x) * 4;
        for (let c = 0; c < 4; c++) {
          const tmp = p[i + c];
          p[i + c] = p[j + c];
          p[j + c] = tmp;
        }
      }
    }
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function rotateCW() {
    const w = canvasW,
      h = canvasH,
      src = pixelsRef.current;
    const dst = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * w + x) * 4,
          di = (x * h + (h - 1 - y)) * 4;
        dst[di] = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = src[si + 3];
      }
    }
    pixelsRef.current = dst;
    layerDataRef.current[activeLayerIdRef.current] = dst;
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function rotateCCW() {
    const w = canvasW,
      h = canvasH,
      src = pixelsRef.current;
    const dst = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * w + x) * 4,
          di = ((w - 1 - x) * h + y) * 4;
        dst[di] = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = src[si + 3];
      }
    }
    pixelsRef.current = dst;
    layerDataRef.current[activeLayerIdRef.current] = dst;
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
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
  }, []);

  // ── Persistence ────────────────────────────────────────────────────────────
  function saveToProject() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    dispatch({
      type: "SET_SPRITE_FORGE_DATA",
      payload: canvas.toDataURL("image/png"),
    });
  }

  // ── Frame thumbnail generator ─────────────────────────────────────────────
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

  // ── Export helpers ────────────────────────────────────────────────────────
  /** Composite a frame's visible layers and return a canvas element */
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

  /** Trigger a browser download of a blob/dataURL */
  function triggerDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  function exportPNG() {
    // Save current frame first
    saveCurrentFrameToRef();
    const activeFrameId = framesRef.current[activeFrameIdxRef.current]?.id;
    if (!activeFrameId) return;
    const cvs = compositeFrameToCanvas(activeFrameId);
    triggerDownload(
      cvs.toDataURL("image/png"),
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
    const shW = cols * (fw + padding) + padding;
    const shH = rows * (fh + padding + labelH) + padding;

    const sheet = document.createElement("canvas");
    sheet.width = shW;
    sheet.height = shH;
    const ctx = sheet.getContext("2d");

    allFrames.forEach((frame, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = padding + col * (fw + padding);
      const y = padding + row * (fh + padding + labelH);
      const frameCvs = compositeFrameToCanvas(frame.id);
      ctx.drawImage(frameCvs, x, y);
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
    const allFrames = framesRef.current;
    for (let i = 0; i < allFrames.length; i++) {
      const frame = allFrames[i];
      const cvs = compositeFrameToCanvas(frame.id);
      const dataUrl = cvs.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      const num = String(i + 1).padStart(3, "0");
      folder.file(`${state.name || "sprite"}_frame_${num}.png`, base64, {
        base64: true,
      });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(
      URL.createObjectURL(blob),
      `${state.name || "sprite"}_frames.zip`,
    );
  }

  function exportPaletteHex() {
    const colors = palettes[activePalette] ?? [];
    const hex = colors.map((c) => c.replace("#", "")).join("\n");
    const blob = new Blob([hex], { type: "text/plain" });
    triggerDownload(
      URL.createObjectURL(blob),
      `${activePalette.replace(/\s+/g, "_")}.hex`,
    );
  }

  // ── Reference image ───────────────────────────────────────────────────────
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

  // ── Cross-workspace actions ────────────────────────────────────────────────
  function clearCanvas() {
    pixelsRef.current.fill(0);
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  // ── Playback ───────────────────────────────────────────────────────────────
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── Layer management ───────────────────────────────────────────────────────
  function addLayer() {
    const newLayer = makeLayer(`Layer ${layers.length + 1}`);
    layerDataRef.current[newLayer.id] = new Uint8ClampedArray(
      canvasW * canvasH * 4,
    );
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  }

  function deleteLayer(id) {
    if (layers.length <= 1) return; // must keep at least one
    const remaining = layers.filter((l) => l.id !== id);
    delete layerDataRef.current[id];
    delete layerMaskDataRef.current[id];
    if (editingMaskId === id) setEditingMaskId(null);
    setLayers(remaining);
    const newActive =
      id === activeLayerId ? remaining[remaining.length - 1].id : activeLayerId;
    setActiveLayerId(newActive);
  }

  function duplicateLayer(id) {
    const src = layers.find((l) => l.id === id);
    if (!src) return;
    const dup = makeLayer(src.name + " copy");
    const srcData = layerDataRef.current[id];
    layerDataRef.current[dup.id] = srcData
      ? new Uint8ClampedArray(srcData)
      : new Uint8ClampedArray(canvasW * canvasH * 4);
    // Copy mask if present
    const srcMask = layerMaskDataRef.current[id];
    if (srcMask) {
      layerMaskDataRef.current[dup.id] = new Uint8Array(srcMask);
      dup.hasMask = true;
    }
    const idx = layers.findIndex((l) => l.id === id);
    setLayers((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
    setActiveLayerId(dup.id);
  }

  function mergeLayerDown(id) {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx <= 0) return;
    const below = layers[idx - 1];
    const topData = layerDataRef.current[id];
    const botData = layerDataRef.current[below.id];
    if (!topData || !botData) return;
    const topLayer = layers[idx];
    // Composite top onto bottom using top's opacity
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
    layers.forEach((layer) => {
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
    layerMaskDataRef.current = {}; // masks are baked in by compositing
    setEditingMaskId(null);
    pixelsRef.current = flat;
    setLayers([baseLayer]);
    setActiveLayerId(baseLayer.id);
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function moveLayerUp(id) {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx >= layers.length - 1) return;
    setLayers((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  function moveLayerDown(id) {
    const idx = layers.findIndex((l) => l.id === id);
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

  // ── Layer mask management ──────────────────────────────────────────────────
  function addLayerMask(layerId) {
    layerMaskDataRef.current[layerId] = new Uint8Array(canvasW * canvasH).fill(
      255,
    );
    updateLayer(layerId, { hasMask: true });
    redraw();
  }

  function removeLayerMask(layerId) {
    delete layerMaskDataRef.current[layerId];
    if (editingMaskId === layerId) setEditingMaskId(null);
    updateLayer(layerId, { hasMask: false });
    redraw();
  }
  function saveCurrentFrameToRef() {
    const frameId = framesRef.current[activeFrameIdxRef.current]?.id;
    if (!frameId) return;
    frameDataRef.current[frameId] = {
      layers: [...layersRef.current],
      activeLayerId: activeLayerIdRef.current,
      pixelData: layerDataRef.current, // aliased — same object
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

  function moveFrameLeft(idx) {
    if (idx <= 0) return;
    saveCurrentFrameToRef();
    setFrames((prev) => {
      const next = [...prev];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      return next;
    });
    setActiveFrameIdx(idx - 1);
  }

  function moveFrameRight(idx) {
    if (idx >= framesRef.current.length - 1) return;
    saveCurrentFrameToRef();
    setFrames((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
    setActiveFrameIdx(idx + 1);
  }

  function useInAnimator() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
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
      pushHistoryEntry();
      redraw();
      saveToProject();
    };
    loadImg.src = src;
  }

  // ── Selection clipboard operations ────────────────────────────────────────
  function copySelection() {
    const sel = selectionRef.current;
    if (!sel) return;
    const { x: sx, y: sy, w: sw, h: sh } = sel;
    const src = pixelsRef.current;
    const buf = new Uint8ClampedArray(sw * sh * 4);
    for (let dy = 0; dy < sh; dy++) {
      for (let dx = 0; dx < sw; dx++) {
        // Respect lasso polygon — pixels outside it are left transparent
        if (
          lassoMaskRef.current &&
          !lassoMaskRef.current[(sy + dy) * canvasW + (sx + dx)]
        )
          continue;
        const si = ((sy + dy) * canvasW + (sx + dx)) * 4;
        const di = (dy * sw + dx) * 4;
        buf[di] = src[si];
        buf[di + 1] = src[si + 1];
        buf[di + 2] = src[si + 2];
        buf[di + 3] = src[si + 3];
      }
    }
    clipboardRef.current = { pixels: buf, w: sw, h: sh };
  }

  function pasteSelection() {
    const clip = clipboardRef.current;
    if (!clip) return;
    const { pixels, w: cw, h: ch } = clip;
    // Paste centered on canvas
    const px = Math.max(0, Math.floor((canvasW - cw) / 2));
    const py = Math.max(0, Math.floor((canvasH - ch) / 2));
    const dst = pixelsRef.current;
    for (let dy = 0; dy < ch; dy++) {
      for (let dx = 0; dx < cw; dx++) {
        const nx = px + dx,
          ny = py + dy;
        if (nx >= canvasW || ny >= canvasH) continue;
        const si = (dy * cw + dx) * 4;
        const di = (ny * canvasW + nx) * 4;
        // Alpha-composite paste over destination
        const sa = pixels[si + 3] / 255;
        const da = dst[di + 3] / 255;
        const oa = sa + da * (1 - sa);
        if (oa === 0) {
          dst[di] = dst[di + 1] = dst[di + 2] = dst[di + 3] = 0;
        } else {
          dst[di] = Math.round(
            (pixels[si] * sa + dst[di] * da * (1 - sa)) / oa,
          );
          dst[di + 1] = Math.round(
            (pixels[si + 1] * sa + dst[di + 1] * da * (1 - sa)) / oa,
          );
          dst[di + 2] = Math.round(
            (pixels[si + 2] * sa + dst[di + 2] * da * (1 - sa)) / oa,
          );
          dst[di + 3] = Math.round(oa * 255);
        }
      }
    }
    // Pasted region is always rectangular — clear any lasso polygon
    lassoMaskRef.current = null;
    const newSel = {
      x: px,
      y: py,
      w: Math.min(cw, canvasW - px),
      h: Math.min(ch, canvasH - py),
    };
    selectionRef.current = newSel;
    setSelection(newSel);
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function deleteSelectionContents() {
    const sel = selectionRef.current;
    if (!sel) return;
    for (let dy = 0; dy < sel.h; dy++) {
      for (let dx = 0; dx < sel.w; dx++) {
        if (
          lassoMaskRef.current &&
          !lassoMaskRef.current[(sel.y + dy) * canvasW + (sel.x + dx)]
        )
          continue;
        const i = ((sel.y + dy) * canvasW + (sel.x + dx)) * 4;
        pixelsRef.current[i] =
          pixelsRef.current[i + 1] =
          pixelsRef.current[i + 2] =
          pixelsRef.current[i + 3] =
            0;
      }
    }
    pushHistoryEntry();
    redraw();
    saveToProject();
  }

  function cropToSelection() {
    const sel = selectionRef.current;
    if (!sel) return;
    const { x: sx, y: sy, w: sw, h: sh } = sel;
    // Pre-compute cropped data for every layer
    const cropped = {};
    for (const [lid, data] of Object.entries(layerDataRef.current)) {
      const buf = new Uint8ClampedArray(sw * sh * 4);
      for (let dy = 0; dy < sh; dy++) {
        for (let dx = 0; dx < sw; dx++) {
          const si = ((sy + dy) * canvasW + (sx + dx)) * 4;
          const di = (dy * sw + dx) * 4;
          buf[di] = data[si];
          buf[di + 1] = data[si + 1];
          buf[di + 2] = data[si + 2];
          buf[di + 3] = data[si + 3];
        }
      }
      cropped[lid] = buf;
    }
    pendingResizeDataRef.current = cropped;
    selectionRef.current = null;
    setSelection(null);
    setCanvasW(sw);
    setCanvasH(sh);
  }

  function changeSize(nw, nh) {
    if (nw === canvasW && nh === canvasH) return;
    const w = canvasW,
      h = canvasH;
    const hasContent =
      historyRef.current.length > 1 || pixelsRef.current?.some((v) => v !== 0);
    if (
      hasContent &&
      !window.confirm(
        `Resize to ${nw}×${nh}? Pixels outside the new canvas will be clipped.`,
      )
    )
      return;

    // 9-point anchor offset computation
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
    const offX = Math.round((nw - w) * ax);
    const offY = Math.round((nh - h) * ay);

    // Pre-compute shifted layer data
    const resized = {};
    for (const [lid, data] of Object.entries(layerDataRef.current)) {
      const buf = new Uint8ClampedArray(nw * nh * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = x + offX,
            ny = y + offY;
          if (nx < 0 || nx >= nw || ny < 0 || ny >= nh) continue;
          const si = (y * w + x) * 4;
          const di = (ny * nw + nx) * 4;
          buf[di] = data[si];
          buf[di + 1] = data[si + 1];
          buf[di + 2] = data[si + 2];
          buf[di + 3] = data[si + 3];
        }
      }
      resized[lid] = buf;
    }
    pendingResizeDataRef.current = resized;
    setCanvasW(nw);
    setCanvasH(nh);
  }

  // ── Palette management ─────────────────────────────────────────────────────
  function paletteAddColor(hex) {
    setPalettes((prev) => {
      const colors = prev[activePalette] ?? [];
      if (colors.includes(hex)) return prev;
      return { ...prev, [activePalette]: [...colors, hex] };
    });
  }
  function paletteRemoveColor(idx) {
    setPalettes((prev) => ({
      ...prev,
      [activePalette]: prev[activePalette].filter((_, i) => i !== idx),
    }));
  }
  function paletteSetColors(colors) {
    setPalettes((prev) => ({ ...prev, [activePalette]: colors }));
  }
  function paletteAddNew(name) {
    setPalettes((prev) => ({ ...prev, [name]: [] }));
    setActivePalette(name);
  }
  function paletteDelete(name) {
    const next = { ...palettes };
    delete next[name];
    const fallback = Object.keys(next)[0];
    setPalettes(next);
    setActivePalette(fallback);
  }
  function paletteRename(oldName, newName) {
    const next = {};
    for (const [k, v] of Object.entries(palettes)) {
      next[k === oldName ? newName : k] = v;
    }
    setPalettes(next);
    if (activePalette === oldName) setActivePalette(newName);
  }

  // ── Cursor ────────────────────────────────────────────────────────────────
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

  // Keep tile-update fn fresh every render so it reads latest closure values
  tileUpdateRef.current = () => {
    const tc = tileCanvasRef.current;
    const off2 = offscreenRef.current;
    if (!tc || !off2 || !tileVisible) return;
    const n = tileCount;
    tc.width = canvasW * n;
    tc.height = canvasH * n;
    const tCtx = tc.getContext("2d");
    tCtx.imageSmoothingEnabled = false;
    tCtx.clearRect(0, 0, tc.width, tc.height);
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        tCtx.drawImage(off2, col * canvasW, row * canvasH);
      }
    }
  };


  // ── Render ─────────────────────────────────────────────────────────────────
  const ctx = {
    // Canvas
    canvasW, canvasH, zoom, setZoom, canvasRef,
    onMouseDown, onMouseMove, onMouseUp, onMouseLeave, cursorStyle,
    // Tools
    tool, setTool, fillShapes, setFillShapes,
    symmetryH, setSymmetryH, symmetryV, setSymmetryV,
    gridVisible, setGridVisible, frameGridVisible, setFrameGridVisible,
    // Brush
    brushType, setBrushType, brushSize, setBrushSize, brushOpacity, setBrushOpacity,
    // Transform
    flipH, flipV, rotateCW, rotateCCW,
    // History
    doUndo, doRedo, canUndo, canRedo, clearCanvas,
    // Colour
    fgColor, setFgColor, bgColor, setBgColor, fgAlpha, setFgAlpha,
    colorHistory, pickColor,
    // Selection
    selection, setSelection, selectionRef, lassoMaskRef, clipboardRef,
    copySelection, pasteSelection, cropToSelection, deleteSelectionContents,
    // Layers
    layers, activeLayerId, setActiveLayerId,
    addLayer, deleteLayer, duplicateLayer, mergeLayerDown,
    moveLayerUp, moveLayerDown, updateLayer, flattenAll, redraw,
    // Masks
    editingMaskId, setEditingMaskId, addLayerMask, removeLayerMask,
    // Frames
    frames, activeFrameIdx, frameThumbnails, playbackFrameIdxRef,
    isPlaying, fps, setFps, onionSkinning, setOnionSkinning,
    switchToFrame, duplicateFrame, deleteFrame, addFrame, startPlayback, stopPlayback,
    // Canvas settings
    resizeAnchor, setResizeAnchor, customW, setCustomW, customH, setCustomH, changeSize,
    // Palette
    palettes, activePalette, setActivePalette,
    paletteAddColor, paletteRemoveColor, paletteAddNew,
    paletteDelete, paletteRename, paletteSetColors,
    panelTab, setPanelTab,
    // Reference image
    refImage, clearRefImage, loadRefImage,
    refVisible, setRefVisible, refVisibleRef,
    refOpacity, setRefOpacity, refOpacityRef,
    // Tile preview
    tileVisible, setTileVisible, tileCount, setTileCount, tileCanvasRef, redrawRef,
    // Export
    exportOpen, setExportOpen,
    exportFramesPerRow, setExportFramesPerRow,
    exportPadding, setExportPadding,
    exportLabels, setExportLabels,
    exportPNG, exportSpriteSheet, exportFramesZip, exportPaletteHex,
    // More tab
    projectState: state, importFromAnimator, useInAnimator,
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
