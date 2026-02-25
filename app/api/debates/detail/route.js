import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/debates/detail?debateId=<uuid>
 * Get full debate details including topic, scores, transcript status, and pipeline state.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const debateId = searchParams.get("debateId");

    if (!debateId) {
      return NextResponse.json({ error: "debateId required" }, { status: 400 });
    }

    const db = createServiceClient();

    // Fetch debate + topic separately from users to avoid ambiguous FK join
    // (two FKs to users: pro_user_id + con_user_id confuses PostgREST).
    const { data: debate, error } = await db
      .from("debates")
      .select("*, topics(title, short_title, category, description)")
      .eq("id", debateId)
      .single();

    if (error || !debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    // ── Server-side prematch timeout safety net ──
    // If the debate has been in prematch for more than 90 seconds,
    // auto-cancel it. This catches cases where both players closed
    // their tab and no client-side timeout fired.
    if (debate.status === "prematch" && debate.created_at) {
      const ageMs = Date.now() - new Date(debate.created_at).getTime();
      const PREMATCH_TIMEOUT_MS = 90_000; // 90s (client timeout is 60s)

      if (ageMs > PREMATCH_TIMEOUT_MS) {
        const { data: autoCancelled } = await db
          .from("debates")
          .update({
            status: "cancelled",
            phase: "ended",
            completed_at: new Date().toISOString(),
          })
          .eq("id", debateId)
          .eq("status", "prematch")
          .select("id")
          .maybeSingle();

        if (autoCancelled) {
          await db
            .from("matchmaking_queue")
            .update({ status: "expired", debate_id: null, matched_with: null })
            .eq("debate_id", debateId)
            .eq("status", "matched");

          // Re-fetch to return the cancelled state
          const { data: refreshed } = await db
            .from("debates")
            .select("*, topics(title, short_title, category, description)")
            .eq("id", debateId)
            .single();
          if (refreshed) Object.assign(debate, refreshed);
        }
      }
    }

    // ── Server-side "forfeiting" stuck safety net ──
    // If the debate has been in the transitional "forfeiting" state for more
    // than 30 seconds, the pipeline likely crashed or Vercel killed the
    // function. Auto-complete the forfeit so the client isn't stuck forever.
    if (debate.status === "forfeiting") {
      // Use updated_at (set when status changed to "forfeiting") or fall back to started_at
      const stuckSince = debate.updated_at || debate.started_at || debate.created_at;
      const stuckMs = stuckSince ? Date.now() - new Date(stuckSince).getTime() : Infinity;
      const FORFEITING_TIMEOUT_MS = 30_000; // 30s is more than enough for the pipeline

      if (stuckMs > FORFEITING_TIMEOUT_MS) {
        // We don't know which side forfeited, so mark as pipeline_failed
        // unless we can infer from existing data.
        const { data: autoResolved } = await db
          .from("debates")
          .update({
            status: "pipeline_failed",
            phase: "ended",
            completed_at: new Date().toISOString(),
          })
          .eq("id", debateId)
          .eq("status", "forfeiting") // CAS guard
          .select("id")
          .maybeSingle();

        if (autoResolved) {
          // Re-fetch to return the resolved state
          const { data: refreshed } = await db
            .from("debates")
            .select("*, topics(title, short_title, category, description)")
            .eq("id", debateId)
            .single();
          if (refreshed) Object.assign(debate, refreshed);
        }
      }
    }

    // Fetch user display names separately
    const [proUser, conUser] = await Promise.all([
      debate.pro_user_id
        ? db.from("users").select("username, rank_tier").eq("id", debate.pro_user_id).maybeSingle().then((r) => r.data)
        : null,
      debate.con_user_id
        ? db.from("users").select("username, rank_tier").eq("id", debate.con_user_id).maybeSingle().then((r) => r.data)
        : null,
    ]);

    // Get vote tally
    const { data: votes } = await db
      .from("votes")
      .select("winner_choice")
      .eq("debate_id", debateId);

    const voteTally = { pro: 0, con: 0, draw: 0, total: 0 };
    if (votes) {
      for (const v of votes) {
        voteTally[v.winner_choice] = (voteTally[v.winner_choice] || 0) + 1;
        voteTally.total++;
      }
    }

    return NextResponse.json(
      {
        debate: {
          ...debate,
          // Flatten topic and user data
          topic_title: debate.topics?.title || null,
          topic_description: debate.topics?.description || null,
          pro_username: proUser?.username || null,
          pro_rank_tier: proUser?.rank_tier || null,
          con_username: conUser?.username || null,
          con_rank_tier: conUser?.rank_tier || null,
          // Strip raw transcript segments from public response (large payload)
          transcript: debate.transcript
            ? { full_text: debate.transcript.full_text, duration: debate.transcript.duration }
            : null,
        },
        voteTally,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
