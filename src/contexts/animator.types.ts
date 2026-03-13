/**
 * src/contexts/animator.types.ts — TypeScript interfaces for AnimatorContext.
 *
 * AnimatorContext owns the animator workspace state: loaded sprite sheets,
 * frame configuration, and animation definitions.
 *
 * Sprint 8 — TypeScript migration.
 */

import type {
  SheetRecord,
  AnimationRecord,
  FrameConfig,
} from "../services/types";

// ── State ──────────────────────────────────────────────────────────────────────

export interface AnimatorState {
  sheets: SheetRecord[];
  activeSheetId: string | null;
  frameConfig: FrameConfig;
  animations: AnimationRecord[];
  activeAnimationId: string | null;
}

// ── Actions ────────────────────────────────────────────────────────────────────

export type AnimatorAction =
  | { type: "LOAD_PROJECT"; payload: Record<string, unknown> }
  | { type: "RESET_PROJECT" }
  | {
      type: "SET_SPRITE_SHEET";
      payload: {
        objectUrl: string;
        filename: string;
        width: number;
        height: number;
      };
    }
  | { type: "SET_FRAME_CONFIG"; payload: Partial<FrameConfig> }
  | {
      type: "ADD_SHEET";
      payload: {
        id: string;
        filename: string;
        objectUrl: string | null;
        dataUrl: string | null;
        width: number;
        height: number;
      };
    }
  | { type: "REMOVE_SHEET"; payload: string }
  | { type: "SET_ACTIVE_SHEET"; payload: string }
  | {
      type: "RESTORE_SHEET_URLS";
      payload: Array<{ id: string; objectUrl: string }>;
    }
  | { type: "ADD_ANIMATION"; payload: AnimationRecord }
  | { type: "DELETE_ANIMATION"; payload: string }
  | { type: "RENAME_ANIMATION"; payload: { id: string; name: string } }
  | { type: "DUPLICATE_ANIMATION"; payload: AnimationRecord }
  | { type: "SET_ACTIVE_ANIMATION"; payload: string | null }
  | {
      type: "UPDATE_ANIMATION";
      payload: Partial<AnimationRecord> & { id: string };
    }
  | { type: "RESTORE_SNAPSHOT"; payload: AnimatorState };

// ── Context value ──────────────────────────────────────────────────────────────

export interface AnimatorContextValue {
  state: AnimatorState;
  dispatch: (action: AnimatorAction) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}
