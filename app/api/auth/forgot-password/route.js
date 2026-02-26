import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { randomBytes } from "crypto";
import { Resend } from "resend";

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

    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Reset link for ${email}: ${resetLink}`);
    } else {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Debate Arena <onboarding@resend.dev>",
        to: email,
        subject: "Reset your password",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="margin-bottom:8px">Reset your password</h2>
            <p style="color:#666;margin-bottom:24px">
              Click the link below to set a new password. This link expires in 1 hour.
            </p>
            <a href="${resetLink}"
               style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
              Reset Password
            </a>
            <p style="color:#999;font-size:12px;margin-top:24px">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
      });
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
