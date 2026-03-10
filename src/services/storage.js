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
