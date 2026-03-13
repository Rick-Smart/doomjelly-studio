import { useState, useMemo } from "react";
import JSZip from "jszip";
import { useAnimator } from "../../../contexts/AnimatorContext";
import { Modal } from "../../../ui/Modal";
import { EXPORT_FORMATS } from "../../../services/exportService";
import { serialiseProject } from "../../../services/projectService";
import {
  loadImage,
  buildPackedAtlas,
  buildAnimStrips,
  canvasToBlob,
} from "../../../services/imageExportService";
import "./ExportPanel.css";

const EXPORT_TYPES = [
  { id: "json", label: "JSON" },
  { id: "atlas", label: "Packed Atlas" },
  { id: "strips", label: "Animation Strips" },
  { id: "bundle", label: "Export All" },
];

function slugify(str) {
  return str.replace(/[^a-z0-9_\-]/gi, "_");
}

function pickSelected(animations, target, activeAnimationId) {
  if (target === "active")
    return animations.filter((a) => a.id === activeAnimationId);
  return animations;
}

/**
 * Export modal — triggered from the Animator toolbar.
 * Props: isOpen bool, onClose fn
 */
export function ExportPanel({ isOpen, onClose }) {
  const { state } = useAnimator();
  const {
    animations,
    activeAnimationId,
    frameConfig,
    activeSheetId,
    sheets,
    name: projectName,
  } = state;
  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? null;

  const [exportType, setExportType] = useState("json");
  const [formatId, setFormatId] = useState("generic");
  const [target, setTarget] = useState("active");
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const activeAnim = animations.find((a) => a.id === activeAnimationId);
  const format = EXPORT_FORMATS.find((f) => f.id === formatId);
  const hasImage = !!activeSheet?.objectUrl;
  const hasAnims = animations.length > 0;

  const selectedAnims = useMemo(
    () => pickSelected(animations, target, activeAnimationId),
    [animations, target, activeAnimationId],
  );

  // JSON preview
  const generated = useMemo(() => {
    if (exportType !== "json" || !format || animations.length === 0)
      return null;
    try {
      return format.generate(animations, frameConfig, {
        target,
        activeAnimationId,
      });
    } catch {
      return null;
    }
  }, [exportType, format, animations, frameConfig, target, activeAnimationId]);

  const preview = useMemo(() => {
    if (!generated || !format) return "";
    return format.serialize
      ? format.serialize(generated)
      : JSON.stringify(generated, null, 2);
  }, [generated, format]);

  // Atlas info (sync, no image load needed)
  const atlasInfo = useMemo(() => {
    if (exportType !== "atlas") return null;
    const { frameW, frameH } = frameConfig;
    const seen = new Set();
    for (const anim of selectedAnims)
      for (const f of anim.frames) seen.add(`${f.col},${f.row}`);
    const count = seen.size;
    if (count === 0) return null;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return { count, cols, rows, w: cols * frameW, h: rows * frameH };
  }, [exportType, selectedAnims, frameConfig]);

  // Strips info (sync)
  const stripsInfo = useMemo(() => {
    if (exportType !== "strips") return null;
    const { frameW, frameH } = frameConfig;
    return selectedAnims
      .filter((a) => a.frames.length > 0)
      .map((anim) => ({
        name: anim.name,
        frameCount: anim.frames.length,
        w: anim.frames.length * frameW,
        h: frameH,
      }));
  }, [exportType, selectedAnims, frameConfig]);

  // Download helpers
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDownloadJSON() {
    if (!generated || !format) return;
    const suffix =
      target === "active" ? (activeAnim?.name ?? "animation") : "all";
    const ext = format.ext ?? "json";
    const filename = `${slugify(projectName)}_${suffix}_${format.id}.${ext}`;
    const text = format.serialize
      ? format.serialize(generated)
      : JSON.stringify(generated, null, 2);
    triggerDownload(new Blob([text], { type: "text/plain" }), filename);
  }

  async function handleDownloadAtlas() {
    if (!activeSheet?.objectUrl) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const img = await loadImage(activeSheet.objectUrl);
      const result = buildPackedAtlas(img, animations, frameConfig, {
        target,
        activeAnimationId,
      });
      if (!result)
        throw new Error(
          "No cells found — add frames to your animations first.",
        );
      const pngBlob = await canvasToBlob(result.canvas);
      const zip = new JSZip();
      zip.file("atlas.png", pngBlob);
      zip.file("atlas.json", JSON.stringify(result.json, null, 2));
      const zipBlob = await zip.generateAsync({ type: "blob" });
      triggerDownload(zipBlob, `${slugify(projectName)}_atlas.zip`);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadStrips() {
    if (!activeSheet?.objectUrl) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const img = await loadImage(activeSheet.objectUrl);
      const strips = buildAnimStrips(img, animations, frameConfig, {
        target,
        activeAnimationId,
      });
      if (!strips.length)
        throw new Error("No animations to export — add frames first.");
      const zip = new JSZip();
      for (const strip of strips) {
        const pngBlob = await canvasToBlob(strip.canvas);
        const safeName = slugify(strip.name);
        zip.file(`${safeName}.png`, pngBlob);
        zip.file(`${safeName}.json`, JSON.stringify(strip.json, null, 2));
      }
      const suffix =
        target === "active" && activeAnim ? slugify(activeAnim.name) : "all";
      const zipBlob = await zip.generateAsync({ type: "blob" });
      triggerDownload(zipBlob, `${slugify(projectName)}_strips_${suffix}.zip`);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadBundle() {
    setIsExporting(true);
    setExportError(null);
    try {
      const zip = new JSZip();

      // Always include the project JSON
      const data = serialiseProject(state);
      zip.file(
        `${slugify(projectName)}.doomjelly.json`,
        JSON.stringify(data, null, 2),
      );

      if (activeSheet?.objectUrl) {
        const img = await loadImage(activeSheet.objectUrl);

        // Packed atlas — all animations
        const atlasResult = buildPackedAtlas(img, animations, frameConfig, {
          target: "all",
        });
        if (atlasResult) {
          const atlasPng = await canvasToBlob(atlasResult.canvas);
          zip.file("atlas/atlas.png", atlasPng);
          zip.file(
            "atlas/atlas.json",
            JSON.stringify(atlasResult.json, null, 2),
          );
        }

        // Animation strips — one per animation
        const strips = buildAnimStrips(img, animations, frameConfig, {
          target: "all",
        });
        for (const strip of strips) {
          const pngBlob = await canvasToBlob(strip.canvas);
          const safeName = slugify(strip.name);
          zip.file(`strips/${safeName}.png`, pngBlob);
          zip.file(
            `strips/${safeName}.json`,
            JSON.stringify(strip.json, null, 2),
          );
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      triggerDownload(zipBlob, `${slugify(projectName)}_bundle.zip`);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setIsExporting(false);
    }
  }

  function switchType(id) {
    setExportType(id);
    setExportError(null);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Animations"
      width={640}
    >
      <div className="export-panel">
        {/* ── Export type tabs ── */}
        <div className="export-panel__type-tabs">
          {EXPORT_TYPES.map((t) => (
            <button
              key={t.id}
              className={`export-panel__type-tab${exportType === t.id ? " export-panel__type-tab--active" : ""}`}
              onClick={() => switchType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Scope — shared across all types (hidden for bundle) ── */}
        {exportType !== "bundle" && (
          <div className="export-panel__option-group">
            <label className="export-panel__label">Scope</label>
            <div className="export-panel__radio-row">
              <button
                className={`export-panel__scope-btn${target === "active" ? " export-panel__scope-btn--active" : ""}`}
                onClick={() => setTarget("active")}
                disabled={!activeAnim}
              >
                Active — {activeAnim?.name ?? "none"}
              </button>
              <button
                className={`export-panel__scope-btn${target === "all" ? " export-panel__scope-btn--active" : ""}`}
                onClick={() => setTarget("all")}
                disabled={!hasAnims}
              >
                All animations ({animations.length})
              </button>
            </div>
          </div>
        )}

        {/* ════════════════ JSON ════════════════ */}
        {exportType === "json" && (
          <>
            <div className="export-panel__option-group">
              <label className="export-panel__label">Format</label>
              <div className="export-panel__radio-row">
                {EXPORT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    className={`export-panel__format-btn${formatId === f.id ? " export-panel__format-btn--active" : ""}`}
                    onClick={() => setFormatId(f.id)}
                  >
                    <span className="export-panel__format-name">{f.label}</span>
                    <span className="export-panel__format-desc">
                      {f.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="export-panel__preview-wrap">
              <pre className="export-panel__preview">
                {preview || "// No animations to export"}
              </pre>
            </div>

            <div className="export-panel__actions">
              <button
                className="export-panel__btn"
                onClick={handleCopy}
                disabled={!generated}
              >
                {copied ? "✓ Copied!" : "Copy to clipboard"}
              </button>
              <button
                className="export-panel__btn export-panel__btn--primary"
                onClick={handleDownloadJSON}
                disabled={!generated}
              >
                Download .{format?.ext ?? "json"}
              </button>
            </div>
          </>
        )}

        {/* ════════════════ PACKED ATLAS ════════════════ */}
        {exportType === "atlas" && (
          <>
            {!hasImage ? (
              <div className="export-panel__image-notice">
                Re-import your sprite sheet to enable image export.
                <br />
                <span className="export-panel__image-notice-sub">
                  The image file is not persisted on page refresh — re-import
                  the PNG to continue.
                </span>
              </div>
            ) : atlasInfo ? (
              <div className="export-panel__image-info">
                <div className="export-panel__image-info-row">
                  <span className="export-panel__image-info-stat">
                    {atlasInfo.count} unique{" "}
                    {atlasInfo.count === 1 ? "cell" : "cells"} packed into a{" "}
                    {atlasInfo.cols}×{atlasInfo.rows} grid
                  </span>
                </div>
                <div className="export-panel__image-info-row export-panel__image-info-row--dim">
                  <span>atlas.png</span>
                  <span>
                    {atlasInfo.w}×{atlasInfo.h}px
                  </span>
                  <span>atlas.json</span>
                </div>
              </div>
            ) : (
              <div className="export-panel__image-notice">
                No frames found — add frames to your animations and try again.
              </div>
            )}

            {exportError && (
              <div className="export-panel__error">{exportError}</div>
            )}

            <div className="export-panel__actions">
              <button
                className="export-panel__btn export-panel__btn--primary"
                onClick={handleDownloadAtlas}
                disabled={!hasImage || !atlasInfo || isExporting}
              >
                {isExporting ? "Building…" : "Export Atlas .zip"}
              </button>
            </div>
          </>
        )}

        {/* ════════════════ ANIMATION STRIPS ════════════════ */}
        {exportType === "strips" && (
          <>
            {!hasImage ? (
              <div className="export-panel__image-notice">
                Re-import your sprite sheet to enable image export.
                <br />
                <span className="export-panel__image-notice-sub">
                  The image file is not persisted on page refresh — re-import
                  the PNG to continue.
                </span>
              </div>
            ) : stripsInfo && stripsInfo.length > 0 ? (
              <div className="export-panel__image-info">
                <div className="export-panel__image-info-row">
                  <span className="export-panel__image-info-stat">
                    {stripsInfo.length}{" "}
                    {stripsInfo.length === 1 ? "strip" : "strips"}
                  </span>
                </div>
                <div className="export-panel__strips-list">
                  {stripsInfo.map((s) => (
                    <div key={s.name} className="export-panel__strip-row">
                      <span className="export-panel__strip-name">
                        {s.name}.png
                      </span>
                      <span className="export-panel__strip-meta">
                        {s.frameCount} {s.frameCount === 1 ? "frame" : "frames"}{" "}
                        · {s.w}×{s.h}px
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="export-panel__image-notice">
                No frames found — add frames to your animations and try again.
              </div>
            )}

            {exportError && (
              <div className="export-panel__error">{exportError}</div>
            )}

            <div className="export-panel__actions">
              <button
                className="export-panel__btn export-panel__btn--primary"
                onClick={handleDownloadStrips}
                disabled={!hasImage || !stripsInfo?.length || isExporting}
              >
                {isExporting ? "Building…" : "Export Strips .zip"}
              </button>
            </div>
          </>
        )}
        {/* ════════════════ EXPORT ALL BUNDLE ════════════════ */}
        {exportType === "bundle" && (
          <>
            <div className="export-panel__image-info">
              <div className="export-panel__image-info-row">
                <span className="export-panel__image-info-stat">
                  Downloads a single .zip with all project files
                </span>
              </div>
              <div className="export-panel__strips-list">
                <div className="export-panel__strip-row">
                  <span className="export-panel__strip-name">
                    {slugify(projectName)}.doomjelly.json
                  </span>
                  <span className="export-panel__strip-meta">Project data</span>
                </div>
                <div
                  className={`export-panel__strip-row${!hasImage ? " export-panel__strip-row--muted" : ""}`}
                >
                  <span className="export-panel__strip-name">
                    atlas/atlas.png + atlas.json
                  </span>
                  <span className="export-panel__strip-meta">
                    {hasImage ? "Packed sprite atlas" : "requires sprite sheet"}
                  </span>
                </div>
                <div
                  className={`export-panel__strip-row${!hasImage ? " export-panel__strip-row--muted" : ""}`}
                >
                  <span className="export-panel__strip-name">
                    strips/{"{name}"}.png + .json × {animations.length}
                  </span>
                  <span className="export-panel__strip-meta">
                    {hasImage
                      ? "Per-animation strips"
                      : "requires sprite sheet"}
                  </span>
                </div>
              </div>
              {!hasImage && (
                <div className="export-panel__image-notice export-panel__image-notice--inline">
                  Re-import your sprite sheet to include image files — the
                  project JSON will still be bundled.
                </div>
              )}
            </div>

            {exportError && (
              <div className="export-panel__error">{exportError}</div>
            )}

            <div className="export-panel__actions">
              <button
                className="export-panel__btn export-panel__btn--primary"
                onClick={handleDownloadBundle}
                disabled={!hasAnims || isExporting}
              >
                {isExporting ? "Building…" : "Download bundle.zip"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
