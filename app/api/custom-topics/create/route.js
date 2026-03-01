import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { sendTopicSubmissionEmail } from '@/lib/email';
import { createApprovalToken, createRejectionToken } from '@/lib/tokens';
import { CreateCustomTopicSchema, validate } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

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

    // Check rate limiting: max 1 topic per user per 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTopics, error: checkError } = await db
      .from('custom_topics')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', twentyFourHoursAgo)
      .limit(1);

    if (checkError) {
      console.error('Rate limit check failed:', checkError);
      return NextResponse.json(
        { error: 'Failed to validate submission' },
        { status: 500 }
      );
    }

    if (recentTopics && recentTopics.length > 0) {
      return NextResponse.json(
        { error: 'You can only create one topic per day. Please try again tomorrow.' },
        { status: 429 }
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
