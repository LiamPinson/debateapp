import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { randomBytes, createHash } from "crypto";

/**
 * POST /api/auth/login
 * { email, password }
 * → signInWithPassword → look up user row → create session token → return { user, sessionToken }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "email and password required" }, { status: 400 });
    }

    const db = createServiceClient();

    const { data: authData, error: authError } = await db.auth.signInWithPassword({ email, password });

    if (authError) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // Look up user record
    const { data: user, error: userError } = await db
      .from("users")
      .select("id, username, email, rank_tier, quality_score_avg, wins, losses, draws, total_debates")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    // Generate a session token so the client can persist the login
    const sessionToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(sessionToken).digest("hex");

    await db.from("sessions").insert({ token_hash: tokenHash });

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
      sessionToken,
    });
  } catch (err) {
    console.error("Login route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
