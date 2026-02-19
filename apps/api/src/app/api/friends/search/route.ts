import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;

  const q = new URL(request.url).searchParams.get('q');

  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', `%${q}%`)
    .neq('id', user.id)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
