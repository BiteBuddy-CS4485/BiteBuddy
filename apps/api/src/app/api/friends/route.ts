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
      requester:profiles!requester_id(*),
      addressee:profiles!addressee_id(*)
    `)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const friends = data?.map(f => ({
    ...f,
    profile: f.requester_id === user.id ? f.addressee : f.requester,
  }));

  return NextResponse.json({ data: friends });
}
