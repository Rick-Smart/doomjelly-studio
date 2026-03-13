import { isSupabaseEnabled } from "./supabase.js";
import { idbGet, idbPut, idbDelete, SPRITES_STORE } from "./idb.js";
import {
  sbListSprites,
  sbSaveSprite,
  sbLoadSprite,
  sbDeleteSprite,
} from "./supabaseApi.js";
import {
  readProjectsIndex,
  writeProjectsIndex,
  readSpritesIndex,
  writeSpritesIndex,
  migrateLocalIfNeeded,
} from "./localIndex.js";

export async function listSprites(projectId) {
  if (isSupabaseEnabled) return sbListSprites(projectId);
  migrateLocalIfNeeded();
  return readSpritesIndex().filter((s) => s.projectId === projectId);
}

export async function loadSprite(id) {
  if (isSupabaseEnabled) return sbLoadSprite(id);
  const data = await idbGet(SPRITES_STORE, id);
  if (!data) return null;
  const jellySpriteState =
    data.jellyBody ??
    (data.body?.frames ? data.body : (data.body?.jellySpriteState ?? null));
  return {
    ...data,
    jellySpriteState,
    animatorState: data.animatorBody ?? null,
  };
}

export async function saveSprite(sprite, thumbnail) {
  if (thumbnail !== undefined) sprite = { ...sprite, thumbnail };
  if (isSupabaseEnabled && sprite.projectId) return sbSaveSprite(sprite);
  if (isSupabaseEnabled && !sprite.projectId) {
    console.warn(
      "saveSprite: no projectId — saving to local IDB instead of Supabase",
    );
  }
  const now = new Date().toISOString();
  const frameCount = sprite.frameCount ?? sprite.jellyBody?.frames?.length ?? 0;
  const canvasW = sprite.canvasW ?? sprite.jellyBody?.canvasW ?? 32;
  const canvasH = sprite.canvasH ?? sprite.jellyBody?.canvasH ?? 32;
  const record = { ...sprite, frameCount, canvasW, canvasH, updatedAt: now };
  await idbPut(SPRITES_STORE, record);

  const { body: _b, jellyBody: _jb, animatorBody: _ab, ...meta } = record;

  // Index writes are best-effort — a localStorage failure must not mask a
  // successful IDB write (Rule 9).
  try {
    const index = readSpritesIndex();
    const i = index.findIndex((s) => s.id === sprite.id);
    if (i >= 0) index[i] = { ...index[i], ...meta };
    else index.unshift(meta);
    writeSpritesIndex(index);
  } catch (e) {
    console.warn("saveSprite: sprites index update failed (non-fatal):", e);
  }

  try {
    const projects = readProjectsIndex();
    const pi = projects.findIndex((p) => p.id === sprite.projectId);
    if (pi >= 0) {
      projects[pi] = { ...projects[pi], updatedAt: now };
      writeProjectsIndex(projects);
    }
  } catch (e) {
    console.warn("saveSprite: projects index update failed (non-fatal):", e);
  }

  return meta;
}

export async function deleteSprite(id) {
  if (isSupabaseEnabled) return sbDeleteSprite(id);
  writeSpritesIndex(readSpritesIndex().filter((s) => s.id !== id));
  await idbDelete(SPRITES_STORE, id);
}

export async function renameSprite(id, name) {
  const sprite = await loadSprite(id);
  return saveSprite({ ...sprite, name });
}
