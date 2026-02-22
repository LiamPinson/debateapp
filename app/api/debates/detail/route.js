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
