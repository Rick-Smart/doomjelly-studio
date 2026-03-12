import { useRef, useEffect, useState } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { usePlayback } from "../../../contexts/PlaybackContext";
import "./TimelineView.css";

/** pixels per tick — cells grow wider with more ticks */
const TICK_PX = 7;
/** minimum cell width in pixels */
const CELL_MIN_W = 44;
/** thumbnail render size */
const THUMB = 32;

function TimelineThumb({
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
      className="tl-cell__thumb"
    />
  );
}

/**
 * Horizontal timeline strip — alternative frame view to the list.
 * Each frame cell is proportionally wide based on its tick count.
 * Click a cell to seek playback to that frame.
 */
export function TimelineView() {
  const { state, dispatch } = useProject();
  const { animations, activeAnimationId, spriteSheet, frameConfig } = state;
  const activeAnim = animations.find((a) => a.id === activeAnimationId) ?? null;
  const frames = activeAnim?.frames ?? [];

  const { frameIndex, seekTo, pausePlayback } = usePlayback();

  const activeRef = useRef(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);

  // Auto-scroll to keep the active cell in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [frameIndex]);

  if (!activeAnim || frames.length === 0) return null;

  const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } = frameConfig;
  const src = spriteSheet?.objectUrl ?? null;

  const cellWidths = frames.map((f) =>
    Math.max(CELL_MIN_W, (f.ticks ?? 6) * TICK_PX),
  );
  const totalW = cellWidths.reduce((s, w) => s + w, 0);
  const playheadLeft = cellWidths
    .slice(0, frameIndex)
    .reduce((s, w) => s + w, 0);

  function handleClick(i) {
    pausePlayback();
    seekTo(i);
  }

  function reorderFrames(from, to) {
    if (from === null || to === null || from === to) return;
    const updated = [...frames];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    dispatch({
      type: "UPDATE_ANIMATION",
      payload: { id: activeAnim.id, frames: updated },
    });
  }

  return (
    <div className="tl">
      <div className="tl__scroll">
        <div className="tl__strip" style={{ width: totalW }}>
          {/* Playhead highlight column */}
          <div
            className="tl__playhead"
            style={{ left: playheadLeft, width: cellWidths[frameIndex] ?? 0 }}
          />

          {frames.map((frame, i) => {
            const w = cellWidths[i];
            const isActive = i === frameIndex;
            const isDragging = dragIdx === i;
            const isDropTarget = dropIdx === i && dragIdx !== i;
            return (
              <div
                key={i}
                ref={isActive ? activeRef : null}
                draggable
                className={`tl-cell${
                  isActive ? " tl-cell--active" : ""
                }${isDragging ? " tl-cell--dragging" : ""}${
                  isDropTarget ? " tl-cell--drop-target" : ""
                }`}
                style={{ width: w }}
                onClick={() => handleClick(i)}
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropIdx(i);
                }}
                onDrop={() => {
                  reorderFrames(dragIdx, i);
                  setDragIdx(null);
                  setDropIdx(null);
                }}
                onDragEnd={() => {
                  setDragIdx(null);
                  setDropIdx(null);
                }}
                title={`Frame ${i + 1} — ${frame.ticks} tick${
                  frame.ticks !== 1 ? "s" : ""
                } — drag to reorder`}
              >
                <span className="tl-cell__index">{i + 1}</span>
                <TimelineThumb
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
                <span className="tl-cell__ticks">{frame.ticks}t</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
