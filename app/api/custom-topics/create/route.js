import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { sendTopicSubmissionEmail } from '@/lib/email';
import { createApprovalToken, createRejectionToken } from '@/lib/tokens';
import { CreateCustomTopicSchema, validate } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

const TOPIC_COST_POINTS = 2;
const MAX_TOPICS_PER_DAY = 7;

/**
 * POST /api/custom-topics/create
 * Create a new custom debate topic submission
 *
 * Body: {
 *   headline: string (max 20 words),
 *   description: string (max 150 words),
 *   notificationPreference: 'email' | 'in_app' | 'both'
 * }
 *
 * Returns: { success: true, message: "..." }
 */
export async function POST(request) {
  try {
    const { data: body, error: validationError } = await validate(request, CreateCustomTopicSchema);
    if (validationError) return validationError;

    const { headline, description, notificationPreference } = body;

    const db = createServiceClient();

    // Get authenticated user from request header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await db.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Look up user row to check points balance
    const { data: userRow, error: userError } = await db
      .from('users')
      .select('id, points_balance')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userRow) {
      return NextResponse.json(
        { error: 'User record not found' },
        { status: 404 }
      );
    }

    // Check points balance
    if (userRow.points_balance < TOPIC_COST_POINTS) {
      const needed = TOPIC_COST_POINTS - userRow.points_balance;
      return NextResponse.json(
        {
          error: `You need ${needed} more point${needed !== 1 ? 's' : ''} to propose a topic. Complete debates to earn points.`,
          points_balance: userRow.points_balance,
          points_required: TOPIC_COST_POINTS,
        },
        { status: 402 }
      );
    }

    // Check rate limit: max 7 topics per user per 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTopics, error: checkError } = await db
      .from('custom_topics')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', twentyFourHoursAgo);

    if (checkError) {
      console.error('Rate limit check failed:', checkError);
      return NextResponse.json(
        { error: 'Failed to validate submission' },
        { status: 500 }
      );
    }

    if (recentTopics && recentTopics.length >= MAX_TOPICS_PER_DAY) {
      return NextResponse.json(
        { error: `You can submit up to ${MAX_TOPICS_PER_DAY} topics per day. Please try again tomorrow.` },
        { status: 429 }
      );
    }

    // Deduct points atomically before creating the topic
    const { error: spendError } = await db.rpc('spend_points', {
      p_user_id: userRow.id,
      p_amount: TOPIC_COST_POINTS,
      p_type: 'topic_submitted',
      p_custom_topic_id: null, // will update after insert if needed
    });

    if (spendError) {
      console.error('Failed to spend points:', spendError);
      return NextResponse.json(
        { error: 'Failed to deduct points. Please try again.' },
        { status: 500 }
      );
    }

    // Create custom topic submission
    const { data: topic, error: insertError } = await db
      .from('custom_topics')
      .insert({
        user_id: user.id,
        headline,
        description,
        notification_preference: notificationPreference,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Topic creation failed:', insertError);
      return NextResponse.json(
        { error: 'Failed to create topic submission' },
        { status: 500 }
      );
    }

    // Generate approval/rejection tokens
    const approveToken = await createApprovalToken(topic.id);
    const rejectToken = await createRejectionToken(topic.id);

    // Send email to owner
    try {
      await sendTopicSubmissionEmail(headline, approveToken, rejectToken);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail the submission if email fails in dev
      if (process.env.NODE_ENV !== 'development') {
        throw emailError;
      }
    }

    return NextResponse.json(
      { success: true, message: 'Submission received, check back soon' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Custom topic creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
