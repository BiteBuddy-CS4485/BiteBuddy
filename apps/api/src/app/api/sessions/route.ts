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

  const sessionIds = memberships?.map(m => m.session_id) ?? [];
  if (sessionIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  let query = supabase
    .from('sessions')
    .select('*')
    .in('id', sessionIds)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
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
    await supabase.from('profiles').insert({
      id: user.id,
      username: user.email ?? user.id,
      display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User',
    });
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
  await supabase
    .from('session_members')
    .insert({ session_id: session.id, user_id: user.id });

  return NextResponse.json({ data: session }, { status: 201 });
}
