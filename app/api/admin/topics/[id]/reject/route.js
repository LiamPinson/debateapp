import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/topics/[id]/reject
 * Rejects a pending topic and marks it as rejected
 * Requires authenticated user with is_admin = true
 *
 * Params:
 *   id: string (required) - Topic ID
 *
 * Body: {
 *   userId: string (required) - ID of admin rejecting the topic
 * }
 *
 * Returns: {
 *   success: boolean
 *   topic: updated topic object
 * }
 *
 * Errors:
 *   - 400 Bad Request: userId not provided
 *   - 403 Forbidden: User is not an admin
 *   - 404 Not Found: Topic not found
 *   - 409 Conflict: Topic is already approved/rejected
 *   - 500 Internal Server Error: Database operation failure
 */
export async function POST(request, { params }) {
  try {
    const { id } = params;
    const { userId } = await request.json().catch(() => ({}));

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
        { status: 404 }
      );
    }

    if (!user.is_admin) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Admin access required.' },
        { status: 403 }
      );
    }

    // 3. Check if topic exists
    const { data: topic, error: checkError } = await db
      .from('custom_topics')
      .select('id, status')
      .eq('id', id)
      .single();

    if (checkError || !topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    // 4. Check if topic is still pending
    if (topic.status !== 'pending') {
      return NextResponse.json(
        { error: `Topic is already ${topic.status}` },
        { status: 409 }
      );
    }

    // 5. Update the topic to rejected status
    const { data: updated, error: updateError } = await db
      .from('custom_topics')
      .update({
        status: 'rejected'
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update topic: ${updateError.message}`);
    }

    // 6. Return updated topic
    return NextResponse.json(
      {
        success: true,
        topic: updated
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Reject topic error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
