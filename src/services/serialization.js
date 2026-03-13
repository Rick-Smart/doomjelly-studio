const SCHEMA_VERSION = 2;

export function serialiseSprite(jellyBody, meta) {
  return {
    version: SCHEMA_VERSION,
    id: meta.id,
    projectId: meta.projectId,
    name: meta.name,
    savedAt: new Date().toISOString(),
    type: "jelly-sprite",
    jellyBody: jellyBody ?? null,
  };
}

export function downloadSpriteJson(jellyBody, meta) {
  const data = serialiseSprite(jellyBody, meta);
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

    let settled = false;
    let focusTimer = null;

    function settle(fn) {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onWindowFocus);
      clearTimeout(focusTimer);
      if (input.parentNode) document.body.removeChild(input);
      fn();
    }

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        settle(() => resolve(null));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          settle(() => resolve(JSON.parse(e.target.result)));
        } catch (err) {
          settle(() => reject(err));
        }
      };
      reader.onerror = () =>
        settle(() => reject(new Error("Failed to read file")));
      reader.readAsText(file);
    };

    // When the file dialog closes (cancel or confirm) the browser returns focus
    // to the window. If change hasn't fired after a short debounce, the user
    // cancelled — resolve with null so callers don't hang forever.
    function onWindowFocus() {
      focusTimer = setTimeout(() => settle(() => resolve(null)), 300);
    }

    input.style.display = "none";
    document.body.appendChild(input);
    window.addEventListener("focus", onWindowFocus, { once: true });
    input.click();
  });
}
