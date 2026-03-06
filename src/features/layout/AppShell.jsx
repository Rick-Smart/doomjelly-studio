import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import './AppShell.css'

const NAV_ITEMS = [
  { to: '/editor',   label: 'Editor' },
  { to: '/projects', label: 'Projects' },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const { theme, setTheme, themes } = useTheme()

  return (
    <div className="shell">
      <header className="shell-header">
        <span className="shell-logo" aria-hidden="true">🪼</span>
        <span className="shell-title">DoomJelly Studio</span>

        <nav className="shell-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `shell-nav-link${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="shell-header-end">
          <select
            className="theme-select"
            value={theme}
            onChange={e => setTheme(e.target.value)}
            title="Switch theme"
            aria-label="Select theme"
          >
            {themes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

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
  )
}
