import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SignupRequest } from '@bitebuddy/shared';

export async function POST(request: NextRequest) {
  const body: SignupRequest = await request.json();
  const { email, password, username, display_name } = body;

  if (!email || !password || !username) {
    return NextResponse.json({ error: 'Email, password, and username are required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: display_name ?? username },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    data: {
      user: data.user,
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
    },
  });
}
