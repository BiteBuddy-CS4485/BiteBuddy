export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  created_by: string;
  name: string;
  status: 'waiting' | 'active' | 'completed';
  latitude: number;
  longitude: number;
  radius_meters: number;
  price_filter: string[] | null;
  category_filter: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionMember {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
}

export interface SessionRestaurant {
  id: string;
  session_id: string;
  yelp_id: string;
  name: string;
  image_url: string | null;
  rating: number | null;
  review_count: number | null;
  price: string | null;
  categories: { alias: string; title: string }[] | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  yelp_url: string | null;
}

export interface Swipe {
  id: string;
  session_id: string;
  user_id: string;
  restaurant_id: string;
  liked: boolean;
  created_at: string;
}

export interface Match {
  id: string;
  session_id: string;
  restaurant_id: string;
  matched_at: string;
}
