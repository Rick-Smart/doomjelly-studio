import { useRef, useEffect } from "react";

/** Fixed thumbnail render size in pixels. */
const THUMB = 32;

/**
 * Renders a single sprite-sheet cell as a 32×32 canvas thumbnail.
 *
 * Props:
 *   src       string   Object URL of the sprite sheet image
 *   col       number   Column index of the frame on the sheet
 *   row       number   Row index of the frame on the sheet
 *   frameW    number   Frame width in pixels
 *   frameH    number   Frame height in pixels
 *   offsetX   number   Sheet horizontal offset
 *   offsetY   number   Sheet vertical offset
 *   gutterX   number   Horizontal gutter between frames
 *   gutterY   number   Vertical gutter between frames
 *   className string   CSS class applied to the <canvas> element
 */
export function FrameThumb({
  src,
  col,
  row,
  frameW,
  frameH,
  offsetX,
  offsetY,
  gutterX,
  gutterY,
  className,
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
      className={className}
    />
  );
}
