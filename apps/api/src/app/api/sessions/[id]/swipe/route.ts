import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';
import type { SwipeRequest } from '@bitebuddy/shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;
  const { id } = await params;

  const body: SwipeRequest = await request.json();

  if (!body.restaurant_id || body.liked === undefined) {
    return NextResponse.json({ error: 'restaurant_id and liked are required' }, { status: 400 });
  }

  // Insert the swipe
  const { data: swipe, error: swipeError } = await supabase
    .from('swipes')
    .insert({
      session_id: id,
      user_id: user.id,
      restaurant_id: body.restaurant_id,
      liked: body.liked,
    })
    .select()
    .single();

  if (swipeError) {
    return NextResponse.json({ error: swipeError.message }, { status: 400 });
  }

  // Check if this swipe caused a match (the trigger inserts into matches)
  let match = null;
  if (body.liked) {
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .eq('session_id', id)
      .eq('restaurant_id', body.restaurant_id)
      .maybeSingle();

    match = matchData;
  }

  const [{ count: totalRestaurants }, { data: members }, { data: userSwipes }, { data: allSwipes }] = await Promise.all([
    supabase
      .from('session_restaurants')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', id),
    supabase
      .from('session_members')
      .select('user_id')
      .eq('session_id', id),
    supabase
      .from('swipes')
      .select('restaurant_id')
      .eq('session_id', id)
      .eq('user_id', user.id),
    supabase
      .from('swipes')
      .select('user_id, restaurant_id')
      .eq('session_id', id),
  ]);

  const totalRestaurantCount = totalRestaurants ?? 0;
  const userSwipeCount = (userSwipes ?? []).length;

  const userSwipeMap = new Map<string, Set<string>>();
  (allSwipes ?? []).forEach((entry) => {
    if (!userSwipeMap.has(entry.user_id)) {
      userSwipeMap.set(entry.user_id, new Set<string>());
    }
    userSwipeMap.get(entry.user_id)?.add(entry.restaurant_id);
  });

  const sessionCompleted =
    totalRestaurantCount > 0 &&
    (members ?? []).length > 0 &&
    (members ?? []).every((member) => (userSwipeMap.get(member.user_id)?.size ?? 0) >= totalRestaurantCount);

  if (sessionCompleted) {
    await supabase
      .from('sessions')
      .update({ status: 'completed' })
      .eq('id', id)
      .neq('status', 'completed');
  }

  return NextResponse.json({
    data: {
      swipe_id: swipe.id,
      is_match: !!match,
      match: match ?? undefined,
      user_swipe_count: userSwipeCount,
      session_completed: sessionCompleted,
    },
  });
}
