import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;
  const { id } = await params;

  // Only the creator can cancel
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('created_by, status')
    .eq('id', id)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.created_by !== user.id) {
    return NextResponse.json({ error: 'Only the host can cancel this session' }, { status: 403 });
  }

  if (session.status === 'completed' || session.status === 'cancelled') {
    return NextResponse.json({ error: 'Session is already ended' }, { status: 400 });
  }

  // Use admin client to bypass RLS for the status update
  const admin = createAdminClient();
  const { error } = await admin
    .from('sessions')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: { success: true } });
}
