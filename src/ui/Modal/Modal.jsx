import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";

/**
 * Accessible modal dialog.
 * - Renders via React portal into document.body
 * - Focus trap: Tab / Shift+Tab cycle within the dialog
 * - Escape key closes the dialog
 * - Click on overlay closes the dialog
 * - Returns focus to the previously focused element on close
 *
 * Props:
 *   isOpen   bool
 *   onClose  fn
 *   title    string
 *   children ReactNode
 *   width    number   CSS width in px (default 480)
 */
export function Modal({ isOpen, onClose, title, children, width = 480 }) {
  const dialogRef = useRef(null);
  const prevFocusRef = useRef(null);

  // Store previous focus and move focus into dialog when opening
  useEffect(() => {
    if (isOpen) {
      prevFocusRef.current = document.activeElement;
      setTimeout(() => {
        const first = dialogRef.current?.querySelector(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        );
        first?.focus();
      }, 0);
    } else {
      prevFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Focus trap + Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className="modal-dialog"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-dialog__header">
          <span id="modal-title" className="modal-dialog__title">
            {title}
          </span>
          <button
            type="button"
            className="modal-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="modal-dialog__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
