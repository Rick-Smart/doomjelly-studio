import { useCallback } from "react";
import { useProject } from "../../../contexts/ProjectContext";
import { FileDropZone } from "../../../ui/FileDropZone";
import { Button } from "../../../ui/Button";
import "./SpriteImporter.css";

function calcCellCount(imgW, imgH, config) {
  const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } = config;
  if (!frameW || !frameH) return { cols: 0, rows: 0, total: 0 };
  const usableW = imgW - offsetX;
  const usableH = imgH - offsetY;
  const cols = Math.floor((usableW + gutterX) / (frameW + gutterX));
  const rows = Math.floor((usableH + gutterY) / (frameH + gutterY));
  return {
    cols: Math.max(0, cols),
    rows: Math.max(0, rows),
    total: Math.max(0, cols * rows),
  };
}

export function SpriteImporter({ onSheetLoaded }) {
  const { state, dispatch } = useProject();
  const { spriteSheet, frameConfig } = state;

  const handleFile = useCallback(
    (file) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        dispatch({
          type: "SET_SPRITE_SHEET",
          payload: {
            objectUrl: url,
            filename: file.name,
            width: img.naturalWidth,
            height: img.naturalHeight,
          },
        });
        onSheetLoaded?.(url, img.naturalWidth, img.naturalHeight);
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    },
    [dispatch, onSheetLoaded],
  );

  const handleReplace = useCallback(() => {
    // Revoke old object URL before replacing
    if (spriteSheet?.objectUrl) URL.revokeObjectURL(spriteSheet.objectUrl);
    dispatch({ type: "SET_SPRITE_SHEET", payload: null });
  }, [spriteSheet, dispatch]);

  const cells = spriteSheet
    ? calcCellCount(spriteSheet.width, spriteSheet.height, frameConfig)
    : null;

  return (
    <div className="sprite-importer">
      <div className="panel-heading">Sprite Sheet</div>

      {!spriteSheet ? (
        <FileDropZone
          accept="image/png"
          onFile={handleFile}
          label="Drop a PNG here"
          hint="or click to browse"
        />
      ) : (
        <div className="sprite-importer__loaded">
          <div className="sprite-importer__preview-wrap">
            <img
              className="sprite-importer__preview"
              src={spriteSheet.objectUrl}
              alt={spriteSheet.filename}
            />
          </div>
          <div className="sprite-importer__meta">
            <span
              className="sprite-importer__filename"
              title={spriteSheet.filename}
            >
              {spriteSheet.filename}
            </span>
            <span className="sprite-importer__dims">
              {spriteSheet.width} × {spriteSheet.height} px
            </span>
            {cells && (
              <span className="sprite-importer__cells">
                {cells.cols} × {cells.rows} = {cells.total} cells
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleReplace}>
            Replace sheet
          </Button>
        </div>
      )}
    </div>
  );
}
