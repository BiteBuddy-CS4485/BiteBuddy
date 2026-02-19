import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';
import type { FriendRequestPayload } from '@bitebuddy/shared';

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;

  const body: FriendRequestPayload = await request.json();

  if (!body.username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  // Look up the target user
  const { data: target, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', body.username)
    .single();

  if (lookupError || !target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (target.id === user.id) {
    return NextResponse.json({ error: 'Cannot send friend request to yourself' }, { status: 400 });
  }

  // Check if friendship already exists (in either direction)
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${user.id})`
    )
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: `Friend request already ${existing.status}` }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: target.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
