import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { sendTopicApprovedEmail } from '@/lib/email';
import { verifyToken } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-topics/approve
 * Owner approves a custom topic via email link
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
        { error: 'Approval token required' },
        { status: 400 }
      );
    }

    // Verify token
    const payload = await verifyToken(token);
    if (!payload || payload.action !== 'approve') {
      return NextResponse.json(
        { error: 'Invalid or expired approval link' },
        { status: 400 }
      );
    }

    const topicId = payload.topicId;
    const db = createServiceClient();

    // Get topic
    const { data: topic, error: selectError } = await db
      .from('custom_topics')
      .select('id, headline, user_id, status')
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

    // Approve topic
    const { error: updateError } = await db
      .from('custom_topics')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        // Note: approved_by_user_id is intentionally not updated here
        // This endpoint is called from unauthenticated email link (no admin context)
        // Constraint allows null approved_by_user_id for system-approved topics
      })
      .eq('id', topicId);

    if (updateError) {
      console.error('Topic approval failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve topic' },
        { status: 500 }
      );
    }

    // Get creator email
    const { data: { users }, error: userError } = await db.auth.admin.listUsers();
    const creator = users.find(u => u.id === topic.user_id);

    if (creator && creator.email) {
      try {
        await sendTopicApprovedEmail(creator.email, topic.headline);
      } catch (emailError) {
        console.error('Failed to send approval email to creator:', emailError);
        // Don't fail the approval if email fails
      }
    }

    return NextResponse.json(
      { success: true, message: 'Topic approved and published!' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Topic approval error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
