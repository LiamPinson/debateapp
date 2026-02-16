import { NextResponse } from "next/server";
import { enterQueue, leaveQueue } from "@/lib/matchmaking";
import { createServiceClient } from "@/lib/supabase";

/**
 * POST /api/matchmaking/queue
 * Enter the matchmaking queue.
 *
 * Body: { userId?, sessionId?, category, topicId?, timeLimit, stance, ranked }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, sessionId, category, topicId, timeLimit, stance, ranked } = body;

    if (!category || !timeLimit) {
      return NextResponse.json({ error: "category and timeLimit are required" }, { status: 400 });
    }

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
    const body = await request.json();
    const { queueId } = body;

    if (!queueId) {
      return NextResponse.json({ error: "queueId required" }, { status: 400 });
    }

    await leaveQueue(queueId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
