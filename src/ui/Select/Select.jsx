import "./Select.css";

/**
 * Styled select / dropdown.
 *
 * Props:
 *   label    string
 *   value    string
 *   onChange fn(string)
 *   options  [{ value: string, label: string }]
 *   disabled bool
 */
export function Select({
  label,
  value,
  onChange,
  options = [],
  disabled,
  className = "",
}) {
  return (
    <label className={`select-wrap${className ? ` ${className}` : ""}`}>
      {label && <span className="select-wrap__label">{label}</span>}
      <div className="select-wrap__control">
        <select
          className="select-field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="select-wrap__arrow" aria-hidden="true">
          ▾
        </span>
      </div>
    </label>
  );
}
