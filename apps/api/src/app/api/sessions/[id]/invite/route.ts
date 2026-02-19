import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';
import type { InviteFriendsRequest } from '@bitebuddy/shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;
  const { id } = await params;

  const body: InviteFriendsRequest = await request.json();

  if (!body.user_ids?.length) {
    return NextResponse.json({ error: 'user_ids are required' }, { status: 400 });
  }

  const rows = body.user_ids.map(userId => ({
    session_id: id,
    user_id: userId,
  }));

  const { data, error } = await supabase
    .from('session_members')
    .upsert(rows, { onConflict: 'session_id,user_id' })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
