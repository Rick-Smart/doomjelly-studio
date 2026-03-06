import "./Page.css";

/**
 * Standard wrapper for all route-level views.
 * Provides a consistent header bar + scrollable body, preventing
 * layout jitter as the user navigates between pages.
 *
 * Props:
 *   title      string     Page heading displayed in the header bar
 *   actions    ReactNode  Right-aligned controls inside the header bar
 *   children   ReactNode  Page body content
 *   scrollable bool       Body scrolls vertically (default true)
 *   padding    bool       Adds standard body padding (default true)
 *   className  string
 */
export function Page({
  title,
  actions,
  children,
  scrollable = true,
  padding = true,
  className = "",
}) {
  return (
    <div className={`page${className ? ` ${className}` : ""}`}>
      {(title || actions) && (
        <div className="page__header">
          {title && <h1 className="page__title">{title}</h1>}
          {actions && <div className="page__actions">{actions}</div>}
        </div>
      )}
      <div
        className={[
          "page__body",
          scrollable ? "page__body--scroll" : "",
          padding ? "page__body--pad" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
