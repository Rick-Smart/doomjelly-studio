import { useState } from "react";
import "./Panel.css";

/**
 * Collapsible titled section / side panel.
 * Use anywhere a labeled, optionally collapsible container is needed.
 *
 * Props:
 *   title        string
 *   children     ReactNode
 *   collapsible  bool      default false
 *   defaultOpen  bool      default true
 *   actions      ReactNode  extra controls in the header (right side)
 *   className    string
 */
export function Panel({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  actions,
  className = "",
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`panel${!open ? " panel--closed" : ""}${className ? ` ${className}` : ""}`}
    >
      <div className="panel__header">
        <span className="panel__title">{title}</span>
        <div className="panel__header-end">
          {actions}
          {collapsible && (
            <button
              type="button"
              className="panel__toggle"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? "Collapse section" : "Expand section"}
            >
              {open ? "▴" : "▾"}
            </button>
          )}
        </div>
      </div>
      {open && <div className="panel__body">{children}</div>}
    </div>
  );
}
