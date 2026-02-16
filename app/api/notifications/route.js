import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/notifications?userId=<uuid>&unreadOnly=true&limit=50
 * List notifications for a user.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const db = createServiceClient();
    let query = db
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notifications: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read.
 *
 * Body: { notificationIds: string[] } or { userId: string, markAllRead: true }
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { notificationIds, userId, markAllRead } = body;
    const db = createServiceClient();

    if (markAllRead && userId) {
      const { error } = await db
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (!notificationIds || notificationIds.length === 0) {
      return NextResponse.json({ error: "notificationIds or markAllRead required" }, { status: 400 });
    }

    const { error } = await db
      .from("notifications")
      .update({ read: true })
      .in("id", notificationIds);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
