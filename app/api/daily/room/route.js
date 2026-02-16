import { NextResponse } from "next/server";
import { createDailyRoom, createMeetingToken } from "@/lib/daily";
import { createServiceClient } from "@/lib/supabase";

/**
 * POST /api/daily/room
 * Get or create a Daily.co room for a debate, and generate a participant token.
 *
 * Body: { debateId, userId?, sessionId?, side }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { debateId, userId, sessionId, side } = body;

    if (!debateId || !side) {
      return NextResponse.json({ error: "debateId and side are required" }, { status: 400 });
    }

    const db = createServiceClient();

    // Get debate record
    const { data: debate, error } = await db
      .from("debates")
      .select("*")
      .eq("id", debateId)
      .single();

    if (error || !debate) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    // Verify this user is a participant
    const isProUser = (userId && debate.pro_user_id === userId) || (sessionId && debate.pro_session_id === sessionId);
    const isConUser = (userId && debate.con_user_id === userId) || (sessionId && debate.con_session_id === sessionId);

    if (!isProUser && !isConUser) {
      return NextResponse.json({ error: "Not a participant in this debate" }, { status: 403 });
    }

    // Room should already exist (created during matchmaking)
    if (!debate.daily_room_name) {
      return NextResponse.json({ error: "No room assigned to this debate" }, { status: 400 });
    }

    // Generate meeting token
    const label = userId
      ? (await db.from("users").select("username").eq("id", userId).single()).data?.username || side
      : side.charAt(0).toUpperCase() + side.slice(1);

    const isOwner = side === "pro"; // Pro controls recording
    const token = await createMeetingToken(debate.daily_room_name, label, isOwner);

    return NextResponse.json({
      room_name: debate.daily_room_name,
      room_url: debate.daily_room_url,
      token,
      domain: process.env.NEXT_PUBLIC_DAILY_DOMAIN,
    });
  } catch (err) {
    console.error("Daily room error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
