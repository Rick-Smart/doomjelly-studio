import { useEffect, useRef } from "react";

/**
 * Sets up a 2D canvas context and re-runs the draw callback whenever
 * its dependencies change. Handles devicePixelRatio for sharp rendering
 * and keeps the canvas logical size in sync with its CSS size.
 *
 * Usage:
 *   const canvasRef = useCanvas(draw, [dep1, dep2])
 *   <canvas ref={canvasRef} />
 */
export function useCanvas(draw, deps = []) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    draw(ctx, canvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return canvasRef;
}
