import { isSupabaseEnabled } from "./supabase.js";
import { idbPut, idbDelete, PROJECTS_STORE, SPRITES_STORE } from "./idb.js";
import {
  sbListProjects,
  sbCreateProject,
  sbRenameProject,
  sbDeleteProject,
  sbListSprites,
  sbDeleteSprite,
} from "./supabaseApi.js";
import {
  readProjectsIndex,
  writeProjectsIndex,
  readSpritesIndex,
  writeSpritesIndex,
  migrateLocalIfNeeded,
} from "./localIndex.js";

export async function listProjects() {
  if (isSupabaseEnabled) return sbListProjects();
  migrateLocalIfNeeded();
  return readProjectsIndex();
}

export async function createProject(name) {
  if (isSupabaseEnabled) return sbCreateProject(name);
  migrateLocalIfNeeded();
  const project = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const index = readProjectsIndex();
  index.unshift(project);
  writeProjectsIndex(index);
  await idbPut(PROJECTS_STORE, project);
  return project;
}

export async function renameProject(id, name) {
  if (isSupabaseEnabled) return sbRenameProject(id, name);
  const index = readProjectsIndex();
  const i = index.findIndex((p) => p.id === id);
  if (i >= 0) {
    index[i] = { ...index[i], name, updatedAt: new Date().toISOString() };
    writeProjectsIndex(index);
    await idbPut(PROJECTS_STORE, index[i]);
  }
}

export async function deleteProject(id) {
  if (isSupabaseEnabled) {
    // Delete all sprites in the project first. Supabase FK cascade may not be
    // configured on the sprites table, so be explicit to avoid orphaned rows.
    const sprites = await sbListSprites(id).catch(() => []);
    await Promise.all(sprites.map((s) => sbDeleteSprite(s.id).catch(() => {})));
    return sbDeleteProject(id);
  }
  // IDB path: delete each sprite record from SPRITES_STORE before purging
  // the index entries and the project row, so no orphaned blobs remain.
  const orphans = readSpritesIndex().filter((s) => s.projectId === id);
  await Promise.all(orphans.map((s) => idbDelete(SPRITES_STORE, s.id)));
  writeSpritesIndex(readSpritesIndex().filter((s) => s.projectId !== id));
  writeProjectsIndex(readProjectsIndex().filter((p) => p.id !== id));
  await idbDelete(PROJECTS_STORE, id);
}
