import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { THEMES } from "../../contexts/ThemeContext";
import "./AppShell.css";

const NAV_ITEMS = [
  { to: "/editor", label: "Workspace" },
  { to: "/projects", label: "Projects" },
  { to: "/settings", label: "Settings" },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, setTheme, themes } = useTheme();

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
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
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
