import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';
import type { FriendRespondPayload } from '@bitebuddy/shared';

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  const body: FriendRespondPayload = await request.json();

  if (!body.friendship_id || !body.action) {
    return NextResponse.json({ error: 'friendship_id and action are required' }, { status: 400 });
  }

  if (body.action !== 'accept' && body.action !== 'decline') {
    return NextResponse.json({ error: 'Action must be accept or decline' }, { status: 400 });
  }

  const newStatus = body.action === 'accept' ? 'accepted' : 'declined';

  const { data, error } = await supabase
    .from('friendships')
    .update({ status: newStatus })
    .eq('id', body.friendship_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
