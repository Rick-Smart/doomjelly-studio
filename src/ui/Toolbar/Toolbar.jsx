import "./Toolbar.css";

/**
 * Horizontal row of grouped controls.
 *
 * Props:
 *   justify  'start' | 'center' | 'end' | 'between'  default 'start'
 *   gap      'sm' | 'md'  default 'sm'
 */
export function Toolbar({
  children,
  justify = "start",
  gap = "sm",
  className = "",
}) {
  return (
    <div
      className={`toolbar toolbar--${justify} toolbar--gap-${gap}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}

/** Group of related controls inside a Toolbar */
export function ToolbarGroup({ children, className = "" }) {
  return (
    <div className={`toolbar__group${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

/** Visual separator between toolbar groups */
export function ToolbarSeparator() {
  return <div className="toolbar__sep" aria-hidden="true" />;
}
