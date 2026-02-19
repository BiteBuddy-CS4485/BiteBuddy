import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '../../../../lib/auth';
import { searchRestaurants } from '../../../../lib/yelp';
import { CUISINE_CATEGORIES } from '@bitebuddy/shared';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedClient(request);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const latitude = parseFloat(searchParams.get('latitude') ?? '');
  const longitude = parseFloat(searchParams.get('longitude') ?? '');
  const cuisine = searchParams.get('cuisine') ?? 'all';
  const radius = parseInt(searchParams.get('radius') ?? '5000', 10);

  if (isNaN(latitude) || isNaN(longitude)) {
    return NextResponse.json({ error: 'latitude and longitude are required' }, { status: 400 });
  }

  const category = CUISINE_CATEGORIES.find(c => c.key === cuisine);
  const includedTypes = category ? [...category.googlePlacesTypes] : ['restaurant'];

  try {
    const restaurants = await searchRestaurants({
      latitude,
      longitude,
      radius,
      includedTypes,
    });

    return NextResponse.json({ data: { restaurants } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch restaurants';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
