import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedClient } from '../../../../lib/auth';
import { searchRestaurants, PlaceBusiness } from '../../../../lib/yelp';
import { CUISINE_CATEGORIES } from '@bitebuddy/shared';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const discoverCache = new Map<string, { data: PlaceBusiness[]; timestamp: number }>();

function getCacheKey(lat: number, lng: number, cuisine: string, radius: number): string {
  // Round coordinates to ~100m precision to group nearby requests
  const rlat = (Math.round(lat * 1000) / 1000).toFixed(3);
  const rlng = (Math.round(lng * 1000) / 1000).toFixed(3);
  return `${rlat},${rlng},${cuisine},${radius}`;
}

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

  const cacheKey = getCacheKey(latitude, longitude, cuisine, radius);
  const cached = discoverCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ data: { restaurants: cached.data } });
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

    discoverCache.set(cacheKey, { data: restaurants, timestamp: Date.now() });

    return NextResponse.json({ data: { restaurants } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch restaurants';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
