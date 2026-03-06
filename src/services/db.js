/**
 * Database service — localStorage stub.
 *
 * All methods return Promises to match the async Supabase API shape.
 * To migrate: replace internals with supabase.from('projects')... calls.
 * The rest of the app never changes.
 */

const INDEX_KEY = "dj-projects-index";

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeIndex(projects) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(projects));
}

export async function getProjects() {
  return readIndex();
}

export async function saveProject(project) {
  const index = readIndex();
  const id = project.id ?? crypto.randomUUID();
  const entry = {
    id,
    name: project.name,
    updatedAt: new Date().toISOString(),
  };

  const i = index.findIndex((p) => p.id === id);
  if (i >= 0) {
    index[i] = entry;
  } else {
    index.push(entry);
  }

  writeIndex(index);
  localStorage.setItem(`dj-project-${id}`, JSON.stringify({ ...project, id }));
  return entry;
}

export async function loadProject(id) {
  const raw = localStorage.getItem(`dj-project-${id}`);
  if (!raw) throw new Error(`Project "${id}" not found`);
  return JSON.parse(raw);
}

export async function deleteProject(id) {
  writeIndex(readIndex().filter((p) => p.id !== id));
  localStorage.removeItem(`dj-project-${id}`);
}
