/**
 * Storage service — object URL stub.
 *
 * Returns Promises to match the async Supabase Storage API shape.
 * To migrate: replace internals with supabase.storage.from('sprites')... calls.
 * Object URLs are in-memory only; they don't survive page refresh,
 * which is intentional for the dev stub (user re-imports the sheet).
 */

const cache = new Map();

export async function uploadSprite(file) {
  const url = URL.createObjectURL(file);
  const id = crypto.randomUUID();
  cache.set(id, url);
  return { id, url, filename: file.name };
}

export async function getSpriteUrl(id) {
  return cache.get(id) ?? null;
}

export async function deleteSprite(id) {
  const url = cache.get(id);
  if (url) URL.revokeObjectURL(url);
  cache.delete(id);
}
