import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  // Get matches with restaurant data
  const { data: matches, error: matchError } = await supabase
    .from('matches')
    .select(`
      *,
      restaurant:session_restaurants!restaurant_id(*)
    `)
    .eq('session_id', id)
    .order('matched_at', { ascending: false });

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 400 });
  }

  // Get total restaurant count
  const { count: totalRestaurants } = await supabase
    .from('session_restaurants')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', id);

  // Get per-user swipe progress
  const { data: swipes } = await supabase
    .from('swipes')
    .select('user_id')
    .eq('session_id', id);

  const swipeProgress: Record<string, number> = {};
  swipes?.forEach(s => {
    swipeProgress[s.user_id] = (swipeProgress[s.user_id] ?? 0) + 1;
  });

  return NextResponse.json({
    data: {
      matches: matches ?? [],
      total_restaurants: totalRestaurants ?? 0,
      swipe_progress: swipeProgress,
    },
  });
}
