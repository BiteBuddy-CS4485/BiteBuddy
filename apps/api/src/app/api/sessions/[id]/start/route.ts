import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '@/lib/auth';
import { searchRestaurants, mapPriceFilter } from '@/lib/yelp';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;
  const { supabase, user } = auth;
  const { id } = await params;

  // Verify session exists and user is the creator
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.created_by !== user.id) {
    return NextResponse.json({ error: 'Only the session creator can start it' }, { status: 403 });
  }

  if (session.status !== 'waiting') {
    return NextResponse.json({ error: 'Session has already been started' }, { status: 400 });
  }

  // Fetch restaurants from Google Places
  const priceLevels = mapPriceFilter(session.price_filter);

  let businesses;
  try {
    businesses = await searchRestaurants({
      latitude: session.latitude,
      longitude: session.longitude,
      radius: session.radius_meters,
      priceLevels,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Google Places API error';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!businesses.length) {
    return NextResponse.json({ error: 'No restaurants found for the given criteria' }, { status: 404 });
  }

  // Insert restaurants into session_restaurants
  const restaurantRows = businesses.map(biz => ({
    session_id: id,
    yelp_id: biz.id,
    name: biz.name,
    image_url: biz.image_url,
    rating: biz.rating,
    review_count: biz.review_count,
    price: biz.price,
    categories: biz.categories,
    address: biz.address,
    latitude: biz.latitude,
    longitude: biz.longitude,
    phone: biz.phone,
    yelp_url: biz.url,
  }));

  const { error: insertError } = await supabase
    .from('session_restaurants')
    .insert(restaurantRows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  // Update session status to active
  const { error: updateError } = await supabase
    .from('sessions')
    .update({ status: 'active' })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({
    data: { restaurant_count: businesses.length },
  });
}
