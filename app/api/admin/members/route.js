import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/members
 * Returns paginated list of all registered users
 * Requires authenticated admin user
 *
 * Query: { userId, page, limit }
 *
 * Returns: { users: [...], pagination: { page, limit, total, pages } }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    const db = createServiceClient();

    // Check admin status
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

    // Get total count
    const { count: total, error: countError } = await db
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to fetch users count: ${countError.message}`);
    }

    // Get paginated users
    const offset = (page - 1) * limit;
    const { data: users, error: usersError } = await db
      .from('users')
      .select('id, username, email, created_at, is_active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    const pages = Math.ceil(total / limit);

    return NextResponse.json({
      users: users || [],
      pagination: {
        page,
        limit,
        total: total || 0,
        pages,
      },
    });
  } catch (err) {
    console.error('Admin members route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
