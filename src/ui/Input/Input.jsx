import "./Input.css";

/**
 * General-purpose text input with optional label, error, and hint.
 *
 * Props:
 *   label       string
 *   value       string
 *   onChange    fn(string)
 *   placeholder string
 *   type        string   default 'text'
 *   disabled    bool
 *   error       string   error message (replaces hint when set)
 *   hint        string   helper text below field
 *   className   string
 */
export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  error,
  hint,
  className = "",
  ...rest
}) {
  return (
    <label
      className={`input-wrap${error ? " input-wrap--error" : ""}${className ? ` ${className}` : ""}`}
    >
      {label && <span className="input-wrap__label">{label}</span>}
      <input
        type={type}
        className="input-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        {...rest}
      />
      {error && (
        <span className="input-wrap__message input-wrap__message--error">
          {error}
        </span>
      )}
      {hint && !error && <span className="input-wrap__message">{hint}</span>}
    </label>
  );
}
