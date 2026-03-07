import { useJellySprite } from "../JellySpriteContext";
import { FrameThumb } from "../FrameThumb";

export function CanvasArea() {
  const {
    editingMaskId,
    setEditingMaskId,
    canvasW,
    canvasH,
    zoom,
    canvasRef,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    cursorStyle,
    isPlaying,
    fps,
    setFps,
    onionSkinning,
    setOnionSkinning,
    frames,
    activeFrameIdx,
    frameThumbnails,
    playbackFrameIdxRef,
    switchToFrame,
    duplicateFrame,
    deleteFrame,
    addFrame,
    renameFrame,
    startPlayback,
    stopPlayback,
  } = useJellySprite();

  return (
    <div className="jelly-sprite__canvas-area">
      {editingMaskId && (
        <div className="jelly-sprite__mask-edit-banner">
          <span>✦ Mask edit mode — pencil reveals, eraser hides</span>
          <button
            className="jelly-sprite__mask-edit-done"
            onClick={() => setEditingMaskId(null)}
          >
            Done
          </button>
        </div>
      )}
      <div className="jelly-sprite__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="jelly-sprite__canvas"
          width={canvasW * zoom}
          height={canvasH * zoom}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          style={{ cursor: cursorStyle }}
        />
      </div>

      <div className="jelly-sprite__frame-strip">
        <div className="jelly-sprite__frame-strip-controls">
          <button
            className={`jelly-sprite__playback-btn${isPlaying ? " jelly-sprite__playback-btn--active" : ""}`}
            onClick={isPlaying ? stopPlayback : startPlayback}
            disabled={frames.length <= 1}
            title={isPlaying ? "Stop (Space)" : "Play (Space)"}
          >
            {isPlaying ? "⏹" : "▶"}
          </button>
          <div className="jelly-sprite__fps-control">
            <span className="jelly-sprite__fps-label">{fps} FPS</span>
            <input
              type="range"
              min={1}
              max={30}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="jelly-sprite__fps-slider"
              disabled={isPlaying}
            />
          </div>
          <button
            className={`jelly-sprite__playback-btn${onionSkinning ? " jelly-sprite__playback-btn--active" : ""}`}
            onClick={() => setOnionSkinning((v) => !v)}
            title="Onion skinning"
            disabled={isPlaying || frames.length <= 1}
          >
            👻
          </button>
        </div>
        <div className="jelly-sprite__frames-scroll">
          {frames.map((frame, idx) => (
            <FrameThumb
              key={frame.id}
              thumb={frameThumbnails[frame.id]}
              name={frame.name}
              active={idx === activeFrameIdx}
              idx={idx}
              playbackIdx={isPlaying ? playbackFrameIdxRef.current : -1}
              isPlaying={isPlaying}
              onClick={() => !isPlaying && switchToFrame(idx)}
              onDuplicate={() => duplicateFrame(idx)}
              onDelete={() => deleteFrame(idx)}
              onRename={(name) => renameFrame(frame.id, name)}
              canDelete={frames.length > 1 && !isPlaying}
            />
          ))}
          <button
            className="jelly-sprite__add-frame-btn"
            onClick={addFrame}
            disabled={isPlaying}
            title="Add frame"
          >
            + Frame
          </button>
        </div>
      </div>
    </div>
  );
}
