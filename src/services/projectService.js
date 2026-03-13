// Legacy shim imports (used by shim functions below)
import {
  pickAndLoadSpriteFile,
  serialiseSprite,
  downloadSpriteJson,
} from "./serialization.js";
import { loadSprite, saveSprite, deleteSprite } from "./sprites.js";

// Re-export thin barrel — all callers import from here unchanged.
export * from "./projects.js";
export * from "./sprites.js";
export * from "./serialization.js";

// ── Legacy shims (keep old callers working) ──────────────────────────────────
export function pickAndLoadProject() {
  return pickAndLoadSpriteFile();
}
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
    projectId: state.projectId ?? null,
    name: state.name,
  });
}
export function downloadProject(state) {
  return downloadSpriteJson(null, {
    id: state.id,
    projectId: state.projectId ?? null,
    name: state.name,
  });
}
