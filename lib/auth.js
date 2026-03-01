// ============================================================
// Server-side Auth Helpers
// ============================================================
// Resolves the caller's identity from the session token sent
// in the request. Used by API routes to verify authorization.
// ============================================================

import { createHash } from "crypto";
import { createServiceClient } from "./supabase.js";

/**
 * Set the session token as an HttpOnly cookie on the response.
 * SameSite=Lax allows the cookie to be sent on top-level navigations.
 */
export function setSessionCookie(response, token) {
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set("debate_session", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}

/**
 * Clear the session cookie on the response.
 */
export function clearSessionCookie(response) {
  response.cookies.set("debate_session", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}

/**
 * Resolve the caller's identity from the request.
 * Reads the session token from the x-session-token header or
 * debate_session cookie, then looks up the session row.
 *
 * @param {Request} request - The incoming HTTP request
 * @returns {Promise<{ userId: string|null, sessionId: string } | null>}
 *   null if no valid session token found
 */
export async function resolveCallerIdentity(request) {
  // Prefer HttpOnly cookie; fall back to header for legacy clients
  const token =
    request.cookies?.get?.("debate_session")?.value ||
    request.headers.get("x-session-token");

  if (!token) return null;

  const db = createServiceClient();
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: session } = await db
    .from("sessions")
    .select("id, user_id")
    .eq("token_hash", tokenHash)
    .single();

  if (!session) return null;

  return {
    userId: session.user_id || null,
    sessionId: session.id,
  };
}

/**
 * Given a debate record and a caller identity, determine which side
 * the caller is on. Returns 'pro', 'con', or null if not a participant.
 */
export function resolveCallerSide(debate, caller) {
  if (!caller || !debate) return null;

  if (caller.userId) {
    if (debate.pro_user_id === caller.userId) return "pro";
    if (debate.con_user_id === caller.userId) return "con";
  }

  if (caller.sessionId) {
    if (debate.pro_session_id === caller.sessionId) return "pro";
    if (debate.con_session_id === caller.sessionId) return "con";
  }

  return null;
}
