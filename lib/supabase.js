import { createClient } from "@supabase/supabase-js";

// Server-side client with service role (bypasses RLS)
// Used in API routes only — never expose to client
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE env vars — check .env.local");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Client-side Supabase (uses anon key, respects RLS)
// Disable Supabase auth token refresh: this app uses a custom session system,
// so there is never a Supabase auth session to refresh. Without this, GoTrue
// repeatedly calls fetch with an undefined token URL, causing
// "TypeError: Failed to execute 'fetch' on 'Window': Invalid value" errors
// that also break the realtime WebSocket connection.
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
