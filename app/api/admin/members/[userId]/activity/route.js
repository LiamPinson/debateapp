import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/members/:userId/activity
 * Returns activity stats for a specific user
 * Requires authenticated admin user
 *
 * Path Params: { userId } - The user ID to retrieve activity for
 * Query Params: { userId } - The authenticated admin user ID (must have is_admin=true)
 *
 * Returns: {
 *   user: { id, username, email, created_at },
 *   activity: { debatesParticipated, topicsSubmitted, topicsApproved, topicsRejected }
 * }
 * Errors:
 *   - 400 Bad Request: userId query param not provided
 *   - 401 Unauthorized: Admin user not found or session invalid
 *   - 403 Forbidden: User exists but is not an admin
 *   - 404 Not Found: Target user not found
 *   - 500 Internal Server Error: Database query failure
 */
export async function GET(request, { params }) {
  try {
    const { userId } = params;
    const searchParams = request.nextUrl.searchParams;
    const adminId = searchParams.get('userId');

    if (!adminId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // Check admin status
    const { data: admin, error: adminError } = await db
      .from('users')
      .select('id, is_admin')
      .eq('id', adminId)
      .single();

    if (adminError || !admin) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    if (!admin.is_admin) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin access required.' },
        { status: 403 }
      );
    }

    // Get user info
    const { data: user, error: userError } = await db
      .from('users')
      .select('id, username, email, created_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Count debates participated
    const { count: debatesParticipated, error: debatesError } = await db
      .from('debates')
      .select('id', { count: 'exact', head: true })
      .or(`pro_user_id.eq.${userId},con_user_id.eq.${userId}`);

    if (debatesError) {
      throw new Error(`Failed to fetch debates: ${debatesError.message}`);
    }

    // Count topics submitted
    const { count: topicsSubmitted, error: submittedError } = await db
      .from('custom_topics')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', userId);

    if (submittedError) {
      throw new Error(`Failed to fetch submitted topics: ${submittedError.message}`);
    }

    // Count topics approved
    const { count: topicsApproved, error: approvedError } = await db
      .from('custom_topics')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', userId)
      .eq('status', 'approved');

    if (approvedError) {
      throw new Error(`Failed to fetch approved topics: ${approvedError.message}`);
    }

    // Count topics rejected
    const { count: topicsRejected, error: rejectedError } = await db
      .from('custom_topics')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', userId)
      .eq('status', 'rejected');

    if (rejectedError) {
      throw new Error(`Failed to fetch rejected topics: ${rejectedError.message}`);
    }

    return NextResponse.json({
      user,
      activity: {
        debatesParticipated: debatesParticipated || 0,
        topicsSubmitted: topicsSubmitted || 0,
        topicsApproved: topicsApproved || 0,
        topicsRejected: topicsRejected || 0,
      },
    });
  } catch (err) {
    console.error('Admin member activity route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
