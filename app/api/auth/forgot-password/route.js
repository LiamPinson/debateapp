import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { randomBytes } from "crypto";

/**
 * POST /api/auth/forgot-password
 * { email }
 * → validate email exists → generate token → store in DB → send email
 * → return { success: true, message: "..." }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // Check if user exists in the users table
    const { data: user, error: userError } = await db
      .from("users")
      .select("id, email")
      .eq("email", email)
      .single();

    // Always return success for security (don't expose if email exists)
    if (userError || !user) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a reset link will be sent.",
      });
    }

    // Generate secure random token (32 bytes = 64 char hex string)
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store token in database
    const { error: insertError } = await db.from("password_reset_tokens").insert({
      user_id: user.id,
      email: user.email,
      token,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error("Failed to insert reset token:", insertError);
      return NextResponse.json(
        { error: "Failed to process request" },
        { status: 500 }
      );
    }

    // Send email with reset link
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

    // TODO: Implement email sending (Supabase, SendGrid, Resend, etc.)
    // For now, log to console in development
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Reset link for ${email}: ${resetLink}`);
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a reset link will be sent.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
