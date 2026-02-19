import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { randomBytes, createHash } from "crypto";

/**
 * POST /api/auth/oauth
 * { accessToken }
 * Verifies a Supabase OAuth access token, finds or creates a user row,
 * creates a session token, and returns { user, sessionToken }.
 */
export async function POST(request) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: "accessToken required" }, { status: 400 });
    }

    const db = createServiceClient();

    // Verify the access token with Supabase
    const { data: { user: supabaseUser }, error: authError } = await db.auth.getUser(accessToken);

    if (authError || !supabaseUser) {
      return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
    }

    // Look up existing user row by auth_id
    const { data: existingUser } = await db
      .from("users")
      .select("id, username, email, rank_tier, quality_score_avg, wins, losses, draws, total_debates")
      .eq("auth_id", supabaseUser.id)
      .single();

    let user = existingUser;

    if (!user) {
      // First Google login — auto-generate username from full name or email prefix
      const fullName = supabaseUser.user_metadata?.full_name || "";
      const emailPrefix = supabaseUser.email?.split("@")[0] || "user";
      let base = (fullName || emailPrefix)
        .replace(/[^a-zA-Z0-9_]/g, "")
        .slice(0, 24);
      if (base.length < 3) base = base.padEnd(3, "0");

      // Check if username is taken
      const { data: taken } = await db
        .from("users")
        .select("id")
        .eq("username", base)
        .limit(1);

      let username = base;
      if (taken && taken.length > 0) {
        const suffix = Math.floor(1000 + Math.random() * 9000);
        username = base.slice(0, 20) + suffix;
      }

      const { data: newUser, error: insertError } = await db
        .from("users")
        .insert({
          auth_id: supabaseUser.id,
          username,
          email: supabaseUser.email,
          quality_score_avg: 50,
          rank_tier: "Bronze",
        })
        .select("id, username, email, rank_tier, quality_score_avg, wins, losses, draws, total_debates")
        .single();

      if (insertError) {
        console.error("User creation failed:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      user = newUser;
    }

    // Generate session token
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
    console.error("OAuth route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
