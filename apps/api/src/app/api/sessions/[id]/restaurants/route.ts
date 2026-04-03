import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;
  const { id } = await params;

  const [{ data, error }, { count: swipeCount }] = await Promise.all([
    supabase
      .from('session_restaurants')
      .select('*')
      .eq('session_id', id)
      .order('rating', { ascending: false }),
    supabase
      .from('swipes')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', id)
      .eq('user_id', user.id),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: { restaurants: data, user_swipe_count: swipeCount ?? 0 } });
}
