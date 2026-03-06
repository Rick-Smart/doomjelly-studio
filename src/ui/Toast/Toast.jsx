import "./Toast.css";

/**
 * ToastList — fixed overlay that renders all active toasts.
 *
 * Props:
 *   toasts    Array<{ id, message, type: 'info'|'success'|'error' }>
 *   onDismiss fn(id)
 */
export function ToastList({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-list" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <span className="toast__message">{t.message}</span>
          <button
            className="toast__dismiss"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
