import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

/**
 * POST /api/auth/logout
 * Clears the HttpOnly session cookie, effectively logging the user out.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  return clearSessionCookie(res);
}
