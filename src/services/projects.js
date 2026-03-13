import { isSupabaseEnabled } from "./supabase.js";
import { idbPut, idbDelete, PROJECTS_STORE } from "./idb.js";
import {
  sbListProjects,
  sbCreateProject,
  sbRenameProject,
  sbDeleteProject,
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
  if (isSupabaseEnabled) return sbDeleteProject(id);
  writeProjectsIndex(readProjectsIndex().filter((p) => p.id !== id));
  await idbDelete(PROJECTS_STORE, id);
  writeSpritesIndex(readSpritesIndex().filter((s) => s.projectId !== id));
}
