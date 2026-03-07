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
  canDelete,
}) {
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
