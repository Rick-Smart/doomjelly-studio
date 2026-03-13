import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { THEMES } from "../contexts/ThemeContext";
import { useDocumentStore } from "../contexts/useDocumentStore.js";
import "./AppShell.css";

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const { id: stateId } = useDocumentStore();

  const NAV_ITEMS = [
    {
      to: stateId ? `/jelly-sprite/${stateId}` : "/jelly-sprite",
      label: "Jelly Sprite",
      base: "/jelly-sprite",
    },
    {
      to: stateId ? `/animator/${stateId}` : "/animator",
      label: "Animator",
      base: "/animator",
    },
    { to: "/projects", label: "Projects", base: "/projects" },
    { to: "/settings", label: "Settings", base: "/settings" },
  ];

  return (
    <div className="shell">
      <header className="shell-header">
        <NavLink
          to="/projects"
          className="shell-logo-link"
          aria-label="Projects"
        >
          <span className="shell-logo" aria-hidden="true">
            🪼
          </span>
          <span className="shell-title">DoomJelly Studio</span>
        </NavLink>

        <nav className="shell-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, label, base }) => (
            <NavLink
              key={base}
              to={to}
              className={({ isActive }) =>
                `shell-nav-link${isActive ? " active" : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="shell-header-end">
          <div className="theme-swatches" aria-label="Select theme">
            {Object.entries(THEMES).map(([id, def]) => (
              <button
                key={id}
                className={`theme-swatch${theme === id ? " theme-swatch--active" : ""}`}
                style={{ "--swatch-color": def.swatch }}
                onClick={() => setTheme(id)}
                title={def.label}
                aria-label={`${def.label} theme${theme === id ? " (active)" : ""}`}
              />
            ))}
          </div>

          <span className="shell-user" title={user?.email}>
            {user?.name ?? user?.email}
          </span>

          <button className="shell-signout" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
