import { useEffect } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { usePlayback } from "../../../contexts/PlaybackContext";

/**
 * Wires all animator keyboard shortcuts as a side-effect hook.
 *
 * Must be called inside both PlaybackProvider and ProjectContext.
 *
 * @param {{ onSave: function, onHelp?: function }} callbacks
 */
export function useAnimatorKeyboard({ onSave, onHelp }) {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useProject();
  const { frameIndex, isPlaying, playPlayback, pausePlayback, seekTo } =
    usePlayback();

  const activeAnim = state.animations.find(
    (a) => a.id === state.activeAnimationId,
  );
  const frameCount = activeAnim?.frames.length ?? 0;

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (document.activeElement?.isContentEditable) return;

      if (e.code === "Space") {
        e.preventDefault();
        isPlaying ? pausePlayback() : playPlayback();
        return;
      }
      if (e.code === "ArrowLeft" && frameCount > 0) {
        e.preventDefault();
        pausePlayback();
        seekTo(Math.max(0, frameIndex - 1));
        return;
      }
      if (e.code === "ArrowRight" && frameCount > 0) {
        e.preventDefault();
        pausePlayback();
        seekTo(Math.min(frameCount - 1, frameIndex + 1));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        onHelp?.();
        return;
      }
      if (e.key === "Escape") {
        if (state.activeAnimationId !== null) {
          dispatch({ type: "SET_ACTIVE_ANIMATION", payload: null });
        }
        return;
      }
      if ((e.key === "a" || e.key === "A") && !e.ctrlKey && !e.metaKey) {
        const { activeAnimationId, activeSheetId, sheets, frameConfig } = state;
        const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;
        if (!activeAnimationId || !activeSheet) return;
        e.preventDefault();
        const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } =
          frameConfig;
        const stepX = frameW + gutterX;
        const stepY = frameH + gutterY;
        if (!frameW || !frameH || stepX <= 0 || stepY <= 0) return;
        const cols = Math.floor((activeSheet.width - offsetX) / stepX);
        const rows = Math.floor((activeSheet.height - offsetY) / stepY);
        if (cols <= 0 || rows <= 0) return;
        const newFrames = [];
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            newFrames.push({ col, row, ticks: 6, dx: 0, dy: 0 });
          }
        }
        dispatch({
          type: "UPDATE_ANIMATION",
          payload: { id: activeAnimationId, frames: newFrames },
        });
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isPlaying,
    frameIndex,
    frameCount,
    playPlayback,
    pausePlayback,
    seekTo,
    undo,
    redo,
    canUndo,
    canRedo,
    dispatch,
    state.activeAnimationId,
    state.activeSheetId,
    state.sheets,
    state.frameConfig,
    onSave,
    onHelp,
  ]);
}
