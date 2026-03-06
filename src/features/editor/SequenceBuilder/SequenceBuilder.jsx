import { useRef, useEffect, useState } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { usePlayback } from "../../../contexts/PlaybackContext";
import { EmptyState } from "../../../ui/EmptyState";
import { IconButton } from "../../../ui/IconButton";
import { NumberInput } from "../../../ui/NumberInput";
import "./SequenceBuilder.css";

const THUMB = 32;

function FrameThumb({
  src,
  col,
  row,
  frameW,
  frameH,
  offsetX,
  offsetY,
  gutterX,
  gutterY,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, THUMB, THUMB);
    if (!src || !frameW || !frameH) return;
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      const srcX = offsetX + col * (frameW + gutterX);
      const srcY = offsetY + row * (frameH + gutterY);
      ctx.drawImage(img, srcX, srcY, frameW, frameH, 0, 0, THUMB, THUMB);
    };
    img.src = src;
  }, [src, col, row, frameW, frameH, offsetX, offsetY, gutterX, gutterY]);

  return (
    <canvas
      ref={canvasRef}
      width={THUMB}
      height={THUMB}
      className="seq-frame__thumb"
    />
  );
}

export function SequenceBuilder() {
  const { state, dispatch } = useProject();
  const { animations, activeAnimationId, spriteSheet, frameConfig } = state;
  const activeAnim = animations.find((a) => a.id === activeAnimationId) ?? null;
  const frames = activeAnim?.frames ?? [];
  const { frameIndex: playbackIdx } = usePlayback();

  const [bulkTicks, setBulkTicks] = useState(6);

  // Auto-scroll to keep the active frame visible while playing.
  const activeRowRef = useRef(null);
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [playbackIdx]);

  function updateFrames(updated) {
    if (!activeAnim) return;
    dispatch({
      type: "UPDATE_ANIMATION",
      payload: { id: activeAnim.id, frames: updated },
    });
  }

  function updateFrame(index, patch) {
    updateFrames(frames.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function deleteFrame(index) {
    updateFrames(frames.filter((_, i) => i !== index));
  }

  function moveFrame(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= frames.length) return;
    const updated = [...frames];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    updateFrames(updated);
  }

  function applyBulkTicks() {
    if (!activeAnim || frames.length === 0) return;
    updateFrames(frames.map((f) => ({ ...f, ticks: bulkTicks })));
  }

  const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } = frameConfig;
  const src = spriteSheet?.objectUrl ?? null;

  if (!activeAnim) {
    return (
      <div className="seq-builder">
        <div className="seq-builder__header">
          <span className="panel-heading">Frames</span>
        </div>
        <EmptyState
          icon="🖼"
          title="No animation selected"
          hint="Select or create an animation above"
        />
      </div>
    );
  }

  return (
    <div className="seq-builder">
      <div className="seq-builder__header">
        <span className="panel-heading">Frames — {activeAnim.name}</span>
        <span className="seq-builder__count">{frames.length}</span>
      </div>

      {frames.length === 0 ? (
        <EmptyState
          icon="🖼"
          title="No frames yet"
          hint="Click cells on the sheet to add"
        />
      ) : (
        <>
          <ul className="seq-builder__list">
            {frames.map((frame, i) => {
              const isActive = i === playbackIdx;
              const hasOffset = (frame.dx ?? 0) !== 0 || (frame.dy ?? 0) !== 0;
              let cls = "seq-frame";
              if (isActive) cls += " seq-frame--active";
              if (hasOffset) cls += " seq-frame--offset";
              return (
                <li
                  key={i}
                  ref={isActive ? activeRowRef : null}
                  className={cls}
                >
                  <span className="seq-frame__index">{i + 1}</span>
                  <FrameThumb
                    src={src}
                    col={frame.col}
                    row={frame.row}
                    frameW={frameW}
                    frameH={frameH}
                    offsetX={offsetX}
                    offsetY={offsetY}
                    gutterX={gutterX}
                    gutterY={gutterY}
                  />
                  <span className="seq-frame__coords">
                    {frame.col},{frame.row}
                  </span>
                  <NumberInput
                    label=""
                    value={frame.ticks}
                    onChange={(v) => updateFrame(i, { ticks: v })}
                    min={1}
                    max={999}
                    step={1}
                  />
                  <span className="seq-frame__tick-label">t</span>
                  <NumberInput
                    label=""
                    value={frame.dx ?? 0}
                    onChange={(v) => updateFrame(i, { dx: v })}
                    min={-999}
                    max={999}
                    step={1}
                    className="seq-frame__offset-input"
                  />
                  <span className="seq-frame__tick-label">dx</span>
                  <NumberInput
                    label=""
                    value={frame.dy ?? 0}
                    onChange={(v) => updateFrame(i, { dy: v })}
                    min={-999}
                    max={999}
                    step={1}
                    className="seq-frame__offset-input"
                  />
                  <span className="seq-frame__tick-label">dy</span>
                  <IconButton
                    icon="↑"
                    title="Move up"
                    size="sm"
                    onClick={() => moveFrame(i, -1)}
                    disabled={i === 0}
                  />
                  <IconButton
                    icon="↓"
                    title="Move down"
                    size="sm"
                    onClick={() => moveFrame(i, 1)}
                    disabled={i === frames.length - 1}
                  />
                  <IconButton
                    icon="×"
                    title="Remove frame"
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteFrame(i)}
                  />
                </li>
              );
            })}
          </ul>

          <div className="seq-builder__bulk">
            <span className="seq-builder__bulk-label">All ticks:</span>
            <NumberInput
              label=""
              value={bulkTicks}
              onChange={setBulkTicks}
              min={1}
              max={999}
              step={1}
            />
            <button
              type="button"
              className="seq-builder__bulk-apply"
              onClick={applyBulkTicks}
            >
              Apply
            </button>
          </div>
        </>
      )}
    </div>
  );
}
