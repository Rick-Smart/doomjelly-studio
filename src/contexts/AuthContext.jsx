import { createContext, useContext, useEffect, useState } from "react";
import { supabase, isSupabaseEnabled } from "../services/supabase.js";

const DEV_USER = {
  id: "dev-user",
  email: "dev@doomjelly.local",
  name: "Dev User",
};

function sessionToUser(session) {
  if (!session?.user) return null;
  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    name: u.user_metadata?.name ?? u.email.split("@")[0],
  };
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const bypass = import.meta.env.VITE_AUTH_BYPASS === "true";

  const [user, setUser] = useState(bypass ? DEV_USER : null);
  // Start in loading state when Supabase is active so we restore the session
  // before rendering protected routes.
  const [loading, setLoading] = useState(isSupabaseEnabled && !bypass);
  const [error, setError] = useState(null);

  // Restore existing Supabase session on mount and listen for auth changes.
  useEffect(() => {
    if (!isSupabaseEnabled || bypass) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(sessionToUser(session));
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(sessionToUser(session));
    });

    return () => subscription.unsubscribe();
  }, [bypass]);

  async function login(email, password) {
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseEnabled) {
        const { error: sbError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (sbError) throw sbError;
        // user state is updated via onAuthStateChange
      } else {
        if (!email || !password)
          throw new Error("Email and password are required");
        setUser({ id: "user-stub", email, name: email.split("@")[0] });
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    if (isSupabaseEnabled) {
      await supabase.auth.signOut();
      // user state cleared via onAuthStateChange
    } else {
      setUser(null);
    }
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
