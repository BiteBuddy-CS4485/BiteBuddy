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

  // Get session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (sessionError) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Get members with profiles
  const { data: members } = await supabase
    .from('session_members')
    .select(`
      *,
      profile:profiles!user_id(*)
    `)
    .eq('session_id', id);

  // Get counts
  const { count: restaurantCount } = await supabase
    .from('session_restaurants')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', id);

  const { count: matchCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', id);

  return NextResponse.json({
    data: {
      ...session,
      members: members ?? [],
      restaurant_count: restaurantCount ?? 0,
      match_count: matchCount ?? 0,
    },
  });
}
