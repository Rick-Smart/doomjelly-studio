import { useState, useEffect } from "react";
import "./NumberInput.css";

/**
 * Labeled number input used throughout config panels.
 *
 * Keeps local string state so the field can be emptied/partially typed
 * without snapping back. onChange fires only when a valid number is
 * committed (on blur) or entered via the step arrows / Enter key.
 *
 * Props:
 *   label     string   Display label
 *   value     number
 *   onChange  fn(number)
 *   min       number   (optional)
 *   max       number   (optional)
 *   step      number   default 1
 *   suffix    string   e.g. 'px' displayed after the input
 */
export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  className = "",
}) {
  const [raw, setRaw] = useState(String(value));

  // Keep local state in sync when parent value changes externally
  // (e.g. "Reset to defaults"), but only if the field isn't mid-edit.
  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  function commit(str) {
    const v = parseFloat(str);
    if (isNaN(v)) {
      // Revert to last known good value
      setRaw(String(value));
      return;
    }
    const clamped = clamp(v, min, max);
    setRaw(String(clamped));
    if (clamped !== value) onChange(clamped);
  }

  return (
    <label className={
um-input${className ? ` ${className}` : ""}`}>
      <span className="num-input__label">{label}</span>
      <div className="num-input__row">
        <input
          type="number"
          className="num-input__field"
          value={raw}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const str = e.target.value;
            setRaw(str);
            // Commit immediately when the string is a complete valid number.
            // This fires instantly for stepper arrows (always a complete number).
            // Partial typing ("-", "", "3.") won't parse so they stay as raw
            // until blur commits or reverts them.
            if (
              !isNaN(parseFloat(str)) &&
              String(parseFloat(str)) === str.trim()
            ) {
              commit(str);
            }
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(e.target.value);
              e.target.blur();
            }
          }}
        />
        {suffix && <span className="num-input__suffix">{suffix}</span>}
      </div>
    </label>
  );
}

function clamp(v, min, max) {
  if (min !== undefined && v < min) return min;
  if (max !== undefined && v > max) return max;
  return v;
}
