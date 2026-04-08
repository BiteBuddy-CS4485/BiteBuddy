import { createClient } from '@supabase/supabase-js';

export function createServerClient(accessToken: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

interface SessionLocation {
  lat: number;
  lng: number;
  timestamp: string;
}

interface SessionParticipant {
  id: string;
  user_locations?: Record<string, SessionLocation>;
}

interface SessionWithUsers {
  id: string;
  participants: SessionParticipant[];
  user_locations: Record<string, SessionLocation>;
}

export async function getSessionWithUsers(
  sessionId: string,
  accessToken: string
): Promise<SessionWithUsers> {
  const client = createServerClient(accessToken);

  const { data: session, error: sessionError } = await client
    .from('sessions')
    .select('*, user_locations')
    .eq('id', sessionId)
    .single();

  if (sessionError) throw sessionError;

  const { data: members, error: membersError } = await client
    .from('session_members')
    .select('user_id')
    .eq('session_id', sessionId);

  if (membersError) throw membersError;

  return {
    id: session.id,
    participants: members.map((m: any) => ({ id: m.user_id })),
    user_locations: session.user_locations || {},
  };
}

export async function storeUserLocation(
  sessionId: string,
  _userId: string,
  latitude: number,
  longitude: number,
  accessToken: string
): Promise<void> {
  const client = createServerClient(accessToken);

  // Uses a security-definer RPC so any session member can write their own
  // location slot without needing UPDATE permission on the sessions table.
  const { error } = await client.rpc('store_user_location', {
    p_session_id: sessionId,
    p_lat:        latitude,
    p_lng:        longitude,
  });

  if (error) throw error;
}
