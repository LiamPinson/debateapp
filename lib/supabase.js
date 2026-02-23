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

// ── Client-side Supabase (singleton) ─────────────────────────
// Reuses a single client across all hooks and components so there
// is only ONE GoTrueClient and ONE realtime WebSocket connection.
//
// persistSession: false   → no stale-session-refresh fetch errors
// autoRefreshToken: false → no periodic token refresh (app uses
//                           its own session system, not Supabase auth)
let _browserClient = null;

export function createBrowserClient() {
  if (_browserClient) return _browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
  }
  _browserClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _browserClient;
}

// ── OAuth client (non-singleton) ─────────────────────────────
// Used ONLY for Google OAuth login/register and the auth callback.
// Needs persistSession: true so the PKCE code-verifier survives the
// redirect to Google and back.  Created on-demand, never kept alive.
export function createOAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: true },
  });
}
