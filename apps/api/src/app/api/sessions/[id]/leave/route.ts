import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;
  const { id } = await params;

  // Hosts must cancel instead of leave
  const { data: session } = await supabase
    .from('sessions')
    .select('created_by')
    .eq('id', id)
    .single();

  if (session?.created_by === user.id) {
    return NextResponse.json({ error: 'As the host, use Cancel Session instead of Leave' }, { status: 400 });
  }

  // The "Users can leave sessions" RLS policy (migration 010) allows users to delete their own membership.
  const { error } = await supabase
    .from('session_members')
    .delete()
    .eq('session_id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: { success: true } });
}
