import { useState, useRef, useEffect } from "react";

export function FrameThumb({
  thumb,
  name,
  active,
  idx,
  isPlaying,
  playbackIdx,
  onClick,
  onDuplicate,
  onDelete,
  onRename,
  canDelete,
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  function startRename(e) {
    e.stopPropagation();
    setDraft(name);
    setRenaming(true);
  }

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    setRenaming(false);
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    }
    if (e.key === "Escape") setRenaming(false);
  }

  return (
    <div
      className={[
        "jelly-sprite__frame-thumb",
        active ? "jelly-sprite__frame-thumb--active" : "",
        isPlaying && playbackIdx === idx
          ? "jelly-sprite__frame-thumb--playing"
          : "",
      ]
        .join(" ")
        .trim()}
      onClick={onClick}
      title={name}
    >
      <div className="jelly-sprite__frame-thumb-num">{idx + 1}</div>
      {thumb ? (
        <img className="jelly-sprite__frame-thumb-img" src={thumb} alt={name} />
      ) : (
        <div className="jelly-sprite__frame-thumb-empty" />
      )}
      {renaming ? (
        <input
          ref={inputRef}
          className="jelly-sprite__frame-thumb-rename"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="jelly-sprite__frame-thumb-name"
          onDoubleClick={!isPlaying ? startRename : undefined}
          title="Double-click to rename"
        >
          {name}
        </div>
      )}
      <div className="jelly-sprite__frame-thumb-actions">
        <button
          className="jelly-sprite__frame-thumb-btn"
          title="Duplicate frame"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          ⎘
        </button>
        <button
          className="jelly-sprite__frame-thumb-btn jelly-sprite__frame-thumb-btn--danger"
          title="Delete frame"
          disabled={!canDelete}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
