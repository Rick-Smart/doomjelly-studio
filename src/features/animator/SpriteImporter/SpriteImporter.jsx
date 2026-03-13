import { useCallback, useRef } from "react";
import { useAnimatorStore } from "../../../contexts/useAnimatorStore.js";
import { selectActiveSheet } from "../selectors";
import { FileDropZone } from "../../../ui/FileDropZone";
import "./SpriteImporter.css";

function calcCellCount(imgW, imgH, config) {
  const { frameW, frameH, offsetX, offsetY, gutterX, gutterY } = config;
  if (!frameW || !frameH) return null;
  const cols = Math.max(
    0,
    Math.floor((imgW - offsetX + gutterX) / (frameW + gutterX)),
  );
  const rows = Math.max(
    0,
    Math.floor((imgH - offsetY + gutterY) / (frameH + gutterY)),
  );
  return cols * rows;
}

function loadSheetFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({
        objectUrl: url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bad image"));
    };
    img.src = url;
  });
}

export function SpriteImporter() {
  const { dispatch, ...state } = useAnimatorStore();
  const { sheets, activeSheetId, frameConfig } = state;
  const activeSheet = selectActiveSheet(state);
  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  const dispatchAddSheet = useCallback(
    async (file) => {
      try {
        const { objectUrl, width, height } = await loadSheetFile(file);
        dispatch({
          type: "ADD_SHEET",
          payload: {
            id: crypto.randomUUID(),
            filename: file.name,
            objectUrl,
            width,
            height,
          },
        });
      } catch {}
    },
    [dispatch],
  );

  const dispatchReplaceSheet = useCallback(
    async (file) => {
      try {
        const { objectUrl, width, height } = await loadSheetFile(file);
        if (activeSheet?.objectUrl) URL.revokeObjectURL(activeSheet.objectUrl);
        dispatch({
          type: "SET_SPRITE_SHEET",
          payload: { objectUrl, filename: file.name, width, height },
        });
      } catch {}
    },
    [dispatch, activeSheet],
  );

  // No sheets yet — show drop zone
  if (!sheets.length) {
    return (
      <div className="sprite-importer">
        <div className="panel-heading">Sprite Sheets</div>
        <FileDropZone
          accept="image/png"
          onFile={dispatchAddSheet}
          label="Drop a PNG here"
          hint="or click to browse"
        />
      </div>
    );
  }

  return (
    <div className="sprite-importer">
      <div className="panel-heading si-heading">
        <span>Sprite Sheets</span>
        <button
          className="si-add-btn"
          onClick={() => addInputRef.current?.click()}
          title="Add another sheet"
        >
          + Add
        </button>
      </div>

      <ul className="si-sheet-list">
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheetId;
          const cfg = sheet.frameConfig ?? frameConfig;
          const total = sheet.width
            ? calcCellCount(sheet.width, sheet.height, cfg)
            : null;
          return (
            <li
              key={sheet.id}
              className={`si-row${isActive ? " si-row--active" : ""}`}
              onClick={() =>
                !isActive &&
                dispatch({ type: "SET_ACTIVE_SHEET", payload: sheet.id })
              }
            >
              <div className="si-thumb-wrap">
                {sheet.objectUrl ? (
                  <img
                    className="si-thumb"
                    src={sheet.objectUrl}
                    alt=""
                    aria-hidden
                  />
                ) : (
                  <span className="si-thumb-placeholder" aria-hidden>
                    ?
                  </span>
                )}
              </div>
              <div className="si-info">
                <span className="si-filename" title={sheet.filename}>
                  {sheet.filename}
                </span>
                <span className="si-dims">
                  {sheet.width} × {sheet.height} px
                  {total !== null ? ` · ${total} cells` : ""}
                </span>
                {!sheet.objectUrl && (
                  <span className="si-reimport">re-import required</span>
                )}
              </div>
              <div className="si-actions">
                {isActive && (
                  <button
                    className="si-icon-btn"
                    title="Replace this sheet’s image"
                    onClick={(e) => {
                      e.stopPropagation();
                      replaceInputRef.current?.click();
                    }}
                  >
                    ↻
                  </button>
                )}
                {sheets.length > 1 && (
                  <button
                    className="si-icon-btn si-icon-btn--danger"
                    title="Remove sheet"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: "REMOVE_SHEET", payload: sheet.id });
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <input
        ref={addInputRef}
        type="file"
        accept="image/png"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) dispatchAddSheet(f);
          e.target.value = "";
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/png"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) dispatchReplaceSheet(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
