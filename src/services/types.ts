/**
 * src/services/types.ts — canonical data-contract interfaces for DoomJelly Studio.
 *
 * These interfaces define the shapes that cross service boundaries: what gets
 * written to IDB / Supabase, what gets passed between workspaces, and what
 * the context contexts own. Import from here rather than inferring from runtime
 * shapes.
 *
 * Sprint 8 — TypeScript migration.
 */

// ── Primitive building blocks ─────────────────────────────────────────────────

/** A single layer in a JellySprite frame. */
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  blendMode: string;
  hasMask: boolean;
}

/** A frame entry (metadata only — pixel data is in PixelDocument or JellyBody). */
export interface Frame {
  id: string;
  name: string;
}

/** Animator sprite-sheet frame config (pixel offsets + dimensions). */
export interface FrameConfig {
  frameW: number;
  frameH: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  gutterX: number;
  gutterY: number;
}

// ── Animator domain ───────────────────────────────────────────────────────────

/** A loaded sprite sheet (image + optional per-sheet frame config). */
export interface SheetRecord {
  id: string;
  filename: string;
  objectUrl: string | null;
  dataUrl: string | null;
  width: number;
  height: number;
  frameConfig: FrameConfig | null;
}

/** A named animation range over frames in a sheet. */
export interface AnimationRecord {
  id: string;
  name: string;
  from: number;
  to: number;
  loop: boolean;
  fps?: number;
}

/**
 * The animator portion of the saved document body.
 * Written by AnimatorPage.buildAnimatorBody() and restored by AnimatorContext
 * on LOAD_PROJECT.
 */
export interface AnimatorBody {
  sheets: SheetRecord[];
  activeSheetId: string | null;
  frameConfig: FrameConfig;
  animations: AnimationRecord[];
  activeAnimationId: string | null;
}

// ── JellySprite pixel domain ──────────────────────────────────────────────────

/**
 * Per-frame pixel data as serialised by PixelDocument.serialize().
 * pixelBuffers / maskBuffers are base64-encoded Uint8ClampedArray /
 * Uint8Array strings keyed by layer id.
 */
export interface JellyFrameRecord {
  id: string;
  name: string;
  layers: Layer[];
  activeLayerId: string;
  pixelBuffers: Record<string, string>;
  maskBuffers: Record<string, string>;
}

/**
 * The full JellySprite pixel-data body stored in IDB.
 * Produced by PixelDocument.serialize() (version 3) and optionally augmented
 * with view/tool state by jellySpritePersistence.serializeJellySprite().
 */
export interface JellyBody {
  version: number;
  canvasW: number;
  canvasH: number;
  activeFrameIdx: number;
  frames: JellyFrameRecord[];
  /** Optional tool/view snapshot fields (legacy or extended save). */
  zoom?: number;
  tool?: string;
  brushType?: string;
  fgColor?: string;
  bgColor?: string;
}

// ── Storage index records ─────────────────────────────────────────────────────

/** Slim index entry written to localStorage for fast project listing. */
export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Slim index entry written to localStorage / Supabase for sprite listing. */
export interface SpriteRecord {
  id: string;
  projectId: string;
  name: string;
  thumbnail: string | null;
  frameCount: number;
  animCount: number;
  canvasW: number;
  canvasH: number;
  createdAt: string;
  updatedAt: string;
  tools?: { jelly: boolean; animator: boolean };
}

// ── Full document record (IDB) ────────────────────────────────────────────────

/**
 * The full document record as it lives in IDB (SPRITES_STORE).
 * Returned by loadSprite() and accepted by saveSprite().
 */
export interface DocumentRecord extends SpriteRecord {
  jellyBody: JellyBody | null;
  animatorBody: AnimatorBody | null;
}
