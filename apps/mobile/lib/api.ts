import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json.data;
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json.data;
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json.data;
}

interface Restaurant {
  place_id: string;
  name: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  vicinity?: string;
}

interface DiscoverResponse {
  centroid: { lat: number; lng: number };
  search_radius: number;
  restaurant_count: number;
  restaurants: Restaurant[];
}

/**
 * Join a session with user's current location
 */
export async function joinSessionWithLocation(
  sessionId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  await apiPost(`/api/sessions/${sessionId}/join`, { latitude, longitude });
}

/**
 * Discover restaurants for a session based on all users' locations
 */
export async function discoverRestaurants(
  sessionId: string,
  options?: {
    search_radius?: number; // km
    dietary_restrictions?: string[];
    preferences?: {
      minRating?: number;
    };
  }
): Promise<DiscoverResponse> {
  return apiPost(`/api/sessions/${sessionId}/discover`, {
    search_radius: options?.search_radius ?? 1,
    dietary_restrictions: options?.dietary_restrictions ?? [],
    preferences: options?.preferences ?? {},
  });
}
