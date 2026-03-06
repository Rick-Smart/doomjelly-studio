import { useDropZone } from "../../hooks/useDropZone";
import "./FileDropZone.css";

/**
 * Reusable drag-and-drop + file picker zone.
 *
 * Props:
 *   accept      string   MIME type e.g. 'image/png'
 *   onFile      fn       Called with File object
 *   label       string   Main instruction text
 *   hint        string   Sub-hint below label
 *   className   string   Extra class names
 */
export function FileDropZone({ accept, onFile, label, hint, className = "" }) {
  const { isDragging, dropZoneProps, inputRef, handleInputChange, openPicker } =
    useDropZone({ accept, onFile });

  return (
    <div
      className={`drop-zone${isDragging ? " drop-zone--over" : ""}${className ? ` ${className}` : ""}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={openPicker}
      onKeyDown={(e) => e.key === "Enter" && openPicker()}
      {...dropZoneProps}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="drop-zone__input"
        onChange={handleInputChange}
        tabIndex={-1}
      />
      <span className="drop-zone__icon" aria-hidden="true">
        📂
      </span>
      {label && <span className="drop-zone__label">{label}</span>}
      {hint && <span className="drop-zone__hint">{hint}</span>}
    </div>
  );
}
