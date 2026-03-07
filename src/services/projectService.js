/**
 * Project persistence service.
 *
 * Handles:
 *  - Serialising / deserialising the .doomjelly.json format
 *  - Downloading a project as a file
 *  - Loading a project from a user-selected file
 *  - localStorage index (list, save-entry, delete-entry)
 *
 * Schema v1:
 * {
 *   version: 1,
 *   id: string,
 *   name: string,
 *   savedAt: ISO string,
 *   frameConfig: { frameW, frameH, scale, offsetX, offsetY, gutterX, gutterY },
 *   animations: [{ id, name, frames: [{ col, row, ticks, dx, dy }] }]
 * }
 *
 * Sprite sheet is intentionally excluded — binary data; user re-imports it.
 */

const SCHEMA_VERSION = 1;
const INDEX_KEY = "dj-projects-index";

// ── localStorage helpers ──────────────────────────────────────────────────────

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

// ── Serialisation ─────────────────────────────────────────────────────────────

/**
 * Converts ProjectContext state into the portable .doomjelly.json shape.
 * Strips sprite sheet (binary) — only metadata remains.
 */
export function serialiseProject(state) {
  return {
    version: SCHEMA_VERSION,
    id: state.id ?? crypto.randomUUID(),
    name: state.name,
    savedAt: new Date().toISOString(),
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
  };
}

// ── File download ─────────────────────────────────────────────────────────────

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

// ── File load ─────────────────────────────────────────────────────────────────

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
          if (!data.version || !data.animations) {
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

// ── localStorage project list ─────────────────────────────────────────────────

/** Returns the index array of { id, name, savedAt } entries. */
export async function listProjects() {
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
  localStorage.setItem(`dj-project-${data.id}`, JSON.stringify(data));
  return entry;
}

/** Loads a full project from localStorage by id. */
export async function loadProjectFromStorage(id) {
  const raw = localStorage.getItem(`dj-project-${id}`);
  if (!raw) throw new Error(`Project "${id}" not found in storage`);
  return JSON.parse(raw);
}

/** Deletes a project from localStorage and the index. */
export async function deleteProjectFromStorage(id) {
  writeIndex(readIndex().filter((p) => p.id !== id));
  localStorage.removeItem(`dj-project-${id}`);
}

/** Renames a saved project in localStorage and updates the index. */
export async function renameProject(id, name) {
  const data = await loadProjectFromStorage(id);
  const updated = { ...data, name, savedAt: new Date().toISOString() };
  await saveProjectToStorage(updated);
  return updated;
}
