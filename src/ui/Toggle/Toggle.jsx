import "./Toggle.css";

/**
 * Boolean toggle switch.
 *
 * Props:
 *   label         string
 *   checked       bool
 *   onChange      fn(bool)
 *   disabled      bool
 *   labelPosition 'left' | 'right'  default 'right'
 */
export function Toggle({
  label,
  checked,
  onChange,
  disabled,
  labelPosition = "right",
}) {
  return (
    <label className={`toggle${disabled ? " toggle--disabled" : ""}`}>
      {label && labelPosition === "left" && (
        <span className="toggle__label">{label}</span>
      )}
      {/* Input comes before the visual track so ~ sibling selector works */}
      <input
        type="checkbox"
        className="toggle__input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
      {label && labelPosition === "right" && (
        <span className="toggle__label">{label}</span>
      )}
    </label>
  );
}
