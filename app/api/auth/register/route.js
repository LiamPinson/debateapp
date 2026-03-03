import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { setSessionCookie } from "@/lib/auth";
import { randomBytes, createHash } from "crypto";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { RegisterSchema, validate } from "@/lib/schemas";

/**
 * POST /api/auth/register
 * Register a new user. Migrates session data if transitioning from guest.
 *
 * Body: { username, email, password, sessionId? }
 */
export async function POST(request) {
  try {
    const { data: body, error: validationError } = await validate(request, RegisterSchema);
    if (validationError) return validationError;

    const { username, email, password, sessionId } = body;

    // Rate limit: 3 registrations per IP per hour
    const ip = getClientIP(request);
    const allowed = await checkRateLimit(`register_ip:${ip}`, 3600, 3);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    const db = createServiceClient();

    // Check username uniqueness
    const { data: existing } = await db
      .from("users")
      .select("id")
      .eq("username", username)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    // Create Supabase auth user
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email verification for MVP
      user_metadata: { username },
    });

    if (authError) {
      console.error("Auth creation failed:", authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Migrate session data if provided
    let migratedStrikes = 0;
    let migratedDebates = 0;
    if (sessionId) {
      const { data: session } = await db
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (session) {
        migratedStrikes = session.strike_count || 0;
        migratedDebates = session.debate_count || 0;
      }
    }

    // Create user record
    const { data: user, error: userError } = await db
      .from("users")
      .insert({
        auth_id: authData.user.id,
        username,
        email,
        session_id: sessionId || null,
        total_debates: migratedDebates,
        strike_count: migratedStrikes,
        quality_score_avg: 50,
        rank_tier: "Bronze",
      })
      .select()
      .single();

    if (userError) {
      console.error("User creation failed:", userError);
      // Clean up auth user
      await db.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // Link the existing session to the new user so the server can
    // resolve caller identity from the session token.
    if (sessionId) {
      await db
        .from("sessions")
        .update({ user_id: user.id })
        .eq("id", sessionId);
    }

    // Migrate debate ownership from session to user
    if (sessionId) {
      await db
        .from("debates")
        .update({ pro_user_id: user.id })
        .eq("pro_session_id", sessionId);

      await db
        .from("debates")
        .update({ con_user_id: user.id })
        .eq("con_session_id", sessionId);

      // Migrate strikes
      await db
        .from("strikes")
        .update({ user_id: user.id })
        .eq("session_id", sessionId);
    }

    // Create a session token so the newly registered user is immediately
    // authenticated via HttpOnly cookie (no localStorage round-trip).
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
        points_balance: user.points_balance ?? 0,
      },
      auth_id: authData.user.id,
    });
    return setSessionCookie(res, sessionToken);
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
