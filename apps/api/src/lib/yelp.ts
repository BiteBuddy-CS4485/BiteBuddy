const PLACES_BASE_URL = 'https://places.googleapis.com/v1/places:searchNearby';

interface PlacesSearchParams {
  latitude: number;
  longitude: number;
  radius: number;
  priceLevels?: string[];
  limit?: number;
  includedTypes?: string[];
}

export interface PlaceBusiness {
  id: string;
  name: string;
  image_url: string | null;
  rating: number;
  review_count: number;
  price: string | null;
  categories: { alias: string; title: string }[];
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  url: string;
}

// Maps our UI price symbols to Google Places price levels
const PRICE_TO_LEVEL: Record<string, string> = {
  '$': 'PRICE_LEVEL_INEXPENSIVE',
  '$$': 'PRICE_LEVEL_MODERATE',
  '$$$': 'PRICE_LEVEL_EXPENSIVE',
  '$$$$': 'PRICE_LEVEL_VERY_EXPENSIVE',
};

const LEVEL_TO_SYMBOL: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

export function mapPriceFilter(priceFilter: string[] | null | undefined): string[] | undefined {
  if (!priceFilter?.length) return undefined;
  return priceFilter
    .map(p => PRICE_TO_LEVEL[p])
    .filter(Boolean);
}

export async function searchRestaurants(params: PlacesSearchParams): Promise<PlaceBusiness[]> {
  const body: Record<string, unknown> = {
    includedTypes: params.includedTypes ?? ['restaurant'],
    maxResultCount: Math.min(params.limit ?? 20, 20),
    locationRestriction: {
      circle: {
        center: {
          latitude: params.latitude,
          longitude: params.longitude,
        },
        radius: Math.min(params.radius, 50000),
      },
    },
  };

  if (params.priceLevels?.length) {
    body.priceLevels = params.priceLevels;
  }

  const response = await fetch(PLACES_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.rating',
        'places.userRatingCount',
        'places.priceLevel',
        'places.primaryType',
        'places.types',
        'places.photos',
        'places.nationalPhoneNumber',
        'places.googleMapsUri',
      ].join(','),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Places API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const places = data.places ?? [];

  return places.map((place: any) => {
    // Build a photo URL if available
    let imageUrl: string | null = null;
    if (place.photos?.length > 0) {
      const photoName = place.photos[0].name;
      imageUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    }

    // Map types to category-like objects
    const categories = (place.types ?? [])
      .filter((t: string) => t !== 'restaurant' && t !== 'point_of_interest' && t !== 'establishment' && t !== 'food')
      .slice(0, 3)
      .map((t: string) => ({
        alias: t,
        title: t.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      }));

    return {
      id: place.id,
      name: place.displayName?.text ?? 'Unknown',
      image_url: imageUrl,
      rating: place.rating ?? 0,
      review_count: place.userRatingCount ?? 0,
      price: LEVEL_TO_SYMBOL[place.priceLevel] ?? null,
      categories,
      address: place.formattedAddress ?? '',
      latitude: place.location?.latitude ?? 0,
      longitude: place.location?.longitude ?? 0,
      phone: place.nationalPhoneNumber ?? '',
      url: place.googleMapsUri ?? '',
    };
  });
}
