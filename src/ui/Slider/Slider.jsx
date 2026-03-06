import "./Slider.css";

/**
 * Labeled range slider.
 *
 * Props:
 *   label        string
 *   value        number
 *   onChange     fn(number)
 *   min          number   default 0
 *   max          number   default 100
 *   step         number   default 1
 *   suffix       string   unit shown next to value (e.g. '×', '%', 'px')
 *   displayValue string | number  overrides the displayed value (e.g. formatted string)
 */
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = "",
  displayValue,
}) {
  const display = displayValue ?? value;
  return (
    <div className="slider-wrap">
      <div className="slider-wrap__header">
        {label && <span className="slider-wrap__label">{label}</span>}
        <span className="slider-wrap__value">
          {display}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        className="slider-field"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
