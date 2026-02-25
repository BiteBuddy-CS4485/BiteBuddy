import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';
import type { UpdateProfileRequest } from '@bitebuddy/shared';

export async function PUT(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;

  const body: UpdateProfileRequest = await request.json();
  const updates: Record<string, string | undefined> = {};

  if (body.username !== undefined) {
    // Only allow setting username if current one is a placeholder
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    if (currentProfile && currentProfile.username.startsWith('user_')) {
      updates.username = body.username;
    }
  }

  if (body.display_name !== undefined) updates.display_name = body.display_name;
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
