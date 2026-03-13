/**
 * src/contexts/document.types.ts — TypeScript interfaces for DocumentContext.
 *
 * DocumentContext owns the slim document identity (id, name, projectId, spriteId)
 * plus canvas geometry and document structure metadata (frames, layers, tags).
 * It intentionally does NOT own pixel data — that lives in PixelDocument.
 *
 * Sprint 8 — TypeScript migration.
 */

import type { Frame, Layer, AnimationRecord } from "../services/types";

// ── State ──────────────────────────────────────────────────────────────────────

export interface DocumentState {
  /** Sprite ID — null until first save. */
  id: string | null;
  name: string;
  /** Parent project ID. */
  projectId: string | null;
  /** The IDB / Supabase sprite id (same as id after Sprint 6). */
  spriteId: string | null;

  canvasW: number;
  canvasH: number;

  /** Frame metadata list — pixel data lives in PixelDocument. */
  frames: Frame[];
  /** Layer metadata list — pixel data lives in PixelDocument. */
  layers: Layer[];
  /**
   * Named animation ranges (tags). Seeded from Animator animations
   * on LOAD_PROJECT; written back on LOAD_DOCUMENT / SET_TAGS.
   */
  tags: AnimationRecord[];

  jellyBody: unknown | null;
}

// ── Actions ────────────────────────────────────────────────────────────────────

export type DocumentAction =
  | {
      type: "LOAD_DOCUMENT";
      payload: Partial<DocumentState> & { id?: string | null };
    }
  | {
      type: "LOAD_PROJECT";
      payload: Partial<DocumentState> & { id?: string | null };
    }
  | { type: "RESET_DOCUMENT" }
  | { type: "RESET_PROJECT" }
  | { type: "SET_DOCUMENT_NAME"; payload: string }
  | { type: "SET_PROJECT_NAME"; payload: string }
  | { type: "SET_DOCUMENT_ID"; payload: string }
  | { type: "SET_PROJECT_ID"; payload: string }
  | { type: "SET_SPRITE_ID"; payload: string }
  | { type: "SET_CANVAS_SIZE"; payload: { w?: number; h?: number } }
  | { type: "SET_FRAMES"; payload: Frame[] }
  | { type: "SET_LAYERS"; payload: Layer[] }
  | { type: "SET_TAGS"; payload: AnimationRecord[] };

// ── Context value ──────────────────────────────────────────────────────────────

export interface DocumentContextValue {
  state: DocumentState;
  dispatch: (action: DocumentAction) => void;
  isDirty: boolean;
  markSaved: () => void;
}
