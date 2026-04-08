import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';
import { storeUserLocation } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;
  const { id } = await params;

  // Parse optional location from request body
  let latitude: number | undefined;
  let longitude: number | undefined;
  try {
    const body = await request.json();
    latitude = body.latitude;
    longitude = body.longitude;
  } catch {
    // No body or invalid JSON — location is optional
  }

  const { data, error } = await supabase
    .from('session_members')
    .upsert({ session_id: id, user_id: user.id }, { onConflict: 'session_id,user_id' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Store location if provided
  if (latitude !== undefined && longitude !== undefined) {
    try {
      const authHeader = request.headers.get('authorization');
      if (authHeader) {
        const accessToken = authHeader.replace('Bearer ', '');
        await storeUserLocation(id, user.id, latitude, longitude, accessToken);
      }
    } catch (locationError) {
      console.warn('Failed to store location:', locationError);
      // Don't fail the join if location storage fails
    }
  }

  return NextResponse.json({ data }, { status: 201 });
}
