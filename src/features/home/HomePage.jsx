import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../../contexts/ProjectContext";
import {
  listProjects,
  loadProjectFromStorage,
} from "../../services/projectService";
import "./HomePage.css";

const MAX_RECENT = 5;

const fmt = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function HomePage() {
  const { state, dispatch } = useProject();
  const navigate = useNavigate();
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    listProjects().then((projects) => {
      setRecent(
        [...projects]
          .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
          .slice(0, MAX_RECENT),
      );
    });
  }, []);

  async function handleOpen(id) {
    const data = await loadProjectFromStorage(id);
    dispatch({ type: "LOAD_PROJECT", payload: data });
    navigate("/editor");
  }

  function handleNew() {
    dispatch({ type: "RESET_PROJECT" });
    navigate("/editor");
  }

  return (
    <div className="home">
      {/* ── Hero ── */}
      <div className="home-hero">
        <div className="home-hero__logo" aria-hidden="true">
          🪼
        </div>
        <h1 className="home-hero__title">DoomJelly Studio</h1>
        <p className="home-hero__sub">Sprite sheet animation editor</p>
        <div className="home-hero__ctas">
          <button
            className="home-btn home-btn--primary"
            onClick={() => navigate("/editor")}
          >
            Open Editor
          </button>
          <button className="home-btn" onClick={handleNew}>
            New Project
          </button>
        </div>
      </div>

      {/* ── Recent projects ── */}
      {recent.length > 0 && (
        <div className="home-recent">
          <div className="home-recent__header">
            <span className="home-recent__heading">Recent</span>
            <button
              className="home-recent__all"
              onClick={() => navigate("/projects")}
            >
              All projects →
            </button>
          </div>
          <div className="home-recent__list">
            {recent.map((p) => (
              <button
                key={p.id}
                className="home-recent__card"
                onClick={() => handleOpen(p.id)}
              >
                {p.thumbnail ? (
                  <img
                    className="home-recent__thumb"
                    src={p.thumbnail}
                    alt=""
                    aria-hidden="true"
                  />
                ) : (
                  <div className="home-recent__thumb home-recent__thumb--placeholder">
                    🪼
                  </div>
                )}
                <div className="home-recent__info">
                  <span className="home-recent__name">{p.name}</span>
                  <span className="home-recent__meta">
                    {p.animCount != null
                      ? `${p.animCount} anim${p.animCount !== 1 ? "s" : ""} · ${p.frameCount} frame${p.frameCount !== 1 ? "s" : ""}`
                      : fmt(p.savedAt)}
                  </span>
                </div>
                <span className="home-recent__arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty welcome ── */}
      {recent.length === 0 && (
        <div className="home-welcome">
          <p className="home-welcome__text">
            No saved projects yet — create one to get started.
          </p>
        </div>
      )}
    </div>
  );
}
