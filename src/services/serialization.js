const SCHEMA_VERSION = 2;

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
