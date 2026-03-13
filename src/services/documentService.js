// Sprint 6d — unified save/load entry point for both workspaces.
// Both JellySpriteWorkspace and AnimatorPage call saveDocument() / loadDocument()
// instead of assembling the IDB record themselves.  This is the single place
// that knows about jellyBody, animatorBody, and thumbnail — workspaces should
// not need to think about the storage schema.

import { loadSprite, saveSprite } from "./sprites.js";

/**
 * Load a document by sprite ID and return a normalised payload.
 * Callers dispatch the result as LOAD_PROJECT to both DocumentContext and
 * AnimatorContext — the reducers already handle the field names used here.
 *
 * @param {string} spriteId
 * @returns {Promise<object|null>}
 */
export async function loadDocument(spriteId) {
  const data = await loadSprite(spriteId);
  if (!data) return null;
  return {
    ...data,
    id: spriteId,
    // Both storage paths (IDB + Supabase) now normalise to jellyBody/animatorBody.
    jellyBody: data.jellyBody ?? null,
    animatorBody: data.animatorBody ?? null,
  };
}

/**
 * Save the current document to IDB / Supabase.
 *
 * @param {object} docState   Snapshot of DocumentContext state (id, name, projectId, canvasW/H, frames[])
 * @param {object} [extras]
 * @param {object|null} [extras.jellyBody]    Full JellySprite pixel payload from collectSaveData()
 * @param {object|null} [extras.animatorBody] Animator body from buildAnimatorBody()
 * @param {string|null} [extras.thumbnail]    Base64 PNG thumbnail data URL
 * @returns {Promise<{id: string}>}           The saved sprite's id
 */
export async function saveDocument(
  docState,
  { jellyBody = undefined, animatorBody = undefined, thumbnail = null } = {},
) {
  const id = docState.id ?? crypto.randomUUID();

  await saveSprite(
    {
      id,
      projectId: docState.projectId ?? null,
      name: docState.name,
      canvasW: docState.canvasW ?? jellyBody?.canvasW ?? 32,
      canvasH: docState.canvasH ?? jellyBody?.canvasH ?? 32,
      jellyBody,
      animatorBody,
      frameCount: docState.frames?.length ?? jellyBody?.frames?.length ?? 0,
      animCount: animatorBody?.animations?.length ?? 0,
      tools: {
        jelly: !!jellyBody,
        animator: !!animatorBody,
      },
    },
    thumbnail ?? undefined,
  );

  return { id };
}
