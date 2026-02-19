import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '../../../../lib/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;

  const { supabase, user } = auth;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 50);

  // Get session IDs the user is a member of
  const { data: memberships, error: memErr } = await supabase
    .from('session_members')
    .select('session_id')
    .eq('user_id', user.id);

  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  const sessionIds = (memberships ?? []).map(m => m.session_id);
  if (sessionIds.length === 0) {
    return NextResponse.json({ data: { matches: [] } });
  }

  // Get recent matches with session and restaurant info
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select(`
      id,
      session_id,
      matched_at,
      sessions ( name ),
      session_restaurants ( name, image_url, rating )
    `)
    .in('session_id', sessionIds)
    .order('matched_at', { ascending: false })
    .limit(limit);

  if (matchErr) {
    return NextResponse.json({ error: matchErr.message }, { status: 500 });
  }

  const result = (matches ?? []).map((m: any) => ({
    match_id: m.id,
    session_id: m.session_id,
    session_name: m.sessions?.name ?? 'Unknown Session',
    restaurant_name: m.session_restaurants?.name ?? 'Unknown Restaurant',
    restaurant_image_url: m.session_restaurants?.image_url ?? null,
    restaurant_rating: m.session_restaurants?.rating ?? null,
    matched_at: m.matched_at,
  }));

  return NextResponse.json({ data: { matches: result } });
}
