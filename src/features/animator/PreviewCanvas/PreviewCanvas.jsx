import { useRef, useEffect, useState } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { useAnimationLoop } from "../../../hooks/useAnimationLoop";
import { usePlayback } from "../../../contexts/PlaybackContext";
import { useLocalStorage } from "../../../hooks/useLocalStorage";
import { IconButton } from "../../../ui/IconButton";
import { Select } from "../../../ui/Select";
import { Slider } from "../../../ui/Slider";
import "./PreviewCanvas.css";

const MODE_OPTIONS = [
  { value: "loop", label: "Loop" },
  { value: "ping-pong", label: "Ping-pong" },
  { value: "once", label: "Once" },
];

const BG_OPTIONS = [
  { value: "checker", label: "Checker" },
  { value: "#000000", label: "Black" },
  { value: "#ffffff", label: "White" },
  { value: "custom", label: "Custom…" },
];

function drawChecker(ctx, w, h, size = 8) {
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle =
        (Math.floor(x / size) + Math.floor(y / size)) % 2 ? "#666" : "#444";
      ctx.fillRect(x, y, size, size);
    }
  }
}

/**
 * Given a set of frames and a monotonic tick clock, return the frame that
 * should be displayed — independent of any other animation's timing.
 */
function resolveFrameFromTicks(frames, elapsedTicks) {
  if (!frames.length) return null;
  const cycleTicks = frames.reduce((s, f) => s + (f.ticks ?? 6), 0);
  if (cycleTicks <= 0) return frames[0];
  const t = elapsedTicks % cycleTicks;
  let acc = 0;
  for (const frame of frames) {
    acc += frame.ticks ?? 6;
    if (t < acc) return frame;
  }
  return frames[frames.length - 1];
}

export function PreviewCanvas({ expanded = false, onToggleExpand } = {}) {
  const { state } = useProject();
  const { animations, activeAnimationId, activeSheetId, sheets, frameConfig } =
    state;
  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
  const activeAnim = animations.find((a) => a.id === activeAnimationId) ?? null;
  const frames = activeAnim?.frames ?? [];

  const [mode, setMode] = useState("loop");
  const [speed, setSpeed] = useState(1);
  const [bg, setBg] = useLocalStorage("dj-preview-bg", "checker");
  const [customColor, setCustomColor] = useLocalStorage(
    "dj-preview-custom-color",
    "#1a1a24",
  );
  const [onionSkin, setOnionSkin] = useState(false);
  const colorInputRef = useRef(null);
  const [imgVer, setImgVer] = useState(0);
  // Refs for canvas element and loaded sprite sheet image
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  // Auto-fit: computed display dimensions from the viewport container
  const viewportRef = useRef(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

  const { frameIndex, isPlaying, play, pause, seek, elapsedTicks } =
    useAnimationLoop(frames, {
      mode,
      speed,
      ticksPerSecond: 60,
      resetKey: activeAnimationId,
    });

  // Publish frameIndex + controls to PlaybackContext.
  const {
    setFrameIndex,
    setIsPlaying: setIsPlayingCtx,
    registerControls,
    previewAnimIds,
  } = usePlayback();
  useEffect(() => {
    setFrameIndex(frameIndex);
  }, [frameIndex, setFrameIndex]);
  useEffect(() => {
    setIsPlayingCtx(isPlaying);
  }, [isPlaying, setIsPlayingCtx]);
  useEffect(() => {
    registerControls(play, pause, seek);
  }, [play, pause, seek, registerControls]);

  // Observe viewport size and compute largest contain-fit for the canvas.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { frameW, frameH } = frameConfig;
    function compute(width, height) {
      if (!frameW || !frameH) return;
      const pad = 16;
      const aw = width - pad;
      const ah = height - pad;
      const aspect = frameW / frameH;
      let w = aw;
      let h = w / aspect;
      if (h > ah) {
        h = ah;
        w = h * aspect;
      }
      setDisplaySize({
        w: Math.max(1, Math.floor(w)),
        h: Math.max(1, Math.floor(h)),
      });
    }
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      compute(width, height);
    });
    ro.observe(el);
    // Also compute immediately on mount
    compute(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameConfig.frameW, frameConfig.frameH]);

  const src = activeSheet?.objectUrl ?? null;

  // Load / reload source image whenever objectUrl changes.
  useEffect(() => {
    if (!src) {
      imgRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgVer((v) => v + 1);
    };
    img.src = src;
  }, [src]);

  // Redraw canvas on every relevant change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } = frameConfig;
    // Canvas resolution = native frame size (CSS scales it to fill the viewport)
    canvas.width = frameW || 1;
    canvas.height = frameH || 1;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    if (bg === "checker") {
      drawChecker(ctx, canvas.width, canvas.height);
    } else if (bg === "custom") {
      ctx.fillStyle = customColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (!imgRef.current) return;

    // Onion skin: ghost of previous frame at 30% opacity (active animation only).
    if (onionSkin && frameIndex > 0) {
      const prev = frames[frameIndex - 1];
      if (prev) {
        ctx.globalAlpha = 0.3;
        const px = offsetX + prev.col * (frameW + gutterX) + (prev.dx ?? 0);
        const py = offsetY + prev.row * (frameH + gutterY) + (prev.dy ?? 0);
        ctx.drawImage(
          imgRef.current,
          px,
          py,
          frameW,
          frameH,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        ctx.globalAlpha = 1;
      }
    }

    // Composite: draw each selected animation layer bottom-to-top.
    // Active animation uses frameIndex directly (preserves ping-pong/once modes).
    // All other layers resolve their frame from the shared tick clock so each
    // layer's timing is independent of the active animation's tick schedule.
    const toRender =
      previewAnimIds.length > 0
        ? animations.filter((a) => previewAnimIds.includes(a.id))
        : activeAnim
          ? [activeAnim]
          : [];

    for (const anim of toRender) {
      const af = anim.frames;
      if (!af.length) continue;
      const frame =
        anim.id === activeAnim?.id
          ? af[frameIndex] // active: honours ping-pong / once
          : resolveFrameFromTicks(af, elapsedTicks); // others: tick-clock
      if (!frame) continue;
      const srcX = offsetX + frame.col * (frameW + gutterX) + (frame.dx ?? 0);
      const srcY = offsetY + frame.row * (frameH + gutterY) + (frame.dy ?? 0);
      ctx.drawImage(
        imgRef.current,
        srcX,
        srcY,
        frameW,
        frameH,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    frameIndex,
    elapsedTicks,
    bg,
    customColor,
    frameConfig,
    frames,
    imgVer,
    onionSkin,
    previewAnimIds,
    animations,
    activeAnim,
  ]);

  const hasFrames = frames.length > 0;
  // Show canvas when any composite layer has frames, not just the active anim.
  const hasAnyPreviewFrames =
    hasFrames ||
    (previewAnimIds.length > 0 &&
      animations.some(
        (a) => previewAnimIds.includes(a.id) && a.frames.length > 0,
      ));

  return (
    <div
      className={`preview-canvas${expanded ? " preview-canvas--expanded" : ""}`}
    >
      <div className="preview-canvas__viewport" ref={viewportRef}>
        {hasAnyPreviewFrames && src ? (
          <canvas
            ref={canvasRef}
            className="preview-canvas__canvas"
            style={
              displaySize.w > 0
                ? { width: displaySize.w, height: displaySize.h }
                : undefined
            }
          />
        ) : (
          <div className="preview-canvas__empty">
            {!src ? "No sheet loaded" : "No frames in animation"}
          </div>
        )}
      </div>

      <div className="preview-canvas__controls">
        {/* Play/pause + frame counter + mode */}
        <div className="preview-canvas__playbar">
          <IconButton
            icon={isPlaying ? "⏸" : "▶"}
            title={isPlaying ? "Pause" : "Play"}
            variant="secondary"
            size="sm"
            onClick={isPlaying ? pause : play}
            disabled={!hasFrames}
          />
          <span className="preview-canvas__counter">
            {hasFrames ? `${frameIndex + 1} / ${frames.length}` : "— / —"}
          </span>
          <Select
            value={mode}
            onChange={setMode}
            options={MODE_OPTIONS}
            compact
            className="preview-canvas__compact-select"
          />
          {onToggleExpand && (
            <button
              type="button"
              className="preview-canvas__expand-btn"
              onClick={onToggleExpand}
              title={
                expanded ? "Collapse preview" : "Expand preview to canvas area"
              }
            >
              {expanded ? "⊠" : "⛶"}
            </button>
          )}
        </div>

        {/* Scrub slider */}
        {hasFrames && (
          <Slider
            label="Scrub"
            value={frameIndex}
            onChange={(i) => {
              pause();
              seek(i);
            }}
            min={0}
            max={Math.max(0, frames.length - 1)}
            step={1}
          />
        )}

        {/* Background + onion skin row */}
        <div className="preview-canvas__row">
          <Select
            value={bg}
            onChange={setBg}
            options={BG_OPTIONS}
            compact
            className="preview-canvas__compact-select"
          />
          {bg === "custom" && (
            <>
              <input
                ref={colorInputRef}
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="preview-canvas__color-input"
                title="Pick custom background color"
              />
              <button
                type="button"
                className="preview-canvas__color-swatch"
                style={{ background: customColor }}
                onClick={() => colorInputRef.current?.click()}
                title="Pick custom background color"
              />
            </>
          )}
          <button
            type="button"
            className={`preview-canvas__onion-btn${onionSkin ? " preview-canvas__onion-btn--on" : ""}`}
            onClick={() => setOnionSkin((v) => !v)}
            title="Toggle onion skin (prev frame ghost)"
          >
            🧅
          </button>
        </div>

        {/* Speed */}
        <Slider
          label="Speed"
          value={speed}
          onChange={setSpeed}
          min={0.25}
          max={4}
          step={0.25}
          displayValue={`${speed}×`}
        />
      </div>
    </div>
  );
}
