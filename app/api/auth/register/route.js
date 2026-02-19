import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * POST /api/auth/register
 * Register a new user. Migrates session data if transitioning from guest.
 *
 * Body: { username, email, sessionId? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, email, password, sessionId } = body;

    if (!username || !email || !password) {
      return NextResponse.json({ error: "username, email, and password required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Validate username
    if (username.length < 3 || username.length > 24) {
      return NextResponse.json({ error: "Username must be 3-24 characters" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: "Username can only contain letters, numbers, and underscores" }, { status: 400 });
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

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        quality_score: user.quality_score_avg,
        rank_tier: user.rank_tier,
        total_debates: user.total_debates,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
      },
      auth_id: authData.user.id,
    });
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
