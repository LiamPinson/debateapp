import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * POST /api/challenges
 * Create a new challenge.
 *
 * Body: { challengerId, targetId, topicId, timeLimit? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { challengerId, targetId, topicId, timeLimit } = body;

    if (!challengerId || !targetId || !topicId) {
      return NextResponse.json(
        { error: "challengerId, targetId, and topicId are required" },
        { status: 400 }
      );
    }

    if (challengerId === targetId) {
      return NextResponse.json({ error: "Cannot challenge yourself" }, { status: 400 });
    }

    const db = createServiceClient();

    // Check for existing pending challenge between these users
    const { data: existing } = await db
      .from("challenges")
      .select("id")
      .eq("challenger_id", challengerId)
      .eq("target_id", targetId)
      .eq("status", "pending")
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "You already have a pending challenge to this user" },
        { status: 409 }
      );
    }

    const { data: challenge, error } = await db
      .from("challenges")
      .insert({
        challenger_id: challengerId,
        target_id: targetId,
        topic_id: topicId,
        time_limit: timeLimit || 15,
        status: "pending",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify the target
    await db.from("notifications").insert({
      user_id: targetId,
      type: "challenge_received",
      title: "New challenge!",
      body: "Someone has challenged you to a debate.",
      data: { challenge_id: challenge.id, challenger_id: challengerId, topic_id: topicId },
    });

    return NextResponse.json({ challenge });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/challenges
 * Accept or decline a challenge.
 *
 * Body: { challengeId, action: 'accept' | 'decline' }
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { challengeId, action } = body;

    if (!challengeId || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "challengeId and action (accept/decline) required" },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    const { data: challenge } = await db
      .from("challenges")
      .select("*")
      .eq("id", challengeId)
      .eq("status", "pending")
      .single();

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found or already resolved" }, { status: 404 });
    }

    const newStatus = action === "accept" ? "accepted" : "declined";

    const { error } = await db
      .from("challenges")
      .update({ status: newStatus })
      .eq("id", challengeId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify the challenger
    await db.from("notifications").insert({
      user_id: challenge.challenger_id,
      type: "challenge_received",
      title: `Challenge ${newStatus}!`,
      body: action === "accept"
        ? "Your challenge was accepted. Get ready to debate!"
        : "Your challenge was declined.",
      data: { challenge_id: challengeId },
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/challenges?userId=<uuid>&type=received|sent
 * List challenges for a user.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type") || "received";

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const db = createServiceClient();

    const column = type === "sent" ? "challenger_id" : "target_id";
    const { data, error } = await db
      .from("challenges")
      .select("*, topics(title, short_title, category)")
      .eq(column, userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ challenges: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
