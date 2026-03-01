import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { setSessionCookie } from "@/lib/auth";
import { randomBytes, createHash } from "crypto";
import { ResetPasswordSchema, validate } from "@/lib/schemas";

/**
 * POST /api/auth/reset-password
 * { token, password }
 * → validate token, password
 * → update password in Supabase auth
 * → delete token
 * → create session token
 * → return { user } + HttpOnly cookie
 */
export async function POST(request) {
  try {
    const { data: body, error: validationError } = await validate(request, ResetPasswordSchema);
    if (validationError) return validationError;

    const { token, password } = body;

    const db = createServiceClient();

    // Validate token exists and not expired
    const { data: resetToken, error: queryError } = await db
      .from("password_reset_tokens")
      .select("user_id, email, expires_at")
      .eq("token", token)
      .single();

    if (queryError || !resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    // Check expiry
    const expiresAt = new Date(resetToken.expires_at);
    if (expiresAt < new Date()) {
      await db.from("password_reset_tokens").delete().eq("token", token);
      return NextResponse.json(
        { error: "Reset link has expired" },
        { status: 400 }
      );
    }

    // Update password in Supabase auth
    const { error: updateError } = await db.auth.admin.updateUserById(resetToken.user_id, {
      password,
    });

    if (updateError) {
      console.error("Failed to update password:", updateError);
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      );
    }

    // Delete the reset token
    await db.from("password_reset_tokens").delete().eq("token", token);

    // Get user data
    const { data: user, error: userError } = await db
      .from("users")
      .select("id, username, email, rank_tier, quality_score_avg, wins, losses, draws, total_debates")
      .eq("id", resetToken.user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Generate session token
    const sessionToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(sessionToken).digest("hex");

    await db.from("sessions").insert({ token_hash: tokenHash, user_id: user.id });

    const res = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        quality_score: user.quality_score_avg,
        rank_tier: user.rank_tier,
        total_debates: user.total_debates,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
      },
    });
    return setSessionCookie(res, sessionToken);
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
