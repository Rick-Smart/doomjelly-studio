import { useState, useMemo } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { Modal } from "../../../ui/Modal";
import { EXPORT_FORMATS } from "../../../services/exportService";
import "./ExportPanel.css";

/**
 * Export modal — triggered from the Editor toolbar.
 * Props: isOpen bool, onClose fn
 */
export function ExportPanel({ isOpen, onClose }) {
  const { state } = useProject();
  const {
    animations,
    activeAnimationId,
    frameConfig,
    name: projectName,
  } = state;

  const [formatId, setFormatId] = useState("generic");
  const [target, setTarget] = useState("active");
  const [copied, setCopied] = useState(false);

  const activeAnim = animations.find((a) => a.id === activeAnimationId);
  const format = EXPORT_FORMATS.find((f) => f.id === formatId);

  const generated = useMemo(() => {
    if (!format || animations.length === 0) return null;
    try {
      return format.generate(animations, frameConfig, {
        target,
        activeAnimationId,
      });
    } catch {
      return null;
    }
  }, [format, animations, frameConfig, target, activeAnimationId]);

  const preview = useMemo(() => {
    if (!generated || !format) return "";
    return format.serialize
      ? format.serialize(generated)
      : JSON.stringify(generated, null, 2);
  }, [generated, format]);

  async function handleCopy() {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDownload() {
    if (!generated || !format) return;
    const suffix =
      target === "active" ? (activeAnim?.name ?? "animation") : "all";
    const ext = format.ext ?? "json";
    const filename = `${projectName.replace(/[^a-z0-9_\-]/gi, "_")}_${suffix}_${format.id}.${ext}`;
    const text = format.serialize
      ? format.serialize(generated)
      : JSON.stringify(generated, null, 2);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Animations"
      width={620}
    >
      <div className="export-panel">
        {/* ── Options row ── */}
        <div className="export-panel__options">
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
                disabled={animations.length === 0}
              >
                All animations ({animations.length})
              </button>
            </div>
          </div>
        </div>

        {/* ── JSON preview ── */}
        <div className="export-panel__preview-wrap">
          <pre className="export-panel__preview">
            {preview || "// No animations to export"}
          </pre>
        </div>

        {/* ── Actions ── */}
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
            onClick={handleDownload}
            disabled={!generated}
          >
            Download .{format?.ext ?? "json"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
