import { Modal } from "../Modal";
import { Button } from "../Button";
import "./ConfirmDialog.css";

/**
 * "Are you sure?" confirmation dialog built on Modal.
 *
 * Props:
 *   isOpen        bool
 *   onClose       fn
 *   onConfirm     fn      Called when confirmed; dialog also closes automatically
 *   title         string  default 'Are you sure?'
 *   message       string  Body text
 *   confirmLabel  string  default 'Confirm'
 *   cancelLabel   string  default 'Cancel'
 *   variant       'danger' | 'primary'  default 'danger'
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
}) {
  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width={380}>
      {message && <p className="confirm-dialog__message">{message}</p>}
      <div className="confirm-dialog__actions">
        <Button variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
