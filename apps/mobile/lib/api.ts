import { supabase } from './supabase';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveApiUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').trim();

  // Web can use localhost directly while running in the same browser host machine.
  if (Platform.OS === 'web') {
    return configured;
  }

  try {
    const url = new URL(configured);
    const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (!isLoopback) return configured;

    const hostUri =
      Constants.expoConfig?.hostUri ??
      ((Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost as string | undefined) ??
      '';

    const detectedHost = hostUri.split(':')[0];
    const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(detectedHost);

    if (isIpv4) {
      url.hostname = detectedHost;
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    // Ignore parsing issues and use configured value.
  }

  return configured;
}

const API_URL = resolveApiUrl();

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  return apiRequest<T>(`${API_URL}${path}`, { headers: await getAuthHeaders() });
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(`${API_URL}${path}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(`${API_URL}${path}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function apiRequest<T = unknown>(url: string, init: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any).error ?? 'Request failed');
    return (json as any).data as T;
  } catch (error: any) {
    const isNetworkFailure =
      error instanceof TypeError ||
      /network request failed|failed to fetch/i.test(String(error?.message ?? ''));

    if (isNetworkFailure) {
      throw new Error(
        `Cannot reach API at ${API_URL}. If using Expo Go on a phone, ensure EXPO_PUBLIC_API_URL points to your computer's LAN IP (example: http://192.168.x.x:3000) and the API server is running.`
      );
    }

    throw error;
  }
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
