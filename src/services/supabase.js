import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
// Support both the new publishable key name and the legacy anon key name.
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Supabase client singleton.
 * Will be 
ull` when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set,
 * which keeps the app fully functional in offline / local-dev mode.
 */
export const supabase = url && key ? createClient(url, key) : null;

/**
 * True when Supabase env vars are present AND auth bypass is not active.
 * Used by projectService and AuthContext to decide which backend to use.
 * VITE_AUTH_BYPASS=true forces the app into local-only (IndexedDB) mode even
 * if Supabase is configured — this keeps local dev clean without real auth.
 */
export const isSupabaseEnabled =
  !!supabase && import.meta.env.VITE_AUTH_BYPASS !== "true";
