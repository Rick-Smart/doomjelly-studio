import { IconButton } from "../../../../ui/IconButton";
import { NumberInput } from "../../../../ui/NumberInput";
import { FrameThumb } from "../../shared/FrameThumb";
import "./FrameRow.css";

/**
 * A single frame row in the SequenceBuilder list.
 *
 * Props:
 *   index       number   1-based display index
 *   frame       object   { col, row, ticks, dx, dy }
 *   isActive    bool     Whether this frame is currently playing
 *   isFirst     bool     Disables "move up"
 *   isLast      bool     Disables "move down"
 *   innerRef    ref      Forwarded ref for auto-scroll
 *   src         string   Sprite sheet object URL
 *   frameW/H    number   Frame dimensions
 *   offsetX/Y   number   Sheet offsets
 *   gutterX/Y   number   Gutter sizes
 *   onUpdate    fn(patch)  Partial update to this frame
 *   onDelete    fn()       Remove this frame
 *   onMoveUp    fn()
 *   onMoveDown  fn()
 */
export function FrameRow({
  index,
  frame,
  isActive,
  isFirst,
  isLast,
  innerRef,
  src,
  frameW,
  frameH,
  offsetX,
  offsetY,
  gutterX,
  gutterY,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onSelect,
}) {
  const hasOffset = (frame.dx ?? 0) !== 0 || (frame.dy ?? 0) !== 0;
  let cls = "seq-frame";
  if (isActive) cls += " seq-frame--active";
  if (hasOffset) cls += " seq-frame--offset";
  if (isDragging) cls += " seq-frame--dragging";
  if (isDropTarget) cls += " seq-frame--drop-target";

  return (
    <li
      ref={innerRef}
      className={cls}
      draggable
      onClick={(e) => {
        if (e.target.closest("input, button")) return;
        onSelect?.();
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <span className="seq-frame__drag-handle" title="Drag to reorder">
        ⠿
      </span>
      <span className="seq-frame__index">{index}</span>
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
        className="seq-frame__thumb"
      />
      <span className="seq-frame__coords">
        {frame.col},{frame.row}
      </span>

      {/* ── Ticks group ── */}
      <div className="seq-frame__group">
        <NumberInput
          label=""
          compact
          value={frame.ticks}
          onChange={(v) => onUpdate({ ticks: v })}
          min={1}
          max={999}
          step={1}
        />
      </div>

      {/* ── Offset group ── */}
      <div className="seq-frame__group">
        <div className="seq-frame__offset-pair">
          <span className="seq-frame__axis-label">dx</span>
          <div className="seq-frame__inputs-joined">
            <NumberInput
              label=""
              compact
              value={frame.dx ?? 0}
              onChange={(v) => onUpdate({ dx: v })}
              min={-999}
              max={999}
              step={1}
              className="seq-frame__offset-input seq-frame__offset-input--left"
            />
            <NumberInput
              label=""
              compact
              value={frame.dy ?? 0}
              onChange={(v) => onUpdate({ dy: v })}
              min={-999}
              max={999}
              step={1}
              className="seq-frame__offset-input seq-frame__offset-input--right"
            />
          </div>
          <span className="seq-frame__axis-label">dy</span>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="seq-frame__actions">
        <IconButton
          icon="↑"
          title="Move up"
          size="sm"
          onClick={onMoveUp}
          disabled={isFirst}
        />
        <IconButton
          icon="↓"
          title="Move down"
          size="sm"
          onClick={onMoveDown}
          disabled={isLast}
        />
        <IconButton
          icon="✕"
          title="Remove frame"
          size="sm"
          variant="danger"
          onClick={onDelete}
        />
      </div>
    </li>
  );
}
