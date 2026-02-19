import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET() {
  const db = createServiceClient();
  const { data: topics, error } = await db
    .from('topics')
    .select('*')
    .eq('active', true)
    .order('category')
    .order('title');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ topics });
}
