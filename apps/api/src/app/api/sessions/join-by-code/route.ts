import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;

  const { code } = await request.json();
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
  }

  // Use admin client to look up the session by code (bypasses RLS — user isn't a member yet)
  const admin = createAdminClient();
  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .select('id, name, status')
    .eq('invite_code', code.trim().toUpperCase())
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  if (session.status === 'completed') {
    return NextResponse.json({ error: 'This session has already ended' }, { status: 410 });
  }

  // Join the session using the user's own client (respects RLS)
  const { error: joinError } = await supabase
    .from('session_members')
    .upsert({ session_id: session.id, user_id: user.id }, { onConflict: 'session_id,user_id' });

  if (joinError) {
    return NextResponse.json({ error: joinError.message }, { status: 400 });
  }

  return NextResponse.json({ data: { session_id: session.id, status: session.status } }, { status: 200 });
}
