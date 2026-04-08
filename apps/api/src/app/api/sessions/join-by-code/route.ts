import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;

  const { code } = await request.json();
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
  }

  // Use security-definer RPC to look up the session by invite code.
  // This bypasses RLS without requiring the service-role key — the user isn't a member yet.
  const { data: rows, error: sessionError } = await supabase
    .rpc('get_session_by_invite_code', { p_code: code.trim().toUpperCase() });

  const session = rows?.[0];

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  if (session.status === 'active') {
    return NextResponse.json({ error: 'Swiping has already started — you can\'t join mid-session' }, { status: 410 });
  }

  if (session.status === 'completed' || session.status === 'cancelled') {
    return NextResponse.json({ error: 'This session has already ended' }, { status: 410 });
  }

  // RLS "Users can join sessions" allows authenticated users to insert their own membership.
  // Use plain insert; treat duplicate key (23505) as already-a-member, which is fine.
  const { error: joinError } = await supabase
    .from('session_members')
    .insert({ session_id: session.id, user_id: user.id });

  if (joinError && joinError.code !== '23505') {
    return NextResponse.json({ error: joinError.message }, { status: 400 });
  }

  return NextResponse.json({ data: { session_id: session.id, status: session.status } }, { status: 200 });
}
