/**
 * Pure selector functions for ProjectContext state.
 * All functions take `state` and return a derived value — no side effects,
 * no dispatching, no React dependencies.
 *
 * Import these instead of writing state.sheets.find(...) inline.
 */

/** The active sheet object, or null if none is selected / sheets is empty. */
export const selectActiveSheet = (state) =>
  state.sheets.find((s) => s.id === state.activeSheetId) ?? null;

/** The active animation object, or null. */
export const selectActiveAnimation = (state) =>
  state.animations.find((a) => a.id === state.activeAnimationId) ?? null;

/** Number of frames in the active animation, or 0. */
export const selectFrameCount = (state) =>
  selectActiveAnimation(state)?.frames.length ?? 0;

/** Frames array of the active animation, or an empty array. */
export const selectFrames = (state) =>
  selectActiveAnimation(state)?.frames ?? [];
