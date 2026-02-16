import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { randomBytes, createHash } from "crypto";

/**
 * POST /api/auth/session
 * Create or retrieve a session for an unregistered user.
 * Session token is stored as a cookie on the client.
 *
 * Body: { token? } — if token provided, retrieves existing session
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = body;
    const db = createServiceClient();

    if (token) {
      // Retrieve existing session
      const tokenHash = hashToken(token);
      const { data: session } = await db
        .from("sessions")
        .select("*")
        .eq("token_hash", tokenHash)
        .single();

      if (session) {
        // Update last_seen
        await db
          .from("sessions")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", session.id);

        return NextResponse.json({
          session_id: session.id,
          debate_count: session.debate_count,
          strike_count: session.strike_count,
          debates_remaining: Math.max(0, 5 - session.debate_count),
        });
      }
      // Token not found — create new session below
    }

    // Generate new token
    const newToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(newToken);

    const { data: session, error } = await db
      .from("sessions")
      .insert({ token_hash: tokenHash })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      token: newToken, // Client stores this in localStorage
      session_id: session.id,
      debate_count: 0,
      strike_count: 0,
      debates_remaining: 5,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
