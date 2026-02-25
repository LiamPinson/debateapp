import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/auth/reset-password/validate?token=xyz
 * → validate token exists and not expired
 * → return { valid: true, email: "masked" } or error
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // Look up token
    const { data: resetToken, error: queryError } = await db
      .from("password_reset_tokens")
      .select("id, email, expires_at")
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
      // Token expired, optionally delete it
      await db.from("password_reset_tokens").delete().eq("token", token);
      return NextResponse.json(
        { error: "Reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Mask email: first char + asterisks + domain
    const [localPart, domain] = resetToken.email.split("@");
    const maskedEmail = localPart[0] + "*".repeat(localPart.length - 1) + "@" + domain;

    return NextResponse.json({
      valid: true,
      email: maskedEmail,
    });
  } catch (err) {
    console.error("Reset password validate error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
