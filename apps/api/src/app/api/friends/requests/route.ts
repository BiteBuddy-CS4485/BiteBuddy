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
      requester:profiles!requester_id(*)
    `)
    .eq('addressee_id', user.id)
    .eq('status', 'pending');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const requests = data?.map(f => ({
    ...f,
    profile: f.requester,
  }));

  return NextResponse.json({ data: requests });
}
