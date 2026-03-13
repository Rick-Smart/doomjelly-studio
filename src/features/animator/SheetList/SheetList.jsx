import { useNavigate } from "react-router-dom";
import { useProject } from "../../../contexts/ProjectContext";
import { sheetGridDims } from "../../../engine/frameUtils";
import "./SheetList.css";

export function SheetList() {
  const { state, dispatch } = useProject();
  const navigate = useNavigate();
  const { sheets, activeSheetId, frameConfig } = state;

  if (!sheets.length) {
    return (
      <div className="sheet-list">
        <div className="panel-heading">Sprite Sheets</div>
        <p className="sheet-list__empty">
          No sheets loaded.{" "}
          <button
            className="sheet-list__link"
            onClick={() => navigate("/projects")}
          >
            Open a sprite from Projects ↗
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="sheet-list">
      <div className="panel-heading">Sprite Sheets</div>
      <ul className="sheet-list__items">
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeSheetId;
          const cfg = sheet.frameConfig ?? frameConfig;
          const { cols, rows } = sheetGridDims(sheet.width, sheet.height, cfg);
          return (
            <li
              key={sheet.id}
              className={`sheet-list__row${isActive ? " sheet-list__row--active" : ""}`}
              onClick={() =>
                !isActive &&
                dispatch({ type: "SET_ACTIVE_SHEET", payload: sheet.id })
              }
              title={isActive ? undefined : "Switch to this sheet"}
            >
              <div className="sheet-list__thumb-wrap">
                {sheet.objectUrl ? (
                  <img
                    className="sheet-list__thumb"
                    src={sheet.objectUrl}
                    alt=""
                    aria-hidden
                  />
                ) : (
                  <span className="sheet-list__thumb-placeholder" aria-hidden>
                    ?
                  </span>
                )}
              </div>
              <div className="sheet-list__info">
                <span className="sheet-list__name" title={sheet.filename}>
                  {sheet.filename}
                </span>
                <span className="sheet-list__dims">
                  {sheet.width} × {sheet.height} px
                  {cols && rows ? ` · ${cols * rows} cells` : ""}
                </span>
                {!sheet.objectUrl && (
                  <span className="sheet-list__stale">
                    re-open from Projects to reload
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
