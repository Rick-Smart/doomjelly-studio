import { useRef, useEffect, useState } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { usePlayback } from "../../../contexts/PlaybackContext";
import "./TracksPanel.css";

const TICK_PX = 7;
const CELL_MIN_W = 48;
const THUMB = 32;
const LABEL_W = 130;

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
      ctx.drawImage(
        img,
        offsetX + col * (frameW + gutterX),
        offsetY + row * (frameH + gutterY),
        frameW,
        frameH,
        0,
        0,
        THUMB,
        THUMB,
      );
    };
    img.src = src;
  }, [src, col, row, frameW, frameH, offsetX, offsetY, gutterX, gutterY]);

  return (
    <canvas
      ref={canvasRef}
      width={THUMB}
      height={THUMB}
      className="tracks-cell__thumb"
    />
  );
}

function TrackRow({
  anim,
  isActive,
  activeFrameIndex,
  src,
  frameConfig,
  onSelectFrame,
  onSelectTrack,
  onTogglePreview,
  isInPreview,
  onReorder,
}) {
  const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } = frameConfig;
  const frames = anim.frames;
  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);
  const activeRef = useRef(null);

  useEffect(() => {
    if (isActive && activeRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [activeFrameIndex, isActive]);

  const cellWidths = frames.map((f) =>
    Math.max(CELL_MIN_W, (f.ticks ?? 6) * TICK_PX),
  );
  const totalW = cellWidths.reduce((s, w) => s + w, 0);

  return (
    <div className={`track-row${isActive ? " track-row--active" : ""}`}>
      <div
        className={`track-row__label${isActive ? " track-row__label--active" : ""}`}
        style={{ width: LABEL_W }}
        onClick={onSelectTrack}
        title="Click to select this animation"
      >
        <span className="track-row__name" title={anim.name}>
          {anim.name}
        </span>
        <span className="track-row__count">{frames.length}f</span>
        <button
          type="button"
          className={`track-row__eye${isInPreview ? " track-row__eye--on" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePreview();
          }}
          title={
            isInPreview
              ? "Remove from composite preview"
              : "Add to composite preview"
          }
        >
          {isInPreview ? "◉" : "◎"}
        </button>
      </div>
      <div className="track-row__scroll">
        <div className="track-row__strip" style={{ width: totalW || "100%" }}>
          {frames.length === 0 ? (
            <div className="track-row__empty">
              No frames — click sheet cells to add
            </div>
          ) : (
            frames.map((frame, i) => {
              const w = cellWidths[i];
              const isCurrent = isActive && i === activeFrameIndex;
              const isDragging = dragIdx === i;
              const isDropTarget = dropIdx === i && dragIdx !== i;
              return (
                <div
                  key={i}
                  ref={isCurrent ? activeRef : null}
                  draggable
                  className={`tracks-cell${isCurrent ? " tracks-cell--active" : ""}${isDragging ? " tracks-cell--dragging" : ""}${isDropTarget ? " tracks-cell--drop-target" : ""}`}
                  style={{ width: w }}
                  onClick={() => onSelectFrame(anim.id, i)}
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropIdx(i);
                  }}
                  onDrop={() => {
                    onReorder(anim.id, dragIdx, i);
                    setDragIdx(null);
                    setDropIdx(null);
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setDropIdx(null);
                  }}
                  title={`Frame ${i + 1} — ${frame.ticks}t — drag to reorder`}
                >
                  <span className="tracks-cell__index">{i + 1}</span>
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
                  <span className="tracks-cell__ticks">{frame.ticks}t</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function TracksPanel() {
  const { state, dispatch } = useProject();
  const { animations, activeAnimationId, spriteSheet, frameConfig } = state;
  const {
    frameIndex,
    seekTo,
    pausePlayback,
    previewAnimIds,
    togglePreviewAnim,
  } = usePlayback();
  const src = spriteSheet?.objectUrl ?? null;

  // isInPreview: when no composite is active, the active anim eye shows as lit
  function isInPreview(animId) {
    if (previewAnimIds.length === 0) return animId === activeAnimationId;
    return previewAnimIds.includes(animId);
  }

  function handleSelectTrack(animId) {
    pausePlayback();
    dispatch({ type: "SET_ACTIVE_ANIMATION", payload: animId });
    seekTo(0);
  }

  function handleSelectFrame(animId, frameIdx) {
    pausePlayback();
    if (animId !== activeAnimationId) {
      dispatch({ type: "SET_ACTIVE_ANIMATION", payload: animId });
    }
    seekTo(frameIdx);
  }

  function handleReorder(animId, from, to) {
    if (from === null || to === null || from === to) return;
    const anim = animations.find((a) => a.id === animId);
    if (!anim) return;
    const updated = [...anim.frames];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    dispatch({
      type: "UPDATE_ANIMATION",
      payload: { id: animId, frames: updated },
    });
  }

  if (animations.length === 0) {
    return (
      <div className="tracks-panel tracks-panel--empty">
        <span>No animations yet — create one in the Animations panel</span>
      </div>
    );
  }

  return (
    <div className="tracks-panel">
      <div className="tracks-panel__header">
        <span className="tracks-panel__title">Tracks</span>
      </div>
      <div className="tracks-panel__body">
        {animations.map((anim) => (
          <TrackRow
            key={anim.id}
            anim={anim}
            isActive={anim.id === activeAnimationId}
            activeFrameIndex={anim.id === activeAnimationId ? frameIndex : -1}
            src={src}
            frameConfig={frameConfig}
            onSelectFrame={handleSelectFrame}
            onSelectTrack={() => handleSelectTrack(anim.id)}
            onTogglePreview={() =>
              togglePreviewAnim(anim.id, activeAnimationId)
            }
            isInPreview={isInPreview(anim.id)}
            onReorder={handleReorder}
          />
        ))}
      </div>
    </div>
  );
}
