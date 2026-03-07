import { useRef, useEffect } from "react";

export function BrushThumb({ brushId, active }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = canvas.width; // 15
    const r = 4; // preview radius
    const cx = Math.floor(s / 2);
    const cy = Math.floor(s / 2);
    ctx.fillStyle = active ? "#6c9ef8" : "#888";
    if (brushId === "pixel") {
      ctx.fillRect(cx, cy, 1, 1);
      return;
    }
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx,
          py = cy + dy;
        if (px < 0 || py < 0 || px >= s || py >= s) continue;
        if (brushId === "round" && dx * dx + dy * dy > r * r) continue;
        if (brushId === "diamond" && Math.abs(dx) + Math.abs(dy) > r) continue;
        if (brushId === "cross" && dx !== 0 && dy !== 0) continue;
        if (brushId === "dither" && (cx + cy + dx + dy) % 2 !== 0) continue;
        if (brushId === "dither2" && (cx + cy + dx + dy) % 2 === 0) continue;
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }, [brushId, active]);
  return (
    <canvas
      ref={ref}
      width={15}
      height={15}
      className="jelly-sprite__brush-thumb"
    />
  );
}
