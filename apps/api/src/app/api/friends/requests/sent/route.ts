import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from('friendships')
    .select(`
      *,
      addressee:profiles!addressee_id(*)
    `)
    .eq('requester_id', user.id)
    .eq('status', 'pending');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const requests = data?.map(f => ({
    ...f,
    profile: f.addressee,
  }));

  return NextResponse.json({ data: requests });
}
