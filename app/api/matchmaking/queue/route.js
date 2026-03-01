import { NextResponse } from "next/server";
import { enterQueue, leaveQueue } from "@/lib/matchmaking";
import { createServiceClient } from "@/lib/supabase";
import { QueueSchema, LeaveQueueSchema, validate } from "@/lib/schemas";

/**
 * GET /api/matchmaking/queue?queueId=xxx
 * Poll the status of a queue entry. Used as a fallback when Supabase
 * realtime is unavailable (e.g. due to RLS restrictions for guest users).
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const queueId = searchParams.get("queueId");

    if (!queueId) {
      return NextResponse.json({ error: "queueId required" }, { status: 400 });
    }

    const db = createServiceClient();
    const { data, error } = await db
      .from("matchmaking_queue")
      .select("status, debate_id, matched_with")
      .eq("id", queueId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || { status: "not_found" });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/matchmaking/queue
 * Enter the matchmaking queue.
 *
 * Body: { userId?, sessionId?, category, topicId?, timeLimit, stance, ranked }
 */
export async function POST(request) {
  try {
    const { data: body, error: validationError } = await validate(request, QueueSchema);
    if (validationError) return validationError;

    const { userId, sessionId, category, topicId, timeLimit, stance, ranked } = body;

    // Validate unregistered user debate limit
    if (!userId && sessionId) {
      const db = createServiceClient();
      const { data: session } = await db
        .from("sessions")
        .select("debate_count")
        .eq("id", sessionId)
        .single();

      if (session && session.debate_count >= 5) {
        return NextResponse.json(
          { error: "Guest limit reached. Please register to continue." },
          { status: 403 }
        );
      }
    }

    // Ranked requires registration
    if (ranked && !userId) {
      return NextResponse.json(
        { error: "Ranked matchmaking requires registration." },
        { status: 403 }
      );
    }

    const result = await enterQueue({
      userId: userId || null,
      sessionId: sessionId || null,
      category,
      topicId: topicId || null,
      timeLimit: parseInt(timeLimit),
      stance: stance || "either",
      ranked: !!ranked,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Queue error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/matchmaking/queue
 * Leave the matchmaking queue.
 *
 * Body: { queueId }
 */
export async function DELETE(request) {
  try {
    const { data: body, error: validationError } = await validate(request, LeaveQueueSchema);
    if (validationError) return validationError;

    await leaveQueue(body.queueId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
