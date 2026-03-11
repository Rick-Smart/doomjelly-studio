import JSZip from "jszip";
import { supabase, isSupabaseEnabled } from "./supabase.js";

const SCHEMA_VERSION = 2;
const IDB_NAME = "doomjelly-studio";
const IDB_VERSION = 2;
const PROJECTS_STORE = "projects";
const SPRITES_STORE = "sprites";
const PROJECTS_INDEX_KEY = "dj-projects-index-v2";
const SPRITES_INDEX_KEY = "dj-sprites-index-v2";
// Supabase — projects (containers)

async function sbListProjects() {
  const { data, error } = await supabase
    .from("projects_v2")
    .select("id, name, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function sbCreateProject(name) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("projects_v2")
    .insert({ user_id: user.id, name })
    .select("id, name, created_at, updated_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

async function sbRenameProject(id, name) {
  const { error } = await supabase
    .from("projects_v2")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

async function sbDeleteProject(id) {
  const { error } = await supabase.from("projects_v2").delete().eq("id", id);
  if (error) throw error;
}

// Supabase — sprites

async function sbListSprites(projectId) {
  const { data, error } = await supabase
    .from("sprites")
    .select(
      "id, project_id, name, thumbnail, frame_count, anim_count, canvas_w, canvas_h, created_at, updated_at",
    )
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map(sbSpriteRow);
}

async function sbSaveSprite(sprite) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const row = {
    id: sprite.id,
    project_id: sprite.projectId,
    user_id: user.id,
    name: sprite.name,
    body: sprite.body,
    thumbnail: sprite.thumbnail ?? null,
    frame_count: sprite.frameCount ?? 0,
    anim_count: sprite.animCount ?? 0,
    canvas_w: sprite.canvasW ?? 32,
    canvas_h: sprite.canvasH ?? 32,
    updated_at: now,
  };
  const { error } = await supabase.from("sprites").upsert(row);
  if (error) throw error;
  await supabase
    .from("projects_v2")
    .update({ updated_at: now })
    .eq("id", sprite.projectId);
  return sbSpriteRow(row);
}

async function sbLoadSprite(id) {
  const { data, error } = await supabase
    .from("sprites")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return { ...sbSpriteRow(data), body: data.body };
}

async function sbDeleteSprite(id) {
  const { error } = await supabase.from("sprites").delete().eq("id", id);
  if (error) throw error;
}

function sbSpriteRow(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    thumbnail: r.thumbnail ?? null,
    frameCount: r.frame_count ?? 0,
    animCount: r.anim_count ?? 0,
    canvasW: r.canvas_w ?? 32,
    canvasH: r.canvas_h ?? 32,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// IndexedDB helpers

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SPRITES_STORE)) {
        const s = db.createObjectStore(SPRITES_STORE, { keyPath: "id" });
        s.createIndex("by_project", "projectId", { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// localStorage index helpers

function readProjectsIndex() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeProjectsIndex(list) {
  localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(list));
}

function readSpritesIndex() {
  try {
    return JSON.parse(localStorage.getItem(SPRITES_INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeSpritesIndex(list) {
  localStorage.setItem(SPRITES_INDEX_KEY, JSON.stringify(list));
}

// Migrate old single-level localStorage data into the new schema
function migrateLocalIfNeeded() {
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

// Public API — Projects

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

// Public API — Sprites

export async function listSprites(projectId) {
  if (isSupabaseEnabled) return sbListSprites(projectId);
  migrateLocalIfNeeded();
  return readSpritesIndex().filter((s) => s.projectId === projectId);
}

export async function loadSprite(id) {
  if (isSupabaseEnabled) return sbLoadSprite(id);
  const data = await idbGet(SPRITES_STORE, id);
  return data;
}

export async function saveSprite(sprite) {
  if (isSupabaseEnabled) return sbSaveSprite(sprite);
  const now = new Date().toISOString();
  const record = { ...sprite, updatedAt: now };
  await idbPut(SPRITES_STORE, record);

  const index = readSpritesIndex();
  const { body: _body, ...meta } = record;
  const i = index.findIndex((s) => s.id === sprite.id);
  if (i >= 0) {
    index[i] = { ...index[i], ...meta };
  } else {
    index.unshift(meta);
  }
  writeSpritesIndex(index);

  const projects = readProjectsIndex();
  const pi = projects.findIndex((p) => p.id === sprite.projectId);
  if (pi >= 0) {
    projects[pi] = { ...projects[pi], updatedAt: now };
    writeProjectsIndex(projects);
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

// Serialise / deserialise

export function serialiseSprite(jellySpriteState, meta) {
  return {
    version: SCHEMA_VERSION,
    id: meta.id,
    projectId: meta.projectId,
    name: meta.name,
    savedAt: new Date().toISOString(),
    type: "jelly-sprite",
    jellySpriteState: jellySpriteState ?? null,
  };
}

export function downloadSpriteJson(jellySpriteState, meta) {
  const data = serialiseSprite(jellySpriteState, meta);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = data.name.replace(/[^a-z0-9_-]/gi, "_") + ".sprite.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return data;
}

export function pickAndLoadSpriteFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.sprite.json,.doomjelly.json";
    input.onchange = () => {
      const file = input.files?.[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    };
    input.style.display = "none";
    document.body.appendChild(input);
    input.click();
    setTimeout(() => document.body.removeChild(input), 1000);
  });
}

// Legacy shims — keep existing callers working
export async function loadProjectFromStorage(id) {
  return loadSprite(id);
}
export async function saveProjectToStorage(data, thumbnail) {
  return saveSprite({ ...data, body: data, thumbnail });
}
export async function deleteProjectFromStorage(id) {
  return deleteSprite(id);
}
export function serialiseProject(state, jellySpriteState) {
  return serialiseSprite(jellySpriteState, {
    id: state.id,
    projectId: null,
    name: state.name,
  });
}
export function downloadProject(state) {
  return downloadSpriteJson(null, {
    id: state.id,
    projectId: null,
    name: state.name,
  });
}
