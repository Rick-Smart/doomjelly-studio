import { createContext, useContext, useState } from "react";

/**
 * Auth context with dev bypass support.
 *
 * Set VITE_AUTH_BYPASS=true in .env.development to skip login during dev.
 * When wiring a real provider (e.g. Supabase), replace only the internals
 * of login() and logout() — the context shape stays the same.
 */

const DEV_USER = {
  id: "dev-user",
  email: "dev@doomjelly.local",
  name: "Dev User",
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const bypass = import.meta.env.VITE_AUTH_BYPASS === "true";
  const [user, setUser] = useState(bypass ? DEV_USER : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function login(email, password) {
    setLoading(true);
    setError(null);
    try {
      // TODO: replace with supabase.auth.signInWithPassword({ email, password })
      if (!email || !password)
        throw new Error("Email and password are required");
      setUser({ id: "user-stub", email, name: email.split("@")[0] });
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    // TODO: replace with supabase.auth.signOut()
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
