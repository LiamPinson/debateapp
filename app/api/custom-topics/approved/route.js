import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/custom-topics/approved
 * Get all approved custom topics (for topics page)
 *
 * Returns: { topics: [ { id, headline, description, createdAt } ] }
 */
export async function GET() {
  try {
    const db = createServiceClient();

    const { data: topics, error } = await db
      .from('custom_topics')
      .select('id, headline, description, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch approved custom topics:', error);
      return NextResponse.json(
        { error: 'Failed to fetch topics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      topics: (topics || []).map(t => ({
        id: t.id,
        headline: t.headline,
        description: t.description,
        createdAt: t.created_at,
      })),
    });
  } catch (error) {
    console.error('Approved topics fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
