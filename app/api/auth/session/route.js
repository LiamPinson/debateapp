import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { randomBytes, createHash } from "crypto";

/**
 * POST /api/auth/session
 * Create or retrieve a session for an unregistered user.
 * Uses a browser fingerprint (UA + Accept-Language + IP hash) to
 * prevent trivial session farming via localStorage clearing.
 *
 * Body: { token? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = body;
    const db = createServiceClient();
    const fingerprint = buildFingerprint(request);

    if (token) {
      // Retrieve existing session by token
      const tokenHash = hashToken(token);
      const { data: session } = await db
        .from("sessions")
        .select("*")
        .eq("token_hash", tokenHash)
        .single();

      if (session) {
        // Update last_seen and fingerprint
        await db
          .from("sessions")
          .update({
            last_seen: new Date().toISOString(),
            fingerprint: fingerprint,
          })
          .eq("id", session.id);

        return NextResponse.json({
          session_id: session.id,
          debate_count: session.debate_count,
          strike_count: session.strike_count,
          debates_remaining: Math.max(0, 5 - session.debate_count),
        });
      }
      // Token not found — fall through to fingerprint check / new session
    }

    // Check if a session already exists for this fingerprint.
    // This catches users who clear localStorage to bypass the 5-debate limit.
    if (fingerprint) {
      const { data: fingerprintSession } = await db
        .from("sessions")
        .select("*")
        .eq("fingerprint", fingerprint)
        .order("last_seen", { ascending: false })
        .limit(1)
        .single();

      if (fingerprintSession) {
        // Existing fingerprint found — reissue a token for this session
        const newToken = randomBytes(32).toString("hex");
        const newTokenHash = hashToken(newToken);

        await db
          .from("sessions")
          .update({
            token_hash: newTokenHash,
            last_seen: new Date().toISOString(),
          })
          .eq("id", fingerprintSession.id);

        return NextResponse.json({
          token: newToken,
          session_id: fingerprintSession.id,
          debate_count: fingerprintSession.debate_count,
          strike_count: fingerprintSession.strike_count,
          debates_remaining: Math.max(0, 5 - fingerprintSession.debate_count),
          reattached: true,
        });
      }
    }

    // No existing session — create new one
    const newToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(newToken);

    const { data: session, error } = await db
      .from("sessions")
      .insert({
        token_hash: tokenHash,
        fingerprint: fingerprint,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      token: newToken,
      session_id: session.id,
      debate_count: 0,
      strike_count: 0,
      debates_remaining: 5,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Build a browser fingerprint from request headers.
 * Combines User-Agent, Accept-Language, and client IP into a stable hash.
 * Not perfect (VPN/incognito can bypass) but raises the bar significantly.
 */
function buildFingerprint(request) {
  const ua = request.headers.get("user-agent") || "";
  const lang = request.headers.get("accept-language") || "";
  // x-forwarded-for is set by Vercel/reverse proxies
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "";

  if (!ua && !ip) return null;

  const raw = `${ua}|${lang}|${ip}`;
  return createHash("sha256").update(raw).digest("hex");
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
