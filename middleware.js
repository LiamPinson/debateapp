import { NextResponse } from "next/server";

// Routes that don't require session validation (unauthenticated callers OK)
const PUBLIC_ROUTES = [
  "/api/auth/session",   // Creates anonymous sessions
  "/api/auth/register",  // Registration (may include existing sessionId)
  "/api/auth/login",     // Login (returns new session token)
  "/api/auth/logout",    // Logout (clears HttpOnly session cookie)
  "/api/auth/oauth",     // OAuth callback
];

// Routes that require admin auth (bearer token)
const ADMIN_ROUTES = ["/api/scoring/trigger"];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Skip validation for GET requests (read-only)
  if (request.method === "GET") {
    return NextResponse.next();
  }

  // Skip for public routes (auth endpoints that don't need a token yet)
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Admin routes: check bearer token
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    const adminSecret = process.env.ADMIN_SECRET;
    if (adminSecret) {
      const auth = request.headers.get("authorization");
      if (auth !== `Bearer ${adminSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    return NextResponse.next();
  }

  // For all other mutating requests, require a session token.
  // The token proves the caller went through the auth flow.
  // Individual API routes resolve the full identity via resolveCallerIdentity().
  const sessionToken =
    request.cookies.get("debate_session")?.value ||
    request.headers.get("x-session-token");

  if (!sessionToken) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
