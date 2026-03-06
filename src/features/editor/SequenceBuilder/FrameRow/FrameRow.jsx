import { useRef, useEffect } from "react";
import { IconButton } from "../../../../ui/IconButton";
import { NumberInput } from "../../../../ui/NumberInput";
import "./FrameRow.css";

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
}) {
  const hasOffset = (frame.dx ?? 0) !== 0 || (frame.dy ?? 0) !== 0;
  let cls = "seq-frame";
  if (isActive) cls += " seq-frame--active";
  if (hasOffset) cls += " seq-frame--offset";

  return (
    <li ref={innerRef} className={cls}>
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
      />
      <span className="seq-frame__coords">
        {frame.col},{frame.row}
      </span>

      {/* ── Ticks group ── */}
      <div className="seq-frame__group">
        <NumberInput
          label=""
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
              value={frame.dx ?? 0}
              onChange={(v) => onUpdate({ dx: v })}
              min={-999}
              max={999}
              step={1}
              className="seq-frame__offset-input seq-frame__offset-input--left"
            />
            <NumberInput
              label=""
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
