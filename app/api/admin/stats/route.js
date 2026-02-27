import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/stats
 * Returns platform statistics (total debates, total users, pending topics)
 * Requires authenticated user with is_admin = true
 *
 * Query: { userId: user_id }
 *
 * Returns: { totalDebates, totalUsers, pendingTopics }
 * Errors:
 *   - 400 Bad Request: userId not provided
 *   - 401 Unauthorized: User not authenticated or session invalid
 *   - 403 Forbidden: User exists but is not an admin
 *   - 500 Internal Server Error: Database query failure
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // 1. Validate userId parameter
    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // 2. Get the user and check is_admin flag
    const { data: user, error: userError } = await db
      .from('users')
      .select('id, is_admin')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (!user.is_admin) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin access required.' },
        { status: 403 }
      );
    }

    // 3. Query total debates count
    const { count: totalDebates, error: debatesError } = await db
      .from('debates')
      .select('id', { count: 'exact', head: true });

    if (debatesError) {
      throw new Error(`Failed to fetch debates count: ${debatesError.message}`);
    }

    // 4. Query total users count
    const { count: totalUsers, error: usersError } = await db
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (usersError) {
      throw new Error(`Failed to fetch users count: ${usersError.message}`);
    }

    // 5. Query pending custom topics count
    const { count: pendingTopics, error: topicsError } = await db
      .from('custom_topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (topicsError) {
      throw new Error(`Failed to fetch pending topics count: ${topicsError.message}`);
    }

    // 6. Return stats
    return NextResponse.json({
      totalDebates: totalDebates || 0,
      totalUsers: totalUsers || 0,
      pendingTopics: pendingTopics || 0,
    });
  } catch (err) {
    console.error('Admin stats route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
