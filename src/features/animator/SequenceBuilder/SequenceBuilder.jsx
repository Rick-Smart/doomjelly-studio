import { useRef, useEffect, useState } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { usePlayback } from "../../../contexts/PlaybackContext";
import { EmptyState } from "../../../ui/EmptyState";
import { IconButton } from "../../../ui/IconButton";
import { NumberInput } from "../../../ui/NumberInput";
import { FrameRow } from "./FrameRow";
import { TimelineView } from "../TimelineView";
import "./SequenceBuilder.css";

export function SequenceBuilder() {
  const { state, dispatch } = useProject();
  const { animations, activeAnimationId, spriteSheet, frameConfig } = state;
  const activeAnim = animations.find((a) => a.id === activeAnimationId) ?? null;
  const frames = activeAnim?.frames ?? [];
  const { frameIndex: playbackIdx } = usePlayback();

  const [bulkTicks, setBulkTicks] = useState(6);
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'timeline'
  const [dragIdx, setDragIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);

  const totalTicks = frames.reduce((sum, f) => sum + (f.ticks ?? 6), 0);
  const totalMs = Math.round((totalTicks / 60) * 1000);

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

  function reorderFrames(from, to) {
    if (from === null || to === null || from === to) return;
    const updated = [...frames];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
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
        {frames.length > 0 && (
          <span
            className="seq-builder__duration"
            title="Total duration at 60fps"
          >
            {totalTicks}t · {totalMs}ms
          </span>
        )}
        <div className="seq-builder__view-toggle">
          <button
            className={`seq-builder__view-btn${viewMode === "list" ? " seq-builder__view-btn--active" : ""}`}
            onClick={() => setViewMode("list")}
            title="List view"
          >
            List
          </button>
          <button
            className={`seq-builder__view-btn${viewMode === "timeline" ? " seq-builder__view-btn--active" : ""}`}
            onClick={() => setViewMode("timeline")}
            title="Timeline view"
          >
            Timeline
          </button>
        </div>
      </div>

      {frames.length === 0 ? (
        <EmptyState
          icon="🖼"
          title="No frames yet"
          hint="Click cells on the sheet to add"
        />
      ) : viewMode === "timeline" ? (
        <TimelineView />
      ) : (
        <>
          <div className="seq-builder__col-headers" aria-hidden="true">
            <span className="seq-builder__col--idx" />
            <span className="seq-builder__col--thumb" />
            <span className="seq-builder__col-hdr seq-builder__col--cell">
              cell
            </span>
            <span className="seq-builder__col-hdr seq-builder__col--ticks">
              ticks
            </span>
            <span className="seq-builder__col-hdr seq-builder__col--offset">
              dx · dy
            </span>
            <span className="seq-builder__col-hdr seq-builder__col--order">
              order
            </span>
          </div>
          <ul className="seq-builder__list">
            {frames.map((frame, i) => (
              <FrameRow
                key={i}
                index={i + 1}
                frame={frame}
                isActive={i === playbackIdx}
                isFirst={i === 0}
                isLast={i === frames.length - 1}
                innerRef={i === playbackIdx ? activeRowRef : null}
                src={src}
                frameW={frameW}
                frameH={frameH}
                offsetX={offsetX}
                offsetY={offsetY}
                gutterX={gutterX}
                gutterY={gutterY}
                onUpdate={(patch) => updateFrame(i, patch)}
                onDelete={() => deleteFrame(i)}
                onMoveUp={() => moveFrame(i, -1)}
                onMoveDown={() => moveFrame(i, 1)}
                isDragging={dragIdx === i}
                isDropTarget={dropIdx === i && dragIdx !== i}
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropIdx(i);
                }}
                onDrop={() => {
                  reorderFrames(dragIdx, dropIdx);
                  setDragIdx(null);
                  setDropIdx(null);
                }}
                onDragEnd={() => {
                  setDragIdx(null);
                  setDropIdx(null);
                }}
              />
            ))}
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
