import { useRef, useEffect, useState } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { useAnimationLoop } from "../../../hooks/useAnimationLoop";
import { IconButton } from "../../../ui/IconButton";
import { Select } from "../../../ui/Select";
import { Slider } from "../../../ui/Slider";
import "./PreviewCanvas.css";

const MODE_OPTIONS = [
  { value: "loop", label: "Loop" },
  { value: "ping-pong", label: "Ping-pong" },
  { value: "once", label: "Once" },
];

const SCALE_OPTIONS = [
  { value: "1", label: "1×" },
  { value: "2", label: "2×" },
  { value: "4", label: "4×" },
  { value: "8", label: "8×" },
];

const BG_OPTIONS = [
  { value: "checker", label: "Checker" },
  { value: "#000000", label: "Black" },
  { value: "#ffffff", label: "White" },
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

export function PreviewCanvas() {
  const { state } = useProject();
  const { animations, activeAnimationId, spriteSheet, frameConfig } = state;
  const activeAnim = animations.find((a) => a.id === activeAnimationId) ?? null;
  const frames = activeAnim?.frames ?? [];

  const [mode, setMode] = useState("loop");
  const [speed, setSpeed] = useState(1);
  const [scale, setScale] = useState("2");
  const [bg, setBg] = useState("checker");
  // Bumped when the source image finishes loading so the draw effect re-runs.
  const [imgVer, setImgVer] = useState(0);

  const { frameIndex, isPlaying, play, pause, seek } = useAnimationLoop(
    frames,
    { mode, speed, ticksPerSecond: 60, resetKey: activeAnimationId },
  );

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const src = spriteSheet?.objectUrl ?? null;

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

    const scaleN = Number(scale);
    const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } = frameConfig;
    canvas.width = frameW * scaleN;
    canvas.height = frameH * scaleN;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    if (bg === "checker") {
      drawChecker(ctx, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const frame = frames[frameIndex];
    if (!imgRef.current || !frame) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameIndex, bg, scale, frameConfig, frames, imgVer]);

  const hasFrames = frames.length > 0;

  return (
    <div className="preview-canvas">
      <div className="preview-canvas__viewport">
        {hasFrames && src ? (
          <canvas ref={canvasRef} className="preview-canvas__canvas" />
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
            className="preview-canvas__compact-select"
          />
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

        {/* Scale + background row */}
        <div className="preview-canvas__row">
          <Select
            value={scale}
            onChange={setScale}
            options={SCALE_OPTIONS}
            className="preview-canvas__compact-select"
          />
          <Select
            value={bg}
            onChange={setBg}
            options={BG_OPTIONS}
            className="preview-canvas__compact-select"
          />
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
