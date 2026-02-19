import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from './supabase';
import type { SupabaseClient, User } from '@supabase/supabase-js';

type AuthSuccess = { supabase: SupabaseClient; user: User };
type AuthError = { error: NextResponse };

export async function getAuthenticatedClient(
  request: NextRequest
): Promise<AuthSuccess | AuthError> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Missing authorization' }, { status: 401 }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createServerClient(token);

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }

  return { supabase, user };
}
