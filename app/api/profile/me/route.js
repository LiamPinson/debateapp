import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/profile/me?userId=xxx
 * Get current user's profile with stats and recent debates.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const db = createServiceClient();

    // Get user
    const { data: user, error } = await db
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get recent debates with user joins for DebateCard compatibility
    const { data: debates } = await db
      .from("debates")
      .select("id, winner, created_at, completed_at, topics(title, short_title), pro_user:users!pro_user_id(username), con_user:users!con_user_id(username)")
      .or(`pro_user_id.eq.${userId},con_user_id.eq.${userId}`)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(20);

    // Get notification count
    const { count: unreadNotifs } = await db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);

    // Get pending challenges
    const { count: pendingChallenges } = await db
      .from("challenges")
      .select("id", { count: "exact", head: true })
      .eq("target_id", userId)
      .eq("status", "pending");

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        quality_score: user.quality_score_avg,
        rank_tier: user.rank_tier,
        total_debates: user.total_debates,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        strike_count: user.strike_count,
        created_at: user.created_at,
      },
      recent_debates: (debates || []).map((d) => ({
        id: d.id,
        status: "completed",
        created_at: d.completed_at || d.created_at,
        topic_title: d.topics?.short_title || d.topics?.title || null,
        pro_username: d.pro_user?.username || null,
        con_username: d.con_user?.username || null,
        winner: d.winner,
      })),
      unread_notifications: unreadNotifs || 0,
      pending_challenges: pendingChallenges || 0,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
