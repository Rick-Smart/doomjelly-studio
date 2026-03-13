import { useState } from "react";
import { useAnimator } from "../../../contexts/AnimatorContext";
import { NumberInput } from "../../../ui/NumberInput";
import { Button } from "../../../ui/Button";
import "./FrameConfigPanel.css";

const DEFAULTS = {
  frameW: 32,
  frameH: 32,
  scale: 2,
  offsetX: 0,
  offsetY: 0,
  gutterX: 0,
  gutterY: 0,
};

export function FrameConfigPanel() {
  const { state, dispatch } = useAnimator();
  const cfg = state.frameConfig;
  const [open, setOpen] = useState(true);

  function set(key, value) {
    dispatch({ type: "SET_FRAME_CONFIG", payload: { [key]: value } });
  }

  function reset() {
    dispatch({ type: "SET_FRAME_CONFIG", payload: DEFAULTS });
  }

  return (
    <div className={`frame-config${open ? "" : " frame-config--collapsed"}`}>
      <button
        className="frame-config__heading"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Frame Config</span>
        <span className="frame-config__chevron">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <>
          <div className="frame-config__grid">
            <NumberInput
              label="Frame W"
              value={cfg.frameW}
              min={1}
              max={512}
              onChange={(v) => set("frameW", v)}
              suffix="px"
            />
            <NumberInput
              label="Frame H"
              value={cfg.frameH}
              min={1}
              max={512}
              onChange={(v) => set("frameH", v)}
              suffix="px"
            />
            <NumberInput
              label="Scale"
              value={cfg.scale}
              min={0.25}
              max={16}
              step={0.25}
              onChange={(v) => set("scale", v)}
              suffix="×"
            />
            <div />
            <NumberInput
              label="Offset X"
              value={cfg.offsetX}
              min={0}
              onChange={(v) => set("offsetX", v)}
              suffix="px"
            />
            <NumberInput
              label="Offset Y"
              value={cfg.offsetY}
              min={0}
              onChange={(v) => set("offsetY", v)}
              suffix="px"
            />
            <NumberInput
              label="Gutter X"
              value={cfg.gutterX}
              min={0}
              onChange={(v) => set("gutterX", v)}
              suffix="px"
            />
            <NumberInput
              label="Gutter Y"
              value={cfg.gutterY}
              min={0}
              onChange={(v) => set("gutterY", v)}
              suffix="px"
            />
          </div>

          <Button variant="ghost" size="sm" onClick={reset}>
            Reset to defaults
          </Button>
        </>
      )}
    </div>
  );
}
