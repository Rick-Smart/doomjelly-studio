import "./Tooltip.css";

/**
 * CSS-driven tooltip wrapper. Best for short labels on icon buttons.
 * For longer or dynamic content, prefer a Modal or Popover.
 *
 * Props:
 *   content   string            Tooltip text
 *   position  'top' | 'bottom' | 'left' | 'right'  default 'top'
 *   children  ReactNode
 */
export function Tooltip({
  children,
  content,
  position = "top",
  className = "",
}) {
  if (!content) return children;
  return (
    <span
      className={`tooltip-wrap${className ? ` ${className}` : ""}`}
      data-tooltip={content}
      data-tip-pos={position}
    >
      {children}
    </span>
  );
}
