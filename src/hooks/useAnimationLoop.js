import { useRef, useCallback, useState, useEffect } from "react";

// resetKey resets playback to frame 0 on change — pass activeAnimationId so switching anims resets
export function useAnimationLoop(
  frames,
  { mode = "loop", speed = 1, ticksPerSecond = 60, resetKey } = {},
) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTicks, setElapsedTicks] = useState(0);

  const rafRef = useRef(null);
  const isPlayingRef = useRef(false);
  // All mutable playback state in one ref — the rAF callback never goes stale.
  const r = useRef({ fi: 0, dir: 1, accum: 0, lastTime: null, totalTicks: 0 });

  // Keep options live so changes take effect on the next tick without restart.
  const framesRef = useRef(frames);
  framesRef.current = frames;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const tpsRef = useRef(ticksPerSecond);
  tpsRef.current = ticksPerSecond;

  // Reset to frame 0 when the active animation changes.
  useEffect(() => {
    r.current = { fi: 0, dir: 1, accum: 0, lastTime: null, totalTicks: 0 };
    setFrameIndex(0);
    setElapsedTicks(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Clamp the current frame index when frames are deleted.
  useEffect(() => {
    if (frames.length > 0 && r.current.fi >= frames.length) {
      r.current.fi = frames.length - 1;
      r.current.accum = 0;
      setFrameIndex(r.current.fi);
    }
  }, [frames.length]);

  const step = useCallback((time) => {
    if (!isPlayingRef.current) return;

    const fs = framesRef.current;
    if (!fs || fs.length === 0) {
      rafRef.current = requestAnimationFrame(step);
      return;
    }

    if (r.current.lastTime === null) {
      r.current.lastTime = time;
      rafRef.current = requestAnimationFrame(step);
      return;
    }

    const deltaTicks =
      ((time - r.current.lastTime) / 1000) * tpsRef.current * speedRef.current;
    r.current.lastTime = time;
    r.current.accum += deltaTicks;
    r.current.totalTicks += deltaTicks;

    let changed = false;
    while (r.current.accum >= (fs[r.current.fi]?.ticks ?? 6)) {
      r.current.accum -= fs[r.current.fi]?.ticks ?? 6;
      const total = fs.length;

      if (modeRef.current === "ping-pong") {
        r.current.fi += r.current.dir;
        if (r.current.fi >= total) {
          r.current.fi = Math.max(0, total - 2);
          r.current.dir = -1;
        }
        if (r.current.fi < 0) {
          r.current.fi = Math.min(1, total - 1);
          r.current.dir = 1;
        }
      } else if (modeRef.current === "once") {
        if (r.current.fi < total - 1) {
          r.current.fi++;
        } else {
          setFrameIndex(r.current.fi);
          isPlayingRef.current = false;
          setIsPlaying(false);
          return; // Don't re-schedule RAF
        }
      } else {
        // loop
        r.current.fi = (r.current.fi + 1) % total;
      }
      changed = true;
    }

    if (changed) setFrameIndex(r.current.fi);
    if (changed) setElapsedTicks(Math.round(r.current.totalTicks));
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const play = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setIsPlaying(true);
    r.current.lastTime = null;
    rafRef.current = requestAnimationFrame(step);
  }, [step]);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const seek = useCallback((index) => {
    const fs = framesRef.current;
    // Compute tick position = sum of ticks of all frames before the target index.
    const seekTicks = fs
      .slice(0, index)
      .reduce((s, f) => s + (f.ticks ?? 6), 0);
    r.current.fi = index;
    r.current.accum = 0;
    r.current.totalTicks = seekTicks;
    setFrameIndex(index);
    setElapsedTicks(seekTicks);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { frameIndex, isPlaying, play, pause, seek, elapsedTicks };
}
