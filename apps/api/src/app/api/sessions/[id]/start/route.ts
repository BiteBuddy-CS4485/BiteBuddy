import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;
  const { id } = await params;

  // Verify session exists and user is the creator
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.created_by !== user.id) {
    return NextResponse.json({ error: 'Only the session creator can start it' }, { status: 403 });
  }

  if (session.status !== 'waiting') {
    return NextResponse.json({ error: 'Session has already been started' }, { status: 400 });
  }

  // Update session status to active
  const { error: updateError } = await supabase
    .from('sessions')
    .update({ status: 'active' })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({
    data: { restaurant_count: 0 },
  });
}
