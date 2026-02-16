import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * POST /api/votes/cast
 * Cast a vote on a debate. One vote per user, unweighted.
 *
 * Body: { debateId, voterId, winnerChoice, betterArguments?, moreRespectful?, changedMind? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { debateId, voterId, winnerChoice, betterArguments, moreRespectful, changedMind } = body;

    if (!debateId || !voterId || !winnerChoice) {
      return NextResponse.json(
        { error: "debateId, voterId, and winnerChoice required" },
        { status: 400 }
      );
    }

    if (!["pro", "con", "draw"].includes(winnerChoice)) {
      return NextResponse.json({ error: "winnerChoice must be pro, con, or draw" }, { status: 400 });
    }

    const db = createServiceClient();

    // Verify debate exists and is completed
    const { data: debate } = await db
      .from("debates")
      .select("id, status, pro_user_id, con_user_id")
      .eq("id", debateId)
      .single();

    if (!debate || debate.status !== "completed") {
      return NextResponse.json({ error: "Debate not found or not completed" }, { status: 404 });
    }

    // Can't vote on own debate
    if (debate.pro_user_id === voterId || debate.con_user_id === voterId) {
      return NextResponse.json({ error: "Cannot vote on your own debate" }, { status: 403 });
    }

    // Upsert vote (replaces if already voted)
    const { data: vote, error } = await db
      .from("votes")
      .upsert(
        {
          debate_id: debateId,
          voter_id: voterId,
          winner_choice: winnerChoice,
          better_arguments: betterArguments || null,
          more_respectful: moreRespectful || null,
          changed_mind: changedMind ?? null,
        },
        { onConflict: "debate_id,voter_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Vote error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recalculate vote tally
    const { data: tally } = await db
      .from("votes")
      .select("winner_choice")
      .eq("debate_id", debateId);

    const counts = { pro: 0, con: 0, draw: 0 };
    (tally || []).forEach((v) => counts[v.winner_choice]++);
    const total = counts.pro + counts.con + counts.draw;

    // Determine winner by simple majority
    let winner = "draw";
    if (total > 0) {
      const proPercent = counts.pro / total;
      const conPercent = counts.con / total;
      if (Math.abs(proPercent - conPercent) > 0.05) {
        winner = proPercent > conPercent ? "pro" : "con";
      }
    }

    // Update debate with community vote result
    await db
      .from("debates")
      .update({ winner, winner_source: "community" })
      .eq("id", debateId)
      .eq("status", "completed");

    // Update W/L records for participants
    await updateWinLoss(db, debate, winner);

    return NextResponse.json({
      success: true,
      vote,
      tally: counts,
      total,
      winner,
    });
  } catch (err) {
    console.error("Vote error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/votes/cast?debateId=xxx
 * Get vote tally for a debate.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const debateId = searchParams.get("debateId");

    if (!debateId) {
      return NextResponse.json({ error: "debateId required" }, { status: 400 });
    }

    const db = createServiceClient();

    const { data: tally } = await db
      .from("votes")
      .select("winner_choice")
      .eq("debate_id", debateId);

    const counts = { pro: 0, con: 0, draw: 0 };
    (tally || []).forEach((v) => counts[v.winner_choice]++);

    return NextResponse.json({ tally: counts, total: counts.pro + counts.con + counts.draw });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function updateWinLoss(db, debate, winner) {
  if (winner === "draw") {
    // Both get draws
    for (const uid of [debate.pro_user_id, debate.con_user_id]) {
      if (!uid) continue;
      const { data } = await db.from("users").select("draws").eq("id", uid).single();
      if (data) await db.from("users").update({ draws: data.draws + 1 }).eq("id", uid);
    }
  } else {
    const winnerId = winner === "pro" ? debate.pro_user_id : debate.con_user_id;
    const loserId = winner === "pro" ? debate.con_user_id : debate.pro_user_id;

    if (winnerId) {
      const { data } = await db.from("users").select("wins").eq("id", winnerId).single();
      if (data) await db.from("users").update({ wins: data.wins + 1 }).eq("id", winnerId);
    }
    if (loserId) {
      const { data } = await db.from("users").select("losses").eq("id", loserId).single();
      if (data) await db.from("users").update({ losses: data.losses + 1 }).eq("id", loserId);
    }
  }
}
