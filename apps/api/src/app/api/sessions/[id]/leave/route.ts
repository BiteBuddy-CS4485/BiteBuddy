import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

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

  // Use admin client — session_members has no DELETE RLS policy
  const admin = createAdminClient();
  const { error } = await admin
    .from('session_members')
    .delete()
    .eq('session_id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: { success: true } });
}
