import { NextRequest, NextResponse } from 'next/server';
import { calculateCentroid, calculateDistance } from '@bitebuddy/shared';
import {
  getSessionWithUsers,
  updateSessionRestaurants,
} from '@/lib/supabase';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

interface Coordinate {
  lat: number;
  lng: number;
}

interface GooglePlacesResult {
  place_id: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  vicinity?: string;
  price_level?: number;
  photos?: Array<{ photo_reference: string }>;
}

interface SessionLocation {
  lat: number;
  lng: number;
  timestamp: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  american: ['american', 'burger', 'bbq', 'steakhouse'],
  italian: ['italian', 'pizza', 'pasta'],
  mexican: ['mexican', 'taco', 'taqueria'],
  chinese: ['chinese', 'dim_sum', 'szechuan'],
  japanese: ['japanese', 'sushi', 'ramen', 'izakaya'],
  thai: ['thai'],
  indian: ['indian'],
  mediterranean: ['mediterranean', 'middle_eastern', 'greek', 'lebanese'],
  korean: ['korean', 'kbbq'],
  vietnamese: ['vietnamese', 'pho'],
  greek: ['greek'],
  french: ['french'],
  spanish: ['spanish', 'tapas'],
};

function normalizeCategory(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized || normalized === 'all' || normalized === 'all_cuisines') {
    return null;
  }
  return normalized;
}

function normalizePriceFilters(priceFilter: unknown): Set<number> {
  const selected = new Set<number>();
  if (!Array.isArray(priceFilter)) return selected;

  for (const value of priceFilter) {
    if (value === '$') selected.add(1);
    if (value === '$$') selected.add(2);
    if (value === '$$$') selected.add(3);
    if (value === '$$$$') selected.add(4);
  }

  return selected;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { search_radius = 1, dietary_restrictions = [], preferences = {} } =
      await request.json();

    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    // Get session and user locations
    const session = await getSessionWithUsers(id, accessToken);

    // Extract valid coordinates from session
    const coordinates: Coordinate[] = Object.values(
      session.user_locations || {}
    ).filter((loc: any): loc is SessionLocation => {
      return loc && typeof loc.lat === 'number' && typeof loc.lng === 'number';
    });

    if (coordinates.length === 0) {
      return NextResponse.json(
        { error: 'No user locations available' },
        { status: 400 }
      );
    }

    // Calculate meeting point
    const centroid = calculateCentroid(coordinates);

    // Always prefer the persisted session filters so the swipe pool matches setup.
    const sessionRadiusKm =
      typeof session.radius_meters === 'number' && session.radius_meters > 0
        ? session.radius_meters / 1000
        : search_radius;
    const categoryFilter = normalizeCategory(session.category_filter);
    const selectedPriceLevels = normalizePriceFilters(session.price_filter);

    // Build Google Places search query
    const cuisineKeywords =
      dietary_restrictions.length > 0 ? dietary_restrictions.join('|') : '';
    const query = new URLSearchParams({
      location: `${centroid.lat},${centroid.lng}`,
      radius: String(Math.round(sessionRadiusKm * 1000)),
      type: 'restaurant',
      key: GOOGLE_PLACES_API_KEY!,
    });

    if (cuisineKeywords) {
      query.append('keyword', cuisineKeywords);
    } else if (categoryFilter) {
      query.append('keyword', categoryFilter.replace(/_/g, ' '));
    }

    const placesResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${query}`
    );

    if (!placesResponse.ok) {
      throw new Error(`Google Places API error: ${placesResponse.status}`);
    }

    const placesData = await placesResponse.json();

    if (placesData.status !== 'OK') {
      console.warn(`Google Places API status: ${placesData.status}`);
      return NextResponse.json(
        { error: `Google Places API: ${placesData.status}` },
        { status: 400 }
      );
    }

    // Filter restaurants based on accessibility and preferences
    const filteredRestaurants = (placesData.results as GooglePlacesResult[]).filter(
      (restaurant) => {
        // Check if all users can reasonably reach this restaurant
        const allUsersReachable = coordinates.every((coord) => {
          const distance = calculateDistance(
            coord.lat,
            coord.lng,
            restaurant.geometry.location.lat,
            restaurant.geometry.location.lng
          );
          // Keep restaurants reasonably close for the full group.
          return distance <= sessionRadiusKm * 2;
        });

        let matchesCategory = true;
        if (categoryFilter) {
          const categoryTokens = CATEGORY_KEYWORDS[categoryFilter] ?? [categoryFilter];
          const restaurantTypes = (restaurant.types ?? []).map((type) => type.toLowerCase());
          matchesCategory = categoryTokens.some((token) => {
            const normalizedToken = token.toLowerCase();
            return restaurantTypes.some((type) => type.includes(normalizedToken));
          });
        }

        let matchesPrice = true;
        if (selectedPriceLevels.size > 0) {
          matchesPrice =
            typeof restaurant.price_level === 'number' &&
            selectedPriceLevels.has(restaurant.price_level);
        }

        // Check rating preference
        const meetsRating =
          !preferences.minRating || (restaurant.rating && restaurant.rating >= preferences.minRating);

        return allUsersReachable && matchesCategory && matchesPrice && meetsRating;
      }
    );

    // Save to session_restaurants table for caching
    await updateSessionRestaurants(id, filteredRestaurants, accessToken);

    return NextResponse.json({
      centroid,
      search_radius: sessionRadiusKm,
      restaurant_count: filteredRestaurants.length,
      restaurants: filteredRestaurants.slice(0, 20), // Return top 20
    });
  } catch (error) {
    console.error('Error discovering restaurants:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to discover restaurants';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
