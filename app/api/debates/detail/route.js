import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

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

    const { data: debate, error } = await db
      .from("debates")
      .select("*, topics(title, short_title, category, description)")
      .eq("id", debateId)
      .single();

    if (error || !debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

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

    return NextResponse.json({
      debate: {
        ...debate,
        // Strip raw transcript segments from public response (large payload)
        transcript: debate.transcript
          ? { full_text: debate.transcript.full_text, duration: debate.transcript.duration }
          : null,
      },
      voteTally,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
