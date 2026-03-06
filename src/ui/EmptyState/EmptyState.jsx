import "./EmptyState.css";

/**
 * Consistent no-content placeholder for lists, panels, and pages.
 *
 * Props:
 *   icon      string   Emoji or glyph icon
 *   title     string   Primary message
 *   hint      string   Secondary descriptive text
 *   children  ReactNode  CTA button(s) or other actions
 */
export function EmptyState({ icon, title, hint, children, className = "" }) {
  return (
    <div className={`empty-state${className ? ` ${className}` : ""}`}>
      {icon && (
        <span className="empty-state__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {title && <p className="empty-state__title">{title}</p>}
      {hint && <p className="empty-state__hint">{hint}</p>}
      {children && <div className="empty-state__actions">{children}</div>}
    </div>
  );
}
