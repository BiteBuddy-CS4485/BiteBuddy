import { NextRequest, NextResponse } from 'next/server';
import { calculateCentroid, calculateDistance } from '@bitebuddy/shared';
import { getSessionWithUsers } from '@/lib/supabase';

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
}

interface SessionLocation {
  lat: number;
  lng: number;
  timestamp: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { search_radius = 1, dietary_restrictions = [], preferences = {} } =
      await request.json();

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    const session = await getSessionWithUsers(id, accessToken);

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

    const centroid = calculateCentroid(coordinates);

    const cuisineKeywords =
      dietary_restrictions.length > 0 ? dietary_restrictions.join('|') : '';
    const query = new URLSearchParams({
      location: `${centroid.lat},${centroid.lng}`,
      radius: String(search_radius * 1000),
      type: 'restaurant',
      key: GOOGLE_PLACES_API_KEY!,
    });

    if (cuisineKeywords) {
      query.append('keyword', cuisineKeywords);
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

    const filteredRestaurants = (placesData.results as GooglePlacesResult[]).filter(
      (restaurant) => {
        const allUsersReachable = coordinates.every((coord) => {
          const distance = calculateDistance(
            coord.lat,
            coord.lng,
            restaurant.geometry.location.lat,
            restaurant.geometry.location.lng
          );
          return distance < search_radius * 2;
        });

        const meetsRating =
          !preferences.minRating ||
          (restaurant.rating && restaurant.rating >= preferences.minRating);

        return allUsersReachable && meetsRating;
      }
    );

    return NextResponse.json({
      centroid,
      search_radius,
      restaurant_count: filteredRestaurants.length,
      restaurants: filteredRestaurants.slice(0, 20),
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
