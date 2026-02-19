import type { Profile, Friendship, Session, SessionMember, SessionRestaurant, Match } from './database';

// Auth
export interface SignupRequest {
  email: string;
  password: string;
  username: string;
  display_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Profile;
  access_token: string;
  refresh_token: string;
}

// Profile
export interface UpdateProfileRequest {
  display_name?: string;
  avatar_url?: string;
}

// Friends
export interface FriendRequestPayload {
  username: string;
}

export interface FriendRespondPayload {
  friendship_id: string;
  action: 'accept' | 'decline';
}

export interface FriendWithProfile extends Friendship {
  profile: Profile;
}

// Sessions
export interface CreateSessionRequest {
  name: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  price_filter?: string[];
  category_filter?: string;
}

export interface InviteFriendsRequest {
  user_ids: string[];
}

export interface SwipeRequest {
  restaurant_id: string;
  liked: boolean;
}

export interface SwipeResponse {
  swipe_id: string;
  is_match: boolean;
  match?: Match;
}

export interface SessionDetails extends Session {
  members: (SessionMember & { profile: Profile })[];
  restaurant_count: number;
  match_count: number;
}

export interface SessionResults {
  matches: (Match & { restaurant: SessionRestaurant })[];
  total_restaurants: number;
  swipe_progress: Record<string, number>;
}

// Cuisine categories for discovery / filtering
export const CUISINE_CATEGORIES = [
  { key: 'all', label: 'All', googlePlacesTypes: ['restaurant'] },
  { key: 'italian', label: 'Italian', googlePlacesTypes: ['italian_restaurant'] },
  { key: 'mexican', label: 'Mexican', googlePlacesTypes: ['mexican_restaurant'] },
  { key: 'japanese', label: 'Japanese', googlePlacesTypes: ['japanese_restaurant'] },
  { key: 'chinese', label: 'Chinese', googlePlacesTypes: ['chinese_restaurant'] },
  { key: 'thai', label: 'Thai', googlePlacesTypes: ['thai_restaurant'] },
  { key: 'indian', label: 'Indian', googlePlacesTypes: ['indian_restaurant'] },
  { key: 'american', label: 'American', googlePlacesTypes: ['american_restaurant'] },
  { key: 'pizza', label: 'Pizza', googlePlacesTypes: ['pizza_restaurant'] },
  { key: 'seafood', label: 'Seafood', googlePlacesTypes: ['seafood_restaurant'] },
  { key: 'korean', label: 'Korean', googlePlacesTypes: ['korean_restaurant'] },
  { key: 'burgers', label: 'Burgers', googlePlacesTypes: ['hamburger_restaurant'] },
  { key: 'coffee', label: 'Coffee', googlePlacesTypes: ['coffee_shop', 'cafe'] },
] as const;

export type CuisineKey = (typeof CUISINE_CATEGORIES)[number]['key'];

// Discover restaurants — DTO mirrors PlaceBusiness from API
export interface PlaceBusinessDTO {
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

export interface DiscoverRestaurantsResponse {
  restaurants: PlaceBusinessDTO[];
}

// Recent matches
export interface RecentMatchDTO {
  match_id: string;
  session_id: string;
  session_name: string;
  restaurant_name: string;
  restaurant_image_url: string | null;
  restaurant_rating: number | null;
  matched_at: string;
}

export interface RecentMatchesResponse {
  matches: RecentMatchDTO[];
}

// Generic API response wrapper
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}
