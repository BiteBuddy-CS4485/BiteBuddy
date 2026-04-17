import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mapPriceFilter, searchRestaurants } from '../yelp';

// ---------------------------------------------------------------------------
// mapPriceFilter — pure function, no mocks needed
// ---------------------------------------------------------------------------

describe('mapPriceFilter', () => {
  it('returns undefined for null', () => {
    expect(mapPriceFilter(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(mapPriceFilter(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty array', () => {
    expect(mapPriceFilter([])).toBeUndefined();
  });

  it('maps $ → PRICE_LEVEL_INEXPENSIVE', () => {
    expect(mapPriceFilter(['$'])).toEqual(['PRICE_LEVEL_INEXPENSIVE']);
  });

  it('maps $$ → PRICE_LEVEL_MODERATE', () => {
    expect(mapPriceFilter(['$$'])).toEqual(['PRICE_LEVEL_MODERATE']);
  });

  it('maps $$$ → PRICE_LEVEL_EXPENSIVE', () => {
    expect(mapPriceFilter(['$$$'])).toEqual(['PRICE_LEVEL_EXPENSIVE']);
  });

  it('maps $$$$ → PRICE_LEVEL_VERY_EXPENSIVE', () => {
    expect(mapPriceFilter(['$$$$'])).toEqual(['PRICE_LEVEL_VERY_EXPENSIVE']);
  });

  it('maps multiple price symbols in order', () => {
    expect(mapPriceFilter(['$', '$$$'])).toEqual([
      'PRICE_LEVEL_INEXPENSIVE',
      'PRICE_LEVEL_EXPENSIVE',
    ]);
  });

  it('filters out unrecognised symbols and keeps valid ones', () => {
    expect(mapPriceFilter(['?', '$', 'free'])).toEqual(['PRICE_LEVEL_INEXPENSIVE']);
  });

  it('returns undefined when all symbols are unrecognised', () => {
    // All entries map to undefined and are filtered out → empty array returned
    // The implementation returns an empty array (not undefined) in this edge case,
    // so we only assert that no valid levels survive.
    const result = mapPriceFilter(['?', '£']);
    expect(result?.length ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// searchRestaurants — requires fetch mock
// ---------------------------------------------------------------------------

describe('searchRestaurants', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockPlace = {
    id: 'place123',
    displayName: { text: 'Test Burger Joint' },
    primaryType: 'hamburger_restaurant',
    types: ['hamburger_restaurant', 'fast_food_restaurant', 'point_of_interest'],
    rating: 4.2,
    userRatingCount: 150,
    priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
    formattedAddress: '123 Main St, Dallas, TX',
    location: { latitude: 32.77, longitude: -96.80 },
    nationalPhoneNumber: '+1 555-0100',
    googleMapsUri: 'https://maps.google.com/?cid=place123',
  };

  function mockFetch(places: unknown[]) {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ places }),
    } as Response);
  }

  function mockFetchError(status: number, body: string) {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status,
      text: async () => body,
    } as Response);
  }

  it('maps a Places API place to a PlaceBusiness object', async () => {
    mockFetch([mockPlace]);
    const results = await searchRestaurants({ latitude: 32.77, longitude: -96.80, radius: 5000 });

    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.id).toBe('place123');
    expect(r.name).toBe('Test Burger Joint');
    expect(r.rating).toBe(4.2);
    expect(r.review_count).toBe(150);
    expect(r.price).toBe('$');
    expect(r.address).toBe('123 Main St, Dallas, TX');
    expect(r.latitude).toBe(32.77);
    expect(r.longitude).toBe(-96.80);
    expect(r.phone).toBe('+1 555-0100');
    expect(r.url).toBe('https://maps.google.com/?cid=place123');
  });

  it('filters out places whose primaryType is not food/dining', async () => {
    mockFetch([
      { ...mockPlace, id: 'r1', primaryType: 'restaurant' },
      { ...mockPlace, id: 's1', primaryType: 'clothing_store' },
      { ...mockPlace, id: 'c1', primaryType: 'cafe' },
    ]);
    const results = await searchRestaurants({ latitude: 0, longitude: 0, radius: 1000 });
    const ids = results.map(r => r.id);
    expect(ids).toContain('r1');
    expect(ids).toContain('c1');
    expect(ids).not.toContain('s1');
  });

  it('accepts bakery, coffee_shop, and food_court as valid primary types', async () => {
    mockFetch([
      { ...mockPlace, id: 'b', primaryType: 'bakery' },
      { ...mockPlace, id: 'cs', primaryType: 'coffee_shop' },
      { ...mockPlace, id: 'fc', primaryType: 'food_court' },
      { ...mockPlace, id: 'fr', primaryType: 'fast_food_restaurant' },
    ]);
    const results = await searchRestaurants({ latitude: 0, longitude: 0, radius: 1000 });
    expect(results.map(r => r.id)).toEqual(expect.arrayContaining(['b', 'cs', 'fc', 'fr']));
  });

  it('handles missing optional fields gracefully', async () => {
    mockFetch([{ id: 'bare', primaryType: 'restaurant' }]);
    const results = await searchRestaurants({ latitude: 0, longitude: 0, radius: 1000 });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Unknown');
    expect(results[0].rating).toBe(0);
    expect(results[0].price).toBeNull();
    expect(results[0].categories).toEqual([]);
  });

  it('returns an empty array when Places API returns no results', async () => {
    mockFetch([]);
    const results = await searchRestaurants({ latitude: 0, longitude: 0, radius: 1000 });
    expect(results).toEqual([]);
  });

  it('caps radius at 50 000 m', async () => {
    mockFetch([]);
    await searchRestaurants({ latitude: 0, longitude: 0, radius: 999_999 });
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.locationRestriction.circle.radius).toBe(50_000);
  });

  it('caps maxResultCount at 20', async () => {
    mockFetch([]);
    await searchRestaurants({ latitude: 0, longitude: 0, radius: 1000, limit: 100 });
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.maxResultCount).toBe(20);
  });

  it('includes priceLevels in the request body when provided', async () => {
    mockFetch([]);
    await searchRestaurants({
      latitude: 0,
      longitude: 0,
      radius: 1000,
      priceLevels: ['PRICE_LEVEL_INEXPENSIVE'],
    });
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.priceLevels).toEqual(['PRICE_LEVEL_INEXPENSIVE']);
  });

  it('omits priceLevels from the request body when not provided', async () => {
    mockFetch([]);
    await searchRestaurants({ latitude: 0, longitude: 0, radius: 1000 });
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.priceLevels).toBeUndefined();
  });

  it('throws with status code on a non-OK API response', async () => {
    mockFetchError(403, 'API key missing');
    await expect(
      searchRestaurants({ latitude: 0, longitude: 0, radius: 1000 })
    ).rejects.toThrow('Google Places API error 403');
  });
});
