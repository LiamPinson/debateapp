import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile/[username]/stats
 * Public endpoint — returns W/L/D/total for any username.
 * Used by the username hover card.
 */
export async function GET(request, { params }) {
  try {
    const { username } = params;

    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const db = createServiceClient();

    const { data: user, error } = await db
      .from("users")
      .select("username, wins, losses, draws, total_debates")
      .eq("username", username)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      username: user.username,
      wins: user.wins ?? 0,
      losses: user.losses ?? 0,
      draws: user.draws ?? 0,
      total_debates: user.total_debates ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
