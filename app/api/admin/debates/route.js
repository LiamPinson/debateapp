import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/debates
 * Returns paginated list of all debates with participants and winner
 * Requires authenticated admin user
 *
 * Query: { userId, page, limit }
 *
 * Returns: { debates: [...], pagination: { page, limit, total, pages } }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Validate inputs
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
      .from('debates')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to fetch debates count: ${countError.message}`);
    }

    // Get paginated debates with participants
    const offset = (page - 1) * limit;
    const { data: debates, error: debatesError } = await db
      .from('debates')
      .select(`
        id,
        pro_user:pro_user_id(id, username),
        con_user:con_user_id(id, username),
        winner_side,
        transcript,
        created_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (debatesError) {
      throw new Error(`Failed to fetch debates: ${debatesError.message}`);
    }

    const pages = Math.ceil(total / limit);

    return NextResponse.json({
      debates: debates || [],
      pagination: {
        page,
        limit,
        total: total || 0,
        pages,
      },
    });
  } catch (err) {
    console.error('Admin debates route error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
