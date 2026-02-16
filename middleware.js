import { NextResponse } from "next/server";

// Routes that don't require session validation
const PUBLIC_ROUTES = ["/api/auth/session", "/api/auth/register"];

// Routes that require admin auth
const ADMIN_ROUTES = ["/api/scoring/trigger"];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Skip for public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Skip validation for GET requests
  if (request.method === "GET") {
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

  // For mutating requests, verify session token exists
  const sessionToken =
    request.cookies.get("debate_session")?.value ||
    request.headers.get("x-session-token");

  if (!sessionToken) {
    // Don't block — the API route itself will validate
    // This is a minimal beta check
    return NextResponse.next();
  }

  // Pass session token as header for API routes to consume
  const response = NextResponse.next();
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
