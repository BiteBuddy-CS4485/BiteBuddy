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
  userId: string,
  latitude: number,
  longitude: number,
  accessToken: string
): Promise<void> {
  const client = createServerClient(accessToken);

  const { data: session, error: fetchError } = await client
    .from('sessions')
    .select('user_locations')
    .eq('id', sessionId)
    .single();

  if (fetchError) throw fetchError;

  const userLocations = session.user_locations || {};
  userLocations[userId] = {
    lat: latitude,
    lng: longitude,
    timestamp: new Date().toISOString(),
  };

  const { error: updateError } = await client
    .from('sessions')
    .update({ user_locations: userLocations })
    .eq('id', sessionId);

  if (updateError) throw updateError;
}

export async function updateSessionRestaurants(
  sessionId: string,
  restaurants: any[],
  accessToken: string
): Promise<void> {
  const client = createServerClient(accessToken);

  await client
    .from('session_restaurants')
    .delete()
    .eq('session_id', sessionId);

  const restaurantsToInsert = restaurants.map((r: any) => ({
    session_id: sessionId,
    yelp_id: r.place_id,
    name: r.name,
    image_url: r.photos?.[0]?.photo_reference
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${r.photos[0].photo_reference}&key=${process.env.GOOGLE_PLACES_API_KEY}`
      : null,
    rating: r.rating || null,
    review_count: r.user_ratings_total || 0,
    price: r.price_level ? '$'.repeat(r.price_level) : null,
    categories: JSON.stringify(r.types || []),
    address: r.vicinity || null,
    latitude: r.geometry.location.lat,
    longitude: r.geometry.location.lng,
    phone: r.formatted_phone_number || null,
    yelp_url: r.url || r.website || null,
  }));

  if (restaurantsToInsert.length > 0) {
    const { error } = await client
      .from('session_restaurants')
      .insert(restaurantsToInsert);

    if (error) throw error;
  }
}
