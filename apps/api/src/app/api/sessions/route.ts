import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';
import type { CreateSessionRequest } from '@bitebuddy/shared';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;

  const statusFilter = new URL(request.url).searchParams.get('status');

  // Get session IDs where user is a member
  const { data: memberships, error: memberError } = await supabase
    .from('session_members')
    .select('session_id')
    .eq('user_id', user.id);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  const memberSessionIds = memberships?.map(m => m.session_id) ?? [];
  if (memberSessionIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  let query = supabase
    .from('sessions')
    .select('*')
    .in('id', memberSessionIds)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const enrichedSessionIds = data.map((session) => session.id);

  const [{ data: membershipsData }, { data: restaurantsData }, { data: matchesData }, { data: userSwipesData }] = await Promise.all([
    supabase
      .from('session_members')
      .select('session_id, user_id')
      .in('session_id', enrichedSessionIds),
    supabase
      .from('session_restaurants')
      .select('session_id')
      .in('session_id', enrichedSessionIds),
    supabase
      .from('matches')
      .select('session_id')
      .in('session_id', enrichedSessionIds),
    supabase
      .from('swipes')
      .select('session_id, restaurant_id')
      .in('session_id', enrichedSessionIds)
      .eq('user_id', user.id),
  ]);

  const memberCounts: Record<string, number> = {};
  (membershipsData ?? []).forEach((member) => {
    memberCounts[member.session_id] = (memberCounts[member.session_id] ?? 0) + 1;
  });

  const restaurantCounts: Record<string, number> = {};
  (restaurantsData ?? []).forEach((restaurant) => {
    restaurantCounts[restaurant.session_id] = (restaurantCounts[restaurant.session_id] ?? 0) + 1;
  });

  const matchCounts: Record<string, number> = {};
  (matchesData ?? []).forEach((match) => {
    matchCounts[match.session_id] = (matchCounts[match.session_id] ?? 0) + 1;
  });

  const userSwipeCounts: Record<string, number> = {};
  (userSwipesData ?? []).forEach((swipe) => {
    userSwipeCounts[swipe.session_id] = (userSwipeCounts[swipe.session_id] ?? 0) + 1;
  });

  return NextResponse.json({
    data: data.map((session) => {
      const restaurantCount = restaurantCounts[session.id] ?? 0;
      const userSwipeCount = userSwipeCounts[session.id] ?? 0;

      return {
        ...session,
        member_count: memberCounts[session.id] ?? 0,
        restaurant_count: restaurantCount,
        match_count: matchCounts[session.id] ?? 0,
        user_swipe_count: userSwipeCount,
        is_current_user_done: restaurantCount > 0 && userSwipeCount >= restaurantCount,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;

  const body: CreateSessionRequest = await request.json();
  console.log('[POST /api/sessions] body:', JSON.stringify(body));
  console.log('[POST /api/sessions] user.id:', user.id);

  if (!body.name || body.latitude == null || body.longitude == null) {
    console.log('[POST /api/sessions] validation failed - missing fields');
    return NextResponse.json({ error: 'Name, latitude, and longitude are required' }, { status: 400 });
  }

  // Ensure user has a profile (Google OAuth might not trigger the auto-create)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    console.log('[POST /api/sessions] creating missing profile for user:', user.id);
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        username: user.email ?? user.id,
        display_name:
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split('@')[0] ??
          'User',
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      console.log('[POST /api/sessions] profile upsert error:', profileError.message);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }
  }

  // Create the session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      created_by: user.id,
      name: body.name,
      latitude: body.latitude,
      longitude: body.longitude,
      radius_meters: body.radius_meters ?? 5000,
      price_filter: body.price_filter ?? null,
      category_filter: body.category_filter ?? null,
    })
    .select()
    .single();

  if (sessionError) {
    console.log('[POST /api/sessions] supabase insert error:', sessionError.message);
    return NextResponse.json({ error: sessionError.message }, { status: 400 });
  }

  // Auto-add creator as a member
  const { error: membershipError } = await supabase
    .from('session_members')
    .insert({ session_id: session.id, user_id: user.id, invited: false });

  if (membershipError) {
    console.log('[POST /api/sessions] membership insert error:', membershipError.message);

    // Avoid leaving orphan sessions that the creator cannot access.
    await supabase
      .from('sessions')
      .delete()
      .eq('id', session.id);

    return NextResponse.json({ error: membershipError.message }, { status: 400 });
  }

  return NextResponse.json({ data: session }, { status: 201 });
}
