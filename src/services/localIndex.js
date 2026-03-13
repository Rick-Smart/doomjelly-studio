const PROJECTS_INDEX_KEY = "dj-projects-index-v2";
const SPRITES_INDEX_KEY = "dj-sprites-index-v2";

export function readProjectsIndex() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

export function writeProjectsIndex(list) {
  try {
    localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(list));
  } catch {
    // localStorage quota or private-browsing restriction — non-fatal (Rule 9)
  }
}

export function readSpritesIndex() {
  try {
    return JSON.parse(localStorage.getItem(SPRITES_INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

export function writeSpritesIndex(list) {
  try {
    localStorage.setItem(SPRITES_INDEX_KEY, JSON.stringify(list));
  } catch {
    // localStorage quota or private-browsing restriction — non-fatal (Rule 9)
  }
}

// One-time migration from the old single-level localStorage schema.
export function migrateLocalIfNeeded() {
  const OLD_KEY = "dj-projects-index";
  const oldIndex = (() => {
    try {
      return JSON.parse(localStorage.getItem(OLD_KEY) || "[]");
    } catch {
      return [];
    }
  })();
  if (oldIndex.length === 0) return;
  if (readProjectsIndex().length > 0) return;

  const migratedProject = {
    id: crypto.randomUUID(),
    name: "Migrated",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeProjectsIndex([migratedProject]);

  const spritesIndex = [];
  oldIndex.forEach((p) => {
    spritesIndex.push({
      id: p.id,
      projectId: migratedProject.id,
      name: p.name,
      thumbnail: p.thumbnail ?? null,
      frameCount: p.frameCount ?? p.frame_count ?? 0,
      animCount: p.animCount ?? p.anim_count ?? 0,
      canvasW: 32,
      canvasH: 32,
      createdAt: p.savedAt ?? new Date().toISOString(),
      updatedAt: p.savedAt ?? new Date().toISOString(),
    });
  });
  writeSpritesIndex(spritesIndex);
  localStorage.removeItem(OLD_KEY);
}
