import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { verifyToken } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-topics/reject
 * Owner rejects a custom topic via email link
 *
 * Query: { token: jwt_token }
 *
 * Returns: { success: true, message: "..." }
 */
export async function POST(request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Rejection token required' },
        { status: 400 }
      );
    }

    // Verify token
    const payload = await verifyToken(token);
    if (!payload || payload.action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid or expired rejection link' },
        { status: 400 }
      );
    }

    const topicId = payload.topicId;
    const db = createServiceClient();

    // Get topic
    const { data: topic, error: selectError } = await db
      .from('custom_topics')
      .select('id, status')
      .eq('id', topicId)
      .single();

    if (selectError || !topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    if (topic.status !== 'pending') {
      return NextResponse.json(
        { error: 'Topic has already been processed' },
        { status: 400 }
      );
    }

    // Reject topic
    const { error: updateError } = await db
      .from('custom_topics')
      .update({
        status: 'rejected',
        approved_at: new Date().toISOString(),
      })
      .eq('id', topicId);

    if (updateError) {
      console.error('Topic rejection failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject topic' },
        { status: 500 }
      );
    }

    // No email sent to creator on rejection
    return NextResponse.json(
      { success: true, message: 'Topic rejected' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Topic rejection error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
