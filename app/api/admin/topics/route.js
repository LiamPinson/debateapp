import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/topics
 * Fetches pending/approved/rejected topics with pagination and user info
 * Requires authenticated user with is_admin = true
 *
 * Query: {
 *   userId: string (required) - ID of requesting user
 *   status: 'pending'|'approved'|'rejected' (default: 'pending')
 *   page: number (default: 1)
 *   limit: number (default: 50)
 * }
 *
 * Returns: {
 *   topics: array of topics with user info
 *   pagination: { page, limit, total, pages }
 * }
 *
 * Errors:
 *   - 400 Bad Request: userId not provided or invalid query params
 *   - 401 Unauthorized: User not found
 *   - 403 Forbidden: User is not an admin
 *   - 500 Internal Server Error: Database query failure
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'pending';
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;

    // 1. Validate userId parameter
    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    // 2. Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 1000.' },
        { status: 400 }
      );
    }

    // 3. Validate status parameter
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: pending, approved, rejected' },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // 4. Get the user and check is_admin flag
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

    // 5. Calculate offset for pagination
    const offset = (page - 1) * limit;

    // 6. Fetch total count of topics with the given status
    const { count: totalCount, error: countError } = await db
      .from('custom_topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', status);

    if (countError) {
      throw new Error(`Failed to fetch topics count: ${countError.message}`);
    }

    // 7. Fetch topics with pagination
    const { data: topics, error: topicsError } = await db
      .from('custom_topics')
      .select(`
        id,
        headline,
        description,
        status,
        created_at,
        approved_at,
        approved_by_user_id,
        user_id
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (topicsError) {
      throw new Error(`Failed to fetch topics: ${topicsError.message}`);
    }

    // 8. Fetch user info for each topic
    const topicsWithUsers = await Promise.all(
      (topics || []).map(async (topic) => {
        const { data: submittedByUser } = await db
          .from('users')
          .select('username, email')
          .eq('id', topic.user_id)
          .single();

        return {
          ...topic,
          submitted_by: {
            username: submittedByUser?.username || 'Unknown',
            email: submittedByUser?.email || 'Unknown'
          }
        };
      })
    );

    // 9. Calculate total pages
    const totalPages = Math.ceil((totalCount || 0) / limit);

    // 10. Return response with topics and pagination metadata
    return NextResponse.json({
      topics: topicsWithUsers,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: totalPages
      }
    });
  } catch (err) {
    console.error('Admin topics route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
