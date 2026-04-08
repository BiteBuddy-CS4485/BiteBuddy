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

async function parseResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) {
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return null;
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Server error (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json.data;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, { headers });
  return parseResponse(res);
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return parseResponse(res);
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, { method: 'DELETE', headers });
  return parseResponse(res);
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return parseResponse(res);
}

interface DiscoverResponse {
  centroid: { lat: number; lng: number };
  search_radius: number;
  restaurant_count: number;
  restaurants: Array<{
    place_id: string;
    name: string;
    geometry: { location: { lat: number; lng: number } };
    rating?: number;
    vicinity?: string;
  }>;
}

export async function joinSessionWithLocation(
  sessionId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  await apiPost(`/api/sessions/${sessionId}/join`, { latitude, longitude });
}

export async function discoverRestaurants(
  sessionId: string,
  options?: {
    search_radius?: number;
    dietary_restrictions?: string[];
    preferences?: { minRating?: number };
  }
): Promise<DiscoverResponse> {
  return apiPost(`/api/sessions/${sessionId}/discover`, {
    search_radius: options?.search_radius ?? 1,
    dietary_restrictions: options?.dietary_restrictions ?? [],
    preferences: options?.preferences ?? {},
  });
}
