import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { setSessionCookie } from "@/lib/auth";
import { randomBytes, createHash } from "crypto";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { LoginSchema, validate } from "@/lib/schemas";

/**
 * POST /api/auth/login
 * { email, password }
 * → signInWithPassword → look up user row → create session → return { user } + HttpOnly cookie
 */
export async function POST(request) {
  try {
    const { data: body, error: validationError } = await validate(request, LoginSchema);
    if (validationError) return validationError;

    const { email, password } = body;

    // Rate limit: 5 attempts per email per 15 minutes
    const emailAllowed = await checkRateLimit(`login:${email.toLowerCase()}`, 900, 5);
    if (!emailAllowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    // Rate limit: 20 attempts per IP per 15 minutes
    const ip = getClientIP(request);
    const ipAllowed = await checkRateLimit(`login_ip:${ip}`, 900, 20);
    if (!ipAllowed) {
      return NextResponse.json(
        { error: "Too many login attempts from this network. Please try again later." },
        { status: 429 }
      );
    }

    const db = createServiceClient();

    const { data: authData, error: authError } = await db.auth.signInWithPassword({ email, password });

    if (authError) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // Look up user record
    const { data: user, error: userError } = await db
      .from("users")
      .select("id, username, email, rank_tier, quality_score_avg, wins, losses, draws, total_debates, is_admin")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    // Generate a session token so the client can persist the login.
    // Link it to the user so the server can resolve caller identity.
    const sessionToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(sessionToken).digest("hex");

    await db.from("sessions").insert({ token_hash: tokenHash, user_id: user.id });

    const res = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        quality_score: user.quality_score_avg,
        rank_tier: user.rank_tier,
        total_debates: user.total_debates,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        isAdmin: user.is_admin || false,
      },
    });
    return setSessionCookie(res, sessionToken);
  } catch (err) {
    console.error("Login route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
