import { supabase, isSupabaseEnabled } from "./supabase.js";

const SCHEMA_VERSION = 2;
const INDEX_KEY = "dj-projects-index";
const IDB_NAME = "doomjelly-studio";
const IDB_STORE = "projects";
const IDB_VERSION = 1;

async function sbList() {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, saved_at, anim_count, frame_count, thumbnail")
    .order("saved_at", { ascending: false });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    savedAt: r.saved_at,
    animCount: r.anim_count,
    frameCount: r.frame_count,
    thumbnail: r.thumbnail,
  }));
}

async function sbSave(data, thumbnail) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Preserve existing thumbnail when caller passes undefined
  let thumb = thumbnail;
  if (thumbnail === undefined) {
    const { data: existing } = await supabase
      .from("projects")
      .select("thumbnail")
      .eq("id", data.id)
      .maybeSingle();
    thumb = existing?.thumbnail ?? null;
  }

  const animCount = Array.isArray(data.animations) ? data.animations.length : 0;
  const frameCount = Array.isArray(data.animations)
    ? data.animations.reduce((s, a) => s + (a.frames?.length ?? 0), 0)
    : 0;

  const row = {
    id: data.id,
    user_id: user.id,
    name: data.name,
    saved_at: data.savedAt,
    anim_count: animCount,
    frame_count: frameCount,
    thumbnail: thumb,
    body: data,
  };

  const { error } = await supabase.from("projects").upsert(row);
  if (error) throw error;

  return {
    id: row.id,
    name: row.name,
    savedAt: row.saved_at,
    animCount: row.anim_count,
    frameCount: row.frame_count,
    thumbnail: row.thumbnail,
  };
}

async function sbLoad(id) {
  const { data, error } = await supabase
    .from("projects")
    .select("body")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data.body;
}

async function sbDelete(id) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// IndexedDB helpers

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(IDB_STORE, { keyPath: "id" });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// localStorage index helpers (small metadata only)

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeIndex(list) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

// Serialisation

/**
 * Converts ProjectContext state + optional JellySprite editor state into the
 * portable .doomjelly.json shape.
 *
 * @param {object} state            - ProjectContext state
 * @param {object|null} [jellySpriteState] - Serialized editor state from
 *   serializeJellySprite() — pass null/undefined to omit
 * @param {string} [type="animator"] - "animator" | "jelly-sprite"
 *   Used by the Projects page to navigate to the right editor on open.
 */
export function serialiseProject(state, jellySpriteState, type = "animator") {
  return {
    version: SCHEMA_VERSION,
    id: state.id ?? crypto.randomUUID(),
    name: state.name,
    savedAt: new Date().toISOString(),
    type,
    frameConfig: { ...state.frameConfig },
    animations: state.animations.map((a) => ({
      id: a.id,
      name: a.name,
      frames: a.frames.map((f) => ({
        col: f.col,
        row: f.row,
        ticks: f.ticks ?? 6,
        dx: f.dx ?? 0,
        dy: f.dy ?? 0,
      })),
    })),
    jellySpriteDataUrl: state.jellySpriteDataUrl ?? null,
    // Full editor state (null when called from contexts that don't have JellySprite)
    jellySpriteState: jellySpriteState ?? null,
  };
}

// File download

/**
 * Triggers a browser download of the project as a .doomjelly.json file.
 * Returns the serialised project object so the caller can update state.
 */
export function downloadProject(state) {
  const data = serialiseProject(state);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.name.replace(/[^a-z0-9_\-]/gi, "_")}.doomjelly.json`;
  a.click();
  URL.revokeObjectURL(url);
  return data;
}

// File load

/**
 * Opens a file picker and resolves with the parsed project object.
 * Rejects if the file is invalid or the user cancels.
 */
export function pickAndLoadProject() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.doomjelly.json";

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error("No file selected"));

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          // Accept v1 (has animations array) and v2 (has jellySpriteState)
          if (!data.version || (!data.animations && !data.jellySpriteState)) {
            throw new Error("Not a valid .doomjelly.json file");
          }
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    };

    // Some browsers need the input mounted briefly
    input.style.display = "none";
    document.body.appendChild(input);
    input.click();
    // Clean up after a tick
    setTimeout(() => document.body.removeChild(input), 1000);
  });
}

// localStorage project list

/** Returns the index array of { id, name, savedAt, animCount, frameCount, thumbnail } entries. */
export async function listProjects() {
  if (isSupabaseEnabled) return sbList();
  return readIndex();
}

/**
 * Saves a full project into localStorage and updates the index.
 * Pass the serialised project object (from serialiseProject).
 *
 * @param {object} data - Serialised project.
 * @param {string|null|undefined} thumbnail - Base64 PNG dataURL for the card
 *   thumbnail. Pass a string to set, null to clear, or undefined to keep the
 *   existing thumbnail (e.g. when the sprite sheet isn't loaded this session).
 */
export async function saveProjectToStorage(data, thumbnail = undefined) {
  if (isSupabaseEnabled) return sbSave(data, thumbnail);

  const index = readIndex();
  const existing = index.find((p) => p.id === data.id);
  const animCount = Array.isArray(data.animations) ? data.animations.length : 0;
  const frameCount = Array.isArray(data.animations)
    ? data.animations.reduce((s, a) => s + (a.frames?.length ?? 0), 0)
    : 0;
  const entry = {
    id: data.id,
    name: data.name,
    savedAt: data.savedAt,
    animCount,
    frameCount,
    thumbnail:
      thumbnail !== undefined ? thumbnail : (existing?.thumbnail ?? null),
  };
  const i = index.findIndex((p) => p.id === data.id);
  if (i >= 0) {
    index[i] = entry;
  } else {
    index.push(entry);
  }
  writeIndex(index);
  await idbPut(data);
  return entry;
}

/** Loads a full project by id. */
export async function loadProjectFromStorage(id) {
  if (isSupabaseEnabled) return sbLoad(id);
  const data = await idbGet(id);
  if (!data) throw new Error(`Project "${id}" not found in storage`);
  return data;
}

/** Deletes a project from storage. */
export async function deleteProjectFromStorage(id) {
  if (isSupabaseEnabled) return sbDelete(id);
  writeIndex(readIndex().filter((p) => p.id !== id));
  await idbDelete(id);
}

/** Renames a saved project in localStorage and updates the index. */
export async function renameProject(id, name) {
  const data = await loadProjectFromStorage(id);
  const updated = { ...data, name, savedAt: new Date().toISOString() };
  await saveProjectToStorage(updated);
  return updated;
}
