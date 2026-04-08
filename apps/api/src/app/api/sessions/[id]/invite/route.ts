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
  console.log('invite body:', JSON.stringify(body));  // ADD THIS
  console.log('invite session id:', id);              // ADD THIS

  if (!body.user_ids?.length) {
    return NextResponse.json({ error: 'user_ids are required' }, { status: 400 });
  }

  const { data: existingMembers, error: existingError } = await supabase
    .from('session_members')
    .select('user_id')
    .eq('session_id', id)
    .in('user_id', body.user_ids);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  const existingUserIds = new Set((existingMembers ?? []).map((member) => member.user_id));

  const rows = body.user_ids
    .filter((userId) => !existingUserIds.has(userId))
    .map((userId) => ({
      session_id: id,
      user_id: userId,
      invited: true,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const { data, error } = await supabase
    .from('session_members')
    .insert(rows)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
