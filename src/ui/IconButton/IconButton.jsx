import "./IconButton.css";

/**
 * Icon-only button. Always supply `title` for accessibility —
 * it becomes aria-label and the native browser tooltip.
 *
 * Props:
 *   icon     ReactNode  Icon content (emoji, SVG, text glyph)
 *   title    string     Accessible label + tooltip
 *   variant  'ghost' | 'secondary' | 'primary' | 'danger'
 *   size     'sm' | 'md' | 'lg'
 *   disabled bool
 */
export function IconButton({
  icon,
  title,
  onClick,
  variant = "ghost",
  size = "md",
  disabled,
  className = "",
  ...rest
}) {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn--${variant} icon-btn--${size}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      {...rest}
    >
      {icon}
    </button>
  );
}
