import { useState, useRef, useEffect } from "react";
import "./SplitButton.css";

export function SplitButton({ onSave, saving, saved, isDirty, menuItems }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  const label = saving ? "Saving…" : saved ? "Saved ✓" : "Save";

  return (
    <div className="split-save" ref={wrapRef}>
      <button
        className="split-save__main"
        onClick={onSave}
        disabled={saving}
        title="Save project (Ctrl+S)"
      >
        {label}
        {isDirty && !saving && !saved && (
          <span className="split-save__dot" aria-hidden="true" />
        )}
      </button>
      <button
        className="split-save__chevron"
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        aria-label="More save options"
        aria-expanded={open}
        title="More save options"
      >
        ▾
      </button>
      {open && (
        <div className="split-save__menu" role="menu">
          {menuItems.map((item) =>
            item.separator ? (
              <div key={item.id} className="split-save__sep" role="separator" />
            ) : (
              <button
                key={item.id}
                className="split-save__item"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled) {
                    item.action();
                    setOpen(false);
                  }
                }}
              >
                <span className="split-save__item-label">{item.label}</span>
                {item.hint && (
                  <span className="split-save__item-hint">{item.hint}</span>
                )}
                {item.soon && (
                  <span className="split-save__item-badge">soon</span>
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
