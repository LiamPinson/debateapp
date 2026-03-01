// ============================================================
// Rate Limiting
// ============================================================
// Uses a Postgres-backed rate limit table so it works across
// Vercel serverless instances. Each check is atomic via an
// SQL function that counts recent attempts and records the new one.
// ============================================================

import { createServiceClient } from "./supabase.js";

/**
 * Check if a request is allowed under the rate limit.
 *
 * @param {string} key - Unique key for this limit (e.g. "login:user@email.com")
 * @param {number} windowSeconds - Sliding window size in seconds
 * @param {number} maxAttempts - Maximum attempts allowed in the window
 * @returns {Promise<boolean>} true if allowed, false if rate-limited
 */
export async function checkRateLimit(key, windowSeconds, maxAttempts) {
  try {
    const db = createServiceClient();
    const { data, error } = await db.rpc("check_rate_limit", {
      p_key: key,
      p_window_seconds: windowSeconds,
      p_max_attempts: maxAttempts,
    });

    if (error) {
      // On error, allow the request (fail open) to avoid blocking users
      // if the rate_limits table doesn't exist yet
      console.error("Rate limit check failed:", error.message);
      return true;
    }

    return data === true;
  } catch {
    // Fail open
    return true;
  }
}

/**
 * Extract client IP from request headers (Vercel / reverse proxy).
 */
export function getClientIP(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
